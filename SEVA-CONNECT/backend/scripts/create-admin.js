/**
 * Secure admin bootstrap script.
 * Creates the first administrator account ONLY if no admin exists.
 * Requires explicit credentials via environment variables.
 * Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=StrongPass123! node scripts/create-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Platform Administrator';

  if (!email || !password) {
    console.error('[ADMIN] Missing ADMIN_EMAIL and/or ADMIN_PASSWORD');
    process.exit(1);
  }
  if (String(password).length < 8) {
    console.error('[ADMIN] Password must be at least 8 characters');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[ADMIN] MONGODB_URI not configured');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('[ADMIN] Connected to database');

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log('[ADMIN] Administrator already exists: ' + existingAdmin.email);
    console.log('[ADMIN] No changes made. Existing admins are preserved.');
    await mongoose.disconnect();
    return;
  }

  const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existingUser) {
    console.error('[ADMIN] Email already in use by role: ' + existingUser.role);
    await mongoose.disconnect();
    process.exit(1);
  }

  const admin = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password: String(password),
    role: 'admin',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    authProvider: 'password'
  });

  console.log('[ADMIN] Administrator created successfully: ' + admin.email);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('[ADMIN] Failed:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
