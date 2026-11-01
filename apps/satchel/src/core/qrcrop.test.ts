// T28: in-app QR crop rectangle (clamping, aspect, corner drags, storing on the attachment).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './model.ts';
import { clampCrop, cleanCrop, cropLayout, dragCorner, initialCrop, MIN_CROP, moveCrop, scaleCrop, setCropRect, toFraction } from './qrcrop.ts';
import { primaryTicket, sameAttachments, setQrCrop } from './tickets.ts';

const inside = (r: { x: number; y: number; w: number; h: number }) => {
  assert.ok(r.x >= 0 && r.y >= 0, 'top-left inside');
  assert.ok(r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9, 'bottom-right inside');
  assert.ok(r.w >= MIN_CROP - 1e-9 && r.h >= MIN_CROP - 1e-9, 'not too small');
};

test('clampCrop pulls a frame inside the image and keeps a minimum size', () => {
  assert.deepEqual(clampCrop({ x: -0.2, y: -1, w: 0.5, h: 0.5 }), { x: 0, y: 0, w: 0.5, h: 0.5 });
  assert.deepEqual(clampCrop({ x: 0.8, y: 0.9, w: 0.5, h: 0.5 }), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepEqual(clampCrop({ x: 0, y: 0, w: 3, h: 2 }), { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(clampCrop({ x: 0.5, y: 0.5, w: 0, h: 0.001 }), { x: 0.5, y: 0.5, w: MIN_CROP, h: MIN_CROP });
  inside(clampCrop({ x: 0.99, y: 0.99, w: 0.01, h: 0.01 }));
});

test('cleanCrop: valid kept (rounded), nonsense and the whole image dropped', () => {
  assert.deepEqual(cleanCrop({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(cleanCrop({ x: 0.123456, y: 0, w: 0.5, h: 0.5 }), { x: 0.1235, y: 0, w: 0.5, h: 0.5 });
  for (const bad of [undefined, null, 'x', 3, {}, { x: 0, y: 0, w: 0, h: 0.5 }, { x: 0, y: 0, w: -1, h: 0.5 }, { x: NaN, y: 0, w: 0.5, h: 0.5 }, { x: '0', y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: Infinity, h: 0.5 }]) {
    assert.equal(cleanCrop(bad), null, JSON.stringify(bad));
  }
  assert.equal(cleanCrop({ x: 0, y: 0, w: 1, h: 1 }), null, 'whole image is no crop');
  assert.equal(cleanCrop({ x: -1, y: -1, w: 5, h: 5 }), null);
});

test('initialCrop is a centred square in pixels on portrait, landscape and unknown images', () => {
  const p = initialCrop(1000, 2000);
  inside(p);
  assert.ok(Math.abs(p.w * 1000 - p.h * 2000) < 1, 'square in pixels');
  assert.ok(Math.abs(p.x + p.w / 2 - 0.5) < 1e-3 && Math.abs(p.y + p.h / 2 - 0.5) < 1e-3, 'centred');
  const l = initialCrop(3000, 1000);
  assert.ok(Math.abs(l.w * 3000 - l.h * 1000) < 1);
  inside(initialCrop(0, 0));
});

test('dragCorner moves one corner, keeps the opposite one, never inverts or leaves the image', () => {
  const r = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  assert.deepEqual(dragCorner(r, 'br', 0.1, 0.2), { x: 0.2, y: 0.2, w: 0.5, h: 0.6 });
  assert.deepEqual(dragCorner(r, 'tl', -0.1, -0.1), { x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  assert.deepEqual(dragCorner(r, 'tr', 0.1, -0.1), { x: 0.2, y: 0.1, w: 0.5, h: 0.5 });
  assert.deepEqual(dragCorner(r, 'bl', -0.1, 0.1), { x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
  // dragged far past the opposite corner: stops at the minimum, opposite corner unchanged
  const past = dragCorner(r, 'tl', 0.9, 0.9);
  assert.equal(past.w, MIN_CROP);
  assert.ok(Math.abs(past.x + past.w - 0.6) < 1e-9);
  // dragged off the image: stops at the edge
  assert.deepEqual(dragCorner(r, 'br', 5, 5), { x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
  assert.deepEqual(dragCorner(r, 'tl', -5, -5), { x: 0, y: 0, w: 0.6, h: 0.6 });
  for (const c of ['tl', 'tr', 'bl', 'br'] as const) for (const d of [-2, -0.3, 0.3, 2]) inside(dragCorner(r, c, d, -d));
});

test('moveCrop slides the frame without resizing it; scaleCrop grows and shrinks about the centre', () => {
  const r = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  assert.deepEqual(moveCrop(r, 0.1, -0.1), { x: 0.3, y: 0.1, w: 0.4, h: 0.4 });
  assert.deepEqual(moveCrop(r, 1, 1), { x: 0.6, y: 0.6, w: 0.4, h: 0.4 });
  assert.deepEqual(moveCrop(r, -1, -1), { x: 0, y: 0, w: 0.4, h: 0.4 });
  assert.deepEqual(scaleCrop(r, 0.5), { x: 0.3, y: 0.3, w: 0.2, h: 0.2 });
  assert.deepEqual(scaleCrop(r, 10), { x: 0, y: 0, w: 1, h: 1 });
  inside(scaleCrop({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 3));
  assert.deepEqual(scaleCrop(r, 0.001), { x: 0.375, y: 0.375, w: MIN_CROP, h: MIN_CROP });
});

test('cropLayout keeps the region aspect in pixels and fills the box on the limiting side', () => {
  // Square QR in the middle of a tall 1000x2000 screenshot: region 400x400 px.
  const q = cropLayout({ x: 0.3, y: 0.4, w: 0.4, h: 0.2 }, 1000, 2000, 300, 500)!;
  assert.equal(q.frameW, 300);
  assert.equal(q.frameH, 300);
  assert.equal(q.imageW, 750);
  assert.equal(q.imageH, 1500);
  assert.equal(q.left, -225);
  assert.equal(q.top, -600);
  // Long barcode: 800x100 px region fits by width.
  const b = cropLayout({ x: 0.1, y: 0.5, w: 0.8, h: 0.05 }, 1000, 2000, 320, 320)!;
  assert.equal(b.frameW, 320);
  assert.equal(b.frameH, 40);
  assert.ok(Math.abs(b.frameW / b.frameH - 8) < 1e-9);
  // The visible region is exactly the crop: frame / image size = crop fraction.
  assert.ok(Math.abs(b.frameW / b.imageW - 0.8) < 1e-9 && Math.abs(-b.top / b.imageH - 0.5) < 1e-9);
  assert.equal(cropLayout({ x: 0, y: 0, w: 0.5, h: 0.5 }, 0, 100, 10, 10), null);
  assert.equal(cropLayout({ x: 0, y: 0, w: 0.5, h: 0.5 }, 100, 100, 0, 10), null);
  assert.deepEqual(toFraction(30, -15, 300, 150), { dx: 0.1, dy: -0.1 });
  assert.deepEqual(toFraction(30, 15, 0, 0), { dx: 0, dy: 0 });
});

const item = (): Item =>
  ({
    id: 'i1',
    tripId: 't1',
    kind: 'train',
    title: 'Train',
    start: { local: '2027-04-01T09:00', tz: 'Asia/Tokyo' },
    attachments: [
      { id: 'a1', uri: 'file:///d/attachments/a1.pdf', name: 'a.pdf', mime: 'application/pdf', role: 'booking' },
      { id: 'a2', uri: 'file:///d/attachments/a2.png', name: 'b.png', mime: 'image/png', role: 'other', qrCropUri: 'file:///d/attachments/a2-qr.jpg' },
      { id: 'a3', uri: 'file:///d/attachments/a3.png', name: 'c.png', mime: 'image/png', role: 'ticket', qrCropUri: 'file:///d/attachments/a3.png' },
    ],
  }) as Item;

test('setCropRect stores a clean rectangle, drops a separate crop image, keeps a crop-is-the-file mark', () => {
  const src = item();
  const a = setCropRect(src, 'a2', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  assert.deepEqual(a.item.attachments[1], { id: 'a2', uri: 'file:///d/attachments/a2.png', name: 'b.png', mime: 'image/png', role: 'other', qrCrop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } });
  assert.equal(a.dropped, 'file:///d/attachments/a2-qr.jpg');
  assert.equal(src.attachments[1].qrCrop, undefined, 'never mutates');
  const b = setCropRect(src, 'a3', { x: 0.2, y: 0.2, w: 2, h: 0.3 });
  assert.equal(b.dropped, null);
  assert.deepEqual(b.item.attachments[2].qrCrop, { x: 0, y: 0.2, w: 1, h: 0.3 });
  assert.equal(b.item.attachments[2].qrCropUri, 'file:///d/attachments/a3.png');
  // cleared, or the whole image: no rectangle, nothing dropped
  const c = setCropRect(b.item, 'a3', null);
  assert.equal('qrCrop' in c.item.attachments[2], false);
  assert.equal(c.dropped, null);
  const w = setCropRect(src, 'a2', { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(w.dropped, null);
  assert.equal(w.item.attachments[1].qrCropUri, 'file:///d/attachments/a2-qr.jpg');
  // a rectangle makes the attachment the primary ticket and counts as an unsaved change
  const only = { ...src, attachments: [src.attachments[0], { ...src.attachments[0], id: 'a4', role: 'other' as const }] };
  const rect = setCropRect(only, 'a4', { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }).item;
  assert.equal(primaryTicket(rect)?.id, 'a4');
  assert.equal(sameAttachments(only.attachments, rect.attachments), false);
  assert.equal(sameAttachments(rect.attachments, JSON.parse(JSON.stringify(rect.attachments))), true);
  // a newer crop image replaces the rectangle
  assert.equal('qrCrop' in setQrCrop(rect, 'a4', 'file:///d/attachments/a4-qr.jpg').attachments[1], false);
});
