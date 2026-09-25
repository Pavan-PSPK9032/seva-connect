/**
 * MongoDB Atlas connection using Mongoose.
 * Reads credentials from environment variables (dotenv) only —
 * never from hardcoded strings, and never exposed to the frontend.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const PLACEHOLDER = 'your_mongodb_atlas_connection_string';
const ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri === PLACEHOLDER) {
    console.error(
      '\n[DB] MONGODB_URI is not configured.\n' +
        '  1) Copy backend/.env.example to backend/.env\n' +
        '  2) Paste your MongoDB Atlas connection string into MONGODB_URI\n'
    );
    process.exit(1);
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
      });

      // Bounded to the DB we connected to, not the cluster host.
      console.log(
        `[DB] Connected to MongoDB Atlas (database: ${conn.connection.name})`
      );
      console.log(`[DB] Host: ${conn.connection.host}`);

      mongoose.connection.on('disconnected', () => {
        console.warn('[DB] MongoDB connection lost');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('[DB] MongoDB reconnected');
      });

      return conn;
    } catch (error) {
      console.error(`\n[DB] MongoDB connection attempt ${attempt}/${ATTEMPTS} failed:`);
      console.error(`  ${error.message}\n`);
      if (attempt < ATTEMPTS) {
        console.log(`[DB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        // Prevents "Mongoose already connected/disconnected" state buildup across retries.
        await mongoose.disconnect().catch(() => {});
      }
    }
  }

  console.error('\n[DB] Giving up after repeated failures.');
  console.error('Verify your Atlas URI, network access, and that the user has DB access.');
  process.exit(1);
}

module.exports = connectDB;