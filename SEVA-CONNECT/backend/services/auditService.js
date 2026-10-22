/**
 * Audit service — best-effort append-only logging of privileged actions.
 * A logging failure must never block the action being audited.
 */
const AuditLog = require('../models/AuditLog');

async function record(req, { action, entityType, entityId = null, summary = '', meta = {} }) {
  try {
    const actor = req.user;
    return await AuditLog.create({
      actor: actor?._id,
      actorName: actor?.name || '',
      actorRole: actor?.role || 'volunteer',
      action,
      entityType,
      entityId,
      summary,
      meta,
      ip: req.ip || '',
    });
  } catch (error) {
    console.error('[AUDIT] Could not record entry:', error.message);
    return null;
  }
}

module.exports = { record };
