// T44: helpers behind the item form's Attachments section (src/core/tickets.ts droppedFiles / sameAttachments).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Attachment } from './model.ts';
import { droppedFiles, sameAttachments } from './tickets.ts';

const att = (id: string, extra: Partial<Attachment> = {}): Attachment => ({ id, uri: `file:///d/attachments/${id}.pdf`, name: `${id}.pdf`, mime: 'application/pdf', role: 'ticket', ...extra });

test('droppedFiles: removed attachments lose their file and separate crop', () => {
  const a = att('a', { qrCropUri: 'file:///d/attachments/a-qr.png' });
  const b = att('b');
  assert.deepEqual(droppedFiles([a, b], [b]), [a.uri, 'file:///d/attachments/a-qr.png']);
});

test('droppedFiles: nothing goes when nothing was removed, or when a file is still used', () => {
  const a = att('a');
  assert.deepEqual(droppedFiles([a], [a]), []);
  const shared = att('s', { uri: a.uri });
  assert.deepEqual(droppedFiles([a], [shared]), []);
  assert.deepEqual(droppedFiles([], [a]), []);
});

test('droppedFiles: a crop that is the file itself is listed once', () => {
  const a = att('a', { qrCropUri: 'file:///d/attachments/a.pdf' });
  assert.deepEqual(droppedFiles([a, a], []), [a.uri]);
});

test('droppedFiles: leaving without Save drops only the files added this session', () => {
  const saved = att('saved');
  const added = att('new');
  assert.deepEqual(droppedFiles([added], [saved]), [added.uri]);
});

test('sameAttachments compares ids, order, files and crops', () => {
  const a = att('a');
  const b = att('b');
  assert.equal(sameAttachments([a, b], [a, b]), true);
  assert.equal(sameAttachments([], []), true);
  assert.equal(sameAttachments([a, b], [b, a]), false);
  assert.equal(sameAttachments([a], [a, b]), false);
  assert.equal(sameAttachments([a], [{ ...a, qrCropUri: 'file:///d/attachments/q.png' }]), false);
});

test('droppedFiles: on Save, a file added then removed in the form is deleted too', () => {
  const saved = att('saved');
  const gone = att('gone');
  const added = att('added');
  const tmp = att('tmp');
  assert.deepEqual(droppedFiles([saved, gone, added, tmp], [saved, added]), [gone.uri, tmp.uri]);
});
