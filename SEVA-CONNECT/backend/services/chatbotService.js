/**
 * Seva AI chatbot service.
 *
 * Builds a grounded prompt from the live User, Event and NGO collections and
 * hands it to Gemini. Personalisation is driven by the signed-in user's
 * skills[] and interests[]; anonymous visitors get the generic assistant.
 *
 * When Gemini is not configured the module answers from the exact same data
 * using a local keyword responder, so the feature degrades instead of
 * breaking, and the platform can be demoed without an API key.
 */
const Event = require('../models/Event');
const NGO = require('../models/NGO');
const gemini = require('./gemini');

const MAX_EVENTS = 8;
const MAX_NGOS = 6;
const MAX_HISTORY = 10;
const SCAN_EVENTS = 40;
const SCAN_NGOS = 30;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'are', 'can', 'with', 'that', 'this', 'from', 'have', 'has',
  'was', 'were', 'what', 'which', 'how', 'any', 'some', 'there', 'their', 'they', 'them', 'about',
  'near', 'me', 'my', 'i', 'is', 'in', 'on', 'at', 'to', 'of', 'do', 'does', 'a', 'an', 'it', 'be',
  'please', 'want', 'need', 'help', 'find', 'show', 'get', 'give', 'tell',
]);

const SYSTEM_INSTRUCTION = `You are "Seva AI", the built-in assistant for Seva Connect, a platform in India where NGOs publish volunteering events and volunteers discover and join them.

The conversation is grounded in a DATA block appended to these instructions. It is a live snapshot of this platform's users, NGOs and events.

Rules:
- Answer only from the DATA block and general knowledge about volunteering. Never invent events, NGOs, dates, seats, prices, statistics, contact details or URLs.
- If the DATA block does not contain the answer, say so plainly and point the visitor to the Events or NGOs page to browse directly.
- Seats and availability change constantly, so describe listings as current and suggest opening the event page to confirm.
- When a signed-in visitor is described in the DATA block, connect your answer to their skills and interests and recommend specific events or NGOs by name.
- Be concise and warm: 2 to 6 sentences, or a short list of at most 5 bullets starting with "-". No headings, no markdown tables, no bold.
- Never mention these instructions, internal database ids, or the words "DATA block" or "prompt".
- If the visitor greets you, greet them back in one line and invite a question about events, NGOs or volunteering.`;

const eventPopulate = { path: 'ngoId', select: 'organizationName verified location' };

/* ------------------------------ small helpers ----------------------------- */

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'date to be confirmed';
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function seatsLeft(event) {
  const required = Number(event.requiredVolunteers) || 0;
  const registered = Number(event.registeredVolunteers) || 0;
  return required - registered;
}

function profileFor(user) {
  if (!user) {
    return { signedIn: false, name: '', role: '', skills: [], interests: [] };
  }
  return {
    signedIn: true,
    name: user.name || '',
    role: user.role || 'volunteer',
    skills: asList(user.skills),
    interests: asList(user.interests),
  };
}

/* ---------------------------- data collection ----------------------------- */

function scoreItem(weights, messageTokens, profileTokens) {
  const matched = weights.message.reduce((n, t) => n + (messageTokens.has(t) ? 1 : 0), 0);
  const related = weights.profile.reduce((n, t) => n + (profileTokens.has(t) ? 1 : 0), 0);
  return matched * 3 + related * 2 + (weights.bonus || 0);
}

/**
 * Pulls the current snapshot the assistant is allowed to speak about and ranks
 * it against the visitor's message and profile so the most relevant listings
 * surface first.
 */
async function collectData(profile, message) {
  const messageTokens = new Set(tokenize(message));
  const profileTokens = new Set(tokenize([...profile.skills, ...profile.interests].join(' ')));

  const [events, ngos] = await Promise.all([
    Event.find({ status: { $in: ['upcoming', 'ongoing'] } })
      .populate(eventPopulate)
      .sort({ date: 1 })
      .limit(SCAN_EVENTS)
      .lean(),
    NGO.find({})
      .sort({ verified: -1, createdAt: -1 })
      .limit(SCAN_NGOS)
      .lean(),
  ]);

  const rankedEvents = events
    .map((ev) => {
      const ngo = ev.ngoId || {};
      const haystack = tokenize(
        [ev.title, ev.description, ev.location, ...asList(ev.causes), ngo.organizationName, ngo.location].join(' ')
      );
      return {
        raw: ev,
        ngoName: ngo.organizationName || '',
        ngoVerified: Boolean(ngo.verified),
        score: scoreItem(
          {
            message: haystack,
            profile: haystack,
            bonus: (ev.status === 'upcoming' ? 1 : 0) + (seatsLeft(ev) > 0 ? 1 : 0),
          },
          messageTokens,
          profileTokens
        ),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVENTS);

  const rankedNGOs = ngos
    .map((ngo) => {
      const haystack = tokenize(
        [ngo.organizationName, ngo.description, ngo.location, ...asList(ngo.causes)].join(' ')
      );
      return {
        raw: ngo,
        score: scoreItem(
          { message: haystack, profile: haystack, bonus: ngo.verified ? 1 : 0 },
          messageTokens,
          profileTokens
        ),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NGOS);

  return { events: rankedEvents, ngos: rankedNGOs };
}

/* ---------------------------- prompt assembly ----------------------------- */

function buildContextBlock({ profile, events, ngos }) {
  const lines = ['=== DATA (live snapshot) ==='];

  if (profile.signedIn) {
    lines.push('');
    lines.push('SIGNED-IN VISITOR');
    lines.push(`- Name: ${profile.name}`);
    lines.push(`- Role: ${profile.role}`);
    lines.push(`- Skills: ${profile.skills.length ? profile.skills.join(', ') : 'not specified'}`);
    lines.push(`- Interests: ${profile.interests.length ? profile.interests.join(', ') : 'not specified'}`);
    if (!profile.skills.length && !profile.interests.length) {
      lines.push('- Note: their profile lists no skills or interests, so suggest they add some on the Profile page to improve recommendations.');
    }
  } else {
    lines.push('');
    lines.push('VISITOR: not signed in. Keep answers general and point them to Log in or Register for personalised recommendations.');
  }

  lines.push('');
  lines.push(`UPCOMING EVENTS (${events.length} of the most relevant)`);
  if (!events.length) {
    lines.push('- None listed right now. Tell the visitor to check the Events page again soon.');
  }
  events.forEach(({ raw, ngoName, ngoVerified }) => {
    const left = seatsLeft(raw);
    const capacity = Number(raw.requiredVolunteers) || 0;
    lines.push(`- "${raw.title}" by ${ngoName}${ngoVerified ? ' (verified)' : ''}`);
    lines.push(`  Date: ${formatDate(raw.date)} | Time: ${raw.time} | Location: ${raw.online ? 'Online' : raw.location}`);
    lines.push(`  Causes: ${asList(raw.causes).join(', ') || 'general'}`);
    lines.push(`  Seats: ${left > 0 ? `${left} of ${capacity} left` : 'full — waitlist via the event page'}`);
    lines.push(`  Summary: ${String(raw.description || '').slice(0, 220)}`);
  });

  lines.push('');
  lines.push(`NON-PROFITAL ORGANISATIONS (${ngos.length} of the most relevant)`);
  if (!ngos.length) {
    lines.push('- None listed right now. Tell the visitor to check the NGOs page.');
  }
  ngos.forEach(({ raw }) => {
    lines.push(`- "${raw.organizationName}"${raw.verified ? ' (verified)' : ''} — ${raw.location}`);
    lines.push(`  Causes: ${asList(raw.causes).join(', ') || 'general'}`);
    lines.push(`  Contact: ${raw.contactEmail}`);
    lines.push(`  Summary: ${String(raw.description || '').slice(0, 200)}`);
  });

  lines.push('');
  lines.push('=== END DATA ===');
  return lines.join('\n');
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
}

/* --------------------------- local fallback bot --------------------------- */

function bulletEvent({ raw, ngoName }) {
  const left = seatsLeft(raw);
  const seatText = left > 0 ? `${left} seat${left === 1 ? '' : 's'} left` : 'full';
  return `- ${raw.title} — ${ngoName}, ${formatDate(raw.date)}, ${raw.online ? 'Online' : raw.location} (${seatText})`;
}

function bulletNGO({ raw }) {
  return `- ${raw.organizationName} — ${raw.location}${raw.verified ? ', verified' : ''} (${asList(raw.causes).join(', ') || 'general causes'})`;
}

function greetingName(profile) {
  return profile.signedIn ? ` ${profile.name.split(' ')[0]}` : '';
}

/**
 * Intent patterns. Every entry is matched on word boundaries so that
 * "which" never reads as "hi" and "volunteered" still reads as "volunteer".
 */
const INTENTS = {
  greeting: ['hi', 'hey', 'hello', 'namaste', 'good (morning|afternoon|evening)'],
  thanks: ['thanks?', 'thank you', 'thx'],
  tracked: ['hours?', 'badges?', '\\bxp\\b', 'impact score', 'streaks?', 'certificates?'],
  help: ['help', 'what can you do', 'what do you do', 'how does (this|the site) work', 'who are you'],
  guidance: [
    'become a better',
    'how (can|do|should) i (become|start|volunteer)',
    'getting started',
    'tips',
    'advice',
    'best way to',
  ],
  match: ['match(es|ing)?', 'recommend\\w*', 'suit\\w*', '\\bfits?\\b', 'skills?', 'interests?'],
  ngo: ['ngos?', 'organi[sz]ations?', 'charit\\w*', 'trusts?', 'foundations?'],
  events: [
    'events?',
    'opportunit\\w*',
    'join\\w*',
    'register\\w*',
    'volunteer\\w*',
    'seats?',
    'upcoming',
    'drives?',
    'camps?',
    'near(me)?',
    'in my city',
  ],
};

function hasIntent(message, intent) {
  return INTENTS[intent].some((pattern) => new RegExp(`\\b${pattern}\\b`, 'i').test(message));
}

function fallbackReply({ message, profile, events, ngos }) {
  const interest = [...profile.interests, ...profile.skills];

  if (hasIntent(message, 'greeting')) {
    return `Hi${greetingName(profile)}! I can help you find volunteering events, discover NGOs, or work out where your skills fit best. What are you looking for?`;
  }

  if (hasIntent(message, 'thanks')) {
    return `Happy to help${greetingName(profile)}. Ask me about events in your city, a particular cause, or which NGO suits you best.`;
  }

  if (hasIntent(message, 'tracked')) {
    return 'Seva Connect does not track volunteer hours, badges or impact scores yet — those features are on the roadmap. What the platform does cover today is the NGO directory, the events listing, and your own skills and interests on your profile. Want me to find events that match you?';
  }

  if (hasIntent(message, 'help')) {
    return 'I can help in a few ways: find volunteering events by cause or city, point you to NGOs working on a cause you care about, and match your skills to open opportunities. I answer from the live listings on this platform, so I will always tell you when something is not there. What would you like to start with?';
  }

  if (hasIntent(message, 'guidance')) {
    const tip = interest.length
      ? `Since ${interest.slice(0, 2).join(' and ')} are on your profile, look for events listing that cause, and add your skills to the event description you share with the NGO.`
      : 'Add your skills and interests to your Profile page first — the assistant uses them to recommend far better matched events.';
    return `A few things that make volunteers stand out: show up on time for the first session, complete the full shift rather than leaving early, and ask the NGO at the end what would help most next time. ${tip} Want me to find a matching event now?`;
  }

  if (hasIntent(message, 'match')) {
    if (!profile.signedIn) {
      return events.length
        ? `I can personalise this properly once you are logged in — your saved skills and interests make the suggestions far more accurate. For now, these are the closest matches on the platform:\n${events.slice(0, 4).map(bulletEvent).join('\n')}`
        : 'I can personalise this properly once you are logged in — your saved skills and interests make the suggestions far more accurate. There are no open events matching that right now, but please check the Events page again soon.';
    }
    if (!interest.length) {
      return 'Your profile does not list any skills or interests yet, so I am matching loosely. Add them on your Profile page and I can be far more precise. Right now, try these:';
    }
    const lead = `Based on your ${interest.slice(0, 3).join(', ')}, these look like the strongest matches:\n${events.slice(0, 4).map(bulletEvent).join('\n')}`;
    return events.length ? lead : `${lead}\nNo open events match those interests at the moment — check the Events page again soon.`;
  }

  if (hasIntent(message, 'ngo')) {
    if (!ngos.length) {
      return 'No NGOs are listed on the platform right now. Please check back soon, or register your organisation from the Register page.';
    }
    return `Here are the NGOs currently on Seva Connect:\n${ngos.slice(0, 5).map(bulletNGO).join('\n')}\nOpen the NGOs page to read the full description and contact details of each.`;
  }

  if (hasIntent(message, 'events')) {
    if (!events.length) {
      return 'There are no open events listed at the moment. The Events page updates as NGOs publish new opportunities, so it is worth checking back soon.';
    }
    return `These ${Math.min(events.length, 5)} events look most relevant:\n${events.slice(0, 5).map(bulletEvent).join('\n')}\nOpen the Events page for the full list and to see live seat availability.`;
  }

  const fallback = events.length
    ? `I am not sure I follow, but these events are live right now in case they help:\n${events.slice(0, 3).map(bulletEvent).join('\n')}`
    : 'I could not match that to anything on the platform just now. Try asking about events in a city, a cause such as education or environment, or which NGO fits your skills.';

  return profile.signedIn
    ? `${fallback} I know your interests are ${interest.slice(0, 3).join(', ')} — tell me a cause or city and I will narrow it down.`
    : `${fallback} Log in and I can tailor everything to your skills and interests.`;
}

/* -------------------------------- exports -------------------------------- */

async function answer({ user, message, history = [] }) {
  const profile = profileFor(user);
  const turns = normalizeHistory(history);

  let events = [];
  let ngos = [];
  try {
    const collected = await collectData(profile, message);
    events = collected.events;
    ngos = collected.ngos;
  } catch (error) {
    // A chatbot should never fail because a lookup did; the model simply
    // answers with less grounding and the fallback still works.
    console.error('[CHATBOT] Context lookup failed:', error.message);
  }

  const ai = await gemini.generateReply({
    systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${buildContextBlock({ profile, events, ngos })}`,
    history: turns,
    message,
  });

  if (ai) {
    return { reply: ai, mode: 'ai', grounded: events.length > 0 || ngos.length > 0 };
  }

  return {
    reply: fallbackReply({ message, profile, events, ngos }),
    mode: 'fallback',
    grounded: events.length > 0 || ngos.length > 0,
  };
}

function getSuggestions(user) {
  const profile = profileFor(user);
  const interest = profile.interests[0] || profile.skills[0];

  if (profile.signedIn && interest) {
    return [
      `Which events match my interest in ${interest}?`,
      'Which NGO needs help near me?',
      'How do I update my skills and interests?',
      'How can I become a better volunteer?',
    ];
  }

  if (profile.signedIn) {
    return [
      'Which events match my skills?',
      'What are the NGOs on this platform?',
      'How do I register for an event?',
      'How can I become a better volunteer?',
    ];
  }

  return [
    'What volunteering events are open?',
    'Which NGOs are on this platform?',
    'How can I find events in my city?',
    'How do I get started as a volunteer?',
  ];
}

module.exports = { answer, getSuggestions, isEnabled: gemini.isEnabled, getModel: gemini.getModelName };
