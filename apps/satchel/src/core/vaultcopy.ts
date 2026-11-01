// T155: how the document screen (app/doc/[id].tsx) shows each saved copy of a vault document, reusing the ticket
// pieces: an image can be cropped to its QR / barcode in the app (a rectangle on the attachment, src/core/qrcrop.ts,
// the file is never changed) and a PDF opens full screen inside Satchel where the build has the viewer. Everything
// stays on the phone: the crop is plain data on the document, the viewer only reads the local file.
// Pure TypeScript (no React Native).
import type { Attachment, TravelDoc } from './model.ts';
import { cleanCrop, setCropRect, type CropRect } from './qrcrop.ts';
import { attachmentKind, type AttachmentKind } from './tickets.ts';

export type CopyView = {
  kind: AttachmentKind;
  /** The saved in-app crop of an image copy, safe to draw; null for none (or for a PDF). */
  crop: CropRect | null;
  /** The crop button: add one, adjust the saved one, or none (not an image). */
  cropAction: 'add' | 'adjust' | null;
  /** True when the PDF can be shown inside Satchel (else the system share / preview sheet). */
  inlinePdf: boolean;
};

export function copyView(a: Pick<Attachment, 'mime' | 'name' | 'qrCrop'>, viewerAvailable: boolean): CopyView {
  const kind = attachmentKind(a.mime, a.name);
  const crop = kind === 'image' ? cleanCrop(a.qrCrop) : null;
  return {
    kind,
    crop,
    cropAction: kind === 'image' ? (crop ? 'adjust' : 'add') : null,
    inlinePdf: kind === 'pdf' && viewerAvailable,
  };
}

/** The document and its image copy the crop screen edits, or null when either is gone or the copy is no image. */
export function cropTarget(docs: readonly TravelDoc[], docId: string | undefined, attId: string | undefined): { doc: TravelDoc; copy: Attachment } | null {
  const doc = docs.find((d) => d.id === docId);
  const copy = doc?.attachments.find((a) => a.id === attId);
  if (!doc || !copy || attachmentKind(copy.mime, copy.name) !== 'image') return null;
  return { doc, copy };
}

/**
 * The vault with one copy's crop set (or cleared with null). `dropped` is a separate crop image the caller deletes
 * after the save (the same rule as tickets). The vault is returned unchanged when the document or copy is gone.
 */
export function setDocCrop(
  docs: readonly TravelDoc[],
  docId: string,
  attId: string,
  crop: CropRect | null,
): { docs: TravelDoc[]; dropped: string | null; found: boolean } {
  let dropped: string | null = null;
  let found = false;
  const out = docs.map((d) => {
    if (d.id !== docId || !d.attachments.some((a) => a.id === attId)) return d;
    found = true;
    const r = setCropRect(d, attId, crop);
    dropped = r.dropped;
    return r.item;
  });
  return { docs: found ? out : [...docs], dropped, found };
}
