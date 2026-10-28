/**
 * Shared approval helpers.
 *
 * Records created before the approval workflow existed have no
 * `approvalStatus` field. They are treated as approved when their legacy
 * `verified` / `approved` flag is true, so genuine data keeps working while a
 * migration is rolled out.
 */

function ngoIsApproved(ngo) {
  if (!ngo) return false;
  if (ngo.status === 'suspended') return false;
  if (ngo.approvalStatus) return ngo.approvalStatus === 'approved';
  return Boolean(ngo.approved || ngo.verified);
}

function eventIsApproved(event) {
  if (!event) return false;
  if (event.approvalStatus) return event.approvalStatus === 'approved';
  return Boolean(event.approved);
}

/**
 * Mongo clause matching approved NGOs, including legacy records without an
 * `approvalStatus`. Combine with other clauses using `$and` so callers are free
 * to use `$or` for search.
 */
function approvedNGOClause() {
  return {
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false }, $or: [{ approved: true }, { verified: true }] },
    ],
  };
}

function approvedEventClause() {
  return {
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false }, approved: true },
    ],
  };
}

module.exports = { ngoIsApproved, eventIsApproved, approvedNGOClause, approvedEventClause };
