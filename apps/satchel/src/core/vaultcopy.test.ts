import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Attachment, TravelDoc } from './model.ts';
import { setCropRect } from './qrcrop.ts';
import { cleanDocs, rebaseDocs } from './vault.ts';
import { copyView, cropTarget, setDocCrop } from './vaultcopy.ts';

const img = (id: string, extra: Partial<Attachment> = {}): Attachment => ({ id, uri: `file:///docs/vault/${id}.jpg`, name: `${id}.jpg`, mime: 'image/jpeg', role: 'other', ...extra });
const pdf = (id: string): Attachment => ({ id, uri: `file:///docs/vault/${id}.pdf`, name: `${id}.pdf`, mime: 'application/pdf', role: 'other' });
const doc = (id: string, attachments: Attachment[]): TravelDoc => ({ id, kind: 'visa', label: 'Visa', attachments });
const CROP = { x: 0.2, y: 0.3, w: 0.4, h: 0.25 };

test('copyView: images get a crop button, PDFs the inline viewer only where the build has it', () => {
  assert.deepEqual(copyView(img('a'), true), { kind: 'image', crop: null, cropAction: 'add', inlinePdf: false });
  const cropped = copyView(img('a', { qrCrop: CROP }), false);
  assert.equal(cropped.cropAction, 'adjust');
  assert.deepEqual(cropped.crop, CROP);
  assert.equal(copyView(img('a', { qrCrop: { x: 0, y: 0, w: 1, h: 1 } }), true).cropAction, 'add', 'the whole image is no crop');
  assert.equal(copyView(img('a', { qrCrop: { x: 'no' } as never }), true).crop, null, 'junk crop is ignored');
  assert.deepEqual(copyView(pdf('p'), true), { kind: 'pdf', crop: null, cropAction: null, inlinePdf: true });
  assert.equal(copyView(pdf('p'), false).inlinePdf, false);
  // a picker that gave no mime: decided by the name
  assert.equal(copyView({ mime: '', name: 'scan.PDF' }, true).inlinePdf, true);
  assert.equal(copyView({ mime: 'application/octet-stream', name: 'x.bin' }, true).kind, 'other');
});

test('cropTarget: only an image copy of an existing document', () => {
  const docs = [doc('d1', [img('a'), pdf('p')])];
  assert.equal(cropTarget(docs, 'd1', 'a')?.copy.id, 'a');
  assert.equal(cropTarget(docs, 'd1', 'p'), null);
  assert.equal(cropTarget(docs, 'd1', 'zz'), null);
  assert.equal(cropTarget(docs, 'nope', 'a'), null);
  assert.equal(cropTarget(docs, undefined, undefined), null);
});

test('setDocCrop sets and clears one copy, leaving the rest alone', () => {
  const docs = [doc('d1', [img('a'), img('b')]), doc('d2', [img('c')])];
  const set = setDocCrop(docs, 'd1', 'b', CROP);
  assert.equal(set.found, true);
  assert.deepEqual(set.docs[0].attachments[1].qrCrop, CROP);
  assert.equal(set.docs[0].attachments[0].qrCrop, undefined);
  assert.equal(set.docs[1], docs[1], 'other documents are the same objects');
  assert.equal(docs[0].attachments[1].qrCrop, undefined, 'input not mutated');
  const cleared = setDocCrop(set.docs, 'd1', 'b', null);
  assert.equal(cleared.docs[0].attachments[1].qrCrop, undefined);
  const gone = setDocCrop(docs, 'd1', 'zz', CROP);
  assert.equal(gone.found, false);
  assert.deepEqual(gone.docs, docs);
});

test('setDocCrop drops a separate crop image like the ticket rule, and keeps a self crop', () => {
  const docs = [doc('d1', [img('a', { qrCropUri: 'file:///docs/vault/a-crop.png' }), img('b', { qrCropUri: 'file:///docs/vault/b.jpg' })])];
  assert.equal(setDocCrop(docs, 'd1', 'a', CROP).dropped, 'file:///docs/vault/a-crop.png');
  const self = setDocCrop(docs, 'd1', 'b', CROP);
  assert.equal(self.dropped, null);
  assert.equal(self.docs[0].attachments[1].qrCropUri, 'file:///docs/vault/b.jpg');
  // the generic helper keeps the holder's own type
  const d: TravelDoc = setCropRect(docs[0], 'a', CROP).item;
  assert.equal(d.kind, 'visa');
});

test('a document crop survives storage cleaning and the container move on update', () => {
  const docs = setDocCrop([doc('d1', [img('a')])], 'd1', 'a', CROP).docs;
  const stored = JSON.parse(JSON.stringify(docs));
  const back = rebaseDocs(cleanDocs(stored), 'file:///new/Documents/');
  assert.deepEqual(back[0].attachments[0].qrCrop, CROP);
});
