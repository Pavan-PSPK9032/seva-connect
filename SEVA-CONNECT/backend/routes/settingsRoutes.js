/**
 * Public platform settings — only fields that are safe for anonymous visitors.
 * Secrets (SMTP, JWT, database) are never part of this response.
 */
const router = require('express').Router();
const { getPlatformSettings } = require('../services/settingsService');

router.get('/', async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    return res.json({
      success: true,
      data: {
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        registrationOpen: settings.registrationOpen !== false,
        maintenanceNotice: settings.maintenanceNotice || '',
        announcementBanner: settings.announcementBanner || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
