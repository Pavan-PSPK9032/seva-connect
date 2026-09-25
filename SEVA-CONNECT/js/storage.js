/* ============================================================
   SEVA CONNECT — storage.js
   LocalStorage "database" layer.
   Handles seeding of demo data, CRUD helpers, computations
   (impact score, levels, XP, streak, badges, DNA, matching).

   NOTE: This is a demo-only client-side storage. Because there
   is no backend, passwords are stored in plain text. Never use
   this pattern in production.
   ============================================================ */
(function () {
  'use strict';

  const PREFIX = 'sc_';

  const KEYS = {
    volunteers: 'volunteers',
    currentUser: 'currentUser',
    ngos: 'ngos',
    events: 'events',
    registrations: 'registrations',
    attendance: 'attendance',
    certificates: 'certificates',
    achievements: 'achievements',
    notifications: 'notifications',
    announcements: 'announcements',
    settings: 'settings',
    theme: 'theme',
    seeded: 'seeded'
  };

  /* ------------------------- core storage ------------------------- */

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[SC] Failed to read', key, e);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[SC] Failed to write', key, e);
      return false;
    }
  }

  function clearAll() {
    Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(PREFIX + k); });
  }

  /* --------------------------- helpers --------------------------- */

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 9000 + 1000);
  }

  function pad(n, len) {
    return String(n).padStart(len || 3, '0');
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateShift(days, base) {
    const d = base ? new Date(base) : new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysFromNow(iso) {
    const a = new Date(iso + 'T00:00:00');
    const b = new Date();
    b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  }

  function formatDate(iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    const o = opts || { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-IN', o);
  }

  function weekKey(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = (d.getDay() + 6) % 7; // Monday start
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function initials(name) {
    return (name || 'SC').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  function slugify(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function memberOf(arr, value) {
    return Array.isArray(arr) && arr.indexOf(value) !== -1;
  }

  function intersect(a, b) {
    return (a || []).filter(function (x) { return (b || []).indexOf(x) !== -1; });
  }

  /* ============================================================
     BADGES (achievements)
     Auto-unlock based on volunteer activity.
     ============================================================ */

  const LEVELS = [
    { name: 'New Volunteer', min: 0, icon: '🌱' },
    { name: 'Active Helper', min: 150, icon: '⚡' },
    { name: 'Community Contributor', min: 350, icon: '🤝' },
    { name: 'Social Impact Champion', min: 600, icon: '🏅' },
    { name: 'Community Leader', min: 1000, icon: '👑' }
  ];

  const BADGES = [
    { id: 'first-step', name: 'First Step', emoji: '🥉', category: 'Milestone', desc: 'Attended your first volunteering event. Everyone starts somewhere!' },
    { id: 'helping-hand', name: 'Helping Hand', emoji: '🤝', category: 'Hours', desc: 'Completed 5+ volunteer hours.' },
    { id: 'community-hero', name: 'Community Hero', emoji: '🏆', category: 'Milestone', desc: 'Attended 10+ volunteering events.' },
    { id: 'green-warrior', name: 'Green Warrior', emoji: '🌱', category: 'Environment', desc: 'Took part in 3+ environmental activities.' },
    { id: 'care-giver', name: 'Care Giver', emoji: '❤️', category: 'Healthcare', desc: 'Helped in 3+ healthcare / elderly care activities.' },
    { id: 'education-champion', name: 'Education Champion', emoji: '📚', category: 'Education', desc: 'Contributed to 3+ education drives.' },
    { id: 'life-saver', name: 'Life Saver', emoji: '🩸', category: 'Healthcare', desc: 'Supported 2+ health & blood donation camps.' },
    { id: 'animal-friend', name: 'Animal Friend', emoji: '🐾', category: 'Welfare', desc: 'Helped in 2+ animal welfare activities.' },
    { id: 'consistency-champion', name: 'Consistency Champion', emoji: '🔥', category: 'Consistency', desc: 'Maintained a 7+ week volunteering streak.' },
    { id: 'impact-leader', name: 'Impact Leader', emoji: '🌍', category: 'Milestone', desc: 'Reached 700+ Impact Score.' }
  ];

  function badgeCondition(badge, s) {
    switch (badge.id) {
      case 'first-step': return s.events >= 1;
      case 'helping-hand': return s.hours >= 5;
      case 'community-hero': return s.events >= 10;
      case 'green-warrior': return s.categories['Environment'] >= 3;
      case 'care-giver': return s.categories['Healthcare'] + s.categories['Elderly Care'] >= 3;
      case 'education-champion': return s.categories['Education'] >= 3;
      case 'life-saver': return s.categories['Healthcare'] + s.categories['Blood Donation'] >= 2;
      case 'animal-friend': return s.categories['Animal Welfare'] >= 2;
      case 'consistency-champion': return s.streak >= 7;
      case 'impact-leader': return s.impactScore >= 700;
      default: return false;
    }
  }

  /* ============================================================
     IMPACT MODEL — time → impact estimates (demo calculations)
     ============================================================ */

  const IMPACT_MODEL = [
    { key: 'food', label: 'Food Distribution', unit: 'meals', perHour: 15 },
    { key: 'teaching', label: 'Teaching & Mentoring', unit: 'children taught', perHour: 8 },
    { key: 'environment', label: 'Tree Plantation & Cleanup', unit: 'trees / clean-up bags', perHour: 10 },
    { key: 'health', label: 'Healthcare Support', unit: 'people assisted', perHour: 6 },
    { key: 'blood', label: 'Blood Donation Drives', unit: 'blood units supported', perHour: 2 },
    { key: 'digital', label: 'Digital Literacy', unit: 'people trained', perHour: 7 },
    { key: 'women', label: 'Women Empowerment', unit: 'women reached', perHour: 9 },
    { key: 'animal', label: 'Animal Welfare', unit: 'animals helped', perHour: 11 },
    { key: 'elderly', label: 'Elderly Care', unit: 'elders supported', perHour: 5 },
    { key: 'disaster', label: 'Disaster Relief', unit: 'families supported', perHour: 4 }
  ];

  /* ============================================================
     VOLUNTEERS
     ============================================================ */

  function generateVolunteerId() {
    const vols = get(KEYS.volunteers, []);
    let n = 1;
    const ids = vols.map(function (v) { return v.id; });
    while (ids.indexOf('SCV-' + new Date().getFullYear() + '-' + pad(n, 3)) !== -1) { n += 1; }
    return 'SCV-' + new Date().getFullYear() + '-' + pad(n, 3);
  }

  function findVolunteerByEmail(email) {
    const vols = get(KEYS.volunteers, []);
    return vols.find(function (v) { return v.email.toLowerCase() === String(email).toLowerCase(); }) || null;
  }

  function getVolunteerById(id) {
    return get(KEYS.volunteers, []).find(function (v) { return v.id === id; }) || null;
  }

  function saveVolunteer(volunteer) {
    const vols = get(KEYS.volunteers, []);
    const i = vols.findIndex(function (v) { return v.id === volunteer.id; });
    if (i === -1) { vols.push(volunteer); } else { vols[i] = volunteer; }
    set(KEYS.volunteers, vols);
    return volunteer;
  }

  function deleteVolunteer(id) {
    set(KEYS.volunteers, get(KEYS.volunteers, []).filter(function (v) { return v.id !== id; }));
    set(KEYS.registrations, get(KEYS.registrations, []).filter(function (r) { return r.volunteerId !== id; }));
    set(KEYS.attendance, get(KEYS.attendance, []).filter(function (a) { return a.volunteerId !== id; }));
    set(KEYS.certificates, get(KEYS.certificates, []).filter(function (c) { return c.volunteerId !== id; }));
    set(KEYS.notifications, get(KEYS.notifications, []).filter(function (n) { return n.userId !== id; }));
    const ach = get(KEYS.achievements, {});
    if (ach[id]) { delete ach[id]; set(KEYS.achievements, ach); }
  }

  /* ============================================================
     SESSIONS / AUTH (demo only)
     ============================================================ */

  function login(email, password) {
    const v = findVolunteerByEmail(email);
    if (!v) return { ok: false, message: 'No account found with this email.' };
    if (v.password !== password) return { ok: false, message: 'Incorrect password. Please try again.' };
    if (v.status === 'inactive') return { ok: false, message: 'Your account has been deactivated. Contact support.' };
    set(KEYS.currentUser, v.id);
    const vol = getVolunteerById(v.id);
    if (vol) { vol.lastActive = todayISO(); saveVolunteer(vol); }
    return { ok: true, volunteer: vol || v };
  }

  function logout() {
    localStorage.removeItem(PREFIX + KEYS.currentUser);
  }

  function currentUser() {
    const id = get(KEYS.currentUser, null);
    if (!id) return null;
    return getVolunteerById(id) || null;
  }

  /* ============================================================
     REGISTRATIONS (kind: 'event' | 'ngo')
     ============================================================ */

  function isRegistered(volunteerId, kind, refId) {
    return get(KEYS.registrations, []).some(function (r) {
      return r.volunteerId === volunteerId && r.kind === kind && r.refId === refId;
    });
  }

  function register(volunteerId, kind, refId) {
    if (isRegistered(volunteerId, kind, refId)) return false;
    const regs = get(KEYS.registrations, []);
    regs.push({ id: uid('REG'), volunteerId: volunteerId, kind: kind, refId: refId, at: todayISO() });
    set(KEYS.registrations, regs);
    return true;
  }

  function unregister(volunteerId, kind, refId) {
    set(KEYS.registrations, get(KEYS.registrations, []).filter(function (r) {
      return !(r.volunteerId === volunteerId && r.kind === kind && r.refId === refId);
    }));
  }

  function registrationsOf(volunteerId, kind) {
    return get(KEYS.registrations, []).filter(function (r) {
      return r.volunteerId === volunteerId && (!kind || r.kind === kind);
    });
  }

  /* ============================================================
     ATTENDANCE
     ============================================================ */

  function attendanceOf(volunteerId) {
    return get(KEYS.attendance, []).filter(function (a) { return a.volunteerId === volunteerId; });
  }

  function checkIn(volunteerId, eventId, eventName, eventCategory) {
    const now = new Date();
    const rec = {
      id: uid('ATT'),
      volunteerId: volunteerId,
      eventId: eventId || '',
      eventName: eventName || 'General Volunteering Session',
      eventCategory: eventCategory || 'Community',
      date: todayISO(),
      checkIn: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOut: null,
      hours: 0,
      status: 'checked-in'
    };
    const att = get(KEYS.attendance, []);
    att.push(rec);
    set(KEYS.attendance, att);
    return rec;
  }

  function checkOut(volunteerId, attendanceId) {
    const att = get(KEYS.attendance, []);
    const rec = att.find(function (a) { return a.id === attendanceId && a.volunteerId === volunteerId; });
    if (!rec || rec.checkOut) return null;
    rec.checkOut = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const parsed = function (t) {
      const mm = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!mm) return 0;
      let h = parseInt(mm[1], 10);
      const m = parseInt(mm[2], 10);
      if (mm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (mm[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    let mins = parsed(rec.checkOut) - parsed(rec.checkIn);
    if (mins < 0) mins += 24 * 60;
    rec.hours = Math.round(mins / 60 * 10) / 10;
    rec.status = 'completed';
    set(KEYS.attendance, att);
    return rec;
  }

  /* ============================================================
     CERTIFICATES
     ============================================================ */

  function generateCertificateId() {
    const certs = get(KEYS.certificates, []);
    const year = new Date().getFullYear();
    let n = certs.filter(function (c) { return String(c.id).indexOf(year) !== -1; }).length + 1;
    return 'SEC-' + year + '-' + pad(n, 4);
  }

  function issueCertificate(volunteerId, ngo, event, hours) {
    const vol = getVolunteerById(volunteerId);
    if (!vol) return null;
    const cert = {
      id: uid('CERT'),
      certificateId: generateCertificateId(),
      volunteerId: volunteerId,
      volunteerName: vol.fullName,
      volunteerIdNumber: vol.id,
      ngo: ngo || 'Seva Connect',
      event: event || 'Volunteering Service',
      hours: hours || 0,
      date: todayISO()
    };
    const certs = get(KEYS.certificates, []);
    certs.push(cert);
    set(KEYS.certificates, certs);
    return cert;
  }

  function verifyCertificate(certificateId) {
    const certs = get(KEYS.certificates, []);
    return certs.find(function (c) { return c.certificateId === certificateId; }) || null;
  }

  function certificatesOf(volunteerId) {
    return get(KEYS.certificates, []).filter(function (c) { return c.volunteerId === volunteerId; });
  }

  /* ============================================================
     STATS — hours, events, streak, XP, level, impact score, badges
     ============================================================ */

  function computeStats(volunteerId) {
    const att = attendanceOf(volunteerId).filter(function (a) { return a.status === 'completed'; });
    const vols = get(KEYS.volunteers, []);
    const volunteer = vols.find(function (v) { return v.id === volunteerId; });
    const regs = registrationsOf(volunteerId);

    let hours = 0;
    const dates = [];
    const categories = {};
    att.forEach(function (a) {
      hours += a.hours || 0;
      dates.push(a.date);
      const cat = a.eventCategory || 'Community';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const ngosJoined = regs.filter(function (r) { return r.kind === 'ngo'; }).length;
    const eventsJoined = regs.filter(function (r) { return r.kind === 'event'; }).length;
    // events actually attended = distinct attendance days that were event-based
    const eventsAttended = new Set(att.map(function (a) { return a.eventId || a.date + a.eventName; })).size;
    const tasks = att.length + eventsJoined;

    // streak in weeks (consecutive weeks with at least one attendance)
    const uniqWeeks = Array.from(new Set(dates.map(weekKey))).sort(function (a, b) { return b - a; });
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today); const tw = (thisWeek.getDay() + 6) % 7; thisWeek.setDate(thisWeek.getDate() - tw);
    let expected = thisWeek.getTime();
    if (uniqWeeks.length) {
      // allow current week or last week as start point
      if (uniqWeeks[0] === expected || uniqWeeks[0] === expected - 7 * 24 * 3600 * 1000) {
        let w = uniqWeeks[0];
        streak = 1;
        for (let i = 1; i < uniqWeeks.length; i++) {
          if (uniqWeeks[i] === w - 7 * 24 * 3600 * 1000) { streak += 1; w = uniqWeeks[i]; }
          else break;
        }
      }
    }

    const xp = Math.round(hours * 10 + eventsAttended * 20 + ngosJoined * 40 + tasks * 2 + streak * 5);
    const impactScore = Math.round(hours * 10 + eventsAttended * 25 + ngosJoined * 35 + streak * 8);

    let levelIndex = 0;
    LEVELS.forEach(function (l, i) { if (xp >= l.min) levelIndex = i; });
    const level = LEVELS[levelIndex];
    const next = LEVELS[levelIndex + 1];
    const levelProgress = next ? Math.min(100, Math.round((xp - level.min) / (next.min - level.min) * 100)) : 100;

    // badge evaluation
    const ach = get(KEYS.achievements, {});
    const unlocked = ach[volunteerId] || [];
    const s = { hours: Math.round(hours * 10) / 10, events: eventsAttended, ngos: ngosJoined, tasks: tasks, streak: streak, categories: categories, impactScore: impactScore };
    const newlyUnlocked = [];
    BADGES.forEach(function (b) {
      if (unlocked.indexOf(b.id) === -1 && badgeCondition(b, s)) {
        unlocked.push(b.id);
        newlyUnlocked.push(b);
      }
    });
    if (newlyUnlocked.length) { ach[volunteerId] = unlocked; set(KEYS.achievements, ach); }

    const peopleHelped = Math.round(impactScore / ((volunteer && volunteer._peopleDivisor) || 3.4));

    return {
      hours: Math.round(hours * 10) / 10,
      eventsJoined: eventsJoined,
      eventsAttended: eventsAttended,
      ngosJoined: ngosJoined,
      tasks: tasks,
      streak: streak,
      xp: xp,
      levelIndex: levelIndex,
      levelName: level.name,
      levelIcon: level.icon,
      levelProgress: levelProgress,
      nextLevel: next ? next.name : 'Max Level',
      impactScore: impactScore,
      peopleHelped: peopleHelped,
      categories: categories,
      badges: unlocked,
      newlyUnlocked: newlyUnlocked
    };
  }

  function getBadgeById(id) {
    return BADGES.find(function (b) { return b.id === id; }) || null;
  }

  function getBadgesFor(volunteerId) {
    const stats = computeStats(volunteerId);
    return BADGES.map(function (b) {
      return { badge: b, unlocked: stats.badges.indexOf(b.id) !== -1 };
    });
  }

  function getLeaderboard() {
    const vols = get(KEYS.volunteers, []).filter(function (v) { return v.role !== 'admin' && v.status !== 'inactive'; });
    return vols.map(function (v) {
      const st = computeStats(v.id);
      return { volunteer: v, stats: st };
    }).sort(function (a, b) { return b.stats.impactScore - a.stats.impactScore; });
  }

  /* ============================================================
     VOLUNTEER DNA — interest/activity based profile
     ============================================================ */

  function computeDNA(volunteer) {
    const base = {
      Education: 0, Environment: 0, Technology: 0, Community: 0, Leadership: 0
    };
    const interestMap = {
      Education: 'Education', Healthcare: 'Community', Environment: 'Environment',
      'Women Empowerment': 'Community', 'Child Welfare': 'Community', 'Animal Welfare': 'Environment',
      'Food Distribution': 'Community', 'Blood Donation': 'Community', 'Elderly Care': 'Community',
      'Disaster Relief': 'Community'
    };
    (volunteer.interests || []).forEach(function (i) { if (interestMap[i]) base[interestMap[i]] += 30; });
    (volunteer.skills || []).forEach(function (s) {
      if (/coding|technology|design|digital/i.test(s)) base.Technology += 25;
      if (/teaching|writing|content/i.test(s)) base.Education += 20;
      if (/event|marketing|social|fundrais|lead/i.test(s)) base.Leadership += 25;
      if (/social|marketing|fundrais|event/i.test(s)) base.Community += 15;
    });

    const stats = computeStats(volunteer.id);
    Object.keys(stats.categories).forEach(function (cat) {
      if (/Education/i.test(cat)) base.Education += 15 * stats.categories[cat];
      else if (/Environment|Animal/i.test(cat)) base.Environment += 15 * stats.categories[cat];
      else if (/Health|Food|Child|Elderly|Blood/i.test(cat)) base.Community += 15 * stats.categories[cat];
      else if (/Digital|Tech/i.test(cat)) base.Technology += 15 * stats.categories[cat];
      else base.Leadership += 10 * stats.categories[cat];
    });

    const keys = Object.keys(base);
    const max = Math.max.apply(Math, keys.map(function (k) { return base[k]; }), 100);
    return keys.map(function (k) {
      return { label: k, value: Math.min(100, Math.round(base[k] / max * 100)) };
    });
  }

  /* ============================================================
     RECOMMENDATIONS — AI volunteer matching engine (frontend)
     ============================================================ */

  function recommend(volunteer, limit) {
    if (!volunteer) return [];
    const events = get(KEYS.events, []).filter(function (e) { return e.status === 'upcoming'; });
    const scored = events.map(function (e) {
      let score = 40; // base affinity
      if (memberOf(volunteer.interests, e.category)) score += 25;
      if (intersect(volunteer.skills, e.skills).length) score += 20;
      if (volunteer.city && e.location && volunteer.city.toLowerCase() === String(e.location).toLowerCase()) score += 15;
      if (intersect(volunteer.availability, e.days).length) score += 10;
      if (intersect(volunteer.availability, e.timeOfDay).length) score += 5;
      if (isRegistered(volunteer.id, 'event', e.id)) score -= 60;
      const reasons = [];
      if (memberOf(volunteer.interests, e.category)) reasons.push('Matches your interest in ' + e.category);
      if (intersect(volunteer.skills, e.skills).length) reasons.push('Uses your skills: ' + intersect(volunteer.skills, e.skills).join(', '));
      if (volunteer.city && volunteer.city.toLowerCase() === String(e.location).toLowerCase()) reasons.push('Located in ' + e.location);
      if (intersect(volunteer.availability, e.days).length) reasons.push('Fits your ' + intersect(volunteer.availability, e.days).join(', ') + ' availability');
      return { event: e, score: Math.min(99, Math.round(score / 130 * 100)), reasons: reasons };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return (limit ? scored.slice(0, limit) : scored).map(function (r) { return { event: r.event, match: r.score, reasons: r.reasons }; });
  }

  /* ============================================================
     IMPACT ESTIMATE
     ============================================================ */

  function estimateImpact(hours, activityKey) {
    const model = IMPACT_MODEL.find(function (m) { return m.key === activityKey; }) || IMPACT_MODEL[0];
    const qty = Math.round(hours * model.perHour);
    return { label: model.label, unit: model.unit, quantity: qty, perHour: model.perHour };
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  function getNotifications(userId) {
    return get(KEYS.notifications, []).filter(function (n) {
      return !n.userId || n.userId === userId;
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function pushNotification(userId, notification) {
    const list = get(KEYS.notifications, []);
    list.push(Object.assign({
      id: uid('NTF'),
      userId: userId,
      type: 'info',
      title: 'Notification',
      message: '',
      icon: '🔔',
      date: todayISO(),
      read: false
    }, notification));
    set(KEYS.notifications, list);
  }

  function markNotificationRead(userId, notifId) {
    const list = get(KEYS.notifications, []);
    list.forEach(function (n) {
      if ((!n.userId || n.userId === userId) && n.id === notifId) n.read = true;
    });
    set(KEYS.notifications, list);
  }

  function markAllNotificationsRead(userId) {
    const list = get(KEYS.notifications, []);
    list.forEach(function (n) { if (!n.userId || n.userId === userId) n.read = true; });
    set(KEYS.notifications, list);
  }

  function clearNotifications(userId) {
    set(KEYS.notifications, get(KEYS.notifications, []).filter(function (n) { return n.userId && n.userId !== userId; }));
  }

  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */

  function search(query) {
    const q = String(query || '').trim().toLowerCase();
    const result = { ngos: [], events: [], volunteers: [], skills: [], causes: [] };
    if (!q) return result;
    const inQ = function (str) { return String(str || '').toLowerCase().indexOf(q) !== -1; };

    get(KEYS.ngos, []).forEach(function (n) {
      if (inQ(n.name) || inQ(n.category) || inQ(n.location) || inQ(n.description)) result.ngos.push(n);
      if (inQ(n.category) && result.causes.indexOf(n.category) === -1) result.causes.push(n.category);
    });
    get(KEYS.events, []).forEach(function (e) {
      if (inQ(e.title) || inQ(e.category) || inQ(e.location) || inQ(e.ngoName)) result.events.push(e);
    });
    get(KEYS.volunteers, []).forEach(function (v) {
      if (inQ(v.fullName) || inQ(v.city)) result.volunteers.push(v);
      (v.skills || []).forEach(function (s) { if (inQ(s) && result.skills.indexOf(s) === -1) result.skills.push(s); });
    });
    get(KEYS.events, []).forEach(function (e) {
      if (inQ(e.category) && result.causes.indexOf(e.category) === -1) result.causes.push(e.category);
    });
    return result;
  }

  /* ============================================================
     ANNOUNCEMENTS
     ============================================================ */

  function getAnnouncements() {
    return get(KEYS.announcements, []).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  /* ============================================================
     SEED — realistic demo data created on first load
     ============================================================ */

  function seed() {
    if (get(KEYS.seeded, false)) return;

    const SKILLS = ['Teaching', 'Coding', 'Designing', 'Marketing', 'Photography', 'Healthcare', 'Fundraising', 'Event Management', 'Social Media', 'Content Writing'];
    const INTERESTS = ['Education', 'Healthcare', 'Environment', 'Women Empowerment', 'Child Welfare', 'Animal Welfare', 'Food Distribution', 'Blood Donation', 'Elderly Care', 'Disaster Relief'];
    const AVAIL = ['Weekdays', 'Weekends', 'Morning', 'Afternoon', 'Evening'];

    const v = function (fullName, email, city, state, skills, interests, availability, extra) {
      return Object.assign({
        id: generateVolunteerId(),
        fullName: fullName,
        email: email,
        phone: '+91 9' + Math.floor(100000000 + Math.random() * 899999999),
        password: '123456',
        age: 20 + Math.floor(Math.random() * 18),
        gender: 'Female',
        photo: '',
        address: 'Street No. ' + (10 + Math.floor(Math.random() * 80)) + ', ' + city,
        city: city,
        state: state,
        skills: skills,
        interests: interests,
        availability: availability,
        education: ['High School', 'B.Sc.', 'B.Tech', 'B.Com', 'MBA', 'M.A.'][Math.floor(Math.random() * 6)],
        occupation: ['Student', 'Software Engineer', 'Teacher', 'Designer', 'Freelancer', 'Data Analyst', 'Manager'][Math.floor(Math.random() * 7)],
        emergencyContact: '+91 9' + Math.floor(100000000 + Math.random() * 899999999),
        motivation: 'I want to give back to my community and create lasting social impact through consistent volunteering.',
        bio: '',
        preferredActivity: 'Community work',
        timeAvailable: 'Weekends',
        role: 'volunteer',
        status: 'active',
        joinedDate: dateShift(-40 - Math.floor(Math.random() * 300)),
        lastActive: todayISO()
      }, extra || {});
    };

    const volunteers = [
      v('Priya Patel', 'demo@sevaconnect.com', 'Hyderabad', 'Telangana', ['Teaching', 'Event Management', 'Marketing'], ['Education', 'Environment', 'Child Welfare'], ['Weekends', 'Morning'], { bio: 'Passionate educator who believes every child deserves a bright future.' }),
      v('Ananya Sharma', 'ananya@example.com', 'Hyderabad', 'Telangana', ['Coding', 'Content Writing'], ['Education', 'Environment'], ['Weekends', 'Evening']),
      v('Rohan Verma', 'rohan@example.com', 'Bengaluru', 'Karnataka', ['Coding', 'Photography', 'Social Media'], ['Environment', 'Animal Welfare'], ['Weekdays', 'Evening']),
      v('Arjun Reddy', 'arjun@example.com', 'Warangal', 'Telangana', ['Healthcare', 'Fundraising'], ['Healthcare', 'Blood Donation'], ['Weekends', 'Morning']),
      v('Sneha Kulkarni', 'sneha@example.com', 'Mumbai', 'Maharashtra', ['Designing', 'Marketing'], ['Women Empowerment', 'Education'], ['Weekends', 'Afternoon']),
      v('Vikram Singh', 'vikram@example.com', 'Delhi', 'Delhi NCR', ['Event Management', 'Fundraising'], ['Disaster Relief', 'Elderly Care'], ['Weekdays', 'Evening']),
      v('Meera Iyer', 'meera@example.com', 'Chennai', 'Tamil Nadu', ['Teaching', 'Healthcare'], ['Child Welfare', 'Healthcare'], ['Weekends', 'Morning']),
      v('Karthik Rao', 'karthik@example.com', 'Visakhapatnam', 'Andhra Pradesh', ['Coding', 'Photography'], ['Environment', 'Education'], ['Weekends', 'Morning']),
      v('Divya Nair', 'divya@example.com', 'Vijayawada', 'Andhra Pradesh', ['Content Writing', 'Social Media'], ['Women Empowerment', 'Food Distribution'], ['Weekends', 'Afternoon']),
      v('Rahul Gupta', 'rahul@example.com', 'Secunderabad', 'Telangana', ['Marketing', 'Fundraising'], ['Animal Welfare', 'Disaster Relief'], ['Weekends', 'Evening']),
      v('Admin User', 'admin@sevaconnect.com', 'Hyderabad', 'Telangana', ['Event Management', 'Fundraising'], ['Education', 'Environment', 'Healthcare'], ['Weekdays', 'Morning'], { id: 'SCV-ADMIN-001', role: 'admin' })
    ];
    set(KEYS.volunteers, volunteers);

    const NGO = function (id, name, category, location, emoji, description, mission, skillsNeeded, rating, projects, volunteersCount, founded, verified, impact, extra) {
      return Object.assign({
        id: id,
        name: name,
        category: category,
        location: location,
        city: location,
        logo: emoji,
        color: ['#2E8B57', '#FF9800', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#F44336'][Math.floor(Math.random() * 8)],
        color2: ['#4CAF50', '#FFB74D', '#66BB6A', '#64B5F6', '#F06292', '#BA68C8', '#4DD0E1', '#FF7043'][Math.floor(Math.random() * 8)],
        description: description,
        mission: mission,
        skillsNeeded: skillsNeeded,
        rating: rating,
        projects: projects,
        volunteersCount: volunteersCount,
        founded: founded,
        verified: verified,
        contact: { phone: '+91 9' + Math.floor(100000000 + Math.random() * 899999999), email: 'hello@' + String(slugify(name)).replace(/-/g, '') + '.org', website: slugify(name) + '.org' },
        impact: impact || { peopleHelped: 5000, hoursMobilized: 12000 },
        status: 'approved',
        joinedOn: dateShift(-60)
      }, extra || {});
    };
    const ngos = [
      NGO('NGO-001', 'VidyaLok Trust', 'Education', 'Hyderabad', '📚', 'Empowering underprivileged children and youth through free education, digital literacy and mentorship programs.',
        'To make quality education accessible to every child, regardless of background.', ['Teaching', 'Coding', 'Content Writing'], 4.8, 14, 320, 2015, true, { peopleHelped: 12000, hoursMobilized: 28000 }),
      NGO('NGO-002', 'GreenSparks Foundation', 'Environment', 'Bengaluru', '🌳', 'Driving tree plantation drives, clean-ups and climate awareness campaigns across urban India.',
        'A greener tomorrow through collective action and environmental stewardship.', ['Event Management', 'Photography', 'Social Media'], 4.9, 22, 480, 2016, true, { peopleHelped: 30000, hoursMobilized: 45000 }),
      NGO('NGO-003', 'LifeBridge Care', 'Healthcare', 'Chennai', '🏥', 'Free health camps, elderly care visits and community healthcare awareness programs.',
        'Healthy communities are built by caring hands. We bridge care to those who need it most.', ['Healthcare', 'Fundraising'], 4.7, 18, 260, 2014, true, { peopleHelped: 18000, hoursMobilized: 22000 }),
      NGO('NGO-004', 'Sakhi Foundation', 'Women Empowerment', 'Vijayawada', '🌸', 'Skill development, financial literacy and livelihood programs for women entrepreneurs.',
        'Empowering women to lead, earn and inspire.', ['Teaching', 'Designing', 'Marketing'], 4.8, 16, 210, 2017, true, { peopleHelped: 9000, hoursMobilized: 15000 }),
      NGO('NGO-005', 'Little Wings', 'Child Welfare', 'Visakhapatnam', '🧸', 'Child education, nutrition and safe-shelter initiatives for children in need.',
        'Every child deserves a childhood of safety, joy and learning.', ['Teaching', 'Healthcare', 'Fundraising'], 4.6, 20, 350, 2013, true, { peopleHelped: 15000, hoursMobilized: 20000 }),
      NGO('NGO-006', 'Paws & Care', 'Animal Welfare', 'Warangal', '🐾', 'Street animal rescue, feeding drives and adoption camps for voiceless friends.',
        'A compassionate world where every animal is safe and loved.', ['Photography', 'Fundraising', 'Event Management'], 4.7, 12, 180, 2019, true, { peopleHelped: 6000, hoursMobilized: 9000 }),
      NGO('NGO-007', 'Annapurna Seva', 'Food Distribution', 'Secunderabad', '🍛', 'Meal distribution drives, ration kits and hunger-relief programs for urban communities.',
        'No one in our city should sleep hungry.', ['Fundraising', 'Event Management', 'Social Media'], 4.9, 30, 520, 2012, true, { peopleHelped: 45000, hoursMobilized: 52000 }),
      NGO('NGO-008', 'Drop & Save', 'Blood Donation', 'Mumbai', '🩸', 'Organising blood donation camps and maintaining a ready network of voluntary donors.',
        'Every donated unit is a life saved.', ['Healthcare', 'Marketing'], 4.8, 25, 410, 2014, true, { peopleHelped: 25000, hoursMobilized: 18000 })
    ];
    set(KEYS.ngos, ngos);

    const EVENT = function (id, title, ngoId, dateOffset, time, location, category, icon, description, capacity, skills, days, timeOfDay, occupied) {
      const ngo = ngos.find(function (n) { return n.id === ngoId; });
      return {
        id: id,
        title: title,
        ngoId: ngoId,
        ngoName: ngo.name,
        ngoLogo: ngo.logo,
        icon: icon,
        color: ngo.color,
        color2: ngo.color2,
        date: dateShift(dateOffset, new Date()),
        time: time,
        location: location,
        category: category,
        description: description,
        capacity: capacity,
        registered: occupied || [],
        skills: skills,
        days: days,
        timeOfDay: timeOfDay,
        status: dateOffset < 0 ? 'completed' : 'upcoming',
        createdAt: dateShift(-15)
      };
    };
    const events = [
      EVENT('EVT-001', 'Digital Literacy Workshop', 'NGO-001', 7, '10:00 AM', 'Hyderabad', 'Education', '💻', 'Hands-on workshop teaching computer basics, internet safety and online job skills to students and job seekers.', 40, ['Coding', 'Teaching', 'Content Writing'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-002', 'Tree Plantation Drive', 'NGO-002', 9, '7:30 AM', 'Bengaluru', 'Environment', '🌳', 'Plant 500 saplings in the city green belt with the local forest department. Gloves and saplings provided.', 60, ['Event Management', 'Photography'], ['Weekend'], ['Morning'], ['SCV-2026-004']),
      EVENT('EVT-003', 'Food Distribution Drive', 'NGO-007', 12, '11:00 AM', 'Secunderabad', 'Food Distribution', '🍛', 'Pack and distribute 500+ hot meals to daily-wage earners and families in need.', 50, ['Event Management', 'Fundraising'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-004', 'Blood Donation Camp', 'NGO-008', 16, '9:00 AM', 'Mumbai', 'Blood Donation', '🩸', 'Volunteer support camp at a city hospital — registration help, donor care and refreshments.', 35, ['Healthcare', 'Marketing'], ['Weekend'], ['Morning'], ['SCV-2026-003']),
      EVENT('EVT-005', 'Beach Cleanup Drive', 'NGO-002', 22, '6:30 AM', 'Chennai', 'Environment', '🏖️', 'Morning cleanup of the Marina coastline. Materials and refreshments provided.', 80, ['Event Management', 'Photography', 'Social Media'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-006', 'Women Skill Development Camp', 'NGO-004', 28, '10:30 AM', 'Vijayawada', 'Women Empowerment', '🌸', 'A two-day skill camp teaching tailoring, digital payments and small-business basics to women.', 45, ['Teaching', 'Designing', 'Marketing'], ['Weekend'], ['Afternoon'], null),
      EVENT('EVT-007', 'Teach-a-Child Workshop', 'NGO-001', 34, '9:30 AM', 'Hyderabad', 'Education', '📚', 'Fun learning sessions for children from shelter homes — maths, reading and crafts.', 30, ['Teaching', 'Content Writing'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-008', 'Elderly Care Visit', 'NGO-003', -12, '10:00 AM', 'Chennai', 'Elderly Care', '❤️', 'A day of companionship, health check-up assistance and groceries for senior citizens at a care home.', 25, ['Healthcare'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-009', 'Animal Rescue & Care', 'NGO-006', -20, '8:00 AM', 'Warangal', 'Animal Welfare', '🐾', 'Rescue coordination, feeding and vaccination support for street animals.', 30, ['Healthcare', 'Photography', 'Event Management'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-010', 'Education Supply Drive', 'NGO-005', -35, '9:00 AM', 'Visakhapatnam', 'Education', '🎒', 'Collect, pack and distribute school supplies for children at community schools.', 40, ['Event Management', 'Fundraising'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-011', 'Health Awareness Camp', 'NGO-003', -60, '10:00 AM', 'Mumbai', 'Healthcare', '🏥', 'Free BP, sugar and BMI screening camp plus wellness talks for urban slum residents.', 35, ['Healthcare'], ['Weekend'], ['Morning'], null),
      EVENT('EVT-012', 'Ration Kit Marathon', 'NGO-007', -90, '9:00 AM', 'Delhi', 'Food Distribution', '📦', 'Pack 1000 ration kits for families across 20 shelter clusters in one day.', 55, ['Event Management', 'Marketing'], ['Weekend'], ['Morning'], null)
    ];
    set(KEYS.events, events);

    /* -------- attendance -------- */
    const attendance = [];
    let attSeq = 0;
    const demoId = volunteers[0].id;
    const pastEvents = [events[7], events[8], events[9], events[10], events[11]];
    // 9 weekly sessions for demo volunteer (5 from real past events + 4 general)
    const timeHours = function (h) {
      const hour = Math.floor(h);
      const mins = Math.round((h - hour) * 60);
      const ampm = (hour >= 12) ? 'PM' : 'AM';
      const hh = ((hour % 12) || 12);
      return hh + ':' + String(mins).padStart(2, '0') + ' ' + ampm;
    };
    [0, 0, 1, 2, 3, 4, 0, 1, 2].forEach(function (pi, i) {
      const ev = pi < pastEvents.length ? pastEvents[pi] : null;
      const weeksBack = i + 1; // one session per consecutive week
      const d = dateShift(-weeksBack * 7 - 2);
      const hours = 4.5 + (i % 3) * 0.5;
      attendance.push({
        id: 'ATT-D-' + (++attSeq),
        volunteerId: demoId,
        eventId: ev ? ev.id : '',
        eventName: ev ? ev.title : 'Community Volunteering Session',
        eventCategory: ev ? ev.category : 'Community',
        date: d,
        checkIn: '9:00 AM',
        checkOut: timeHours(9 + hours),
        hours: hours,
        status: 'completed',
        _local: true
      });
    });
    // spread realistic attendance for other volunteers (leaderboard richness)
    const otherVols = ['SCV-2026-002', 'SCV-2026-003', 'SCV-2026-004', 'SCV-2026-005', 'SCV-2026-006', 'SCV-2026-007', 'SCV-2026-008', 'SCV-2026-009', 'SCV-2026-010'];
    otherVols.forEach(function (vid, vi) {
      const count = 3 + (vi % 5);
      for (let i = 0; i < count; i++) {
        const pe = pastEvents[Math.floor(Math.random() * pastEvents.length)];
        attendance.push({
          id: uid('ATT'),
          volunteerId: vid,
          eventId: pe.id,
          eventName: pe.title,
          eventCategory: pe.category,
          date: addDays(pe.date, i === 0 ? 0 : -(i * 7)),
          checkIn: pe.time,
          checkOut: '1:30 PM',
          hours: Math.round((3 + Math.random() * 3) * 10) / 10,
          status: 'completed'
        });
      }
    });
    set(KEYS.attendance, attendance);

    /* -------- registrations -------- */
    const registrations = [];
    registrations.push({ id: uid('REG'), volunteerId: demoId, kind: 'ngo', refId: 'NGO-001', at: dateShift(-120) });
    registrations.push({ id: uid('REG'), volunteerId: demoId, kind: 'ngo', refId: 'NGO-007', at: dateShift(-55) });
    registrations.push({ id: uid('REG'), volunteerId: demoId, kind: 'event', refId: 'EVT-001', at: dateShift(-5) });
    registrations.push({ id: uid('REG'), volunteerId: demoId, kind: 'event', refId: 'EVT-002', at: dateShift(-6) });
    otherVols.forEach(function (vid, vi) {
      if (vi % 2 === 0) registrations.push({ id: uid('REG'), volunteerId: vid, kind: 'ngo', refId: 'NGO-00' + ((vi % 8) + 1), at: dateShift(-30 - vi) });
      registrations.push({ id: uid('REG'), volunteerId: vid, kind: 'event', refId: events[vi % 7].id, at: dateShift(-3 - vi) });
    });
    set(KEYS.registrations, registrations);

    /* -------- certificates -------- */
    const certificates = [
      {
        id: uid('CERT'), certificateId: 'SEC-' + new Date().getFullYear() + '-0001',
        volunteerId: demoId, volunteerName: 'Priya Patel', volunteerIdNumber: demoId,
        ngo: 'VidyaLok Trust', event: 'Teach-a-Child Workshop', hours: 6, date: dateShift(-12)
      },
      {
        id: uid('CERT'), certificateId: 'SEC-' + new Date().getFullYear() + '-0002',
        volunteerId: demoId, volunteerName: 'Priya Patel', volunteerIdNumber: demoId,
        ngo: 'Annapurna Seva', event: 'Food Distribution Drive', hours: 5, date: dateShift(-55)
      },
      {
        id: uid('CERT'), certificateId: 'SEC-' + new Date().getFullYear() + '-0003',
        volunteerId: 'SCV-2026-004', volunteerName: 'Arjun Reddy', volunteerIdNumber: 'SCV-2026-004',
        ngo: 'Drop & Save', event: 'Blood Donation Camp', hours: 4, date: dateShift(-30)
      },
      {
        id: uid('CERT'), certificateId: 'SEC-' + new Date().getFullYear() + '-0004',
        volunteerId: 'SCV-2026-002', volunteerName: 'Ananya Sharma', volunteerIdNumber: 'SCV-2026-002',
        ngo: 'VidyaLok Trust', event: 'Digital Literacy Workshop', hours: 7, date: dateShift(-18)
      }
    ];
    set(KEYS.certificates, certificates);

    /* -------- achievements (precompute) -------- */
    const ach = {};
    volunteers.forEach(function (vol) { if (vol.role !== 'admin') { ach[vol.id] = []; } });
    set(KEYS.achievements, ach);
    volunteers.forEach(function (vol) { if (vol.role !== 'admin') computeStats(vol.id); });

    /* -------- notifications -------- */
    const notifications = [
      { id: uid('NTF'), userId: demoId, type: 'reward', title: 'Community Hero Badge', message: 'You attended your 10th volunteering event. Incredible!', icon: '🏆', date: dateShift(-8), read: false },
      { id: uid('NTF'), userId: demoId, type: 'event', title: 'New Event Available', message: 'Digital Literacy Workshop is now open for registration.', icon: '📅', date: dateShift(-5), read: false },
      { id: uid('NTF'), userId: demoId, type: 'cert', title: 'Certificate Issued', message: 'Your Teach-a-Child Workshop certificate is ready to download.', icon: '🎓', date: dateShift(-12), read: false },
      { id: uid('NTF'), userId: demoId, type: 'milestone', title: '50 Hours Milestone', message: 'You crossed 50 volunteer hours. The community is grateful.', icon: '⏱️', date: dateShift(-15), read: false },
      { id: uid('NTF'), userId: demoId, type: 'ai', title: 'Seva AI Suggestion', message: 'Based on your skills, the Beach Cleanup Drive looks like a great fit.', icon: '🤖', date: dateShift(-2), read: false },
      { id: uid('NTF'), userId: demoId, type: 'welcome', title: 'Welcome to Seva Connect!', message: 'You are one step away from changing someone\'s tomorrow.', icon: '👋', date: dateShift(-120), read: true }
    ];
    set(KEYS.notifications, notifications);

    /* -------- announcements -------- */
    const announcements = [
      { id: uid('ANN'), title: 'Monsoon Tree Plantation Mega Drive', description: 'GreenSparks Foundation is hosting a mega plantation drive across Bengaluru. Register early — community impact up to 5000 saplings!', date: dateShift(-1), priority: 'high', author: 'Admin' },
      { id: uid('ANN'), title: 'New Digital Literacy Cohort', description: 'VidyaLok Trust opens registrations for its new batch. We need 20+ volunteer mentors with basic computer skills.', date: dateShift(-3), priority: 'normal', author: 'Admin' },
      { id: uid('ANN'), title: 'Volunteer of the Month — Arjun', description: 'Congratulations to Arjun Reddy for being Volunteer of the Month with 40+ hours of healthcare volunteering.', date: dateShift(-6), priority: 'normal', author: 'Admin' }
    ];
    set(KEYS.announcements, announcements);

    set(KEYS.settings, { communityName: 'Seva Connect', seedVersion: 1, peopleDivisor: 3.4 });
    set(KEYS.seeded, true);
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  const SC_API = {
    // NOTE: object properties intentionally reference surrounding helpers (closure).
    // No internal reliance on the global `SC` identifier at load time.
    KEYS: KEYS,
    get: get,
    set: set,
    clearAll: clearAll,

    seed: seed,
    uid: uid,
    pad: pad,
    todayISO: todayISO,
    dateShift: dateShift,
    addDays: addDays,
    daysFromNow: daysFromNow,
    formatDate: formatDate,
    weekKey: weekKey,
    initials: initials,
    slugify: slugify,
    intersect: intersect,
    memberOf: memberOf,

    LEVELS: LEVELS,
    BADGES: BADGES,
    IMPACT_MODEL: IMPACT_MODEL,
    getBadgeById: getBadgeById,

    generateVolunteerId: generateVolunteerId,
    findVolunteerByEmail: findVolunteerByEmail,
    getVolunteerById: getVolunteerById,
    getVolunteers: function () { return get(KEYS.volunteers, []); },
    saveVolunteer: saveVolunteer,
    deleteVolunteer: deleteVolunteer,

    login: login,
    logout: logout,
    currentUser: currentUser,

    isRegistered: isRegistered,
    register: register,
    unregister: unregister,
    registrationsOf: registrationsOf,

    getNGOs: function () { return get(KEYS.ngos, []); },
    getNGOById: function (id) { return get(KEYS.ngos, []).find(function (n) { return n.id === id; }) || null; },
    saveNGO: function (ngo) {
      const list = get(KEYS.ngos, []);
      const i = list.findIndex(function (n) { return n.id === ngo.id; });
      if (i === -1) list.push(ngo); else list[i] = ngo;
      set(KEYS.ngos, list); return ngo;
    },
    deleteNGO: function (id) { set(KEYS.ngos, get(KEYS.ngos, []).filter(function (n) { return n.id !== id; })); },

    getEvents: function () { return get(KEYS.events, []); },
    getEventById: function (id) { return get(KEYS.events, []).find(function (e) { return e.id === id; }) || null; },
    saveEvent: function (ev) {
      const list = get(KEYS.events, []);
      const i = list.findIndex(function (e) { return e.id === ev.id; });
      if (i === -1) list.push(ev); else list[i] = ev;
      set(KEYS.events, list); return ev;
    },
    deleteEvent: function (id) { set(KEYS.events, get(KEYS.events, []).filter(function (e) { return e.id !== id; })); },

    attendanceOf: attendanceOf,
    checkIn: checkIn,
    checkOut: checkOut,

    generateCertificateId: generateCertificateId,
    issueCertificate: issueCertificate,
    verifyCertificate: verifyCertificate,
    certificatesOf: certificatesOf,
    getCertificates: function () { return get(KEYS.certificates, []); },

    computeStats: computeStats,
    getBadgesFor: getBadgesFor,
    getLeaderboard: getLeaderboard,
    computeDNA: computeDNA,
    recommend: recommend,
    estimateImpact: estimateImpact,

    getNotifications: getNotifications,
    pushNotification: pushNotification,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    clearNotifications: clearNotifications,

    getAnnouncements: getAnnouncements,
    saveAnnouncement: function (a) {
      const list = get(KEYS.announcements, []);
      a.id = a.id || uid('ANN');
      list.push(a); set(KEYS.announcements, list); return a;
    },
    deleteAnnouncement: function (id) { set(KEYS.announcements, get(KEYS.announcements, []).filter(function (a) { return a.id !== id; })); },

    getAchievementsStore: function () { return get(KEYS.achievements, {}); },
    search: search
  };

  window.SC = SC_API;

  /* auto-seed on first load */
  try { SC_API.seed(); } catch (e) { console.error('[SC] Seed failed', e); }
})();