// Trip reminders are LOCAL notifications only (scheduled on the phone, docs/REMINDERS.md): no remote push, no APNs.
// expo-notifications' plugin adds the `aps-environment` entitlement unless `enableRemoteNotifications` is false
// (set in app.json), and adds UIBackgroundModes "remote-notification" only when asked. This guard removes both
// anyway, so a later options change can't quietly add a push entitlement (which would need a push-enabled
// provisioning profile and a new App Privacy look). Idempotent. Android is untouched.
// ORDER MATTERS: list it in app.json BEFORE "expo-notifications". Expo chains mods so the plugin listed later runs
// its entitlements / Info.plist callback first (@expo/config-plugins withMod: each new mod wraps the earlier one as
// nextMod); listed before, this guard's callback runs last and sees what expo-notifications wrote. Checked with
// `npx expo config --type introspect` and in src/core/reminders.config.test.ts.

/** Drops the push entitlement. Pure, so Node tests can call it without expo installed. */
function stripApsEnvironment(entitlements) {
  const out = { ...(entitlements || {}) };
  delete out['aps-environment'];
  return out;
}

/** Drops "remote-notification" from UIBackgroundModes (and the key itself when nothing else is left). */
function stripRemoteBackgroundMode(infoPlist) {
  const out = { ...(infoPlist || {}) };
  if (Array.isArray(out.UIBackgroundModes)) {
    const modes = out.UIBackgroundModes.filter((m) => m !== 'remote-notification');
    if (modes.length) out.UIBackgroundModes = modes;
    else delete out.UIBackgroundModes;
  }
  return out;
}

function withLocalNotificationsOnly(config) {
  // required here so Node tests can load the pure helpers without expo installed
  const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults = stripApsEnvironment(cfg.modResults);
    return cfg;
  });
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = stripRemoteBackgroundMode(cfg.modResults);
    return cfg;
  });
  return config;
}

module.exports = withLocalNotificationsOnly;
module.exports.stripApsEnvironment = stripApsEnvironment;
module.exports.stripRemoteBackgroundMode = stripRemoteBackgroundMode;
