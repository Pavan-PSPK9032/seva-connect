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

/**
 * Whether the pinned test code may be used. This requires THREE independent
 * switches, so a stray `OTP_TEST_CODE` or `NODE_ENV=test` in a real deployment
 * cannot enable the bypass by itself. Production startup additionally refuses
 * to boot with these values (see server.js).
 */
function isTestOtpEnabled() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NODE_ENV !== 'test') return false;
  if (process.env.ALLOW_OTP_TEST_CODE !== 'true') return false;
  return /^\d{6}$/.test(process.env.OTP_TEST_CODE || '');
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
  // Automated tests may pin a code. isTestOtpEnabled() requires NODE_ENV=test,
  // ALLOW_OTP_TEST_CODE=true and a six-digit OTP_TEST_CODE, and is always false
  // when NODE_ENV=production.
  if (isTestOtpEnabled()) {
    return process.env.OTP_TEST_CODE;
  }
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function otpEmail({ name, otp, minutes }) {
  const safeName = String(name || 'there').replace(/[<>&"']/g, '');
  const brand = 'Seva Connect';
  return {
    subject: 'Your Seva Connect verification code',
    text:
      `Hello ${safeName},\n\n` +
      `Your ${brand} verification code is ${otp}.\n\n` +
      `This code expires in ${minutes} minutes and can be used once.\n` +
      `Enter it on the verification screen to activate your account.\n\n` +
      `Security notice: never share this code with anyone. Seva Connect staff\n` +
      `will never ask you for it. If you did not create an account, ignore this\n` +
      `email and your address will not be registered.\n\n` +
      `— The Seva Connect team\n`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f766e;padding:22px 28px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${brand}</span>
                <div style="color:#ccfbf1;font-size:12px;margin-top:4px;">Volunteer with verified NGOs</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;font-size:16px;">Hello ${safeName},</p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">
                  Use the verification code below to activate your Seva Connect account.
                </p>
                <div style="margin:0 0 18px;padding:18px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;text-align:center;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#0f766e;font-weight:700;">Verification code</div>
                  <div style="font-size:34px;line-height:1.2;letter-spacing:8px;font-weight:700;font-family:Consolas,monospace;color:#0f172a;padding-top:6px;">${otp}</div>
                </div>
                <p style="margin:0 0 10px;font-size:14px;color:#334155;">
                  This code expires in <strong>${minutes} minutes</strong> and can be used once.
                </p>
                <div style="margin:18px 0;padding:12px 14px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:6px;">
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#92400e;">
                    <strong>Never share this code.</strong> Seva Connect staff will never ask you for it.
                    If you did not create an account, you can ignore this email — your address will not be registered.
                  </p>
                </div>
                <p style="margin:18px 0 0;font-size:13px;color:#64748b;">— The Seva Connect team</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  This is an automated message from Seva Connect. Replies are not monitored.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

/**
 * Issue (and email) a fresh OTP. Returns a status object; it never returns the
 * plaintext OTP to the caller.
 *
 * For a pending registration `pendingRegistration` contains the already-hashed
 * form data. It is copied onto the challenge so a resend keeps the same
 * details, and so account creation can happen after a successful check without
 * ever having written a User document.
 *
 * status: 'sent' | 'cooldown' | 'rate_limited' | 'delivery_failed'
 */
async function issueOtp({
  email,
  user,
  pendingRegistration = null,
  purpose = 'registration',
  ip = '',
  forceCooldown = false,
}) {
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
    ...(pendingRegistration ? { pendingRegistration } : {}),
    otpHash: hashOtp(normalized, otp),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    sendCount: 1,
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + ttlMs()),
    requestIp: String(ip || '').slice(0, 80),
  });

  // Tests never touch a mail provider; they pin the code with explicit opt-in.
  if (isTestOtpEnabled()) {
    return { status: 'sent', challengeId: challenge._id, expiresAt: challenge.expiresAt };
  }

  const mail = otpEmail({
    name: pendingRegistration?.name || user?.name,
    otp,
    minutes,
  });
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

  // A concurrent registration may have left an older open challenge behind
  // (both requests passed the pre-checks before either insert completed).
  // Burn those too so only the code that just verified can ever be used.
  await EmailVerification.updateMany(
    { email: normalized, purpose, consumedAt: null, _id: { $ne: challenge._id } },
    { $set: { consumedAt: new Date() } }
  );

  return {
    status: 'verified',
    userId: consumed.userId || null,
    pendingRegistration: consumed.pendingRegistration
      ? consumed.pendingRegistration.toObject()
      : null,
  };
}

module.exports = {
  issueOtp,
  verifyOtp,
  hashOtp,
  generateOtp,
  isTestOtpEnabled,
  MAX_ATTEMPTS,
};
