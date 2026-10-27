const {test}=require('node:test');const assert=require('node:assert/strict');const {patch}=require('./patch-speech.cjs');
const source='    do {\n      let request = Self.prepareRequest(\n    if recognizer.supportsOnDeviceRecognition {\n      request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition\n    }';
test('unsupported selected locale returns before any speech request is prepared',()=>{const got=patch(source);assert.match(got,/requiresOnDeviceRecognition && !recognizer.supportsOnDeviceRecognition/);assert.ok(got.indexOf('return')<got.indexOf('Self.prepareRequest'));assert.match(got,/reset\(andEmitEnd: true\)/);});
test('reinstallation leaves one identical native guard',()=>{assert.equal(patch(patch(source)),patch(source));});
test('changed native dependency cannot silently skip the privacy guard',()=>{assert.throws(()=>patch('changed'));assert.throws(()=>patch(source+'\n'+source));});
