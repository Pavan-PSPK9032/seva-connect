/**
 * Admin controllers — platform oversight.
 * Every handler here is mounted behind protect + authorize('admin').
 */
const User = require('../models/User');
const NGO = require('../models/NGO');
const Event = require('../models/Event');
const Application = require('../models/Application');
const AuditLog = require('../models/AuditLog');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');

const PAGE_SIZE = 20;

function pageArgs(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /api/admin/overview
async function overview(req, res, next) {
  try {
    const [
      volunteers,
      ngoUsers,
      admins,
      suspended,
      ngos,
      verifiedNgos,
      upcomingEvents,
      completedEvents,
      applications,
      pendingApplications,
      hoursAgg,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments({ role: 'volunteer' }),
      User.countDocuments({ role: 'ngo' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ accountStatus: 'suspended' }),
      NGO.countDocuments({}),
      NGO.countDocuments({ verified: true }),
      Event.countDocuments({ status: 'upcoming' }),
      Event.countDocuments({ status: 'completed' }),
      Application.countDocuments({}),
      Application.countDocuments({ status: 'pending' }),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
      User.find({}).select('name email role createdAt').sort({ createdAt: -1 }).limit(5),
    ]);

    return res.json({
      success: true,
      data: {
        users: { volunteers, ngoUsers, admins, suspended, total: volunteers + ngoUsers + admins },
        ngos: { total: ngos, verified: verifiedNgos, pending: ngos - verifiedNgos },
        events: { upcoming: upcomingEvents, completed: completedEvents },
        applications: { total: applications, pending: pendingApplications },
        verifiedHours: hoursAgg[0]?.hours || 0,
        recentUsers,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/users
async function listUsers(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};
    if (req.query.role && ['volunteer', 'ngo', 'admin'].includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (req.query.status && ['active', 'suspended'].includes(req.query.status)) {
      filter.accountStatus = req.query.status;
    }
    if (req.query.q) {
      const q = String(req.query.q).trim().slice(0, 80);
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/users/:id/status
async function setUserStatus(req, res, next) {
  try {
    const { accountStatus } = req.body;

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot change the status of your own account.' });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be suspended here.' });
    }

    target.accountStatus = accountStatus;
    await target.save();

    await audit.record(req, {
      action: `user.${accountStatus}`,
      entityType: 'User',
      entityId: target._id,
      summary: `${accountStatus === 'suspended' ? 'Suspended' : 'Reactivated'} ${target.email}`,
    });

    return res.json({
      success: true,
      message: accountStatus === 'suspended' ? 'Account suspended.' : 'Account reactivated.',
      data: { _id: target._id, accountStatus: target.accountStatus },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/ngos
async function listNGOs(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};
    if (req.query.verified === 'true') filter.verified = true;
    if (req.query.verified === 'false') filter.verified = false;

    const [items, total] = await Promise.all([
      NGO.find(filter)
        .populate({ path: 'createdBy', select: 'name email' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NGO.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/ngos/:id/verify
async function setNGOVerified(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    ngo.verified = req.body.verified;
    await ngo.save();

    if (ngo.createdBy) {
      await notify({
        recipient: ngo.createdBy,
        type: 'system',
        title: ngo.verified ? 'Organisation verified' : 'Verification revoked',
        message: ngo.verified
          ? `${ngo.organizationName} is now a verified organisation on Seva Connect.`
          : `Verification for ${ngo.organizationName} was revoked. Please contact support.`,
        link: '/my-ngo',
      });
    }

    await audit.record(req, {
      action: ngo.verified ? 'ngo.verified' : 'ngo.unverified',
      entityType: 'NGO',
      entityId: ngo._id,
      summary: `${ngo.verified ? 'Verified' : 'Unverified'} ${ngo.organizationName}`,
    });

    return res.json({
      success: true,
      message: ngo.verified ? 'NGO verified.' : 'Verification revoked.',
      data: { _id: ngo._id, verified: ngo.verified },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/audit
async function listAudit(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const [items, total] = await Promise.all([
      AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { overview, listUsers, setUserStatus, listNGOs, setNGOVerified, listAudit };
