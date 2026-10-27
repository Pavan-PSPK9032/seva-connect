/**
 * One-time migration: keep pre-OTP accounts able to log in.
 *
 * Accounts created before email verification shipped have no `emailVerified`
 * value. They are already treated as verified at runtime, so this script is
 * optional: it makes that state explicit in the data. It also repairs any
 * pre-release account that was written with `emailVerified: false` by an
 * intermediate build.
 *
 * It is a dry run unless `--apply` is passed. It never deletes data.
 *
 * Usage:
 *   npm run migrate:legacy-verified -- --before=2026-10-27T00:00:00Z
 *   npm run migrate:legacy-verified -- --before=2026-10-27T00:00:00Z --apply
 *
 * Choose `--before` as the timestamp at which the OTP release goes live. Any
 * account created after that must complete OTP verification normally.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const beforeArg = (args.find((arg) => arg.startsWith('--before=')) || '').split('=')[1];

function usage() {
  console.error(
    'Usage: npm run migrate:legacy-verified -- --before=<ISO timestamp> [--apply]'
  );
  process.exit(1);
}

async function main() {
  if (!beforeArg) usage();
  const before = new Date(beforeArg);
  if (Number.isNaN(before.getTime())) usage();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[MIGRATE] MONGODB_URI is not configured.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[MIGRATE] Connected to database "${mongoose.connection.name}"`);

  const filter = { emailVerified: { $ne: true }, createdAt: { $lt: before } };
  const total = await User.countDocuments(filter);
  console.log(
    `[MIGRATE] Accounts created before ${before.toISOString()} that are still unverified: ${total}`
  );

  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  const sample = await User.find(filter).select('email role createdAt').limit(10).lean();
  for (const user of sample) {
    console.log(`  - ${user.email} (${user.role}) created ${user.createdAt.toISOString()}`);
  }

  if (!apply) {
    console.log('[MIGRATE] Dry run only. Re-run with --apply to mark these accounts verified.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(filter, {
    $set: { emailVerified: true, emailVerifiedAt: new Date() },
  });
  console.log(`[MIGRATE] Marked ${result.modifiedCount} legacy account(s) verified.`);
  console.log('[MIGRATE] No other fields or documents were changed.');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[MIGRATE] Failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
