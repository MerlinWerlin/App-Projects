const withPlayVariant = require('./ops/play-variant.cjs');
module.exports = ({ config }) => {
  // SDK 58's sharing module requires its plugin. Dynamic config cannot be
  // rewritten by Expo's version-alignment step, so declare it explicitly.
  const plugins = config.plugins || [];
  const hasSharing = plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-sharing');
  return withPlayVariant({ ...config, plugins: hasSharing ? plugins : [...plugins, 'expo-sharing'] });
};
