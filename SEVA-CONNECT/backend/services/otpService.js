/**
 * Email OTP service.
 *
 * Security properties:
 *  - cryptographically random 6-digit codes (crypto.randomInt)
 *  - only an HMAC-SHA256 digest is stored
 *  - 5-minute default expiry, enforced server-side on every check
 *  - one active challenge per address; issuing a new one invalidates the old
 *  - 5 verification attempts per challenge
 *  - 60-second resend cooldown and a rolling hourly send cap
 *  - single-use: a successful verification atomically consumes the challenge
 */
const crypto = require('crypto');
const EmailVerification = require('../models/EmailVerification');
const { normalizeEmail } = require('../utils/email');
const { sendMail } = require('./mailer');

const DEFAULT_TTL_MINUTES = 5;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function ttlMs() {
  const minutes = Number(process.env.OTP_TTL_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_TTL_MINUTES) * 60 * 1000;
}

function cooldownMs() {
  const seconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RESEND_COOLDOWN_SECONDS) * 1000;
}

function maxSendsPerHour() {
  const value = Number(process.env.OTP_MAX_SENDS_PER_HOUR);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_SENDS_PER_HOUR;
}

function pepper() {
  return process.env.OTP_PEPPER || process.env.JWT_SECRET || '';
}

function hashOtp(email, otp) {
  return crypto
    .createHmac('sha256', pepper())
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'hex');
  const right = Buffer.from(String(b), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function generateOtp() {
  // Automated tests may pin a code; this branch is unreachable in production.
  if (process.env.NODE_ENV === 'test' && /^\d{6}$/.test(process.env.OTP_TEST_CODE || '')) {
    return process.env.OTP_TEST_CODE;
  }
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function otpEmail({ name, otp, minutes }) {
  const safeName = String(name || 'there').replace(/[<>&]/g, '');
  return {
    subject: 'Your Seva Connect verification code',
    text:
      `Hello ${safeName},\n\n` +
      `Your Seva Connect verification code is ${otp}.\n` +
      `It expires in ${minutes} minutes and can be used once.\n\n` +
      `If you did not create an account, you can ignore this email.\n`,
    html:
      `<p>Hello ${safeName},</p>` +
      `<p>Your Seva Connect verification code is:</p>` +
      `<p style="font-size:28px;letter-spacing:6px;font-weight:700;font-family:monospace">${otp}</p>` +
      `<p>This code expires in ${minutes} minutes and can be used once.</p>` +
      `<p>If you did not create an account, you can ignore this email.</p>`,
  };
}

/**
 * Issue (and email) a fresh OTP. Returns a status object; it never returns the
 * plaintext OTP to the caller.
 *
 * status: 'sent' | 'cooldown' | 'rate_limited' | 'delivery_failed'
 */
async function issueOtp({ email, user, purpose = 'registration', ip = '', forceCooldown = false }) {
  const normalized = normalizeEmail(email);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recent = await EmailVerification.find({
    email: normalized,
    purpose,
    createdAt: { $gte: oneHourAgo },
  })
    .select('sendCount lastSentAt createdAt')
    .lean();

  const sendsLastHour = recent.reduce((sum, item) => sum + (item.sendCount || 1), 0);
  if (sendsLastHour >= maxSendsPerHour()) {
    const oldest = recent.reduce(
      (min, item) => (!min || item.createdAt < min ? item.createdAt : min),
      null
    );
    const retryAfter = oldest
      ? Math.max(1, Math.ceil((oldest.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000))
      : 3600;
    return { status: 'rate_limited', retryAfter };
  }

  const latest = recent.reduce(
    (max, item) => (!max || item.lastSentAt > max ? item.lastSentAt : max),
    null
  );
  if (!forceCooldown && latest) {
    const elapsed = now.getTime() - new Date(latest).getTime();
    if (elapsed < cooldownMs()) {
      return {
        status: 'cooldown',
        retryAfter: Math.max(1, Math.ceil((cooldownMs() - elapsed) / 1000)),
      };
    }
  }

  const otp = generateOtp();
  const minutes = Math.round(ttlMs() / 60000);

  // Invalidate every previously-open challenge before creating the new one, so
  // an older code can never be replayed after a resend.
  await EmailVerification.updateMany(
    { email: normalized, purpose, consumedAt: null },
    { $set: { consumedAt: now } }
  );

  const challenge = await EmailVerification.create({
    email: normalized,
    purpose,
    userId: user?._id || null,
    otpHash: hashOtp(normalized, otp),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    sendCount: 1,
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + ttlMs()),
    requestIp: String(ip || '').slice(0, 80),
  });

  // Tests never touch a mail provider; they use OTP_TEST_CODE.
  if (process.env.NODE_ENV === 'test' && /^\d{6}$/.test(process.env.OTP_TEST_CODE || '')) {
    return { status: 'sent', challengeId: challenge._id, expiresAt: challenge.expiresAt };
  }

  const mail = otpEmail({ name: user?.name, otp, minutes });
  const delivery = await sendMail({ to: normalized, ...mail });

  if (!delivery.delivered) {
    // Do not leave a valid challenge behind when the code could not be sent.
    await EmailVerification.deleteOne({ _id: challenge._id });
    return { status: 'delivery_failed' };
  }

  return { status: 'sent', challengeId: challenge._id, expiresAt: challenge.expiresAt };
}

/**
 * Verify an OTP. This only validates and consumes the challenge; marking the
 * user's email as verified is the controller's atomic responsibility.
 *
 * status: 'verified' | 'invalid' | 'expired' | 'locked'
 */
async function verifyOtp({ email, otp, purpose = 'registration' }) {
  const normalized = normalizeEmail(email);
  const code = String(otp || '').trim();

  if (!/^\d{6}$/.test(code)) return { status: 'invalid', attemptsRemaining: 0 };

  const challenge = await EmailVerification.findOne({
    email: normalized,
    purpose,
    consumedAt: null,
  })
    .sort({ createdAt: -1 })
    .select('+otpHash');

  if (!challenge) return { status: 'invalid', attemptsRemaining: 0 };

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await EmailVerification.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
    return { status: 'expired' };
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    await EmailVerification.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
    return { status: 'locked' };
  }

  const matches = safeEqual(challenge.otpHash, hashOtp(normalized, code));

  if (!matches) {
    const updated = await EmailVerification.findOneAndUpdate(
      {
        _id: challenge._id,
        consumedAt: null,
        attempts: { $lt: challenge.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (!updated) return { status: 'locked' };

    const attemptsRemaining = Math.max(0, updated.maxAttempts - updated.attempts);
    if (attemptsRemaining === 0) {
      // Burn the challenge once the attempt budget is exhausted.
      await EmailVerification.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
      return { status: 'locked' };
    }

    return { status: 'invalid', attemptsRemaining };
  }

  // Single-use claim: only one concurrent verifier can consume the challenge.
  const consumed = await EmailVerification.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );

  if (!consumed) return { status: 'invalid', attemptsRemaining: 0 };

  return { status: 'verified' };
}

module.exports = {
  issueOtp,
  verifyOtp,
  hashOtp,
  generateOtp,
  MAX_ATTEMPTS,
};
