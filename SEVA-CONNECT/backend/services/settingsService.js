/**
 * Platform settings access with a short in-process cache.
 * A missing document resolves to safe defaults; nothing is created until an
 * administrator saves a change.
 */
const PlatformSetting = require('../models/PlatformSetting');

const DEFAULTS = {
  platformName: 'Seva Connect',
  supportEmail: '',
  registrationOpen: true,
  maintenanceNotice: '',
  announcementBanner: '',
};

const CACHE_MS = 30 * 1000;
let cache = { value: null, at: 0 };

async function getPlatformSettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  try {
    const doc = await PlatformSetting.findOne({ key: 'platform' }).lean();
    const value = doc ? { ...DEFAULTS, ...doc } : { ...DEFAULTS };
    cache = { value, at: Date.now() };
    return value;
  } catch (error) {
    console.error('[SETTINGS] Could not load platform settings:', error.message);
    return { ...DEFAULTS };
  }
}

function clearPlatformSettingsCache() {
  cache = { value: null, at: 0 };
}

module.exports = { getPlatformSettings, clearPlatformSettingsCache, DEFAULTS };
