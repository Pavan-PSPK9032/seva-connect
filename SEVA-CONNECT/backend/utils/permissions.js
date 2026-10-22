/**
 * Shared authorization predicates.
 * Kept in one place so every controller applies the same ownership rule.
 */

function canManageNGO(user, ngo) {
  if (!user || !ngo) return false;
  if (user.role === 'admin') return true;
  return Boolean(ngo.createdBy) && ngo.createdBy.toString() === String(user._id);
}

module.exports = { canManageNGO };
