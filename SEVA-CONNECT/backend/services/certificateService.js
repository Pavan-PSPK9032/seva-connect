/**
 * Certificate issuing.
 * Called when an NGO marks an application completed. Idempotent per
 * application so a repeated action can never mint a duplicate certificate.
 */
const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const Event = require('../models/Event');
const NGO = require('../models/NGO');
const User = require('../models/User');

function newCertificateId() {
  const year = new Date().getFullYear();
  return `SC-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function issueForApplication(application) {
  const existing = await Certificate.findOne({ applicationId: application._id });
  if (existing) return existing;

  const [event, ngo, volunteer] = await Promise.all([
    Event.findById(application.eventId),
    NGO.findById(application.ngoId),
    User.findById(application.volunteerId),
  ]);

  if (!event || !ngo || !volunteer) return null;

  try {
    return await Certificate.create({
      certificateId: newCertificateId(),
      applicationId: application._id,
      volunteerId: volunteer._id,
      eventId: event._id,
      ngoId: ngo._id,
      volunteerName: volunteer.name,
      eventTitle: event.title,
      ngoName: ngo.organizationName,
      eventDate: event.date,
      hours: application.hoursCredited || 0,
    });
  } catch (error) {
    // Unique index race — another request issued it first.
    if (error && error.code === 11000) {
      return Certificate.findOne({ applicationId: application._id });
    }
    throw error;
  }
}

module.exports = { issueForApplication };
