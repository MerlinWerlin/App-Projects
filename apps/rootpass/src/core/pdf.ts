/**
 * A tiny PDF 1.4 writer for true-scale templates: vector lines, circles and Helvetica text only, no compression,
 * so tests can read the drawing back and check the scale exactly.
 * PDF user space is 1/72 inch (ISO 32000-1:2008, 8.3.2.3), so 1 mm = 72 / 25.4 pt = 2.834645… pt.
 * Drawing calls take millimetres from the page's TOP-LEFT corner; the writer flips to PDF's bottom-left origin.
 * Circles are four cubic Béziers with the standard k = 0.5522847 (error < 0.03 % of the radius).
 */
export const PT_PER_MM = 72 / 25.4;
export const PAPER = {
  a4: { name: 'A4', w: 210, h: 297 },
  letter: { name: 'US Letter', w: 215.9, h: 279.4 },
} as const;
export type PaperId = keyof typeof PAPER;

const K = 0.5522847498;

const n = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toString();
};

/** WinAnsi text: ASCII plus the few symbols templates use; anything else becomes '?'. */
const WIN_ANSI: Record<string, number> = { '°': 0xb0, '×': 0xd7, '±': 0xb1, '½': 0xbd, '¼': 0xbc, '¾': 0xbe, '–': 0x96, '—': 0x97, '’': 0x92, '“': 0x93, '”': 0x94, '²': 0xb2, '·': 0xb7, 'é': 0xe9 };

export function pdfString(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    let b: number;
    if (code >= 32 && code < 127) b = code;
    else if (WIN_ANSI[ch] !== undefined) b = WIN_ANSI[ch];
    else b = 63; // ?
    if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
    else if (b < 128) out += String.fromCharCode(b);
    else out += '\\' + b.toString(8).padStart(3, '0');
  }
  return `(${out})`;
}

/** Approximate Helvetica width (average advance ≈ 0.52 em) for centring labels. */
export function textWidthMm(s: string, sizePt: number): number {
  return (s.length * 0.52 * sizePt) / PT_PER_MM;
}

export class Page {
  readonly ops: string[] = [];
  readonly wMm: number;
  readonly hMm: number;
  constructor(wMm: number, hMm: number) {
    this.wMm = wMm;
    this.hMm = hMm;
  }
  private X(mm: number) { return n(mm * PT_PER_MM); }
  private Y(mm: number) { return n((this.hMm - mm) * PT_PER_MM); }
  stroke(widthMm: number, gray = 0, dashMm?: [number, number]) {
    this.ops.push(`${n(widthMm * PT_PER_MM)} w ${n(gray)} G ${dashMm ? `[${n(dashMm[0] * PT_PER_MM)} ${n(dashMm[1] * PT_PER_MM)}] 0 d` : '[] 0 d'}`);
  }
  line(x1: number, y1: number, x2: number, y2: number) {
    this.ops.push(`${this.X(x1)} ${this.Y(y1)} m ${this.X(x2)} ${this.Y(y2)} l S`);
  }
  polyline(pts: [number, number][]) {
    if (pts.length < 2) return;
    const [first, ...rest] = pts;
    this.ops.push(`${this.X(first[0])} ${this.Y(first[1])} m ` + rest.map(p => `${this.X(p[0])} ${this.Y(p[1])} l`).join(' ') + ' S');
  }
  rect(x: number, y: number, w: number, h: number, fill = false) {
    this.ops.push(`${this.X(x)} ${this.Y(y + h)} ${n(w * PT_PER_MM)} ${n(h * PT_PER_MM)} re ${fill ? 'f' : 'S'}`);
  }
  fillGray(g: number) { this.ops.push(`${n(g)} g`); }
  circle(cx: number, cy: number, r: number) {
    const k = r * K;
    const p = (x: number, y: number) => `${this.X(x)} ${this.Y(y)}`;
    this.ops.push(
      `${p(cx + r, cy)} m ` +
      `${p(cx + r, cy - k)} ${p(cx + k, cy - r)} ${p(cx, cy - r)} c ` +
      `${p(cx - k, cy - r)} ${p(cx - r, cy - k)} ${p(cx - r, cy)} c ` +
      `${p(cx - r, cy + k)} ${p(cx - k, cy + r)} ${p(cx, cy + r)} c ` +
      `${p(cx + k, cy + r)} ${p(cx + r, cy + k)} ${p(cx + r, cy)} c S`,
    );
  }
  text(x: number, y: number, sizePt: number, s: string, opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; rotate90?: boolean } = {}) {
    const w = textWidthMm(s, sizePt);
    const dx = opts.align === 'center' ? -w / 2 : opts.align === 'right' ? -w : 0;
    const font = opts.bold ? 'F2' : 'F1';
    if (opts.rotate90) {
      // Reads bottom-to-top, anchored at (x, y).
      this.ops.push(`BT /${font} ${n(sizePt)} Tf 0 1 -1 0 ${this.X(x)} ${this.Y(y - dx)} Tm ${pdfString(s)} Tj ET`);
    } else {
      this.ops.push(`BT /${font} ${n(sizePt)} Tf ${this.X(x + dx)} ${this.Y(y)} Td ${pdfString(s)} Tj ET`);
    }
  }
  /** Start a clipped, translated group: content mm (cx, cy) lands at page mm (px, py). */
  beginClip(x: number, y: number, w: number, h: number, offsetX: number, offsetY: number) {
    this.ops.push(`q ${this.X(x)} ${this.Y(y + h)} ${n(w * PT_PER_MM)} ${n(h * PT_PER_MM)} re W n`);
    this.ops.push(`1 0 0 1 ${n(offsetX * PT_PER_MM)} ${n(-offsetY * PT_PER_MM)} cm`);
  }
  endClip() { this.ops.push('Q'); }
}

export class PdfDoc {
  readonly pages: Page[] = [];
  readonly title: string;
  constructor(title: string) {
    this.title = title;
  }
  addPage(wMm: number, hMm: number): Page {
    const p = new Page(wMm, hMm);
    this.pages.push(p);
    return p;
  }
  /** The file as bytes (latin-1). */
  toBytes(): Uint8Array {
    const objs: string[] = [];
    // 1 catalog, 2 pages, 3 font regular, 4 font bold, 5 info, then (page, content) pairs.
    const pageIds = this.pages.map((_, k) => 6 + k * 2);
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[5] = `<< /Title ${pdfString(this.title)} /Creator (Rootpass) /Producer (Rootpass) >>`;
    this.pages.forEach((p, k) => {
      const content = p.ops.join('\n');
      objs[6 + k * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.wMm * PT_PER_MM)} ${n(p.hMm * PT_PER_MM)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + k * 2} 0 R >>`;
      objs[7 + k * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    for (let id = 1; id < objs.length; id++) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 0xff;
    return bytes;
  }
}

/** Base64 for writing the file on the phone. */
export function toBase64(bytes: Uint8Array): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let k = 0; k < bytes.length; k += 3) {
    const a = bytes[k], b = bytes[k + 1] ?? 0, c = bytes[k + 2] ?? 0;
    const v = (a << 16) | (b << 8) | c;
    out += abc[(v >> 18) & 63] + abc[(v >> 12) & 63] + (k + 1 < bytes.length ? abc[(v >> 6) & 63] : '=') + (k + 2 < bytes.length ? abc[v & 63] : '=');
  }
  return out;
}
