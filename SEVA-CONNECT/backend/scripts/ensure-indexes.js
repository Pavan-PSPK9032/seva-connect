/**
 * Create (never drop) the indexes declared by the Mongoose schemas.
 *
 * This is an additive migration: it is safe to run on an existing database and
 * it never deletes or rewrites documents. Run it once per deployment target:
 *
 *   npm run migrate:indexes
 *
 * Requires MONGODB_URI to point at the intended database.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const models = [
  require('../models/User'),
  require('../models/Announcement'),
  require('../models/PlatformSetting'),
  require('../models/NGO'),
  require('../models/Event'),
  require('../models/Application'),
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[MIGRATE] MONGODB_URI is not configured.');
    process.exit(1);
  }

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[MIGRATE] Connected to database "${conn.connection.name}"`);

  for (const model of models) {
    const created = await model.createIndexes();
    console.log(`[MIGRATE] ${model.modelName}: ${created.length} index(es) ensured`);
  }

  await mongoose.disconnect();
  console.log('[MIGRATE] Done. No documents were modified.');
}

main().catch(async (error) => {
  console.error('[MIGRATE] Failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
