/**
 * Platform statistics.
 * GET /api/stats/public — aggregate counts computed from live records only.
 *
 * Nothing here is hardcoded: every number is a database count or aggregation,
 * so the homepage can never display invented impact figures.
 */
const User = require('../models/User');
const NGO = require('../models/NGO');
const Event = require('../models/Event');
const Application = require('../models/Application');

async function getPublicStats(req, res, next) {
  try {
    const [
      volunteers,
      ngos,
      verifiedNgos,
      pendingNgos,
      upcomingEvents,
      ongoingEvents,
      completedEvents,
      applications,
      hoursAgg,
    ] = await Promise.all([
      User.countDocuments({ role: 'volunteer', accountStatus: 'active' }),
      NGO.countDocuments({}),
      NGO.countDocuments({ verified: true }),
      NGO.countDocuments({ verified: false }),
      Event.countDocuments({ status: 'upcoming' }),
      Event.countDocuments({ status: 'ongoing' }),
      Event.countDocuments({ status: 'completed' }),
      Application.countDocuments({ status: { $in: ['pending', 'approved', 'completed'] } }),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        volunteers,
        ngos,
        verifiedNgos,
        pendingNgos,
        activeEvents: upcomingEvents + ongoingEvents,
        upcomingEvents,
        ongoingEvents,
        completedEvents,
        applications,
        verifiedHours: hoursAgg[0]?.hours || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPublicStats };
