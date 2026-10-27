/**
 * Backend integration tests.
 *
 * Runs against an ephemeral in-memory MongoDB — never the configured Atlas
 * database. The suite exercises the real Express app (routing, validation,
 * middleware, controllers, models) through HTTP.
 *
 * Email is never sent: OTP_TEST_CODE pins the code while NODE_ENV=test, and the
 * one delivery-failure test runs with SMTP unconfigured on purpose.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'seva-connect-integration-test-secret';
process.env.OTP_TEST_CODE = '123456';
// Lets resend reach the OTP service without a real mail server; the test branch
// in services/otpService.js returns before any SMTP connection is attempted.
process.env.SMTP_HOST = 'smtp.invalid.test';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const NGO = require('../models/NGO');
const Notification = require('../models/Notification');
const EmailVerification = require('../models/EmailVerification');
const AuditLog = require('../models/AuditLog');
const signToken = require('../utils/generateToken');

const PASSWORD = 'Volunteer123';
const NEW_PASSWORD = 'Volunteer456';
const ADMIN_PASSWORD = 'AdminPass123';

let mongo;
let adminUser;
let adminToken;

async function createUser({ email, name, role = 'volunteer', password = PASSWORD, verified = true }) {
  return User.create({
    name,
    email,
    password,
    role,
    emailVerified: verified,
    emailVerifiedAt: verified ? new Date() : null,
  });
}

async function login(email, password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  adminUser = await createUser({
    email: 'admin@test.local',
    name: 'Test Admin',
    role: 'admin',
    password: ADMIN_PASSWORD,
  });
  const res = await login(adminUser.email, ADMIN_PASSWORD);
  assert.equal(res.status, 200, 'admin login should succeed');
  adminToken = res.body.token;
});

after(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongo) await mongo.stop();
});

/* ------------------------------ Registration ------------------------------ */

test('registration creates an unverified account, sends no token and stores only an OTP hash', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Asha Rao',
    email: 'asha@test.local',
    password: PASSWORD,
    role: 'volunteer',
    acceptTerms: true,
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.equal(res.body.verificationRequired, true);
  assert.equal(res.body.email, 'asha@test.local');
  assert.equal(res.body.token, undefined, 'registration must not auto-login');
  assert.equal(res.body.user, undefined, 'registration must not expose a user payload');
  assert.ok(!JSON.stringify(res.body).includes('123456'), 'response leaked the OTP');

  const user = await User.findOne({ email: 'asha@test.local' });
  assert.ok(user);
  assert.equal(user.emailVerified, false);

  const challenge = await EmailVerification.findOne({ email: 'asha@test.local' }).select('+otpHash');
  assert.ok(challenge, 'a verification challenge should exist');
  assert.match(challenge.otpHash, /^[a-f0-9]{64}$/);
  assert.notEqual(challenge.otpHash, '123456');
  assert.ok(challenge.expiresAt.getTime() > Date.now());

  const rew = await request(app).post('/api/auth/register').send({
    name: 'Asha Rao',
    email: 'asha@test.local',
    password: PASSWORD,
  });
  assert.equal(rew.status, 409);
  assert.equal(rew.body.code, 'EMAIL_NOT_VERIFIED');
});

test('unverified accounts cannot log in, and a forged token is blocked by middleware', async () => {
  const res = await login('asha@test.local', PASSWORD);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');

  const user = await User.findOne({ email: 'asha@test.local' });
  const forged = signToken({ id: user._id }, user);
  const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${forged}`);
  assert.equal(me.status, 403);
  assert.equal(me.body.code, 'EMAIL_NOT_VERIFIED');
});

test('legacy accounts with no emailVerified value can still log in', async () => {
  const legacy = await User.create({
    name: 'Legacy User',
    email: 'legacy@test.local',
    password: PASSWORD,
    role: 'volunteer',
    emailVerified: true,
  });

  // Simulate a document written before the verification field existed.
  await User.collection.updateOne(
    { _id: legacy._id },
    { $unset: { emailVerified: 1, emailVerifiedAt: 1 } }
  );

  const raw = await User.collection.findOne({ _id: legacy._id });
  assert.equal(raw.emailVerified, undefined);

  const hydrated = await User.findById(legacy._id);
  assert.equal(hydrated.emailVerified, undefined, 'schema must not default a missing value');

  const res = await login('legacy@test.local', PASSWORD);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.token);
});

test('OTP verification: wrong code counts an attempt, correct code verifies once', async () => {
  const wrong = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'asha@test.local', otp: '000000' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'OTP_INVALID');
  assert.equal(wrong.body.attemptsRemaining, 4);

  const ok = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'asha@test.local', otp: '123456' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.emailVerified, true);
  assert.ok(!JSON.stringify(ok.body).includes('123456'));

  const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${ok.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'asha@test.local');

  const replay = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'asha@test.local', otp: '123456' });
  assert.equal(replay.status, 400, 'a consumed OTP must not be reusable');
  assert.equal(replay.body.code, 'OTP_INVALID');

  const loggedIn = await login('asha@test.local', PASSWORD);
  assert.equal(loggedIn.status, 200);
  assert.ok(loggedIn.body.token);

  const duplicate = await request(app).post('/api/auth/register').send({
    name: 'Asha Rao',
    email: 'asha@test.local',
    password: PASSWORD,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'EMAIL_TAKEN');
});

/* ------------------------------ OTP abuse -------------------------------- */

test('resend enforces the cooldown and reissuing invalidates the previous code', async () => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Bharat Sen',
    email: 'bharat@test.local',
    password: PASSWORD,
  });
  assert.equal(reg.status, 201);

  const resend = await request(app)
    .post('/api/auth/resend-verification')
    .send({ email: 'bharat@test.local' });
  assert.equal(resend.status, 429);
  assert.equal(resend.body.code, 'OTP_COOLDOWN');

  const unknown = await request(app)
    .post('/api/auth/resend-verification')
    .send({ email: 'nobody@test.local' });
  assert.equal(unknown.status, 200, 'unknown addresses must get a generic response');
  assert.match(unknown.body.message, /if that address/i);
});

test('five wrong attempts lock the challenge and even the right code is refused', async () => {
  for (let i = 1; i <= 4; i += 1) {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'bharat@test.local', otp: '000001' });
    assert.equal(res.status, 400, `attempt ${i}`);
    assert.equal(res.body.code, 'OTP_INVALID');
    assert.equal(res.body.attemptsRemaining, 5 - i);
  }

  const fifth = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'bharat@test.local', otp: '000001' });
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.code, 'OTP_LOCKED');

  const correct = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'bharat@test.local', otp: '123456' });
  // The burned challenge is gone, so the code can no longer be used. A fresh
  // code is required (after the resend cooldown).
  assert.equal(correct.status, 400);
  assert.equal(correct.body.code, 'OTP_INVALID');

  const user = await User.findOne({ email: 'bharat@test.local' });
  assert.equal(user.emailVerified, false);
});

test('expired codes are rejected and consumed', async () => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Chitra Das',
    email: 'chitra@test.local',
    password: PASSWORD,
  });
  assert.equal(reg.status, 201);

  await EmailVerification.updateOne(
    { email: 'chitra@test.local', consumedAt: null },
    { $set: { expiresAt: new Date(Date.now() - 1000) } }
  );

  const res = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'chitra@test.local', otp: '123456' });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'OTP_EXPIRED');

  const challenge = await EmailVerification.findOne({ email: 'chitra@test.local' });
  assert.ok(challenge.consumedAt, 'expired challenge should be burned');
});

test('when email delivery is unavailable, registration fails clearly and leaves no account', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSmtpHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  process.env.NODE_ENV = 'development';

  try {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dev Failure',
      email: 'delivery-failure@test.local',
      password: PASSWORD,
    });

    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'EMAIL_DELIVERY_FAILED');
    assert.equal(await User.countDocuments({ email: 'delivery-failure@test.local' }), 0);
    assert.equal(await EmailVerification.countDocuments({ email: 'delivery-failure@test.local' }), 0);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSmtpHost) process.env.SMTP_HOST = previousSmtpHost;
  }
});

/* --------------------------- RBAC & oversight ---------------------------- */

test('admin endpoints reject anonymous and volunteer callers', async () => {
  const anonymous = await request(app).get('/api/admin/overview');
  assert.equal(anonymous.status, 401);

  const volunteerLogin = await login('asha@test.local', PASSWORD);
  assert.equal(volunteerLogin.status, 200);
  const volunteer = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', `Bearer ${volunteerLogin.body.token}`);
  assert.equal(volunteer.status, 403);

  const admin = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(admin.status, 200);
  assert.equal(admin.body.success, true);
  assert.ok(admin.body.data.users);
  assert.ok(admin.body.data.charts);
});

test('suspend/reactivate invalidates sessions and is recorded in the audit log', async () => {
  const volunteer = await User.findOne({ email: 'asha@test.local' });
  const session = await login('asha@test.local', PASSWORD);
  assert.equal(session.status, 200);
  const token = session.body.token;

  const suspended = await request(app)
    .patch(`/api/admin/users/${volunteer._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ accountStatus: 'suspended' });
  assert.equal(suspended.status, 200);

  const blocked = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'ACCOUNT_SUSPENDED');

  const deniedLogin = await login('asha@test.local', PASSWORD);
  assert.equal(deniedLogin.status, 403);
  assert.equal(deniedLogin.body.code, 'ACCOUNT_SUSPENDED');

  const audit = await request(app)
    .get('/api/admin/audit?action=user.suspended')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.data.length >= 1, 'suspension should be audited');
  const entry = audit.body.data.find((item) => String(item.entityId) === String(volunteer._id));
  assert.ok(entry);
  assert.equal(entry.actorRole, 'admin');

  const active = await request(app)
    .patch(`/api/admin/users/${volunteer._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ accountStatus: 'active' });
  assert.equal(active.status, 200);

  const restored = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
  assert.equal(restored.status, 200);
});

test('administrators cannot change their own status or role', async () => {
  const selfStatus = await request(app)
    .patch(`/api/admin/users/${adminUser._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ accountStatus: 'suspended' });
  assert.equal(selfStatus.status, 400);

  const selfRole = await request(app)
    .patch(`/api/admin/users/${adminUser._id}/role`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'volunteer' });
  assert.equal(selfRole.status, 400);
  assert.equal(selfRole.body.code, 'SELF_ROLE');
});

test('repeating an NGO verification decision does not duplicate notifications or audit entries', async () => {
  const owner = await createUser({
    email: 'owner@test.local',
    name: 'NGO Owner',
    role: 'ngo',
  });
  const ngo = await NGO.create({
    organizationName: 'Green Hands',
    description: 'Community clean-ups',
    location: 'Pune',
    contactEmail: 'owner@test.local',
    createdBy: owner._id,
    verified: false,
  });

  const first = await request(app)
    .patch(`/api/admin/ngos/${ngo._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ verified: true });
  assert.equal(first.status, 200, JSON.stringify(first.body));

  const second = await request(app)
    .patch(`/api/admin/ngos/${ngo._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ verified: true });
  assert.equal(second.status, 200);
  assert.match(second.body.message, /already verified/i);

  const notifications = await Notification.countDocuments({
    recipient: owner._id,
    title: 'Organisation verified',
  });
  assert.equal(notifications, 1, 'the same decision must not notify twice');

  const audits = await AuditLog.countDocuments({
    action: 'ngo.verified',
    entityId: ngo._id,
  });
  assert.equal(audits, 1, 'the same decision must not be audited twice');
});

test('changing the password invalidates old tokens and issues a working fresh one', async () => {
  const session = await login('asha@test.local', PASSWORD);
  assert.equal(session.status, 200);

  const changed = await request(app)
    .put('/api/auth/password')
    .set('Authorization', `Bearer ${session.body.token}`)
    .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.ok(changed.body.token);

  const stale = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${session.body.token}`);
  assert.equal(stale.status, 401);
  assert.equal(stale.body.code, 'SESSION_INVALID');

  const fresh = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${changed.body.token}`);
  assert.equal(fresh.status, 200);

  const oldPassword = await login('asha@test.local', PASSWORD);
  assert.equal(oldPassword.status, 401);
  const newPassword = await login('asha@test.local', NEW_PASSWORD);
  assert.equal(newPassword.status, 200);
});

/* -------------------------- Admin read surfaces -------------------------- */

test('every admin read endpoint responds with its documented shape', async () => {
  const endpoints = [
    '/api/admin/overview',
    '/api/admin/users?page=1&limit=2',
    '/api/admin/volunteers?page=1&limit=2',
    '/api/admin/ngos?page=1&limit=2',
    '/api/admin/events?page=1&limit=2',
    '/api/admin/applications?page=1&limit=2',
    '/api/admin/announcements?page=1&limit=2',
    '/api/admin/audit?page=1&limit=2',
    '/api/admin/settings',
    '/api/admin/security',
  ];

  for (const path of endpoints) {
    const res = await request(app).get(path).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200, `${path} -> ${res.status} ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true, path);
  }

  const overview = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.ok(overview.body.data.users);
  assert.ok(overview.body.data.charts);
  assert.ok(Array.isArray(overview.body.data.recentActivity));

  const report = await request(app)
    .get('/api/admin/reports')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.ok(report.body.data.range.from);
  assert.ok(Array.isArray(report.body.data.series));

  const security = await request(app)
    .get('/api/admin/security')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(security.body.data.email, adminUser.email);
  assert.equal(typeof security.body.data.tokenVersion, 'number');

  const csv = await request(app)
    .get('/api/admin/export?type=users&from=2026-01-01&to=2026-12-31')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text.split('\n')[0], /email/i);
});

/* ---------------------------- Public surfaces ---------------------------- */

test('public settings and announcements are readable without authentication', async () => {
  const settings = await request(app).get('/api/settings');
  assert.equal(settings.status, 200);
  assert.equal(typeof settings.body.data.registrationOpen, 'boolean');
  assert.equal(settings.body.data.smtp, undefined, 'public settings must not expose mail config');
  assert.equal(settings.body.data.jwtSecret, undefined);

  const announcements = await request(app).get('/api/announcements');
  assert.equal(announcements.status, 200);
  assert.ok(Array.isArray(announcements.body.data));
});
