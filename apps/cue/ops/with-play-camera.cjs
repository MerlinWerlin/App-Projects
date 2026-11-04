// Expo Camera 58 includes document scanning by default, separately from barcode
// scanning. Cue uses neither. This plugin is included only by explicit Play profiles.
const { withGradleProperties } = require('expo/config-plugins');
module.exports = config => withGradleProperties(config, mod => {
  const key = 'expo.camera.document-scanner-enabled';
  mod.modResults = mod.modResults.filter(property => property.key !== key);
  mod.modResults.push({ type: 'property', key, value: 'false' });
  return mod;
});
