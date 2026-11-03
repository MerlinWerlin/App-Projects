// The optional camera scanner declares a Play Services model-download hint
// even when source compilation excludes its runtime. Remove that unused hint
// in Play variants only; the original Apple/base configuration is untouched.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = (config) => withAndroidManifest(config, (mod) => {
  const manifest = mod.modResults.manifest;
  manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const app = manifest.application[0];
  const name = 'com.google.mlkit.vision.DEPENDENCIES';
  app['meta-data'] = (app['meta-data'] || []).filter((item) => item.$['android:name'] !== name);
  app['meta-data'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
  return mod;
});
