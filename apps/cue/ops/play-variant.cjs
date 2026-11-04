// Self-contained so each app's build-page bundle can import this without monorepo files.
// Only explicit Play profiles activate this overlay. Existing iOS/Expo Go profiles stay unchanged.
module.exports = function withPlayVariant(config, env = process.env) {
  const variant = env.PLAY_VARIANT;
  if (!variant) return config;
  if (!['preview', 'production'].includes(variant)) throw new Error('Unknown PLAY_VARIANT: ' + variant);
  if (env.EAS_BUILD_PLATFORM && env.EAS_BUILD_PLATFORM !== 'android') {
    throw new Error('Play profiles are Android-only. Use the existing iOS profile.');
  }
  if (env.EXPO_GO_PREVIEW === '1') throw new Error('Play native builds cannot use EXPO_GO_PREVIEW.');
  if (!config.android?.package) throw new Error('An explicit Android package is required.');
  const preview = variant === 'preview';
  const channel = 'play-' + variant;
  return {
    ...config,
    name: config.name + (preview ? ' Play Test' : ''),
    scheme: preview ? String(config.scheme || config.slug) + '-play-test' : config.scheme,
    platforms: ['android'],
    runtimeVersion: String(config.version) + '-play-v1',
    plugins: [...(config.plugins || []).map(plugin => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      const options = Array.isArray(plugin) ? plugin[1] : {};
      return name === 'expo-audio'
        ? [name, { ...options, enableBackgroundPlayback: false, enableBackgroundRecording: false }]
        : name === 'expo-camera'
          ? [name, { ...options, barcodeScannerEnabled: false }]
          : plugin;
    }), './ops/with-play-camera.cjs'],
    android: {
      ...config.android,
      package: config.android.package + (preview ? '.playtest' : ''),
      versionCode: config.android.versionCode || 1,
      // Cue saves its own takes with write-only access and imports through the
      // system document picker. It never reads the user's media collection.
      blockedPermissions: [...new Set([
        ...(config.android.blockedPermissions || []),
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.ACCESS_MEDIA_LOCATION',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ])],
    },
    // Keep initial builds embedded-only until Android runtime/update testing is complete.
    updates: { ...config.updates, enabled: false,
      requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel } },
    extra: { ...config.extra, playVariant: variant },
  };
};
