// Apple's on-device flag is honored only by recognizers that support it. Fail before audio setup otherwise.
const fs = require('node:fs');
const path = require('node:path');
const marker = '    // Cue: do not start a locale that requires server recognition.';
const needle = '    do {\n      let request = Self.prepareRequest(';
const guard = marker + '\n    if options.requiresOnDeviceRecognition && !recognizer.supportsOnDeviceRecognition {\n      errorHandler(RecognizerError.recognizerIsUnavailable)\n      reset(andEmitEnd: true)\n      return\n    }\n\n' + needle;
const conditional = '    if recognizer.supportsOnDeviceRecognition {\n      request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition\n    }';
function patch(source) {
  source = source.replace(/\r\n/g,'\n');
  // Migrate the earlier local draft of this guard; never enough by itself on unsupported locales.
  source = source.replace('    // Cue requires offline recognition; never fall back to an Apple server.\n    request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition', conditional);
  if (!source.includes(conditional)) throw new Error('Speech dependency changed: re-audit native privacy before building.');
  if (source.includes(marker)) {
    if (!source.includes(guard)) throw new Error('Incomplete Cue speech privacy guard.');
    return source;
  }
  if (source.split(needle).length !== 2) throw new Error('Speech dependency changed: expected exactly one request setup.');
  return source.replace(needle, guard);
}
module.exports = { patch };
if (require.main === module) {
  const target = path.join(path.dirname(require.resolve('expo-speech-recognition/package.json')), 'ios', 'ExpoSpeechRecognizer.swift');
  fs.writeFileSync(target, patch(fs.readFileSync(target,'utf8')));
  console.log('Cue selected-locale on-device guard verified.');
}
