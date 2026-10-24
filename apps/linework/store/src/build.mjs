#!/usr/bin/env node
// Linework store screenshot generator (T77). Node stdlib only, no npm installs.
// Writes one SVG per shot per style at 1320x2868 to store/svg/a/ and store/svg/b/.
// Everything is drawn here as original vector art; template line art is reused from assets/templates/.
// Illustrative mockups, not real-device captures. Run: node store/src/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE = join(HERE, '..');
const ROOT = join(STORE, '..');
const W = 1320;
const H = 2868;

// Tokens from src/theme/tokens.ts (docs/PLAN.md §4).
const C = {
  paper: '#F5F1EA', card: '#FFFFFF', line: '#DDD5C8', graphite: '#22201C', muted: '#6E675D',
  ink: '#2346A8', inkDeep: '#1A3482', inkSoft: '#E3E8F7', ok: '#2C7A54', warn: '#A2620F',
  skin: '#EDBE9C', skinShade: '#D79F7B', skinLine: '#B97F5C', nail: '#F6D7C6',
  pencil: '#F2B33D', pencilDark: '#D9932A', pencilLight: '#F8CB66', wood: '#E9C9A0', lead: '#3A3630',
};
const SERIF = "Fraunces, Lora, Georgia, 'Times New Roman', serif";
const SANS = "Inter, 'SF Pro Text', Arial, sans-serif";
const ROUNDED = "'SF Pro Rounded', 'Arial Rounded MT Bold', Nunito, Inter, Arial, sans-serif";
const FALLBACK_SCRIPTS = "'Noto Sans CJK JP', 'Noto Sans CJK KR', 'DejaVu Sans', 'FreeSans', sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let uid = 0;
const id = (p) => `${p}${++uid}`;

// ---------- template art (our own assets/templates line art) ----------
const artCache = new Map();
function artInner(name) {
  if (!artCache.has(name)) {
    const raw = readFileSync(join(ROOT, 'assets/templates', `${name}.svg`), 'utf8');
    const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/g, '');
    artCache.set(name, inner);
  }
  return artCache.get(name);
}
function art(name, x, y, size, { color = C.graphite, opacity = 1, width } = {}) {
  let inner = artInner(name).replace(/#22201C/gi, color);
  if (width) inner = inner.replace(/stroke-width="[\d.]+"/g, `stroke-width="${width}"`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 400 400" overflow="visible" opacity="${opacity}">${inner}</svg>`;
}

// ---------- shared defs ----------
function defs() {
  return `<defs>
  <filter id="shPhone" x="-30%" y="-20%" width="160%" height="140%"><feDropShadow dx="0" dy="40" stdDeviation="46" flood-color="#22201C" flood-opacity="0.28"/></filter>
  <filter id="shCard" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#22201C" flood-opacity="0.20"/></filter>
  <filter id="shSoft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#22201C" flood-opacity="0.16"/></filter>
  <filter id="shDeep" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#0B1640" flood-opacity="0.45"/></filter>
  <filter id="blurPhoto"><feGaussianBlur stdDeviation="2.4"/></filter>
  <radialGradient id="camLight" cx="45%" cy="40%" r="80%"><stop offset="0" stop-color="#F7F2E8"/><stop offset="0.7" stop-color="#E7DFD0"/><stop offset="1" stop-color="#CFC5B3"/></radialGradient>
  <linearGradient id="glassG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
  <linearGradient id="bodyG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A3833"/><stop offset="0.5" stop-color="#1D1C19"/><stop offset="1" stop-color="#2E2C28"/></linearGradient>
  <linearGradient id="pencilG" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${C.pencilLight}"/><stop offset="0.5" stop-color="${C.pencil}"/><stop offset="1" stop-color="${C.pencilDark}"/></linearGradient>
  <linearGradient id="inkBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A50BA"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>
</defs>`;
}

// ---------- icons (24-unit grid, drawn with strokes) ----------
function icon(name, cx, cy, s, color = '#FFFFFF', sw = 2) {
  const k = s / 24;
  const g = (body) => `<g transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${k})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  switch (name) {
    case 'lock': return g('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.2" fill="' + color + '"/>');
    case 'torch': return g('<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>');
    case 'grid': return g('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>');
    case 'mirror': return g('<path d="M12 3v18" stroke-dasharray="2 2.4"/><path d="M9 6 3 18h6zM15 6l6 12h-6z"/>');
    case 'steps': return g('<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M4 20V4"/>');
    case 'light': return g('<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>');
    case 'record': return g('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="' + color + '"/>');
    case 'photo': return g('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>');
    case 'back': return g('<path d="M15 5 8 12l7 7"/>');
    case 'help': return g('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6"/><circle cx="12" cy="17" r=".6" fill="' + color + '"/>');
    case 'search': return g('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>');
    case 'check': return g('<path d="m5 12.5 4.5 4.5L19 7.5"/>');
    case 'wand': return g('<path d="m4 20 11-11M14 4v3M19 9h-3M17.5 5.5l-2 2"/>');
    case 'globe': return g('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>');
    case 'home': return g('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>');
    case 'templates': return g('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>');
    case 'drawings': return g('<path d="M4 20h16M6 16l9-9 3 3-9 9H6z"/>');
    case 'tool': return g('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>');
    case 'star': return g('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>');
    case 'settings': return g('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>');
    default: return '';
  }
}

// ---------- decorative pieces ----------
function sparkle(x, y, s, color = '#FFFFFF', rot = 0, op = 1) {
  const a = s, b = s * 0.22;
  return `<path transform="translate(${x} ${y}) rotate(${rot})" opacity="${op}" fill="${color}" d="M0 ${-a} C ${b} ${-b} ${b} ${-b} ${a} 0 C ${b} ${b} ${b} ${b} 0 ${a} C ${-b} ${b} ${-b} ${b} ${-a} 0 C ${-b} ${-b} ${-b} ${-b} 0 ${-a} Z"/>`;
}
function dot(x, y, r, color, op = 1) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${op}"/>`; }
function ripple(cx, cy, color = '#FFFFFF', base = 46, n = 3, op = 0.9) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${cx}" cy="${cy}" r="${base + i * base * 0.85}" fill="none" stroke="${color}" stroke-width="${10 - i * 2.5}" opacity="${(op * (1 - i * 0.28)).toFixed(2)}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${base * 0.55}" fill="${color}" opacity="${op * 0.35}"/>`;
  return s;
}
// Hand-drawn arrow: a curved stroke with a slight double-line wobble and an open arrowhead.
function arrow(d, end, angle, color = C.graphite, w = 9, dashed = false) {
  const head = `<path transform="translate(${end[0]} ${end[1]}) rotate(${angle})" d="M -46 -30 L 0 0 L -44 32" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" ${dashed ? 'stroke-dasharray="2 26"' : ''}/>${head}`;
}
function card(x, y, w, h, rot, body, { label, fill = C.card, labelColor = C.graphite, r = 36, filter = 'shCard' } = {}) {
  const lab = label ? `<text x="${w / 2}" y="${h - 36}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="38" fill="${labelColor}">${esc(label)}</text>` : '';
  return `<g transform="translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})"><rect width="${w}" height="${h}" rx="${r}" fill="${fill}" filter="url(#${filter})"/>${body}${lab}</g>`;
}
function chip(x, y, label, ic, { rot = 0, fill = C.card, color = C.graphite, iconColor = C.ink, size = 1, filter = 'shSoft' } = {}) {
  const fs = 40 * size, h = 96 * size, pad = 34 * size, isz = 44 * size;
  const tw = label.length * fs * 0.56;
  const w = pad * 2 + (ic ? isz + 18 * size : 0) + tw;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" filter="url(#${filter})"/>${ic ? icon(ic, -w / 2 + pad + isz / 2, 0, isz, iconColor, 2.2) : ''}<text x="${ic ? -w / 2 + pad + isz + 18 * size : 0}" y="${fs * 0.36}" ${ic ? '' : 'text-anchor="middle"'} font-family="${SANS}" font-weight="600" font-size="${fs}" fill="${color}">${esc(label)}</text></g>`;
}

// ---------- hand with pencil (tip at 0,0, pencil runs along +x before rotation) ----------
function phone(cx, cy, w, rot, screen, { shadow = 'shPhone' } = {}) {
  const h = w * 2.168, x = cx - w / 2, y = cy - h / 2;
  const b = w * 0.026, r = w * 0.15, sr = r - b;
  const clip = id('scr');
  return `<g transform="rotate(${rot} ${cx} ${cy})">
  <clipPath id="${clip}"><rect x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" rx="${sr}"/></clipPath>
  <rect x="${x - 5}" y="${y + h * 0.2}" width="10" height="${h * 0.07}" rx="5" fill="#2A2925"/>
  <rect x="${x - 5}" y="${y + h * 0.3}" width="10" height="${h * 0.07}" rx="5" fill="#2A2925"/>
  <rect x="${x + w - 5}" y="${y + h * 0.26}" width="10" height="${h * 0.1}" rx="5" fill="#2A2925"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#bodyG)" filter="url(#${shadow})"/>
  <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="${r - 3}" fill="none" stroke="#5A5750" stroke-width="3"/>
  <g clip-path="url(#${clip})"><svg x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" viewBox="0 0 600 1300" preserveAspectRatio="xMidYMid slice">${screen}
    <rect x="236" y="18" width="128" height="38" rx="19" fill="#0E0E0C"/><circle cx="338" cy="37" r="7" fill="#1B2533"/>
    <rect x="200" y="1272" width="200" height="8" rx="4" fill="${screen.includes('data-dark') ? '#FFFFFF' : C.graphite}" opacity="0.55"/>
  </svg></g>
  <rect x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" rx="${sr}" fill="url(#glassG)" opacity="0.6"/>
</g>`;
}

// ---------- app screens (600x1300) ----------
function statusBar(dark) {
  const c = dark ? '#FFFFFF' : C.graphite;
  return `<text x="58" y="44" font-family="${SANS}" font-weight="600" font-size="22" fill="${c}">12:00</text>
  <g fill="${c}"><rect x="476" y="32" width="5" height="10" rx="1.5"/><rect x="485" y="28" width="5" height="14" rx="1.5"/><rect x="494" y="24" width="5" height="18" rx="1.5"/>
  <rect x="510" y="26" width="34" height="17" rx="4.5" fill="none" stroke="${c}" stroke-width="2"/><rect x="513" y="29" width="24" height="11" rx="2.5"/></g>`;
}
function glassPill(x, y, w, h, active = false) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${active ? 'rgba(35,70,168,0.88)' : 'rgba(20,19,15,0.55)'}" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>`;
}
const TOOLS = [['lock', 'Lock'], ['torch', 'Torch'], ['grid', 'Grid'], ['mirror', 'Mirror'], ['steps', 'Steps'], ['light', 'Lightbox'], ['record', 'Record'], ['photo', 'Photo']];
function controlRow(y, tools, active = []) {
  const n = tools.length, gap = 10, w = (540 - gap * (n - 1)) / n;
  return tools.map(([ic, label], i) => {
    const x = 30 + i * (w + gap), on = active.includes(ic);
    return `${glassPill(x, y, w, 104, on)}${icon(ic, x + w / 2, y + 38, 34)}<text x="${x + w / 2}" y="${y + 86}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="17" fill="#FFFFFF">${label}</text>`;
  }).join('');
}
function opacitySlider(x, y, h, pct) {
  const fillH = h * pct / 100;
  return `${glassPill(x, y, 58, h)}<rect x="${x + 21}" y="${y + 24}" width="16" height="${h - 48}" rx="8" fill="rgba(255,255,255,0.25)"/>
  <rect x="${x + 21}" y="${y + 24 + (h - 48) * (1 - pct / 100)}" width="16" height="${(h - 48) * pct / 100}" rx="8" fill="#FFFFFF"/>
  <circle cx="${x + 29}" cy="${y + 24 + (h - 48) * (1 - pct / 100)}" r="20" fill="#FFFFFF" stroke="${C.ink}" stroke-width="4"/>
  <text x="${x + 29}" y="${y - 16}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="20" fill="#FFFFFF">${pct}%</text>`;
}
// Camera view of paper with the template overlay and a half-done pencil drawing.
function traceScreen({ subject = 'rose-bloom', opacity = 60, locked = false, steps = null, tools = TOOLS.slice(0, 5), active = [], drawn = 0.5, subjectSize = 520, subjectY = 330 } = {}) {
  const cid = id('half');
  const sx = 300 - subjectSize / 2;
  const stepBar = steps ? `${glassPill(110, 96, 380, 64)}<text x="300" y="137" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="22" fill="#FFFFFF">${esc(steps)}</text>` : '';
  const lockBadge = locked ? `${glassPill(190, 172, 220, 54, true)}${icon('lock', 222, 199, 24)}<text x="242" y="207" font-family="${SANS}" font-weight="600" font-size="21" fill="#FFFFFF">Image locked</text>` : '';
  return `<g data-dark="1"><rect width="600" height="1300" fill="url(#camLight)"/>
  <path d="M -20 1020 L 640 960 L 640 1320 L -20 1320 Z" fill="#B99A78" opacity="0.55"/>
  <rect x="40" y="250" width="520" height="760" fill="#FBF8F1" opacity="0.6" transform="rotate(-2 300 630)"/>
  <clipPath id="${cid}"><rect x="0" y="${subjectY + subjectSize * (1 - drawn)}" width="600" height="${subjectSize}"/></clipPath>
  <g clip-path="url(#${cid})">${art(subject, sx + 4, subjectY + 4, subjectSize, { color: '#2F2C27', opacity: 1, width: 3.6 })}</g>
  ${art(subject, sx, subjectY, subjectSize, { color: C.ink, opacity: (opacity / 100).toFixed(2), width: 4.5 })}
  ${statusBar(true)}
  ${glassPill(30, 96, 64, 64)}${icon('back', 62, 128, 30)}
  ${glassPill(506, 96, 64, 64)}${icon('help', 538, 128, 30)}
  ${stepBar}${lockBadge}
  ${opacitySlider(520, 420, 420, opacity)}
  ${controlRow(1130, tools, active)}
  </g>`;
}
// Stylised "photo" subject (a ginger cat on a cushion) and its outline version share the same shapes.
const CAT = {
  body: 'M 170 520 C 150 420 190 330 300 320 C 410 330 450 420 430 520 C 420 560 180 560 170 520 Z',
  head: 'M 210 250 C 210 190 250 160 300 160 C 350 160 390 190 390 250 C 390 310 350 340 300 340 C 250 340 210 310 210 250 Z',
  earL: 'M 222 210 L 228 120 L 280 168 Z', earR: 'M 378 210 L 372 120 L 320 168 Z',
  tail: 'M 420 500 C 500 490 520 420 480 380 C 470 370 456 380 466 394 C 490 430 470 470 418 470',
  cushion: 'M 100 530 C 100 500 500 500 500 530 L 510 590 C 510 620 90 620 90 590 Z',
};
function catPhoto(x, y, w) {
  const k = w / 600;
  return `<g transform="translate(${x} ${y}) scale(${k})">
  <rect width="600" height="700" fill="#E9D9C2"/><rect width="600" height="380" fill="#D8E2EC"/><rect x="380" y="40" width="190" height="280" fill="#F4F0E2" opacity="0.8"/>
  <rect x="0" y="380" width="600" height="320" fill="#CDB89C"/>
  <g filter="url(#blurPhoto)">
  <path d="${CAT.cushion}" fill="#7C9BC9"/><path d="${CAT.tail}" fill="none" stroke="#D9853B" stroke-width="34" stroke-linecap="round"/>
  <path d="${CAT.body}" fill="#E39446"/><path d="M 230 380 C 260 470 340 470 370 380 C 350 520 250 520 230 380 Z" fill="#F7E2C6"/>
  <path d="${CAT.earL}" fill="#D9853B"/><path d="${CAT.earR}" fill="#D9853B"/><path d="M 236 192 L 240 140 L 268 168 Z" fill="#F2B8A0"/><path d="M 364 192 L 360 140 L 332 168 Z" fill="#F2B8A0"/>
  <path d="${CAT.head}" fill="#EBA057"/><path d="M 300 170 L 290 210 M 300 170 L 310 210 M 270 175 L 276 205 M 330 175 L 324 205" stroke="#C4702C" stroke-width="7" stroke-linecap="round"/>
  <path d="M 250 270 C 250 330 350 330 350 270 C 340 300 260 300 250 270 Z" fill="#F7E2C6"/>
  <ellipse cx="262" cy="246" rx="15" ry="18" fill="#3B5E2B"/><ellipse cx="338" cy="246" rx="15" ry="18" fill="#3B5E2B"/><circle cx="266" cy="240" r="5" fill="#FFF"/><circle cx="342" cy="240" r="5" fill="#FFF"/>
  <path d="M 292 276 L 308 276 L 300 286 Z" fill="#C46A6A"/>
  </g></g>`;
}
function catOutline(x, y, w, color = C.graphite, sw = 6) {
  const k = w / 600;
  return `<g transform="translate(${x} ${y}) scale(${k})"><rect width="600" height="700" fill="#FFFFFF"/>
  <g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
  <path d="${CAT.cushion}"/><path d="${CAT.tail}"/><path d="${CAT.body}"/><path d="M 230 380 C 260 470 340 470 370 380"/>
  <path d="${CAT.earL}"/><path d="${CAT.earR}"/><path d="M 236 192 L 240 146 M 364 192 L 360 146"/><path d="${CAT.head}"/>
  <path d="M 300 172 L 292 206 M 300 172 L 308 206"/><ellipse cx="262" cy="246" rx="15" ry="18"/><ellipse cx="338" cy="246" rx="15" ry="18"/>
  <path d="M 292 276 L 308 276 L 300 286 Z M 300 286 C 296 298 284 300 278 296 M 300 286 C 304 298 316 300 322 296"/>
  <path d="M 240 280 L 170 270 M 240 292 L 172 300 M 360 280 L 430 270 M 360 292 L 428 300"/>
  <path d="M 260 520 C 262 540 280 548 296 540 M 304 540 C 320 548 338 540 340 520"/></g></g>`;
}
function prepareScreen(mode = 'outline') {
  const segOn = (x, label, on) => `<rect x="${x}" y="196" width="246" height="62" rx="31" fill="${on ? C.ink : 'transparent'}"/><text x="${x + 123}" y="236" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="24" fill="${on ? '#FFFFFF' : C.graphite}">${label}</text>`;
  const styles = [['Sketch', false], ['Line art', true], ['Bold lines', false]];
  return `<rect width="600" height="1300" fill="${C.paper}"/>${statusBar(false)}
  ${icon('back', 52, 116, 30, C.graphite, 2.4)}<text x="300" y="128" text-anchor="middle" font-family="${SERIF}" font-weight="600" font-size="36" fill="${C.graphite}">Prepare</text>
  <rect x="48" y="190" width="504" height="74" rx="37" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>${segOn(54, 'Original', mode !== 'outline')}${segOn(300, 'Outline', mode === 'outline')}
  <g filter="url(#shSoft)"><rect x="48" y="300" width="504" height="588" rx="28" fill="${C.card}"/></g>
  <clipPath id="prepClip"><rect x="48" y="300" width="504" height="588" rx="28"/></clipPath>
  <g clip-path="url(#prepClip)">${mode === 'outline' ? catOutline(48, 300, 504) : catPhoto(48, 300, 504)}</g>
  <text x="48" y="946" font-family="${SANS}" font-weight="600" font-size="22" fill="${C.muted}">LINE STYLE</text>
  ${styles.map(([s, on], i) => `<rect x="${48 + i * 172}" y="966" width="160" height="66" rx="33" fill="${on ? C.inkSoft : C.card}" stroke="${on ? C.ink : C.line}" stroke-width="2.5"/><text x="${128 + i * 172}" y="1008" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="23" fill="${on ? C.ink : C.graphite}">${s}</text>`).join('')}
  <rect x="48" y="1100" width="504" height="100" rx="50" fill="${C.ink}"/><text x="300" y="1162" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="30" fill="#FFFFFF">Start tracing</text>`;
}
const GRID = [['hero-standing-tall', 'Caped hero'], ['fairy-castle-simple', 'Castle'], ['game-pixel-sword', 'Pixel sword'], ['kids-woodland-fox', 'Little fox'], ['movie-retro-rocket', 'Rocket'], ['fairy-unicorn-cute', 'Unicorn'], ['cute-whale', 'Whale'], ['bot-tulip-pair', 'Tulips']];
function templatesScreen(active = 'All') {
  const cats = ['All', 'New', 'Letters', 'Heroes', 'Fairy tales'];
  let cx = 40;
  const bubbles = cats.map((c) => {
    const w = c.length * 13.5 + 48, on = c === active;
    const s = `<rect x="${cx}" y="250" width="${w}" height="58" rx="29" fill="${on ? C.ink : C.card}" stroke="${on ? C.ink : C.line}" stroke-width="2"/><text x="${cx + w / 2}" y="287" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="22" fill="${on ? '#FFFFFF' : C.graphite}">${esc(c)}</text>`;
    cx += w + 12;
    return s;
  }).join('');
  const HERO_GRID = [['hero-standing-tall', 'Caped hero'], ['hero-caped-pup', 'Caped pup'], ['hero-kid', 'Hero kid'], ['hero-ninja', 'Ninja'], ['hero-star-shield', 'Star shield'], ['hero-knight', 'Knight']];
  const cards = (active === 'Heroes' ? HERO_GRID : GRID).slice(0, 6).map(([a, n], i) => {
    const x = 40 + (i % 2) * 268, y = 340 + Math.floor(i / 2) * 300;
    return `<g filter="url(#shSoft)"><rect x="${x}" y="${y}" width="252" height="282" rx="26" fill="${C.card}"/></g><rect x="${x + 12}" y="${y + 12}" width="228" height="200" rx="18" fill="${C.paper}"/>${art(a, x + 36, y + 22, 180, { width: 5 })}<text x="${x + 22}" y="${y + 256}" font-family="${SANS}" font-weight="600" font-size="23" fill="${C.graphite}">${n}</text>`;
  }).join('');
  return `<rect width="600" height="1300" fill="${C.paper}"/>${statusBar(false)}
  <text x="40" y="150" font-family="${SERIF}" font-weight="700" font-size="56" fill="${C.graphite}">Templates</text>
  <rect x="40" y="176" width="520" height="58" rx="29" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>${icon('search', 76, 205, 28, C.muted)}<text x="102" y="213" font-family="${SANS}" font-size="22" fill="${C.muted}">Search 1,900+ templates</text>
  ${bubbles}${cards}${tabBar('templates')}`;
}
// Letters (owner 24 Oct 2026): Templates with the Letters bubble on, style tiles and one-letter cards.
const LETTER_COUNTS = { bubble: 39, retro: 39, calligraphy: 53, pixel: 39, graffiti: 39, western: 39 };
const LETTER_TILES = [['bubble', 'Bubble'], ['retro', 'Retro'], ['calligraphy', 'Calligraphy'], ['pixel', 'Pixel'], ['graffiti', 'Graffiti'], ['western', 'Western']];
function lettersScreen(activeStyle = 'calligraphy') {
  const cats = ['All', 'New', 'Letters', 'Heroes'];
  let cx = 40;
  const bubbles = cats.map((c) => {
    const w = c.length * 13.5 + 48, on = c === 'Letters';
    const s = `<rect x="${cx}" y="250" width="${w}" height="58" rx="29" fill="${on ? C.ink : C.card}" stroke="${on ? C.ink : C.line}" stroke-width="2"/><text x="${cx + w / 2}" y="287" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="22" fill="${on ? '#FFFFFF' : C.graphite}">${esc(c)}</text>`;
    cx += w + 12;
    return s;
  }).join('');
  const tiles = LETTER_TILES.map(([st, n], i) => {
    const x = 40 + (i % 3) * 176, y = 330 + Math.floor(i / 3) * 176, on = st === activeStyle;
    return `<rect x="${x}" y="${y}" width="164" height="164" rx="24" fill="${on ? C.card : '#FFE3EC'}" stroke="${on ? C.ink : C.line}" stroke-width="${on ? 4 : 2}"/>${art(`char-${st}-a`, x + 42, y + 14, 80, { width: 8 })}<text x="${x + 82}" y="${y + 126}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="21" fill="${C.graphite}">${n}</text><text x="${x + 82}" y="${y + 150}" text-anchor="middle" font-family="${SANS}" font-size="17" fill="${C.muted}">${LETTER_COUNTS[st]}</text>`;
  }).join('');
  const cards = [['char-calligraphy-l', 'Calligraphy L'], ['char-calligraphy-o-small', 'Calligraphy o'], ['char-calligraphy-v', 'Calligraphy V'], ['char-calligraphy-e-small', 'Calligraphy e']].map(([a, n], i) => {
    const x = 40 + (i % 2) * 268, y = 700 + Math.floor(i / 2) * 248;
    return `<g filter="url(#shSoft)"><rect x="${x}" y="${y}" width="252" height="232" rx="26" fill="${C.card}"/></g><rect x="${x + 12}" y="${y + 12}" width="228" height="160" rx="18" fill="${C.paper}"/>${art(a, x + 56, y + 12, 160, { width: 6 })}<text x="${x + 22}" y="${y + 210}" font-family="${SANS}" font-weight="600" font-size="22" fill="${C.graphite}">${n}</text>`;
  }).join('');
  return `<rect width="600" height="1300" fill="${C.paper}"/>${statusBar(false)}
  <text x="40" y="150" font-family="${SERIF}" font-weight="700" font-size="56" fill="${C.graphite}">Templates</text>
  <rect x="40" y="176" width="520" height="58" rx="29" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>${icon('search', 76, 205, 28, C.muted)}<text x="102" y="213" font-family="${SANS}" font-size="22" fill="${C.muted}">Search 1,900+ templates</text>
  ${bubbles}${tiles}${cards}${tabBar('templates')}`;
}
// Workshop tab (owner 24 Oct 2026): blueprint navy, cyan grid, square technical cards.
const BP = { bg: '#0F2236', grid: '#1D3A57', line: '#7FD6F2', card: '#132B44', text: '#E6F4FB', muted: '#8EA3BC' };
function blueprintGrid(w, h, step = 30) {
  let d = '';
  for (let x = 0; x <= w; x += step) d += `M${x} 0V${h}`;
  for (let y = 0; y <= h; y += step) d += `M0 ${y}H${w}`;
  return `<path d="${d}" stroke="${BP.grid}" stroke-width="1" fill="none"/>`;
}
const WORK_TILES = [['Angles', 15], ['Carpentry', 22], ['Framing', 14], ['Metal', 18], ['Pipe', 12], ['Layout', 16]];
const WORK_CARDS = [['trade-angle-45', 'ANGLE 45°'], ['trade-dovetail-1-6-3', 'DOVETAIL 1:6'], ['trade-mitre-30-6', 'MITRE 30° ×6'], ['trade-circle-divide-8', 'CIRCLE ÷ 8']];
function workshopScreen(active = 'Angles') {
  const MONO = "'SF Mono', Menlo, 'DejaVu Sans Mono', monospace";
  const tiles = WORK_TILES.map(([n, k], i) => {
    const x = 40 + (i % 3) * 176, y = 250 + Math.floor(i / 3) * 104, on = n === active;
    return `<rect x="${x}" y="${y}" width="164" height="92" rx="6" fill="${on ? '#1C3D5E' : BP.card}" stroke="${on ? BP.line : '#2C4D6E'}" stroke-width="${on ? 3 : 1.5}"/><text x="${x + 16}" y="${y + 40}" font-family="${MONO}" font-weight="700" font-size="21" fill="${on ? BP.line : BP.text}">${n.toUpperCase()}</text><text x="${x + 16}" y="${y + 72}" font-family="${MONO}" font-size="17" fill="${BP.muted}">${k} TEMPLATES</text>`;
  }).join('');
  const cards = WORK_CARDS.map(([a, n], i) => {
    const x = 40 + (i % 2) * 268, y = 480 + Math.floor(i / 2) * 330;
    return `<rect x="${x}" y="${y}" width="252" height="312" rx="4" fill="${BP.card}" stroke="${BP.line}" stroke-width="1.5"/>${art(a, x + 16, y + 14, 220, { color: BP.text, width: 4 })}<text x="${x + 16}" y="${y + 290}" font-family="${MONO}" font-weight="600" font-size="19" fill="${BP.line}">${n}</text>`;
  }).join('');
  return `<g data-dark="1"><rect width="600" height="1300" fill="${BP.bg}"/>${blueprintGrid(600, 1300)}${statusBar(true)}
  <text x="40" y="150" font-family="${MONO}" font-weight="700" font-size="50" fill="${BP.text}">Workshop</text>
  <text x="40" y="198" font-family="${MONO}" font-size="20" fill="${BP.muted}">Exact angles, joints and layouts</text>
  ${tiles}${cards}${tabBar('tool')}</g>`;
}
// Linework Plus (one-time unlock): no price figure on purpose (it varies by country).
function plusScreen() {
  const rows = [['Every template, 1,900+', 'templates'], ['All 16 letter styles', 'star'], ['The Workshop pack', 'tool'], ['Outline mode for any photo', 'wand']];
  return `<rect width="600" height="1300" fill="${C.paper}"/>${statusBar(false)}
  <circle cx="300" cy="230" r="90" fill="${C.inkSoft}"/>${icon('star', 300, 230, 96, C.ink, 2)}
  <text x="300" y="390" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="54" fill="${C.graphite}">Linework Plus</text>
  <text x="300" y="440" text-anchor="middle" font-family="${SANS}" font-size="24" fill="${C.muted}">One-time unlock. Yours to keep.</text>
  ${rows.map(([t, ic], i) => `<rect x="48" y="${500 + i * 112}" width="504" height="96" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>${icon(ic, 104, 548 + i * 112, 38, C.ink, 2.2)}<text x="144" y="${558 + i * 112}" font-family="${SANS}" font-weight="600" font-size="25" fill="${C.graphite}">${esc(t)}</text>${icon('check', 512, 548 + i * 112, 30, C.ok, 3)}`).join('')}
  <rect x="48" y="980" width="504" height="100" rx="50" fill="${C.ink}"/><text x="300" y="1042" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="30" fill="#FFFFFF">Unlock once</text>
  <text x="300" y="1130" text-anchor="middle" font-family="${SANS}" font-size="21" fill="${C.muted}">No subscription · No ads · Tracing tools stay free</text>`;
}
const TABS = {
  en: ['Trace', 'Templates', 'Workshop', 'My drawings', 'Settings'],
  ja: ['トレース', 'テンプレート', '工房', 'マイ作品', '設定'],
  ar: ['تتبّع', 'القوالب', 'الورشة', 'رسوماتي', 'الإعدادات'],
};
function tabBar(on, lang = 'en') {
  const names = TABS[lang];
  let tabs = [['home', names[0]], ['templates', names[1]], ['tool', names[2]], ['drawings', names[3]], ['settings', names[4]]];
  if (lang === 'ar') tabs = tabs.reverse();
  const ff = lang === 'en' ? SANS : FALLBACK_SCRIPTS;
  const dark = on === 'tool';
  return `<rect x="0" y="1186" width="600" height="114" fill="${dark ? '#0E1B2E' : C.card}"/><rect x="0" y="1186" width="600" height="2" fill="${dark ? '#24405F' : C.line}"/>` + tabs.map(([ic, l], i) => {
    const x = 60 + i * 120, c = ic === on ? (dark ? '#7FD6F2' : C.ink) : dark ? '#8EA3BC' : C.muted;
    return `${icon(ic, x, 1222, 30, c, 2.2)}<text x="${x}" y="1262" text-anchor="middle" font-family="${ff}" font-weight="600" font-size="15" fill="${c}">${esc(l)}</text>`;
  }).join('');
}
const HOME = {
  en: { tag: 'Trace anything. Free.', a: 'Trace a photo', b: 'Take a photo', c: 'See all templates', r: 'Recent', dir: 'ltr' },
  ja: { tag: 'なんでもトレース。無料で。', a: '写真をトレース', b: '写真を撮る', c: 'すべてのテンプレートを見る', r: '最近の項目', dir: 'ltr' },
  ar: { tag: 'تتبّع أي شيء. مجانًا.', a: 'تتبّع صورة', b: 'التقط صورة', c: 'عرض كل القوالب', r: 'الأخيرة', dir: 'rtl' },
};
function homeScreen(lang = 'en') {
  const t = HOME[lang], rtl = t.dir === 'rtl';
  const ff = lang === 'en' ? SANS : FALLBACK_SCRIPTS;
  const tx = rtl ? 552 : 48, anchor = rtl ? 'start" direction="rtl' : 'start';
  const btn = (y, label, ic, primary) => `<rect x="48" y="${y}" width="504" height="112" rx="30" fill="${primary ? C.ink : C.card}" stroke="${primary ? C.ink : C.line}" stroke-width="2"/>${icon(ic, rtl ? 500 : 100, y + 56, 40, primary ? '#FFFFFF' : C.ink, 2.2)}<text x="${rtl ? 460 : 140}" y="${y + 66}" text-anchor="${anchor}" font-family="${ff}" font-weight="700" font-size="30" fill="${primary ? '#FFFFFF' : C.graphite}">${esc(label)}</text>`;
  const recents = ['bot-sunflower', 'cute-penguin', 'orn-love-hearts'].map((a, i) => {
    const x = rtl ? 552 - 160 - i * 172 : 48 + i * 172;
    return `<g filter="url(#shSoft)"><rect x="${x}" y="800" width="160" height="200" rx="22" fill="${C.card}"/></g>${art(a, x + 15, 830, 130, { width: 6 })}`;
  }).join('');
  return `<rect width="600" height="1300" fill="${C.paper}"/>${statusBar(false)}
  <text x="${tx}" y="170" text-anchor="${anchor}" font-family="${SERIF}" font-weight="700" font-size="64" fill="${C.graphite}">Linework</text>
  <text x="${tx}" y="226" text-anchor="${anchor}" font-family="${ff}" font-size="28" fill="${C.muted}">${esc(t.tag)}</text>
  ${btn(290, t.a, 'photo', true)}${btn(426, t.b, 'record', false)}${btn(562, t.c, 'templates', false)}
  <text x="${tx}" y="770" text-anchor="${anchor}" font-family="${ff}" font-weight="700" font-size="30" fill="${C.graphite}">${esc(t.r)}</text>${recents}
  ${tabBar('home', lang)}`;
}

// ---------- headline blocks ----------
function headlineA(lines, sub, color = C.graphite, subColor = C.muted) {
  const fs = 124, lh = 138, top = 236;
  const t = lines.map((l, i) => `<tspan x="660" y="${top + i * lh}">${esc(l)}</tspan>`).join('');
  return `<text text-anchor="middle" font-family="${SERIF}" font-weight="600" font-size="${fs}" letter-spacing="-2" fill="${color}">${t}</text>
  <text x="660" y="${top + (lines.length - 1) * lh + 86}" text-anchor="middle" font-family="${SANS}" font-weight="500" font-size="50" fill="${subColor}">${esc(sub)}</text>`;
}
function headlineB(lines, sub) {
  const fs = 128, lh = 142, top = 320;
  const t = lines.map((l, i) => `<tspan x="660" y="${top + i * lh}">${esc(l)}</tspan>`).join('');
  return `<text text-anchor="middle" font-family="${ROUNDED}" font-weight="800" font-size="${fs}" letter-spacing="-1" fill="#FFFFFF">${t}</text>
  <text x="660" y="${top + lines.length * lh + 4}" text-anchor="middle" font-family="${ROUNDED}" font-weight="600" font-size="50" fill="#FFFFFF" fill-opacity="0.86">${esc(sub)}</text>`;
}
function bgA(c1, c2, c3) {
  const g = id('bg');
  return `<linearGradient id="${g}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3 || c2}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#${g})"/>
  <circle cx="1180" cy="760" r="420" fill="#FFFFFF" opacity="0.28"/><circle cx="120" cy="2300" r="520" fill="#FFFFFF" opacity="0.22"/>`;
}
function bgB() {
  return `<rect width="${W}" height="${H}" fill="url(#inkBg)"/><circle cx="660" cy="1760" r="760" fill="#FFFFFF" opacity="0.05"/>`;
}
function wrap(title, body) {
  uid = 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${esc(title)}</title>
<desc>Linework store screenshot. Illustrative mockup, not a real-device capture. Original art.</desc>
${defs()}
${body}
</svg>
`;
}
// White pop-up panel for style (b) and (a).
function popup(x, y, w, h, body, { fill = C.card, filter = 'shCard', r = 48, rot = 0 } = {}) {
  return `<g transform="translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})"><rect width="${w}" height="${h}" rx="${r}" fill="${fill}" filter="url(#${filter})"/>${body}</g>`;
}
function bigSlider(x, y, h, pct, { track = C.inkSoft, fill = C.ink, bubble = C.ink } = {}) {
  const ty = y + h * (1 - pct / 100);
  return `<rect x="${x - 34}" y="${y}" width="68" height="${h}" rx="34" fill="${track}"/>
  <rect x="${x - 34}" y="${ty}" width="68" height="${y + h - ty}" rx="34" fill="${fill}"/>
  <circle cx="${x}" cy="${ty}" r="62" fill="#FFFFFF" stroke="${fill}" stroke-width="12" filter="url(#shSoft)"/>
  <g transform="translate(${x - 300} ${ty})"><path d="M -150 -78 H 130 Q 170 -78 170 -38 V 38 Q 170 78 130 78 H -150 Q -190 78 -190 38 V -38 Q -190 -78 -150 -78 Z M 170 -22 L 214 0 L 170 22 Z" fill="${bubble}" filter="url(#shSoft)"/>
  <text x="-10" y="34" text-anchor="middle" font-family="${ROUNDED}" font-weight="800" font-size="96" fill="#FFFFFF">${pct}%</text></g>`;
}

// ---------- shots ----------
// v2 (owner 24 Oct 2026): one pastel style, no hands or body parts, an upright iPhone-style phone as large as the
// frame allows, caption above. Workshop moves to shot 3 so tradespeople see it before they flick past.
const PW = 1000; // phone width; height = PW * 2.168
const PCY = 600 + (PW * 2.168) / 2; // phone top at y = 600, under the caption
const SHOTS = [
  { id: '01-trace', lines: ['Trace anything', 'onto paper'], sub: 'Your phone over the page, your pencil on the lines',
    bg: ['#FFF4E4', '#FFE1CC', '#F9CDB8'], screen: () => traceScreen({ subject: 'rose-bloom', opacity: 55, drawn: 0.45 }) },
  // owner 24 Oct 2026: what people use Linework for, in the first images; the uses come from captions.json (11 locales).
  { id: '02-made-for', lines: ['Made for…'], sub: 'Every tool free, no ads',
    bg: ['#F3EEFF', '#E4DAFB', '#D7CCF4'], screen: () => traceScreen({ subject: 'cute-chibi-painter', opacity: 60, tools: TOOLS.slice(0, 5), active: ['grid'] }),
    over: () => {
      const uses = JSON.parse(readFileSync(join(STORE, 'captions.json'), 'utf8')).shots.find((x) => x.id === '02-made-for').items.en;
      const x0 = 160, y0 = 860, cw = 1000, rowH = 118;
      const pills = uses.map((u, i) => {
        const x = x0 + 30 + (i % 2) * 480, y = y0 + 48 + Math.floor(i / 2) * rowH;
        const fs = u.length > 15 ? 34 : 38;
        return `<rect x="${x}" y="${y}" width="460" height="96" rx="48" fill="#FFFFFF" stroke="${C.line}" stroke-width="3"/>${icon('check', x + 50, y + 48, 38, C.ink, 3)}<text x="${x + 84}" y="${y + 61}" font-family="${SANS}" font-weight="700" font-size="${fs}" fill="${C.graphite}">${esc(u)}</text>`;
      }).join('');
      return `<rect x="${x0}" y="${y0}" width="${cw}" height="${48 * 2 + rowH * 5 - 22}" rx="56" fill="#F7F3FF" fill-opacity="0.96" filter="url(#shCard)"/>${pills}`;
    } },
  { id: '03-workshop', lines: ['Exact angles', 'for the workshop'], sub: 'Angles, joints and layouts to trace',
    bg: ['#E7EEF6', '#D3DFEC', '#C2D2E4'], screen: () => workshopScreen('Angles') },
  { id: '04-photo-sketch', lines: ['Any photo', 'to a sketch'], sub: 'Three line styles, made on your phone',
    bg: ['#FFE9DC', '#FFF3E6', '#FBEFD9'], screen: () => prepareScreen('outline') },
  { id: '05-templates', lines: ['1,900+ templates', 'to trace'], sub: 'Letters, heroes, fairy tales, kids and more',
    bg: ['#E6F7EF', '#D3F0E3', '#C4E8D9'], screen: () => templatesScreen('All') },
  { id: '06-letters', lines: ['Letters in', '16 styles'], sub: 'Bubble, retro, calligraphy, pixel and more',
    bg: ['#FFE8EE', '#FCD5DF', '#F6C3D2'], screen: () => lettersScreen('calligraphy') },
  { id: '07-lock', lines: ['Lock it.', 'Draw steady.'], sub: 'Lock, touch lock and focus that stays put',
    bg: ['#E3F1FF', '#CFE5FB', '#BFDAF6'],
    screen: () => traceScreen({ subject: 'wild-hummingbird', opacity: 60, locked: true, active: ['lock'] }) +
      `${glassPill(70, 1040, 460, 64)}<text x="300" y="1081" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="21" fill="#FFFFFF">Touch lock on · press and hold to exit</text>` },
  { id: '08-plus', lines: ['Pay once.', 'Keep it all.'], sub: 'One unlock for every template. No subscription.',
    bg: ['#FFF8DB', '#FFEFB8', '#FBE29A'], screen: () => plusScreen() },
];
for (const s of SHOTS) {
  s.a = () => bgA(...s.bg) + phone(660, PCY, PW, 0, s.screen()) + (s.over ? s.over() : '') + sparkle(90, 700, 30, '#FFFFFF') + sparkle(1236, 760, 24, C.ink);
}

// ---------- write ----------
for (const style of ['a']) mkdirSync(join(STORE, 'svg', style), { recursive: true });
const written = [];
for (const s of SHOTS) {
  for (const style of ['a']) {
    const head = headlineA(s.lines, s.sub);
    const scene = s[style]();
    // Headline goes last so cut-outs never cover it.
    const svg = wrap(`${s.lines.join(' ')} (style ${style})`, scene + head);
    const out = join(STORE, 'svg', style, `${s.id}.svg`);
    writeFileSync(out, svg);
    written.push(out);
  }
}
writeFileSync(join(STORE, 'svg', 'shots.json'), JSON.stringify(SHOTS.map((s) => s.id), null, 2) + '\n');
console.log(`wrote ${written.length} SVGs`);
