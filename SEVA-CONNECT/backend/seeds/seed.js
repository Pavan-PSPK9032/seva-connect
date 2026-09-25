/**
 * Dev seed data — idempotent demo users, NGOs and events.
 * Run from backend/ with: npm run seed
 * Uses the MONGODB_URI from backend/.env (or an override in your shell).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const NGO = require('../models/NGO');
const Event = require('../models/Event');

const PLACEHOLDER = 'your_mongodb_atlas_connection_string';
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri === PLACEHOLDER) {
    console.error('[SEED] Set MONGODB_URI in backend/.env first (see .env.example).');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[SEED] Connected to ${mongoose.connection.name}`);

  const upsertUser = async (data) => {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      console.log(`[SEED] user exists: ${data.email}`);
      return existing;
    }
    const user = await User.create(data);
    console.log(`[SEED] user created: ${data.email}`);
    return user;
  };

  await upsertUser({
    name: 'Demo Volunteer',
    email: 'demo@sevaconnect.com',
    password: '123456',
    role: 'volunteer',
    phone: '+91 98000 00001',
    skills: ['Teaching', 'Healthcare', 'Fundraising'],
    interests: ['Education', 'Child Welfare'],
  });
  await upsertUser({
    name: 'NGO Staff',
    email: 'ngo@sevaconnect.com',
    password: 'ngo456',
    role: 'ngo',
    phone: '+91 98000 00002',
  });
  await upsertUser({
    name: 'Platform Admin',
    email: 'admin@sevaconnect.com',
    password: 'admin123',
    role: 'admin',
  });

  await NGO.deleteMany({});
  await Event.deleteMany({});

  const ngos = await NGO.create([
    {
      organizationName: 'Teach For India',
      description: 'Movement of leaders working to eliminate educational inequity by placing fellows in low-income classrooms across India.',
      location: 'Mumbai, Maharashtra',
      contactEmail: 'hello@teachforindia.org',
      causes: ['Education'],
      website: 'https://www.teachforindia.org',
      verified: true,
    },
    {
      organizationName: 'Goonj',
      description: 'Turns urban surplus into rural development, channeling material as a tool of dignity and self-reliance.',
      location: 'Delhi, NCT',
      contactEmail: 'ramesh@goonj.org',
      causes: ['Clothing', 'Disaster Relief'],
      website: 'https://goonj.org',
      verified: true,
    },
    {
      organizationName: 'The Robin Hood Army',
      description: 'A zero-funding volunteer network that rescues surplus food and serves it to the hungry across the country.',
      location: 'Bengaluru, Karnataka',
      contactEmail: 'ro@robinhoodarmy.com',
      causes: ['Food', 'Hunger'],
      website: 'https://robinhoodarmy.com',
      verified: true,
    },
    {
      organizationName: 'SankalpTaru',
      description: 'Sensitivity-driven tree plantation organization restoring ecosystems through community participation.',
      location: 'Pune, Maharashtra',
      contactEmail: 'team@sankalptaru.org',
      causes: ['Environment', 'Climate'],
      website: 'https://sankalptaru.org',
      verified: true,
    },
    {
      organizationName: 'Uday Foundation',
      description: 'Serves children and the underprivileged with healthcare campaigns, nutrition, and dignity kits.',
      location: 'Lucknow, Uttar Pradesh',
      contactEmail: 'help@udayfoundation.org',
      causes: ['Healthcare', 'Children'],
      website: '',
      verified: false,
    },
    {
      organizationName: 'Vidya Poshak',
      description: 'Enables underprivileged students to continue education through scholarships and career counseling.',
      location: 'Nagpur, Maharashtra',
      contactEmail: 'info@vidyaposhak.org',
      causes: ['Education', 'Livelihood'],
      website: 'https://www.vidyaposhak.org',
      verified: true,
    },
  ]);

  const events = await Event.create([
    {
      title: 'Annual Volunteer Fellowship Orientation',
      description: 'Kick-off orientation for new fellows: classroom leadership, teaching practice and the year roadmap.',
      date: daysFromNow(6),
      time: '9:00 AM - 5:00 PM',
      location: 'Mumbai, Maharashtra',
      causes: ['Education'],
      ngoId: ngos[0]._id,
      requiredVolunteers: 50,
      registeredVolunteers: 34,
      status: 'upcoming',
    },
    {
      title: 'Community Cleanliness Drive',
      description: 'Street-by-street cleanup, waste segregation awareness and community meet with local residents.',
      date: daysFromNow(4),
      time: '7:00 AM - 10:30 AM',
      location: 'Delhi, NCT',
      causes: ['Environment'],
      ngoId: ngos[1]._id,
      requiredVolunteers: 40,
      registeredVolunteers: 40,
      status: 'upcoming',
    },
    {
      title: 'Food Rescue & Distribution Drive',
      description: 'Collect surplus food from partner restaurants and distribute meals to shelter homes.',
      date: daysFromNow(2),
      time: '11:00 AM - 2:00 PM',
      location: 'Bengaluru, Karnataka',
      causes: ['Food'],
      ngoId: ngos[2]._id,
      requiredVolunteers: 30,
      registeredVolunteers: 12,
      status: 'upcoming',
    },
    {
      title: 'Tree Plantation Weekend',
      description: 'Plant native saplings across degraded land with local farmers and ecology experts.',
      date: daysFromNow(10),
      time: '6:30 AM - 9:30 AM',
      location: 'Pune, Maharashtra',
      causes: ['Environment', 'Climate'],
      ngoId: ngos[3]._id,
      requiredVolunteers: 60,
      registeredVolunteers: 21,
      status: 'upcoming',
    },
    {
      title: 'Free Health Screening Camp',
      description: 'Basic checkups, BMI screening and medicine distribution for slum communities.',
      date: daysFromNow(14),
      time: '8:00 AM - 1:00 PM',
      location: 'Lucknow, Uttar Pradesh',
      causes: ['Healthcare'],
      ngoId: ngos[4]._id,
      requiredVolunteers: 25,
      registeredVolunteers: 6,
      status: 'upcoming',
    },
    {
      title: 'Online Mentorship Hour',
      description: 'Virtual career and scholarship mentorship for high-school students.',
      date: daysFromNow(3),
      time: '5:00 PM - 6:30 PM',
      location: 'Online (Zoom)',
      online: true,
      causes: ['Education', 'Livelihood'],
      ngoId: ngos[5]._id,
      requiredVolunteers: 100,
      registeredVolunteers: 58,
      status: 'upcoming',
    },
    {
      title: 'Blanket Distribution Drive',
      description: 'Winter blanket distribution drive across night shelters in Delhi.',
      date: daysFromNow(-30),
      time: '10:00 AM - 3:00 PM',
      location: 'Delhi, NCT',
      causes: ['Clothing'],
      ngoId: ngos[1]._id,
      requiredVolunteers: 45,
      registeredVolunteers: 45,
      status: 'completed',
    },
  ]);

  console.log(`[SEED] Done: ${ngos.length} NGOs, ${events.length} events`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('[SEED] Failed:', error.message);
  process.exit(1);
});