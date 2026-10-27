require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const before = new Date('2026-10-27T00:00:00Z');
  const variants = {
    all: {},
    unverifiedFalse: { emailVerified: false },
    unverifiedMissing: { emailVerified: { $exists: false } },
    beforeDate: { createdAt: { $lt: before } },
    combinedFalse: { emailVerified: false, createdAt: { $lt: before } },
    combinedNeTrue: { emailVerified: { $ne: true }, createdAt: { $lt: before } },
  };
  for (const [name, filter] of Object.entries(variants)) {
    console.log(name, await User.countDocuments(filter));
  }
  const raw = await User.collection.findOne({ email: 'admin@sevaconnect.com' });
  console.log('raw emailVerified:', raw.emailVerified, 'type:', typeof raw.emailVerified);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
