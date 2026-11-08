// T162 (run 112): Satchel's Android "Open in" VIEW filter lives here, not in app.json.
// Expo's update publish rejected the resolved public config with
// "android/intentFilters must NOT have duplicate items" (ship run 41311019053), so the
// filter is added straight to AndroidManifest.xml at prebuild instead. Idempotent:
// running the mod twice never adds a second copy. iOS is untouched.
const FILTER = require('./open-in-filter.json');

const ANDROID = 'android:';

function toManifestFilter(f) {
  return {
    action: [{ $: { [`${ANDROID}name`]: `android.intent.action.${f.action}` } }],
    category: (f.category || []).map((c) => ({ $: { [`${ANDROID}name`]: `android.intent.category.${c}` } })),
    data: (f.data || []).map((d) => {
      const attrs = {};
      for (const [k, v] of Object.entries(d)) attrs[`${ANDROID}${k}`] = v;
      return { $: attrs };
    }),
  };
}

function addFilter(existing, filter) {
  const list = Array.isArray(existing) ? existing.slice() : [];
  const key = JSON.stringify(filter);
  if (!list.some((f) => JSON.stringify(f) === key)) list.push(filter);
  return list;
}

function withOpenIn(config) {
  // required here so Node tests can load the pure helpers without expo installed
  const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = addFilter(activity['intent-filter'], toManifestFilter(FILTER));
    return cfg;
  });
}

module.exports = withOpenIn;
module.exports.FILTER = FILTER;
module.exports.toManifestFilter = toManifestFilter;
module.exports.addFilter = addFilter;
