const withPlayVariant = require('./ops/play-variant.cjs');
module.exports = ({ config }) => {
  const result = withPlayVariant(config);
  if (!process.env.PLAY_VARIANT) return result;
  // This game records and plays while its round screen is open. Do not declare
  // Android background microphone/media services that the game does not use.
  return {
    ...result,
    plugins: result.plugins.map((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio'
      ? [plugin[0], { ...plugin[1], enableBackgroundPlayback: false, enableBackgroundRecording: false }]
      : plugin),
  };
};
