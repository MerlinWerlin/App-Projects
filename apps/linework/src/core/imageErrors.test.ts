import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ImageCheckError,
  MAX_FILE_BYTES,
  canRetry,
  classifyImageError,
  extensionOf,
  isHeic,
  precheckImage,
} from './imageErrors.ts';

test('extensionOf ignores query and fragment', () => {
  assert.equal(extensionOf('file:///a/b/IMG_1.HEIC?x=1#y'), 'heic');
  assert.equal(extensionOf('content://media/external/images/123'), '');
  assert.equal(extensionOf(null), '');
});

test('ordinary JPEG / PNG / WebP photos take the normal path', () => {
  const photos = [
    { uri: 'file:///p/IMG_0001.JPG', mimeType: 'image/jpeg', width: 4032, height: 3024, fileSize: 3_500_000 },
    { uri: 'file:///p/shot.png', mimeType: 'image/png', width: 1179, height: 2556, fileSize: 2_000_000 },
    { uri: 'file:///p/a.webp', mimeType: 'image/webp', width: 1080, height: 1080 },
    { uri: 'file:///p/48mp.jpg', mimeType: 'image/jpeg', width: 8064, height: 6048, fileSize: 25_000_000 },
    { uri: 'content://media/external/images/media/42' },
    { uri: 'file:///p/x.jpeg', mimeType: 'application/octet-stream' },
    {},
  ];
  for (const p of photos) assert.equal(precheckImage(p), null, JSON.stringify(p));
});

test('HEIC is not rejected by the pre-check (it gets converted) but is detected', () => {
  const heic = { uri: 'file:///p/IMG_2.HEIC', mimeType: 'image/heic', width: 4032, height: 3024 };
  assert.equal(precheckImage(heic), null);
  assert.equal(isHeic(heic), true);
  assert.equal(isHeic({ fileName: 'IMG.heif' }), true);
  assert.equal(isHeic({ mimeType: 'image/jpeg', uri: 'a.jpg' }), false);
});

test('pre-check rejects huge photos', () => {
  assert.equal(precheckImage({ mimeType: 'image/jpeg', width: 10000, height: 8000 }), 'tooLarge');
  assert.equal(precheckImage({ mimeType: 'image/png', fileSize: MAX_FILE_BYTES + 1 }), 'tooLarge');
});

test('pre-check rejects non-images and RAW files', () => {
  assert.equal(precheckImage({ mimeType: 'video/quicktime', uri: 'a.mov' }), 'unsupported');
  assert.equal(precheckImage({ mimeType: 'application/pdf' }), 'unsupported');
  assert.equal(precheckImage({ uri: 'file:///p/IMG_9.DNG' }), 'unsupported');
  assert.equal(precheckImage({ mimeType: 'image/x-adobe-dng' }), 'unsupported');
});

test('classifyImageError: memory', () => {
  assert.equal(classifyImageError(new Error('java.lang.OutOfMemoryError: Failed to allocate')), 'memory');
  assert.equal(classifyImageError(new RangeError('Array buffer allocation failed')), 'memory');
  assert.equal(classifyImageError(new RangeError('Invalid typed array length: 99999999999')), 'memory');
  assert.equal(classifyImageError(new Error('maxMemoryUsageInMB limit exceeded')), 'memory');
});

test('classifyImageError: too large', () => {
  assert.equal(classifyImageError(new Error('Image is 9000×9000, larger than the 1024px limit.')), 'tooLarge');
  assert.equal(classifyImageError(new Error('maxResolutionInMP limit exceeded by 120MP')), 'tooLarge');
  assert.equal(classifyImageError(new Error('Bitmap too large to be uploaded into a texture')), 'tooLarge');
  assert.equal(classifyImageError(new Error('boom'), { width: 12000, height: 9000 }), 'tooLarge');
});

test('classifyImageError: heic', () => {
  assert.equal(classifyImageError(new Error('Cannot decode HEIC image')), 'heic');
  assert.equal(classifyImageError(new Error('Could not load image'), { uri: 'x/IMG.HEIC' }), 'heic');
});

test('classifyImageError: unsupported / corrupt', () => {
  assert.equal(classifyImageError(new Error('SOI not found')), 'unsupported');
  assert.equal(classifyImageError(new Error('Couldn’t read that image.')), 'unsupported');
  assert.equal(classifyImageError(new Error('Unknown image format')), 'unsupported');
  assert.equal(classifyImageError('Unsupported image type'), 'unsupported');
  assert.equal(classifyImageError(new Error('x'), { mimeType: 'video/mp4' }), 'unsupported');
});

test('classifyImageError: unknown and pre-classified', () => {
  assert.equal(classifyImageError(new Error('network hiccup')), 'unknown');
  assert.equal(classifyImageError(undefined), 'unknown');
  assert.equal(classifyImageError({}), 'unknown');
  assert.equal(classifyImageError(new ImageCheckError('heic')), 'heic');
  assert.equal(classifyImageError(new ImageCheckError('tooLarge', 'Cannot decode')), 'tooLarge');
});

test('canRetry only for transient kinds', () => {
  assert.equal(canRetry('memory'), true);
  assert.equal(canRetry('unknown'), true);
  assert.equal(canRetry('unsupported'), false);
  assert.equal(canRetry('heic'), false);
  assert.equal(canRetry('tooLarge'), false);
});
