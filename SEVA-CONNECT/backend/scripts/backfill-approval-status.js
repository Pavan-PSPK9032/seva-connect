/**
 * Additive backfill for the organisation/event approval workflow.
 *
 * Existing records predate `approvalStatus`. This script derives a sensible
 * value from the legacy flags instead of deleting or rewriting content:
 *
 *   NGO:   verified/approved true  -> approved
 *          otherwise              -> pending
 *   Event: approved true           -> approved
 *          otherwise              -> pending (status becomes pending_approval)
 *
 * Nothing is deleted. Run once per database after deploying the new code:
 *
 *   npm run migrate:approvals
 *
 * Re-running is safe and only touches documents that are still missing the
 * new field.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const NGO = require('../models/NGO');
const Event = require('../models/Event');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[APPROVALS] MONGODB_URI is not configured.');
    process.exit(1);
  }

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[APPROVALS] Connected to database "${conn.connection.name}"`);

  const legacyNgos = await NGO.find({ approvalStatus: { $exists: false } }).select(
    '_id verified approved verifiedAt createdAt'
  );
  let approvedNgos = 0;
  let pendingNgos = 0;

  for (const ngo of legacyNgos) {
    const approved = Boolean(ngo.verified || ngo.approved);
    await NGO.updateOne(
      { _id: ngo._id, approvalStatus: { $exists: false } },
      {
        $set: {
          approvalStatus: approved ? 'approved' : 'pending',
          approved,
          verified: approved,
          approvedAt: approved ? ngo.verifiedAt || ngo.createdAt || new Date() : null,
          submittedAt: ngo.createdAt || new Date(),
        },
      }
    );
    if (approved) approvedNgos += 1;
    else pendingNgos += 1;
  }

  const legacyEvents = await Event.find({ approvalStatus: { $exists: false } }).select(
    '_id approved status createdAt'
  );
  let approvedEvents = 0;
  let pendingEvents = 0;

  for (const event of legacyEvents) {
    const approved = Boolean(event.approved);
    await Event.updateOne(
      { _id: event._id, approvalStatus: { $exists: false } },
      {
        $set: {
          approvalStatus: approved ? 'approved' : 'pending',
          approved,
          submittedAt: event.createdAt || new Date(),
          ...(approved ? {} : { status: 'pending_approval' }),
        },
      }
    );
    if (approved) approvedEvents += 1;
    else pendingEvents += 1;
  }

  console.log(
    `[APPROVALS] NGOs: ${approvedNgos} approved, ${pendingNgos} pending (${legacyNgos.length} inspected)`
  );
  console.log(
    `[APPROVALS] Events: ${approvedEvents} approved, ${pendingEvents} pending (${legacyEvents.length} inspected)`
  );
  console.log('[APPROVALS] Done. No documents were deleted.');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[APPROVALS] Failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
