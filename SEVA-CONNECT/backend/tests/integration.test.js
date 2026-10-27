/**
 * Backend integration tests.
 *
 * Runs against an ephemeral in-memory MongoDB — never the configured Atlas
 * database. The suite exercises the real Express app (routing, validation,
 * middleware, controllers, models) through HTTP.
 *
 * Email is never sent. The pinned OTP code is enabled only by three explicit
 * switches (NODE_ENV=test, ALLOW_OTP_TEST_CODE=true, OTP_TEST_CODE=123456).
 * Google's verifier is replaced in-process for the Google tests; there is no
 * production bypass in the application code.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'seva-connect-integration-test-secret';
process.env.OTP_TEST_CODE = '123456';
process.env.ALLOW_OTP_TEST_CODE = 'true';
// Lets resend reach the OTP service without a real mail server; the test branch
// in services/otpService.js returns before any SMTP connection is attempted.
process.env.SMTP_HOST = 'smtp.invalid.test';
// The verifier is stubbed in the Google tests; this only satisfies the
// "is Google configured?" check in the controller.
process.env.GOOGLE_CLIENT_ID = '1234567890-test.apps.googleusercontent.com';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
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
const googleAuth = require('../services/googleAuth');
const { isTestOtpEnabled, generateOtp } = require('../services/otpService');

const PASSWORD = 'Volunteer123';
const NEW_PASSWORD = 'Volunteer456';
const ADMIN_PASSWORD = 'AdminPass123';
const FIXED_OTP = '123456';

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

async function register(payload) {
  return request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test User',
      password: PASSWORD,
      acceptTerms: true,
      ...payload,
    });
}

async function verify(email, otp = FIXED_OTP) {
  return request(app).post('/api/auth/verify-email').send({ email, otp });
}

async function resend(email) {
  return request(app).post('/api/auth/resend-verification').send({ email });
}

async function backdateCooldown(email) {
  await EmailVerification.updateMany(
    { email },
    { $set: { lastSentAt: new Date(Date.now() - 2 * 60 * 1000) } }
  );
}

async function withGoogleVerifier(result, fn) {
  const original = googleAuth.verifyGoogleIdToken;
  googleAuth.verifyGoogleIdToken = async () => result;
  try {
    return await fn();
  } finally {
    googleAuth.verifyGoogleIdToken = original;
  }
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Make sure unique indexes (email, sparse googleId) exist before the
  // concurrency tests run.
  await User.init();
  await EmailVerification.init();

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

test('registration stores only a pending record and never creates a User', async () => {
  const res = await register({
    name: 'Asha Rao',
    email: 'Asha@Test.Local',
    password: PASSWORD,
    role: 'volunteer',
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.equal(res.body.verificationRequired, true);
  assert.equal(res.body.email, 'asha@test.local', 'email must be normalised');
  assert.equal(res.body.token, undefined, 'registration must not auto-login');
  assert.equal(res.body.user, undefined, 'registration must not expose a user payload');
  assert.ok(!JSON.stringify(res.body).includes(FIXED_OTP), 'response leaked the OTP');
  assert.ok(!JSON.stringify(res.body).includes(PASSWORD), 'response leaked the password');

  assert.equal(
    await User.countDocuments({ email: 'asha@test.local' }),
    0,
    'no account may exist before OTP verification'
  );

  const challenge = await EmailVerification.findOne({ email: 'asha@test.local' }).select('+otpHash');
  assert.ok(challenge, 'a verification challenge should exist');
  assert.match(challenge.otpHash, /^[a-f0-9]{64}$/);
  assert.notEqual(challenge.otpHash, FIXED_OTP);
  assert.ok(challenge.expiresAt.getTime() > Date.now());
  assert.equal(challenge.pendingRegistration.name, 'Asha Rao');
  assert.equal(challenge.pendingRegistration.role, 'volunteer');
  assert.ok(challenge.pendingRegistration.termsAcceptedAt, 'terms acceptance must be recorded');
  assert.match(challenge.pendingRegistration.passwordHash, /^\$2[aby]\$/, 'password must be bcrypt-hashed');
  assert.ok(
    await bcrypt.compare(PASSWORD, challenge.pendingRegistration.passwordHash),
    'the pending hash must match the submitted password'
  );

  const duplicate = await register({ name: 'Asha Rao', email: 'asha@test.local' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(duplicate.body.verificationRequired, true);
});

test('registration validates the email, password and terms on the server', async () => {
  const noTerms = await request(app).post('/api/auth/register').send({
    name: 'No Terms',
    email: 'noterms@test.local',
    password: PASSWORD,
  });
  assert.equal(noTerms.status, 400, JSON.stringify(noTerms.body));

  const badEmail = await register({ name: 'Bad Email', email: 'not-an-email' });
  assert.equal(badEmail.status, 400);

  const shortPassword = await register({
    name: 'Short Password',
    email: 'short@test.local',
    password: '123',
  });
  assert.equal(shortPassword.status, 400);
});

test('unverified accounts cannot log in, and a forged token is blocked by middleware', async () => {
  const blocked = await createUser({
    email: 'blocked@test.local',
    name: 'Blocked User',
    verified: false,
  });

  const res = await login('blocked@test.local', PASSWORD);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');

  const forged = signToken({ id: blocked._id }, blocked);
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

test('OTP verification creates the account once, then the same code is dead', async () => {
  const wrong = await verify('asha@test.local', '000000');
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'OTP_INVALID');
  assert.equal(wrong.body.attemptsRemaining, 4);

  assert.equal(await User.countDocuments({ email: 'asha@test.local' }), 0);

  const ok = await verify('asha@test.local');
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.email, 'asha@test.local');
  assert.equal(ok.body.user.emailVerified, true);
  assert.ok(ok.body.user.termsAcceptedAt);
  assert.ok(!JSON.stringify(ok.body).includes(FIXED_OTP));

  const users = await User.find({ email: 'asha@test.local' });
  assert.equal(users.length, 1, 'verification must create exactly one account');
  assert.equal(users[0].role, 'volunteer');
  assert.ok(await bcrypt.compare(PASSWORD, await User.findById(users[0]._id).select('+password').then((u) => u.password)));

  const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${ok.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'asha@test.local');

  const replay = await verify('asha@test.local');
  assert.equal(replay.status, 400, 'a consumed OTP must not be reusable');
  assert.equal(replay.body.code, 'OTP_INVALID');

  const loggedIn = await login('asha@test.local', PASSWORD);
  assert.equal(loggedIn.status, 200);
  assert.ok(loggedIn.body.token);

  const duplicate = await register({ name: 'Asha Rao', email: 'asha@test.local' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'EMAIL_TAKEN');
});

/* ------------------------------ OTP abuse -------------------------------- */

test('resend enforces the cooldown and unknown addresses get a generic answer', async () => {
  const reg = await register({ name: 'Bharat Sen', email: 'bharat@test.local' });
  assert.equal(reg.status, 201);
  assert.equal(await User.countDocuments({ email: 'bharat@test.local' }), 0);

  const immediate = await resend('bharat@test.local');
  assert.equal(immediate.status, 429);
  assert.equal(immediate.body.code, 'OTP_COOLDOWN');
  assert.ok(immediate.body.retryAfter > 0);

  const unknown = await resend('nobody@test.local');
  assert.equal(unknown.status, 200, 'unknown addresses must get a generic response');
  assert.match(unknown.body.message, /if that address/i);
});

test('resending invalidates the old challenge and preserves pending details', async () => {
  const reg = await register({
    name: 'Resend User',
    email: 'resend@test.local',
    role: 'ngo',
    skills: ['Teaching'],
  });
  assert.equal(reg.status, 201);

  const before = await EmailVerification.findOne({
    email: 'resend@test.local',
    consumedAt: null,
  });
  assert.ok(before);
  const hashBefore = before.pendingRegistration.passwordHash;

  await backdateCooldown('resend@test.local');
  const resent = await resend('resend@test.local');
  assert.equal(resent.status, 200, JSON.stringify(resent.body));

  const open = await EmailVerification.find({ email: 'resend@test.local', consumedAt: null });
  assert.equal(open.length, 1, 'only one challenge may remain usable');
  assert.equal(open[0].pendingRegistration.name, 'Resend User');
  assert.equal(open[0].pendingRegistration.role, 'ngo');
  assert.equal(open[0].pendingRegistration.passwordHash, hashBefore);
  assert.equal(await EmailVerification.countDocuments({ email: 'resend@test.local', consumedAt: { $ne: null } }), 1);

  const ok = await verify('resend@test.local');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'ngo');
});

test('five wrong attempts lock the challenge and even the right code is refused', async () => {
  for (let i = 1; i <= 4; i += 1) {
    const res = await verify('bharat@test.local', '000001');
    assert.equal(res.status, 400, `attempt ${i}`);
    assert.equal(res.body.code, 'OTP_INVALID');
    assert.equal(res.body.attemptsRemaining, 5 - i);
  }

  const fifth = await verify('bharat@test.local', '000001');
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.code, 'OTP_LOCKED');

  const correct = await verify('bharat@test.local');
  // The burned challenge is gone, so the code can no longer be used. A fresh
  // code is required (after the resend cooldown).
  assert.equal(correct.status, 400);
  assert.equal(correct.body.code, 'OTP_INVALID');

  assert.equal(await User.countDocuments({ email: 'bharat@test.local' }), 0);
});

test('expired codes are rejected and consumed', async () => {
  const reg = await register({ name: 'Chitra Das', email: 'chitra@test.local' });
  assert.equal(reg.status, 201);

  await EmailVerification.updateOne(
    { email: 'chitra@test.local', consumedAt: null },
    { $set: { expiresAt: new Date(Date.now() - 1000) } }
  );

  const res = await verify('chitra@test.local');
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'OTP_EXPIRED');

  const challenge = await EmailVerification.findOne({ email: 'chitra@test.local' });
  assert.ok(challenge.consumedAt, 'expired challenge should be burned');
  assert.equal(await User.countDocuments({ email: 'chitra@test.local' }), 0);
});

test('the hourly send cap stops resend abuse', async () => {
  const previous = process.env.OTP_MAX_SENDS_PER_HOUR;
  process.env.OTP_MAX_SENDS_PER_HOUR = '3';
  try {
    const reg = await register({ name: 'Rate User', email: 'rate@test.local' });
    assert.equal(reg.status, 201);

    for (let i = 0; i < 2; i += 1) {
      await backdateCooldown('rate@test.local');
      const ok = await resend('rate@test.local');
      assert.equal(ok.status, 200, `resend ${i + 1}: ${JSON.stringify(ok.body)}`);
    }

    await backdateCooldown('rate@test.local');
    const limited = await resend('rate@test.local');
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, 'OTP_RATE_LIMITED');
    assert.ok(limited.body.retryAfter > 0);
  } finally {
    if (previous === undefined) delete process.env.OTP_MAX_SENDS_PER_HOUR;
    else process.env.OTP_MAX_SENDS_PER_HOUR = previous;
  }
});

/* ---------------------------- Concurrency -------------------------------- */

test('concurrent registrations leave no account and only one usable challenge', async () => {
  const payload = {
    name: 'Race User',
    email: 'race@test.local',
    password: PASSWORD,
    acceptTerms: true,
  };

  const [first, second] = await Promise.all([
    request(app).post('/api/auth/register').send(payload),
    request(app).post('/api/auth/register').send(payload),
  ]);

  for (const res of [first, second]) {
    assert.ok(
      [201, 409, 429].includes(res.status),
      `unexpected concurrent registration status ${res.status}: ${JSON.stringify(res.body)}`
    );
  }
  assert.ok([first, second].some((res) => res.status === 201), 'one request should succeed');

  assert.equal(
    await User.countDocuments({ email: 'race@test.local' }),
    0,
    'no duplicate or half-created account may exist'
  );

  const open = await EmailVerification.find({ email: 'race@test.local', consumedAt: null });
  assert.ok(open.length >= 1, 'at least one usable challenge must remain');

  // Two simultaneous verifications of the pinned code must create exactly one
  // account and return exactly one authenticated response.
  const [v1, v2] = await Promise.all([
    verify('race@test.local'),
    verify('race@test.local'),
  ]);
  const successes = [v1, v2].filter((res) => res.status === 200);
  assert.equal(successes.length, 1, `expected one success, got ${v1.status}/${v2.status}`);
  assert.equal(await User.countDocuments({ email: 'race@test.local' }), 1);

  const openAfter = await EmailVerification.countDocuments({
    email: 'race@test.local',
    consumedAt: null,
  });
  assert.equal(openAfter, 0, 'verification must burn every open challenge for the address');
});

test('when email delivery is unavailable, registration fails clearly and leaves nothing behind', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSmtpHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  process.env.NODE_ENV = 'development';

  try {
    const res = await register({ name: 'Dev Failure', email: 'delivery-failure@test.local' });

    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'EMAIL_DELIVERY_FAILED');
    assert.equal(await User.countDocuments({ email: 'delivery-failure@test.local' }), 0);
    assert.equal(await EmailVerification.countDocuments({ email: 'delivery-failure@test.local' }), 0);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSmtpHost) process.env.SMTP_HOST = previousSmtpHost;
  }
});

test('the test OTP bypass requires test mode plus an explicit opt-in', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllow = process.env.ALLOW_OTP_TEST_CODE;

  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_OTP_TEST_CODE = 'true';
    assert.equal(isTestOtpEnabled(), false, 'production must never accept the pinned code');

    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_OTP_TEST_CODE;
    assert.equal(isTestOtpEnabled(), false, 'NODE_ENV=test alone must not enable the bypass');

    process.env.ALLOW_OTP_TEST_CODE = 'true';
    assert.equal(isTestOtpEnabled(), true);
    assert.equal(generateOtp(), FIXED_OTP);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAllow === undefined) delete process.env.ALLOW_OTP_TEST_CODE;
    else process.env.ALLOW_OTP_TEST_CODE = previousAllow;
  }
});

/* -------------------------------- Google --------------------------------- */

const GOOGLE_PROFILE = {
  sub: 'google-sub-001',
  email: 'google.user@test.local',
  name: 'Google User',
  picture: 'https://example.com/avatar.png',
  emailVerified: true,
};

function googleRequest(payload = {}) {
  return request(app)
    .post('/api/auth/google')
    .send({ credential: 'g'.repeat(64), nonce: 'test-nonce', ...payload });
}

test('Google signup creates a verified volunteer without an email OTP', async () => {
  const res = await withGoogleVerifier({ status: 'ok', profile: GOOGLE_PROFILE }, () =>
    googleRequest()
  );

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.token);
  assert.equal(res.body.isNewUser, true);
  assert.equal(res.body.user.email, GOOGLE_PROFILE.email);
  assert.equal(res.body.user.role, 'volunteer', 'Google signup must never grant admin');
  assert.equal(res.body.user.emailVerified, true);
  assert.equal(res.body.user.googleLinked, true);
  assert.equal(res.body.user.googleId, undefined, 'Google subject must not be serialized');
  assert.equal(
    await EmailVerification.countDocuments({ email: GOOGLE_PROFILE.email }),
    0,
    'Google signup must not create an email OTP challenge'
  );

  const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${res.body.token}`);
  assert.equal(me.status, 200);

  const again = await withGoogleVerifier({ status: 'ok', profile: GOOGLE_PROFILE }, () =>
    googleRequest()
  );
  assert.equal(again.status, 200);
  assert.equal(again.body.isNewUser, false);
  assert.equal(again.body.user._id, res.body.user._id);

  const passwordAttempt = await login(GOOGLE_PROFILE.email, PASSWORD);
  assert.equal(passwordAttempt.status, 401);
  assert.equal(passwordAttempt.body.code, 'INVALID_CREDENTIALS');
});

test('Google rejects invalid, expired and unverified-email credentials', async () => {
  const invalid = await withGoogleVerifier({ status: 'invalid', reason: 'signature_or_claims' }, () =>
    googleRequest()
  );
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, 'GOOGLE_INVALID_CREDENTIAL');

  const expired = await withGoogleVerifier({ status: 'expired' }, () => googleRequest());
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'GOOGLE_TOKEN_EXPIRED');

  const unverified = await withGoogleVerifier({ status: 'email_unverified' }, () => googleRequest());
  assert.equal(unverified.status, 403);
  assert.equal(unverified.body.code, 'GOOGLE_EMAIL_UNVERIFIED');

  const malformed = await request(app).post('/api/auth/google').send({ credential: 'short' });
  assert.equal(malformed.status, 400);
});

test('Google never auto-links an existing password account by email', async () => {
  await createUser({
    email: 'password.owner@test.local',
    name: 'Password Owner',
    role: 'ngo',
  });

  const profile = {
    ...GOOGLE_PROFILE,
    sub: 'google-sub-password',
    email: 'password.owner@test.local',
  };

  const res = await withGoogleVerifier({ status: 'ok', profile }, () => googleRequest());
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'GOOGLE_LINK_REQUIRED');
  assert.equal(res.body.token, undefined);

  const owner = await User.findOne({ email: 'password.owner@test.local' });
  assert.equal(owner.googleId, undefined, 'no Google identity may be attached automatically');
  assert.equal(owner.role, 'ngo');
});

test('an authenticated user can link Google, and the existing role is preserved', async () => {
  const owner = await createUser({
    email: 'link.me@test.local',
    name: 'Link Me',
    role: 'ngo',
  });

  const session = await login('link.me@test.local', PASSWORD);
  assert.equal(session.status, 200);

  const profile = {
    ...GOOGLE_PROFILE,
    sub: 'google-sub-link',
    email: 'link.me@test.local',
  };

  const linked = await withGoogleVerifier({ status: 'ok', profile }, () =>
    request(app)
      .post('/api/auth/google/link')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ credential: 'g'.repeat(64), nonce: 'test-nonce' })
  );
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.user.googleLinked, true);

  const stored = await User.findById(owner._id);
  assert.equal(stored.googleId, 'google-sub-link');

  const googleLogin = await withGoogleVerifier({ status: 'ok', profile }, () => googleRequest());
  assert.equal(googleLogin.status, 200);
  assert.equal(googleLogin.body.user.role, 'ngo', 'linking must preserve the existing role');
  assert.equal(googleLogin.body.isNewUser, false);
});

test('Google linking rejects a different email and unauthorised callers', async () => {
  const session = await login('link.me@test.local', PASSWORD);
  const profile = {
    ...GOOGLE_PROFILE,
    sub: 'google-sub-other',
    email: 'someone.else@test.local',
  };

  const mismatch = await withGoogleVerifier({ status: 'ok', profile }, () =>
    request(app)
      .post('/api/auth/google/link')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ credential: 'g'.repeat(64) })
  );
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.body.code, 'GOOGLE_EMAIL_MISMATCH');

  const anonymous = await request(app)
    .post('/api/auth/google/link')
    .send({ credential: 'g'.repeat(64) });
  assert.equal(anonymous.status, 401);
});

test('concurrent Google signups create one account', async () => {
  const profile = {
    ...GOOGLE_PROFILE,
    sub: 'google-sub-race',
    email: 'google.race@test.local',
  };

  const original = googleAuth.verifyGoogleIdToken;
  googleAuth.verifyGoogleIdToken = async () => ({ status: 'ok', profile });
  try {
    const [first, second] = await Promise.all([googleRequest(), googleRequest()]);

    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(await User.countDocuments({ email: 'google.race@test.local' }), 1);
  } finally {
    googleAuth.verifyGoogleIdToken = original;
  }
});

/* --------------------------- Sessions & RBAC ----------------------------- */

test('logout invalidates the current token', async () => {
  await createUser({ email: 'logout@test.local', name: 'Logout User' });
  const session = await login('logout@test.local', PASSWORD);
  assert.equal(session.status, 200);

  const out = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${session.body.token}`)
    .send({});
  assert.equal(out.status, 200);

  const stale = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${session.body.token}`);
  assert.equal(stale.status, 401);
  assert.equal(stale.body.code, 'SESSION_INVALID');
});

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
