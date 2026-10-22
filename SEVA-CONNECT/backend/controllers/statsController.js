/**
 * Platform statistics.
 * GET /api/stats/public     — headline counts (no PII)
 * GET /api/stats/impact     — real participation analytics
 * GET /api/stats/leaderboard — volunteer ranking by verified hours
 *
 * Every number is computed from live records. Nothing here is hardcoded.
 */
const User = require('../models/User');
const NGO = require('../models/NGO');
const Event = require('../models/Event');
const Application = require('../models/Application');

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function lastMonthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

function periodStart(period) {
  const now = Date.now();
  if (period === 'week') return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === 'month') return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

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

// GET /api/stats/impact
async function getImpact(req, res, next) {
  try {
    const months = lastMonthKeys(12);
    const trendMonths = lastMonthKeys(6);
    const firstMonth = new Date(`${months[0]}-01T00:00:00.000Z`);

    const [
      volunteers,
      ngos,
      verifiedNgos,
      opportunities,
      completedEvents,
      applications,
      completedActivities,
      uniqueVolunteers,
      hoursAgg,
      eventStatusRows,
      byCauseRows,
      byLocationRows,
      monthlyRows,
      trendRows,
      topNGORows,
    ] = await Promise.all([
      User.countDocuments({ role: 'volunteer', accountStatus: 'active' }),
      NGO.countDocuments({}),
      NGO.countDocuments({ verified: true }),
      Event.countDocuments({ status: { $in: ['upcoming', 'ongoing'] } }),
      Event.countDocuments({ status: 'completed' }),
      Application.countDocuments({ status: { $in: ['pending', 'approved', 'completed'] } }),
      Application.countDocuments({ status: 'completed' }),
      Application.distinct('volunteerId', { status: 'completed' }),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
      Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $unwind: { path: '$event.causes', preserveNullAndEmptyArrays: true } },
        { $match: { 'event.causes': { $nin: [null, ''] } } },
        {
          $group: {
            _id: '$event.causes',
            activities: { $sum: 1 },
            hours: { $sum: '$hoursCredited' },
          },
        },
        { $sort: { hours: -1, activities: -1 } },
        { $limit: 10 },
      ]),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $match: { 'event.location': { $nin: [null, ''] } } },
        {
          $group: {
            _id: '$event.location',
            activities: { $sum: 1 },
            hours: { $sum: '$hoursCredited' },
          },
        },
        { $sort: { hours: -1, activities: -1 } },
        { $limit: 8 },
      ]),
      Application.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: firstMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$completedAt', timezone: 'UTC' } },
            activities: { $sum: 1 },
            hours: { $sum: '$hoursCredited' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Application.aggregate([
        { $match: { createdAt: { $gte: new Date(`${trendMonths[0]}-01T00:00:00.000Z`) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
            applications: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Application.aggregate([
        { $match: { status: 'completed' } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $group: { _id: '$event.ngoId', activities: { $sum: 1 }, hours: { $sum: '$hoursCredited' } } },
        { $sort: { hours: -1, activities: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'ngos', localField: '_id', foreignField: '_id', as: 'ngo' } },
        { $unwind: '$ngo' },
        {
          $project: {
            _id: 0,
            ngoId: '$ngo._id',
            name: '$ngo.organizationName',
            verified: '$ngo.verified',
            activities: 1,
            hours: 1,
          },
        },
      ]),
    ]);

    const monthlyMap = new Map(monthlyRows.map((row) => [row._id, row]));
    const monthly = months.map((key) => ({
      month: key,
      label: monthLabel(key),
      activities: monthlyMap.get(key)?.activities || 0,
      hours: monthlyMap.get(key)?.hours || 0,
    }));

    const trendMap = new Map(trendRows.map((row) => [row._id, row.applications]));
    const applicationTrend = trendMonths.map((key) => ({
      month: key,
      label: monthLabel(key),
      applications: trendMap.get(key) || 0,
    }));

    const eventCounts = eventStatusRows.reduce(
      (acc, row) => ({ ...acc, [row._id]: row.count }),
      { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 }
    );
    const totalEvents = Object.values(eventCounts).reduce((sum, n) => sum + n, 0);

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        totals: {
          volunteers,
          ngos,
          verifiedNgos,
          opportunities,
          completedEvents,
          applications,
          completedActivities,
          activeContributors: uniqueVolunteers.length,
          verifiedHours: hoursAgg[0]?.hours || 0,
        },
        eventStats: {
          ...eventCounts,
          total: totalEvents,
          completionRate: totalEvents ? Math.round((eventCounts.completed / totalEvents) * 100) : 0,
        },
        byCause: byCauseRows.map((row) => ({
          cause: row._id,
          activities: row.activities,
          hours: row.hours,
        })),
        byLocation: byLocationRows.map((row) => ({
          location: row._id,
          activities: row.activities,
          hours: row.hours,
        })),
        monthly,
        applicationTrend,
        topNGOs: topNGORows,
        notes: {
          period: 'Last 12 months for monthly series; all-time for totals.',
          source: 'Completed applications with verified volunteer hours only.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/stats/leaderboard?period=all|week|month&limit=20
async function getLeaderboard(req, res, next) {
  try {
    const period = ['all', 'week', 'month'].includes(req.query.period) ? req.query.period : 'all';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const start = periodStart(period);

    const match = { status: 'completed', hoursCredited: { $gt: 0 } };
    if (start) match.completedAt = { $gte: start };

    const grouped = await Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$volunteerId',
          hours: { $sum: '$hoursCredited' },
          activities: { $sum: 1 },
          lastCompletedAt: { $max: '$completedAt' },
        },
      },
      { $sort: { hours: -1, activities: -1, lastCompletedAt: 1 } },
    ]);

    const volunteers = await User.find({
      _id: { $in: grouped.map((row) => row._id) },
      role: 'volunteer',
      accountStatus: 'active',
      leaderboardOptOut: { $ne: true },
    }).select('name profileImage location');

    const byId = new Map(volunteers.map((user) => [String(user._id), user]));

    const ranked = grouped
      .filter((row) => byId.has(String(row._id)))
      .map((row) => {
        const user = byId.get(String(row._id));
        return {
          volunteerId: String(user._id),
          name: user.name,
          profileImage: user.profileImage || '',
          location: user.location || '',
          hours: row.hours,
          activities: row.activities,
          lastCompletedAt: row.lastCompletedAt,
        };
      })
      .sort(
        (a, b) =>
          b.hours - a.hours ||
          b.activities - a.activities ||
          String(a.name).localeCompare(String(b.name))
      );

    let rank = 0;
    let previous = null;
    const withRanks = ranked.map((entry, index) => {
      const key = `${entry.hours}|${entry.activities}`;
      if (key !== previous) {
        rank = index + 1;
        previous = key;
      }
      return { rank, ...entry };
    });

    return res.json({
      success: true,
      data: {
        period,
        periodStart: start,
        totalParticipants: withRanks.length,
        totalHours: withRanks.reduce((sum, entry) => sum + entry.hours, 0),
        scoring:
          'Ranked by verified volunteer hours, then by number of completed activities. Equal scores share a rank. Only completed activities count; volunteers can opt out from their profile.',
        entries: withRanks.slice(0, limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPublicStats, getImpact, getLeaderboard };
