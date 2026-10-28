/**
 * Admin controllers — platform oversight.
 * Every handler here is mounted behind protect + authorize('admin').
 *
 * Statistics, reports and charts are computed from live collections; nothing
 * in this file contains hardcoded platform numbers.
 */
const User = require('../models/User');
const NGO = require('../models/NGO');
const Event = require('../models/Event');
const Application = require('../models/Application');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const PlatformSetting = require('../models/PlatformSetting');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');
const { getPlatformSettings, clearPlatformSettingsCache } = require('../services/settingsService');

const PAGE_SIZE = 20;

function pageArgs(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row._id || 'unknown'] = row.count;
    return acc;
  }, {});
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function lastMonthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rangeFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = from;
  if (to) filter.$lte = to;
  return Object.keys(filter).length ? filter : null;
}

const USER_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  email: { email: 1 },
  role: { role: 1 },
  login: { lastLoginAt: -1 },
};

/* --------------------------------- Overview -------------------------------- */

// GET /api/admin/overview
async function overview(req, res, next) {
  try {
    const now = new Date();
    const months = lastMonthKeys(6);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      volunteers,
      ngoUsers,
      admins,
      suspended,
      ngosTotal,
      ngosVerified,
      ngosPending,
      eventsByStatus,
      appsByStatus,
      hoursAgg,
      recentUsers,
      recentActivity,
      userGrowthAgg,
      engagementAgg,
      certificates,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ emailVerified: { $ne: false } }),
      User.countDocuments({ emailVerified: false }),
      User.countDocuments({ role: 'volunteer' }),
      User.countDocuments({ role: 'ngo' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ accountStatus: 'suspended' }),
      NGO.countDocuments({}),
      NGO.countDocuments({ $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false }, $or: [{ approved: true }, { verified: true }] }] }),
      NGO.countDocuments({
        $or: [
          { approvalStatus: 'pending' },
          { approvalStatus: { $exists: false }, verificationRequested: true, verified: { $ne: true } },
        ],
      }),
      Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
      User.find({})
        .select('name email role emailVerified accountStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(6),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
      User.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
            users: { $sum: 1 },
            volunteers: { $sum: { $cond: [{ $eq: ['$role', 'volunteer'] }, 1, 0] } },
            ngos: { $sum: { $cond: [{ $eq: ['$role', 'ngo'] }, 1, 0] } },
          },
        },
      ]),
      Application.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
            applications: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            hours: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  { $ifNull: ['$hoursCredited', 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Certificate.countDocuments({}),
    ]);

    const eventCounts = countMap(eventsByStatus);
    const appCounts = countMap(appsByStatus);
    const totalActivities = eventsByStatus.reduce((sum, row) => sum + row.count, 0);
    const totalApplications = appsByStatus.reduce((sum, row) => sum + row.count, 0);

    const growthByMonth = userGrowthAgg.reduce((acc, row) => {
      acc[row._id] = row;
      return acc;
    }, {});
    const engagementByMonth = engagementAgg.reduce((acc, row) => {
      acc[row._id] = row;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: unverifiedUsers,
          volunteers,
          ngoUsers,
          admins,
          suspended,
        },
        ngos: {
          total: ngosTotal,
          verified: ngosVerified,
          pending: ngosPending,
          unverified: Math.max(0, ngosTotal - ngosVerified),
        },
        events: {
          total: totalActivities,
          draft: eventCounts.draft || 0,
          upcoming: eventCounts.upcoming || 0,
          ongoing: eventCounts.ongoing || 0,
          completed: eventCounts.completed || 0,
          cancelled: eventCounts.cancelled || 0,
          archived: eventCounts.archived || 0,
          active: (eventCounts.upcoming || 0) + (eventCounts.ongoing || 0),
        },
        applications: {
          total: totalApplications,
          pending: appCounts.pending || 0,
          approved: appCounts.approved || 0,
          rejected: appCounts.rejected || 0,
          completed: appCounts.completed || 0,
          withdrawn: appCounts.withdrawn || 0,
          cancelled: appCounts.cancelled || 0,
        },
        verifiedHours: hoursAgg[0]?.hours || 0,
        certificates,
        recentUsers,
        recentActivity,
        charts: {
          userGrowth: months.map((key) => ({
            month: key,
            label: monthLabel(key),
            users: growthByMonth[key]?.users || 0,
            volunteers: growthByMonth[key]?.volunteers || 0,
            ngos: growthByMonth[key]?.ngos || 0,
          })),
          engagement: months.map((key) => ({
            month: key,
            label: monthLabel(key),
            applications: engagementByMonth[key]?.applications || 0,
            completed: engagementByMonth[key]?.completed || 0,
            hours: engagementByMonth[key]?.hours || 0,
          })),
          activityStatus: [
            { name: 'Upcoming', value: eventCounts.upcoming || 0 },
            { name: 'Ongoing', value: eventCounts.ongoing || 0 },
            { name: 'Completed', value: eventCounts.completed || 0 },
            { name: 'Cancelled', value: eventCounts.cancelled || 0 },
            { name: 'Draft', value: eventCounts.draft || 0 },
            { name: 'Archived', value: eventCounts.archived || 0 },
          ],
          roleBreakdown: [
            { name: 'Volunteers', value: volunteers },
            { name: 'NGOs', value: ngoUsers },
            { name: 'Admins', value: admins },
          ],
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------- User management ---------------------------- */

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
    if (req.query.verified === 'verified') filter.emailVerified = { $ne: false };
    if (req.query.verified === 'unverified') filter.emailVerified = false;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const sort = USER_SORTS[req.query.sort] || USER_SORTS.newest;

    const [items, total] = await Promise.all([
      User.find(filter)
        .select('name email role phone location accountStatus emailVerified emailVerifiedAt lastLoginAt createdAt')
        .sort(sort)
        .skip(skip)
        .limit(limit),
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

// GET /api/admin/users/:id
async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [applications, ngos, certificates, statsRows] = await Promise.all([
      Application.find({ volunteerId: user._id })
        .populate({ path: 'eventId', select: 'title date status location' })
        .populate({ path: 'ngoId', select: 'organizationName verified' })
        .sort({ createdAt: -1 })
        .limit(20),
      NGO.find({ createdBy: user._id }).select('organizationName verified status location createdAt').lean(),
      Certificate.countDocuments({ volunteerId: user._id }),
      Application.aggregate([
        { $match: { volunteerId: user._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            hours: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  { $ifNull: ['$hoursCredited', 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = statsRows[0] || { total: 0, approved: 0, completed: 0, hours: 0 };

    return res.json({
      success: true,
      data: {
        user,
        applications,
        ngos,
        certificates,
        stats: {
          applications: stats.total,
          approved: stats.approved,
          completed: stats.completed,
          hours: stats.hours,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

async function otherActiveAdmins(excludeId) {
  return User.countDocuments({
    role: 'admin',
    _id: { $ne: excludeId },
    accountStatus: { $ne: 'suspended' },
  });
}

// PATCH /api/admin/users/:id/status
async function setUserStatus(req, res, next) {
  try {
    const { accountStatus } = req.body;

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change the status of your own account.',
      });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Suspending an administrator is allowed only while another active admin
    // remains, so the platform can never be locked out of administration.
    if (target.role === 'admin' && accountStatus === 'suspended') {
      if ((await otherActiveAdmins(target._id)) === 0) {
        return res.status(400).json({
          success: false,
          code: 'LAST_ADMIN',
          message: 'The last active administrator cannot be suspended.',
        });
      }
    }

    if (target.accountStatus === accountStatus) {
      return res.json({
        success: true,
        message:
          accountStatus === 'suspended' ? 'Account is already suspended.' : 'Account is already active.',
        data: { _id: target._id, accountStatus: target.accountStatus },
      });
    }

    target.accountStatus = accountStatus;
    await target.save();

    await notify({
      recipient: target._id,
      type: 'system',
      title: accountStatus === 'suspended' ? 'Account suspended' : 'Account reactivated',
      message:
        accountStatus === 'suspended'
          ? 'Your Seva Connect account has been suspended. Please contact support if you believe this is a mistake.'
          : 'Your Seva Connect account has been reactivated. Welcome back!',
      link: '/dashboard',
    });

    await audit.record(req, {
      action: `user.${accountStatus}`,
      entityType: 'User',
      entityId: target._id,
      summary: `${accountStatus === 'suspended' ? 'Suspended' : 'Reactivated'} ${target.email}`,
      meta: { role: target.role },
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

// PATCH /api/admin/users/:id/role
async function setUserRole(req, res, next) {
  try {
    const { role } = req.body;

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        code: 'SELF_ROLE',
        message: 'You cannot change your own role.',
      });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (target.role === role) {
      return res.json({
        success: true,
        message: `Role is already ${role}.`,
        data: { _id: target._id, role: target.role },
      });
    }

    // Demoting the final active administrator would remove all administration.
    if (target.role === 'admin' && role !== 'admin') {
      if ((await otherActiveAdmins(target._id)) === 0) {
        return res.status(400).json({
          success: false,
          code: 'LAST_ADMIN',
          message: 'The last active administrator cannot be demoted.',
        });
      }
    }

    const previous = target.role;
    target.role = role;
    await target.save();

    await notify({
      recipient: target._id,
      type: 'system',
      title: 'Account role updated',
      message: `Your Seva Connect role is now ${role}. Sign in again if the interface does not update.`,
      link: '/dashboard',
    });

    await audit.record(req, {
      action: 'user.role',
      entityType: 'User',
      entityId: target._id,
      summary: `Changed ${target.email} from ${previous} to ${role}`,
      meta: { previous, role },
    });

    return res.json({
      success: true,
      message: `Role updated to ${role}.`,
      data: { _id: target._id, role: target.role },
    });
  } catch (error) {
    next(error);
  }
}

/* ----------------------------- Volunteer management ------------------------- */

// GET /api/admin/volunteers
async function listVolunteers(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = { role: 'volunteer' };

    if (req.query.status && ['active', 'suspended'].includes(req.query.status)) {
      filter.accountStatus = req.query.status;
    }
    if (req.query.verified === 'verified') filter.emailVerified = { $ne: false };
    if (req.query.verified === 'unverified') filter.emailVerified = false;
    if (req.query.skill) {
      filter.skills = { $regex: escapeRegex(String(req.query.skill).trim()), $options: 'i' };
    }
    if (req.query.availability) {
      filter.availability = {
        $regex: escapeRegex(String(req.query.availability).trim()),
        $options: 'i',
      };
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { location: rx }, { skills: rx }, { interests: rx }];
    }

    const sort = USER_SORTS[req.query.sort] || USER_SORTS.newest;

    const [items, total] = await Promise.all([
      User.find(filter)
        .select('name email phone location availability skills interests accountStatus emailVerified lastLoginAt createdAt')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const ids = items.map((item) => item._id);
    const statsRows = ids.length
      ? await Application.aggregate([
          { $match: { volunteerId: { $in: ids } } },
          {
            $group: {
              _id: '$volunteerId',
              applications: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              hours: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', 'completed'] },
                    { $ifNull: ['$hoursCredited', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
      : [];

    const statsById = statsRows.reduce((acc, row) => {
      acc[String(row._id)] = row;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: items.map((item) => ({
        ...item,
        stats: {
          applications: statsById[String(item._id)]?.applications || 0,
          completed: statsById[String(item._id)]?.completed || 0,
          hours: statsById[String(item._id)]?.hours || 0,
        },
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/volunteers/:id
async function getVolunteer(req, res, next) {
  try {
    const volunteer = await User.findOne({ _id: req.params.id, role: 'volunteer' }).select('-password');
    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });
    }

    const [applications, certificates, statsRows] = await Promise.all([
      Application.find({ volunteerId: volunteer._id })
        .populate({ path: 'eventId', select: 'title date time location status' })
        .populate({ path: 'ngoId', select: 'organizationName verified' })
        .sort({ createdAt: -1 }),
      Certificate.find({ volunteerId: volunteer._id }).sort({ issuedAt: -1 }).lean(),
      Application.aggregate([
        { $match: { volunteerId: volunteer._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            hours: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  { $ifNull: ['$hoursCredited', 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = statsRows[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      completed: 0,
      hours: 0,
    };

    return res.json({
      success: true,
      data: {
        volunteer,
        applications,
        certificates,
        stats: {
          applications: stats.total,
          pending: stats.pending,
          approved: stats.approved,
          completed: stats.completed,
          hours: stats.hours,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/volunteers/:id/assign  { eventId }
async function assignVolunteer(req, res, next) {
  try {
    const volunteer = await User.findOne({ _id: req.params.id, role: 'volunteer' });
    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });
    }
    if (volunteer.emailVerified === false) {
      return res.status(400).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'This volunteer has not verified their email address yet.',
      });
    }
    if (volunteer.accountStatus === 'suspended') {
      return res.status(400).json({ success: false, message: 'This volunteer account is suspended.' });
    }

    const event = await Event.findById(req.body.eventId).populate({
      path: 'ngoId',
      select: 'organizationName createdBy',
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Activity not found.' });
    }
    if (!['upcoming', 'ongoing'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: 'Volunteers can only be assigned to upcoming or ongoing activities.',
      });
    }

    const existing = await Application.findOne({
      eventId: event._id,
      volunteerId: volunteer._id,
    });
    if (existing && ['pending', 'approved', 'completed'].includes(existing.status)) {
      return res.status(409).json({
        success: false,
        message: `This volunteer already has a ${existing.status} application for that activity.`,
      });
    }

    // Atomic capacity guard so concurrent assignments cannot oversubscribe.
    const seated = await Event.findOneAndUpdate(
      { _id: event._id, $expr: { $lt: ['$registeredVolunteers', '$requiredVolunteers'] } },
      { $inc: { registeredVolunteers: 1 } }
    );
    if (!seated) {
      return res.status(409).json({
        success: false,
        message: 'This activity is full. Increase capacity before assigning more volunteers.',
      });
    }

    let application;
    try {
      if (existing) {
        existing.status = 'approved';
        existing.coverNote = existing.coverNote || 'Assigned by an administrator.';
        existing.decidedBy = req.user._id;
        existing.decidedAt = new Date();
        existing.withdrawnAt = null;
        existing.hoursCredited = 0;
        application = await existing.save();
      } else {
        application = await Application.create({
          eventId: event._id,
          volunteerId: volunteer._id,
          ngoId: event.ngoId._id,
          status: 'approved',
          decidedBy: req.user._id,
          decidedAt: new Date(),
          coverNote: 'Assigned by an administrator.',
        });
      }
    } catch (error) {
      // Release the seat if the application could not be written.
      await Event.updateOne(
        { _id: event._id },
        [{ $set: { registeredVolunteers: { $max: [0, { $subtract: ['$registeredVolunteers', 1] }] } } }]
      );
      if (error && error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'This volunteer already has an application for that activity.',
        });
      }
      throw error;
    }

    await notify({
      recipient: volunteer._id,
      type: 'application_approved',
      title: 'Assigned to an activity',
      message: `An administrator assigned you to "${event.title}". Check the activity details.`,
      link: `/events/${event._id}`,
      meta: { eventId: String(event._id), applicationId: String(application._id) },
    });

    if (event.ngoId?.createdBy) {
      await notify({
        recipient: event.ngoId.createdBy,
        type: 'application_received',
        title: 'Volunteer assigned',
        message: `An administrator assigned ${volunteer.name} to "${event.title}".`,
        link: '/my-ngo',
        meta: { eventId: String(event._id), applicationId: String(application._id) },
      });
    }

    await audit.record(req, {
      action: 'volunteer.assign',
      entityType: 'Application',
      entityId: application._id,
      summary: `Assigned ${volunteer.email} to "${event.title}"`,
      meta: { eventId: String(event._id), volunteerId: String(volunteer._id) },
    });

    return res.status(201).json({
      success: true,
      message: 'Volunteer assigned to the activity.',
      data: application,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------ NGO management ------------------------------ */

// GET /api/admin/ngos
async function listNGOs(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};

    if (req.query.verified === 'true') filter.verified = true;
    if (req.query.verified === 'false') filter.verified = false;
    if (req.query.requested === 'true') filter.verificationRequested = true;
    if (
      req.query.approvalStatus &&
      ['pending', 'approved', 'rejected', 'changes_requested', 'suspended'].includes(req.query.approvalStatus)
    ) {
      filter.approvalStatus = req.query.approvalStatus;
    }
    if (req.query.status && ['active', 'suspended'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ organizationName: rx }, { location: rx }, { contactEmail: rx }];
    }

    const sort =
      req.query.sort === 'name'
        ? { organizationName: 1 }
        : req.query.sort === 'oldest'
          ? { createdAt: 1 }
          : { createdAt: -1 };

    const [items, total] = await Promise.all([
      NGO.find(filter)
        .populate({ path: 'createdBy', select: 'name email accountStatus' })
        .sort(sort)
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

// GET /api/admin/ngos/:id
async function getNGO(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id).populate({
      path: 'createdBy',
      select: 'name email phone accountStatus emailVerified createdAt',
    });
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    const [events, eventStats, applicationStats, volunteerRows, history] = await Promise.all([
      Event.find({ ngoId: ngo._id })
        .select('title status date time location requiredVolunteers registeredVolunteers createdAt')
        .sort({ date: -1 })
        .limit(30)
        .lean(),
      Event.aggregate([
        { $match: { ngoId: ngo._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            filled: { $sum: '$registeredVolunteers' },
          },
        },
      ]),
      Application.aggregate([
        { $match: { ngoId: ngo._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.distinct('volunteerId', { ngoId: ngo._id }),
      AuditLog.find({ entityType: 'NGO', entityId: ngo._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const eventCounts = countMap(eventStats.map((row) => ({ _id: row._id, count: row.count })));
    const appCounts = countMap(applicationStats);

    return res.json({
      success: true,
      data: {
        ngo,
        events,
        history,
        stats: {
          events: Object.values(eventCounts).reduce((sum, value) => sum + value, 0),
          upcoming: eventCounts.upcoming || 0,
          completed: eventCounts.completed || 0,
          cancelled: eventCounts.cancelled || 0,
          applications: Object.values(appCounts).reduce((sum, value) => sum + value, 0),
          approved: appCounts.approved || 0,
          completedApplications: appCounts.completed || 0,
          volunteers: volunteerRows.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/ngos/:id/verify
// Legacy endpoint kept for compatibility: `verified: true` approves the
// organisation, `false` rejects it.
async function setNGOVerified(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    const approve = req.body.verified === true;
    const previous = ngo.approvalStatus || (ngo.verified ? 'approved' : 'pending');
    const nextStatus = approve ? 'approved' : 'rejected';
    if (previous === nextStatus) {
      return res.json({
        success: true,
        message: `NGO is already ${nextStatus}.`,
        data: ngo,
      });
    }

    ngo.approvalStatus = nextStatus;
    ngo.approved = approve;
    ngo.verified = approve;
    ngo.approvedAt = approve ? new Date() : null;
    ngo.verifiedAt = approve ? new Date() : null;
    ngo.approvedBy = approve ? req.user._id : null;
    ngo.reviewedAt = new Date();
    ngo.reviewedBy = req.user._id;
    ngo.verificationRequested = false;
    if (!approve) ngo.rejectionReason = String(req.body.note || '').trim().slice(0, 1000);
    if (typeof req.body.note === 'string') ngo.verificationNote = req.body.note;
    await ngo.save();

    if (ngo.createdBy) {
      await notify({
        recipient: ngo.createdBy,
        type: 'system',
        title: approve ? 'Organisation approved' : 'Organisation submission rejected',
        message: approve
          ? `${ngo.organizationName} is now approved on Seva Connect. You can publish events for volunteers.`
          : `Your submission for ${ngo.organizationName} was rejected.${
              ngo.rejectionReason ? ` Reason: ${ngo.rejectionReason}` : ''
            } You can update the details and resubmit.`,
        link: '/my-ngo',
      });
    }

    await audit.record(req, {
      action: approve ? 'ngo.approved' : 'ngo.rejected',
      entityType: 'NGO',
      entityId: ngo._id,
      summary: `${approve ? 'Approved' : 'Rejected'} ${ngo.organizationName}`,
      meta: { previous, reason: ngo.rejectionReason || '' },
    });

    return res.json({
      success: true,
      message: approve ? 'NGO approved.' : 'NGO rejected.',
      data: ngo,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/ngos/:id/approval
// Explicit approval endpoint used by the review panel.
async function reviewNGO(req, res, next) {
  try {
    const { decision, reason } = req.body;
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    if (decision === 'approved') {
      ngo.approvalStatus = 'approved';
      ngo.approved = true;
      ngo.verified = true;
      ngo.approvedAt = new Date();
      ngo.verifiedAt = new Date();
      ngo.approvedBy = req.user._id;
      ngo.rejectionReason = '';
    } else {
      ngo.approvalStatus = decision === 'changes_requested' ? 'changes_requested' : 'rejected';
      ngo.approved = false;
      ngo.verified = false;
      ngo.approvedAt = null;
      ngo.verifiedAt = null;
      ngo.approvedBy = null;
      ngo.rejectionReason = String(reason || '').trim().slice(0, 1000);
      if (!ngo.rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required when rejecting or returning a submission.',
        });
      }
    }

    ngo.reviewedAt = new Date();
    ngo.reviewedBy = req.user._id;
    ngo.verificationRequested = false;
    await ngo.save();

    if (ngo.createdBy) {
      const approved = ngo.approvalStatus === 'approved';
      await notify({
        recipient: ngo.createdBy,
        type: 'system',
        title: approved ? 'Organisation approved' : 'Organisation submission needs attention',
        message: approved
          ? `${ngo.organizationName} is approved. You can now publish events for volunteers.`
          : `Your submission for ${ngo.organizationName} was ${
              ngo.approvalStatus === 'changes_requested' ? 'returned for corrections' : 'rejected'
            }. Reason: ${ngo.rejectionReason}`,
        link: '/my-ngo',
      });
    }

    await audit.record(req, {
      action: `ngo.${ngo.approvalStatus}`,
      entityType: 'NGO',
      entityId: ngo._id,
      summary: `${ngo.approvalStatus} ${ngo.organizationName}`,
      meta: { reason: ngo.rejectionReason || '' },
    });

    return res.json({
      success: true,
      message:
        ngo.approvalStatus === 'approved'
          ? 'NGO approved.'
          : ngo.approvalStatus === 'changes_requested'
            ? 'Submission returned for corrections.'
            : 'NGO rejected.',
      data: ngo,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/ngos/:id/status
async function setNGOStatus(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    if (ngo.status === req.body.status) {
      return res.json({
        success: true,
        message:
          req.body.status === 'suspended'
            ? 'Organisation is already suspended.'
            : 'Organisation is already active.',
        data: ngo,
      });
    }

    ngo.status = req.body.status;
    await ngo.save();

    if (ngo.createdBy) {
      await notify({
        recipient: ngo.createdBy,
        type: 'system',
        title: ngo.status === 'suspended' ? 'Organisation suspended' : 'Organisation reactivated',
        message:
          ngo.status === 'suspended'
            ? `${ngo.organizationName} has been suspended. Its public profile is hidden and records are read-only.`
            : `${ngo.organizationName} is active again.`,
        link: '/my-ngo',
      });
    }

    await audit.record(req, {
      action: `ngo.${ngo.status}`,
      entityType: 'NGO',
      entityId: ngo._id,
      summary: `${ngo.status === 'suspended' ? 'Suspended' : 'Reactivated'} ${ngo.organizationName}`,
    });

    return res.json({
      success: true,
      message: ngo.status === 'suspended' ? 'Organisation suspended.' : 'Organisation reactivated.',
      data: ngo,
    });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------- Activity management --------------------------- */

// GET /api/admin/events
async function listEvents(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};

    if (
      req.query.status &&
      ['draft', 'pending_approval', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'].includes(
        req.query.status
      )
    ) {
      filter.status = req.query.status;
    }
    if (
      req.query.approvalStatus &&
      ['pending', 'approved', 'rejected', 'changes_requested'].includes(req.query.approvalStatus)
    ) {
      filter.approvalStatus = req.query.approvalStatus;
    }
    if (req.query.ngoId) filter.ngoId = req.query.ngoId;

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const dateRange = rangeFilter(from, to);
    if (dateRange) filter.date = dateRange;

    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ title: rx }, { location: rx }, { description: rx }];
    }

    const sort =
      req.query.sort === 'oldest'
        ? { date: 1 }
        : req.query.sort === 'title'
          ? { title: 1 }
          : { date: -1 };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate({ path: 'ngoId', select: 'organizationName verified status' })
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
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

const EVENT_STATUSES = ['draft', 'pending_approval', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'];

// PATCH /api/admin/events/:id/status
// Moderation endpoint. Cancelling mirrors the NGO flow: seats are released and
// open applications are closed with a notification.
async function setEventStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid activity status.' });
    }

    const event = await Event.findById(req.params.id).populate({
      path: 'ngoId',
      select: 'organizationName createdBy',
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const wasCancelled = event.status === 'cancelled';

    // Re-applying the current status is a no-op; notifying again would create
    // duplicate messages for the NGO and volunteers.
    if (event.status === status) {
      return res.json({
        success: true,
        message: `Opportunity is already ${status}.`,
        data: event,
      });
    }

    if (status === 'upcoming') {
      event.approved = true;
      event.approvalStatus = 'approved';
      event.status = 'upcoming';
      event.approvedAt = event.approvedAt || new Date();
      event.approvedBy = req.user._id;
      event.reviewedAt = new Date();
      event.reviewedBy = req.user._id;
    } else {
      event.status = status;
    }
    await event.save();

    if (status === 'cancelled' && !wasCancelled) {
      const affected = await Application.find({
        eventId: event._id,
        status: { $in: ['pending', 'approved'] },
      }).select('volunteerId status');

      const approvedCount = affected.filter((application) => application.status === 'approved').length;

      await Application.updateMany(
        { eventId: event._id, status: { $in: ['pending', 'approved'] } },
        { $set: { status: 'cancelled', decidedBy: req.user._id, decidedAt: new Date() } }
      );

      if (approvedCount > 0) {
        await Event.updateOne({ _id: event._id }, [
          {
            $set: {
              registeredVolunteers: {
                $max: [0, { $subtract: ['$registeredVolunteers', approvedCount] }],
              },
            },
          },
        ]);
      }

      await Promise.all(
        affected.slice(0, 200).map((application) =>
          notify({
            recipient: application.volunteerId,
            type: 'event_cancelled',
            title: 'Opportunity cancelled',
            message: `"${event.title}" was cancelled by the platform team. Your application has been closed.`,
            link: `/events/${event._id}`,
          })
        )
      );
    }

    if (event.ngoId?.createdBy) {
      if (event.status === 'upcoming' && event.approved) {
        await notify({
          recipient: event.ngoId.createdBy,
          type: 'event_published',
          title: 'Event approved',
          message: `"${event.title}" has been approved and is now live for volunteers to participate.`,
          link: `/events/${event._id}`,
        });
      } else {
        await notify({
          recipient: event.ngoId.createdBy,
          type: 'event_updated',
          title: `Opportunity ${status}`,
          message: `An administrator changed "${event.title}" to ${status.replace(/_/g, ' ')}.`,
          link: '/my-ngo',
        });
      }
    }

    await audit.record(req, {
      action: event.approved && event.status === 'upcoming' ? 'event.approve' : `event.${status}`,
      entityType: 'Event',
      entityId: event._id,
      summary: event.approved && event.status === 'upcoming' ? `Approved "${event.title}"` : `Set "${event.title}" to ${status.replace(/_/g, ' ')}`,
    });

    return res.json({ success: true, message: event.approved && event.status === 'upcoming' ? 'Event approved and published.' : `Opportunity marked ${status.replace(/_/g, ' ')}.`, data: event });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/events/:id/approval
// Approve, reject or return an event submission. Rejections and correction
// requests require a reason that the organisation can act on.
async function reviewEvent(req, res, next) {
  try {
    const { decision, reason } = req.body;
    const event = await Event.findById(req.params.id).populate({
      path: 'ngoId',
      select: 'organizationName createdBy approvalStatus status',
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    if (!event.ngoId) {
      return res.status(400).json({ success: false, message: 'The owning organisation no longer exists.' });
    }

    if (decision === 'approved') {
      if (event.ngoId.approvalStatus !== 'approved' && event.ngoId.approvalStatus !== undefined) {
        return res.status(400).json({
          success: false,
          message: 'The organisation must be approved before its events can be published.',
        });
      }
      if (event.ngoId.status === 'suspended') {
        return res.status(400).json({
          success: false,
          message: 'The organisation is suspended and its events cannot be published.',
        });
      }
      event.approvalStatus = 'approved';
      event.approved = true;
      event.approvedAt = new Date();
      event.approvedBy = req.user._id;
      event.rejectionReason = '';
      event.status = 'upcoming';
    } else {
      const note = String(reason || '').trim().slice(0, 1000);
      if (!note) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required when rejecting or returning an event.',
        });
      }
      event.approvalStatus = decision === 'changes_requested' ? 'changes_requested' : 'rejected';
      event.approved = false;
      event.approvedAt = null;
      event.approvedBy = null;
      event.rejectionReason = note;
      event.status = 'draft';
    }

    event.reviewedAt = new Date();
    event.reviewedBy = req.user._id;
    await event.save();

    if (event.ngoId.createdBy) {
      const approved = event.approvalStatus === 'approved';
      await notify({
        recipient: event.ngoId.createdBy,
        type: approved ? 'event_published' : 'system',
        title: approved ? 'Event approved' : 'Event submission needs attention',
        message: approved
          ? `"${event.title}" is approved and now visible to volunteers.`
          : `"${event.title}" was ${
              event.approvalStatus === 'changes_requested' ? 'returned for corrections' : 'rejected'
            }. Reason: ${event.rejectionReason}`,
        link: '/my-ngo',
      });
    }

    await audit.record(req, {
      action: `event.${event.approvalStatus}`,
      entityType: 'Event',
      entityId: event._id,
      summary: `${event.approvalStatus} "${event.title}"`,
      meta: { reason: event.rejectionReason || '' },
    });

    return res.json({
      success: true,
      message:
        event.approvalStatus === 'approved'
          ? 'Event approved and published.'
          : event.approvalStatus === 'changes_requested'
            ? 'Event returned for corrections.'
            : 'Event rejected.',
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

/* --------------------------- Application oversight -------------------------- */
// GET /api/admin/applications
async function listApplications(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};

    if (req.query.status && Application.STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.volunteerId) filter.volunteerId = req.query.volunteerId;

    const [items, total, statusRows] = await Promise.all([
      Application.find(filter)
        .populate({ path: 'volunteerId', select: 'name email accountStatus emailVerified' })
        .populate({ path: 'eventId', select: 'title date location status ngoId' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(filter),
      Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    return res.json({
      success: true,
      data: items,
      summary: countMap(statusRows),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------- Audit log -------------------------------- */

// GET /api/admin/audit
async function listAudit(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};

    if (req.query.actorRole && ['volunteer', 'ngo', 'admin'].includes(req.query.actorRole)) {
      filter.actorRole = req.query.actorRole;
    }
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.action) {
      filter.action = { $regex: escapeRegex(String(req.query.action).trim()), $options: 'i' };
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ summary: rx }, { actorName: rx }, { action: rx }];
    }

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const dateRange = rangeFilter(from, to);
    if (dateRange) filter.createdAt = dateRange;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
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

/* ---------------------------------- Reports -------------------------------- */

function defaultRange(query) {
  const to = parseDate(query.to) || new Date();
  const from =
    parseDate(query.from) ||
    new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
async function reports(req, res, next) {
  try {
    const { from, to } = defaultRange(req.query);
    if (from > to) {
      return res.status(400).json({
        success: false,
        message: 'The start date must be before the end date.',
      });
    }

    const dateRange = { $gte: from, $lte: to };
    const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86400000);
    const groupFormat = spanDays > 62 ? '%Y-%m' : '%Y-%m-%d';

    const [
      registrations,
      verifiedUsers,
      unverifiedUsers,
      volunteerUsers,
      ngoUsers,
      adminUsers,
      appsByStatus,
      appHours,
      eventsByStatus,
      eventsCreated,
      ngosCreated,
      ngosVerified,
      registrationSeries,
      applicationSeries,
    ] = await Promise.all([
      User.countDocuments({ createdAt: dateRange }),
      User.countDocuments({ createdAt: dateRange, emailVerified: { $ne: false } }),
      User.countDocuments({ createdAt: dateRange, emailVerified: false }),
      User.countDocuments({ createdAt: dateRange, role: 'volunteer' }),
      User.countDocuments({ createdAt: dateRange, role: 'ngo' }),
      User.countDocuments({ createdAt: dateRange, role: 'admin' }),
      Application.aggregate([
        { $match: { createdAt: dateRange } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { createdAt: dateRange, status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
      Event.aggregate([
        { $match: { createdAt: dateRange } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Event.countDocuments({ createdAt: dateRange }),
      NGO.countDocuments({ createdAt: dateRange }),
      NGO.countDocuments({
        createdAt: dateRange,
        $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false }, verified: true }],
      }),
      User.aggregate([
        { $match: { createdAt: dateRange } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: 'UTC' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Application.aggregate([
        { $match: { createdAt: dateRange } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: 'UTC' } },
            count: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const appCounts = countMap(appsByStatus);
    const eventCounts = countMap(eventsByStatus);
    const totalApplications = Object.values(appCounts).reduce((sum, value) => sum + value, 0);
    const totalEvents = Object.values(eventCounts).reduce((sum, value) => sum + value, 0);

    const seriesMap = new Map();
    registrationSeries.forEach((row) => {
      seriesMap.set(row._id, {
        period: row._id,
        registrations: row.count,
        applications: 0,
        completed: 0,
      });
    });
    applicationSeries.forEach((row) => {
      const entry = seriesMap.get(row._id) || {
        period: row._id,
        registrations: 0,
        applications: 0,
        completed: 0,
      };
      entry.applications = row.count;
      entry.completed = row.completed;
      seriesMap.set(row._id, entry);
    });
    const series = [...seriesMap.values()].sort((a, b) => a.period.localeCompare(b.period));

    await audit.record(req, {
      action: 'report.view',
      entityType: 'Report',
      summary: `Viewed report ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
      meta: { from: from.toISOString(), to: to.toISOString() },
    });

    return res.json({
      success: true,
      data: {
        range: { from: from.toISOString(), to: to.toISOString(), days: spanDays, groupFormat },
        registrations: {
          total: registrations,
          verified: verifiedUsers,
          unverified: unverifiedUsers,
          volunteers: volunteerUsers,
          ngos: ngoUsers,
          admins: adminUsers,
        },
        participation: {
          applications: totalApplications,
          pending: appCounts.pending || 0,
          approved: appCounts.approved || 0,
          rejected: appCounts.rejected || 0,
          completed: appCounts.completed || 0,
          hours: appHours[0]?.hours || 0,
        },
        activities: {
          created: eventsCreated,
          total: totalEvents,
          upcoming: eventCounts.upcoming || 0,
          ongoing: eventCounts.ongoing || 0,
          completed: eventCounts.completed || 0,
          cancelled: eventCounts.cancelled || 0,
        },
        ngos: {
          created: ngosCreated,
          verified: ngosVerified,
        },
        series,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ----------------------------------- Export -------------------------------- */

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

// GET /api/admin/export?type=users|volunteers|ngos|events|applications&from&to
async function exportCsv(req, res, next) {
  try {
    const type = ['users', 'volunteers', 'ngos', 'events', 'applications'].includes(req.query.type)
      ? req.query.type
      : 'users';

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const dateRange = rangeFilter(from, to);

    let header = [];
    let rows = [];

    if (type === 'users' || type === 'volunteers') {
      const filter = type === 'volunteers' ? { role: 'volunteer' } : {};
      if (dateRange) filter.createdAt = dateRange;
      header = [
        'Name',
        'Email',
        'Role',
        'Status',
        'Email verified',
        'Location',
        'Joined',
        'Last login',
      ];
      const users = await User.find(filter)
        .select('name email role accountStatus emailVerified location createdAt lastLoginAt')
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
      rows = users.map((u) => [
        u.name,
        u.email,
        u.role,
        u.accountStatus || 'active',
        u.emailVerified === false ? 'no' : 'yes',
        u.location || '',
        u.createdAt?.toISOString(),
        u.lastLoginAt?.toISOString(),
      ]);
    } else if (type === 'ngos') {
      const filter = {};
      if (dateRange) filter.createdAt = dateRange;
      header = ['Organisation', 'Location', 'Contact email', 'Verified', 'Status', 'Created'];
      const ngos = await NGO.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
      rows = ngos.map((n) => [
        n.organizationName,
        n.location,
        n.contactEmail,
        n.verified ? 'yes' : 'no',
        n.status || 'active',
        n.createdAt?.toISOString(),
      ]);
    } else if (type === 'events') {
      const filter = {};
      if (dateRange) filter.createdAt = dateRange;
      header = ['Title', 'NGO', 'Status', 'Date', 'Location', 'Capacity', 'Registered'];
      const events = await Event.find(filter)
        .populate({ path: 'ngoId', select: 'organizationName' })
        .sort({ date: -1 })
        .limit(5000)
        .lean();
      rows = events.map((e) => [
        e.title,
        e.ngoId?.organizationName || '',
        e.status,
        e.date?.toISOString(),
        e.location,
        e.requiredVolunteers,
        e.registeredVolunteers,
      ]);
    } else {
      const filter = {};
      if (dateRange) filter.createdAt = dateRange;
      header = ['Volunteer', 'Email', 'Opportunity', 'Status', 'Hours', 'Applied', 'Decided'];
      const applications = await Application.find(filter)
        .populate({ path: 'volunteerId', select: 'name email' })
        .populate({ path: 'eventId', select: 'title' })
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
      rows = applications.map((a) => [
        a.volunteerId?.name || '',
        a.volunteerId?.email || '',
        a.eventId?.title || '',
        a.status,
        a.hoursCredited,
        a.createdAt?.toISOString(),
        a.decidedAt?.toISOString(),
      ]);
    }

    await audit.record(req, {
      action: 'export.csv',
      entityType: 'Report',
      summary: `Exported ${type} CSV (${rows.length} rows)`,
      meta: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="seva-connect-${type}-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    return res.send(body);
  } catch (error) {
    next(error);
  }
}

/* --------------------------------- Settings -------------------------------- */

// GET /api/admin/settings
async function getSettings(req, res, next) {
  try {
    const settings = await getPlatformSettings({ fresh: true });
    return res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/settings
async function updateSettings(req, res, next) {
  try {
    const { platformName, supportEmail, registrationOpen, maintenanceNotice, announcementBanner } =
      req.body;

    const update = { updatedBy: req.user._id, updatedAt: new Date() };
    if (platformName !== undefined) update.platformName = platformName;
    if (supportEmail !== undefined) update.supportEmail = supportEmail;
    if (registrationOpen !== undefined) update.registrationOpen = registrationOpen;
    if (maintenanceNotice !== undefined) update.maintenanceNotice = maintenanceNotice;
    if (announcementBanner !== undefined) update.announcementBanner = announcementBanner;

    const settings = await PlatformSetting.findOneAndUpdate(
      { key: 'platform' },
      { $set: update, $setOnInsert: { key: 'platform' } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    clearPlatformSettingsCache();

    await audit.record(req, {
      action: 'settings.update',
      entityType: 'PlatformSetting',
      summary: 'Updated platform settings',
      meta: update,
    });

    return res.json({ success: true, message: 'Platform settings saved.', data: settings });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/profile
async function getProfile(req, res, next) {
  try {
    return res.json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/profile
async function updateProfile(req, res, next) {
  try {
    const allowed = ['name', 'phone', 'profileImage', 'location'];
    const user = req.user;

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });

    if (req.body.notificationPrefs && typeof req.body.notificationPrefs === 'object') {
      const prefs = req.body.notificationPrefs;
      ['inApp', 'email', 'reminders'].forEach((key) => {
        if (typeof prefs[key] === 'boolean') user.notificationPrefs[key] = prefs[key];
      });
    }

    await user.save();

    await audit.record(req, {
      action: 'admin.profile.update',
      entityType: 'User',
      entityId: user._id,
      summary: 'Updated administrator profile',
    });

    return res.json({ success: true, message: 'Profile updated.', data: user });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/security
async function getSecurity(req, res, next) {
  try {
    return res.json({
      success: true,
      data: {
        email: req.user.email,
        emailVerified: req.user.emailVerified !== false,
        emailVerifiedAt: req.user.emailVerifiedAt || null,
        lastLoginAt: req.user.lastLoginAt || null,
        createdAt: req.user.createdAt || null,
        tokenVersion: req.user.tokenVersion || 0,
        accountStatus: req.user.accountStatus || 'active',
        // JWTs are stateless; this claims no more than one active session per
        // issued token family after the most recent logout/password change.
        sessionsSupported: true,
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/security/logout-all
async function logoutAllSessions(req, res, next) {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });

    await audit.record(req, {
      action: 'admin.sessions.revoke',
      entityType: 'User',
      entityId: req.user._id,
      summary: 'Signed out of all devices',
    });

    return res.json({
      success: true,
      message: 'All sessions have been signed out. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  overview,
  listUsers,
  getUser,
  setUserStatus,
  setUserRole,
  listVolunteers,
  getVolunteer,
  assignVolunteer,
  listNGOs,
  getNGO,
  setNGOVerified,
  reviewNGO,
  setNGOStatus,
  listEvents,
  reviewEvent,
  setEventStatus,
  listApplications,
  listAudit,
  reports,
  exportCsv,
  getSettings,
  updateSettings,
  getProfile,
  updateProfile,
  getSecurity,
  logoutAllSessions,
};
