/**
 * Couch config plugin: LAN access for TV control.
 * - Android: multicast + Wi-Fi state + IR permissions, cleartext HTTP (Roku ECP :8060 etc. are plain HTTP on the LAN).
 * - iOS keys live in app.json (NSLocalNetworkUsageDescription, NSBonjourServices).
 * The multicast entitlement (com.apple.developer.networking.multicast) is added only once Apple grants it;
 * see docs/multicast-request.md. Set COUCH_MULTICAST_ENTITLEMENT=1 at build time to include it.
 */
const { withAndroidManifest, withEntitlementsPlist, AndroidConfig } = require('expo/config-plugins');

const ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.TRANSMIT_IR',
];

function withLanAndroid(config) {
  config = AndroidConfig.Permissions.withPermissions(config, ANDROID_PERMISSIONS);
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    const manifest = c.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] || [];
    if (!manifest['uses-feature'].some((f) => f.$['android:name'] === 'android.hardware.consumerir')) {
      manifest['uses-feature'].push({ $: { 'android:name': 'android.hardware.consumerir', 'android:required': 'false' } });
    }
    return c;
  });
}

function withMulticastEntitlement(config) {
  if (process.env.COUCH_MULTICAST_ENTITLEMENT !== '1') return config;
  return withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.networking.multicast'] = true;
    return c;
  });
}

module.exports = function withLanAccess(config) {
  return withMulticastEntitlement(withLanAndroid(config));
};
module.exports.ANDROID_PERMISSIONS = ANDROID_PERMISSIONS;
