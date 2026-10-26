import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconBackdrop } from './iconBackdrop.ts';

test('older saved sets without wallpaper colour export an opaque colour from their style', () => {
  assert.equal(iconBackdrop({ kind: 'solid', colour: '#FFCCAA' }), '#FFCCAA');
  assert.equal(iconBackdrop({ kind: 'gradient', from: '#AABBCC', to: '#DDEEFF', angle: 90 }, null), '#AABBCC');
  assert.equal(iconBackdrop({ kind: 'glass', tint: '#EEDDCC', opacity: 0.2 }), '#EEDDCC');
});
test('explicit wallpaper colour wins, invalid old values cannot leave transparent corners', () => {
  assert.equal(iconBackdrop({ kind: 'solid', colour: '#FFFFFF' }, '#123456'), '#123456');
  assert.equal(iconBackdrop({ kind: 'solid', colour: '#FFFFFF' }, 'transparent'), '#FFFFFF');
});
