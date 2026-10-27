require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({
    email: { $in: ['admin@sevaconnect.com', 'demo@sevaconnect.com', 'ngo@sevaconnect.com'] },
  }).select('email role emailVerified emailVerifiedAt accountStatus tokenVersion createdAt');
  for (const user of users) {
    console.log(JSON.stringify(user));
  }
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
