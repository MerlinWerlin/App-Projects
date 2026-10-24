#!/usr/bin/env node
/**
 * Cue App Store screenshots: node apps/cue/store/src/render.mjs
 *
 * Eight 1320x2868 JPEGs (APP_IPHONE_67) in apps/cue/store/jpg/ios/, each a short headline over a faithful mock of
 * a real Cue screen. Colours, sizes and strings come from src/theme/theme.ts (LIGHT, DARK, PROMPTER),
 * src/core/prefs.ts (font 38, line height 1.35, reading line 0.33, margin 24) and src/i18n/en.ts.
 * Original art only: icons are drawn here, the "camera view" is an abstract room with no people, and the scripts
 * are sample text written for these shots. The prompter and record screens hide the status bar, as the app does. Voice Follow is not shown (it is not in the store build yet).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..');
const repo = join(appRoot, '..', '..');
const { renderShots, phone, statusBar, esc } = await import(pathToFileURL(join(repo, 'scripts/store/shotkit.mjs')).href);

// ---- tokens (src/theme/theme.ts) ----
const LIGHT = { bg: '#F6F4EF', card: '#FFFFFF', ink: '#1A1A1C', sub: '#6B6A70', line: '#E3E0D8', accent: '#E8552B', accentInk: '#FFFFFF', chip: '#EFECE5' };
const DARK = { bg: '#0F0F11', card: '#1B1B1F', ink: '#F3F2EE', sub: '#9C9AA3', line: '#2C2C31', accent: '#FF6A3D', accentInk: '#140A06', chip: '#26262B' };
const CLASSIC = { bg: '#000000', ink: '#FFFFFF', emph: '#FFB347', dim: '#7A7A80', cue: '#FF6A3D', band: 'rgba(255,255,255,0.08)' };
const PAPER = { bg: '#F4EFE4', ink: '#1C1A17', emph: '#B5401C', dim: '#8C857A', cue: '#B5401C', band: 'rgba(0,0,0,0.06)' };
const FS = 38, LH = Math.round(38 * 1.35), PAD = 24 + 14;

// ---- icons (drawn here, Ionicons-like outline style) ----
const I = (d, s = 24, c = 'currentColor', w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ic = {
  close: (s, c) => I('<path d="M6 6l12 12M18 6L6 18"/>', s, c),
  mic: (s, c) => I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6"/>', s, c),
  speed: (s, c) => I('<path d="M4 16a8 8 0 1116 0"/><path d="M12 16l4-5"/>', s, c),
  back: (s, c) => I('<path d="M18 6v12l-8-6 8-6zM6 6v12"/>', s, c),
  list: (s, c) => I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/>', s, c),
  minus: (s, c) => I('<path d="M5 12h14"/>', s, c),
  plus: (s, c) => I('<path d="M12 5v14M5 12h14"/>', s, c),
  swapH: (s, c) => I('<path d="M4 8h15l-3-3M20 16H5l3 3"/>', s, c),
  swapV: (s, c) => I('<path d="M8 20V5L5 8M16 4v15l3-3"/>', s, c),
  pause: (s, c) => I('<path d="M8 5v14M16 5v14"/>', s, c, 3),
  play: (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="${c}"/></svg>`,
  search: (s, c) => I('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', s, c),
  download: (s, c) => I('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', s, c),
  gear: (s, c) => I('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>', s, c),
  more: (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  pin: (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}"><path d="M9 3h6l-1 6 3 3v2h-4v7l-1 1-1-1v-7H7v-2l3-3z"/></svg>`,
  video: (s, c) => I('<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>', s, c),
  doc: (s, c) => I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', s, c),
  flipCam: (s, c) => I('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><path d="M9.5 13.5a2.8 2.8 0 015-1.5M14.5 14.5a2.8 2.8 0 01-5 1.5"/>', s, c),
  text: (s, c) => I('<path d="M5 6h14M12 6v13M9 19h6"/>', s, c),
  palette: (s, c) => I('<path d="M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.5 1.7-1.5H17a4 4 0 004-4c0-4.5-4-8.2-9-8.2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>', s, c),
  stats: (s, c) => I('<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>', s, c),
  chevL: (s, c) => I('<path d="M15 5l-7 7 7 7"/>', s, c, 2.4),
};

// ---- sample script (written for these shots) ----
const SCRIPT = [
  { h: 'Intro' },
  { p: 'Hi, I’m Sam. Today I’ll show you how to make *fresh pasta* with just two ingredients. ⏸ BREATHE' },
  { p: 'No machine, no fancy tools. Just flour, eggs and about ten minutes.' },
  { h: 'The dough' },
  { p: 'Make a well in the flour and crack the eggs right into the middle.' },
];

function prompterText(palette, { lines = SCRIPT, offset = 0, fs = FS, lh = LH, readLine = 0.33, viewH = 956 } = {}) {
  const lineY = viewH * readLine;
  const blocks = lines.map((b) => {
    if (b.h) return `<div style="font-size:${fs * 0.55}px;line-height:${fs * 0.8}px;color:${palette.dim};font-weight:800;letter-spacing:1px;margin-top:${fs * 0.6}px">${esc(b.h.toUpperCase())}</div>`;
    const html = esc(b.p)
      .replace(/\*([^*]+)\*/g, `<b style="color:${palette.emph};font-weight:800">$1</b>`)
      .replace(/⏸ ([A-Z]+)/g, `<span style="color:${palette.cue};font-size:${fs * 0.6}px;font-weight:800"> ⏸ $1 </span>`);
    return `<div style="margin-bottom:${lh * 0.6}px">${html}</div>`;
  }).join('');
  return `<div style="position:absolute;left:0;right:0;top:${lineY - fs * 0.15}px;height:${lh * 1.1}px;background:${palette.band}"></div>
<div style="position:absolute;left:4px;top:${lineY + lh * 0.2}px;width:0;height:0;border-top:9px solid transparent;border-bottom:9px solid transparent;border-left:12px solid ${palette.cue}"></div>
<div style="position:absolute;left:0;right:0;top:${lineY - offset}px;padding:0 ${PAD}px;font-size:${fs}px;line-height:${lh}px;color:${palette.ink};font-weight:500">${blocks}</div>`;
}

const iconBtn = (svg, { bg = 'transparent', active = false, accent = DARK.accent } = {}) =>
  `<span style="width:44px;height:44px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;background:${active ? accent : bg}">${svg}</span>`;

function prompterScreen({ listening = true, speaking = true, offset = 0, timer = '0:14', showPill = true, mode = 'Voice Pace', speedPct = 100, p = CLASSIC, lines = SCRIPT }) {
  const top = `<div style="position:absolute;top:66px;left:12px;right:12px;display:flex;align-items:center;gap:10px">
${iconBtn(ic.close(24, '#fff'), { bg: 'rgba(0,0,0,0.35)' })}<span style="flex:1"></span>
<span style="color:${p.ink};font-size:16px;font-weight:700;opacity:.8;font-variant-numeric:tabular-nums">${timer}</span>
<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.45);border-radius:18px;padding:0 12px;height:36px;color:#fff;font-weight:700;font-size:13px">${mode === 'Steady' ? ic.speed(16, '#fff') : ic.mic(16, '#fff')}${mode}</span></div>`;
  const listen = listening ? `<div style="position:absolute;right:16px;top:122px;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.45);border-radius:14px;padding:5px 10px">
<span style="width:8px;height:8px;border-radius:4px;background:${speaking ? '#3DDC84' : '#888'}"></span><span style="color:#fff;font-size:12px;font-weight:600">${speaking ? 'Listening' : 'Waiting for you'}</span></div>` : '';
  const pill = showPill ? `<div style="position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:center"><div style="display:flex;align-items:center;background:rgba(40,40,44,0.92);border-radius:28px;padding:4px 6px">
${iconBtn(ic.back(22, '#fff'))}${iconBtn(ic.list(22, '#fff'))}${iconBtn(ic.minus(22, '#fff'))}
<span style="color:#fff;font-weight:700;min-width:44px;text-align:center;font-variant-numeric:tabular-nums">${speedPct}%</span>
${iconBtn(ic.plus(22, '#fff'))}${iconBtn(ic.swapH(22, '#fff'))}${iconBtn(ic.swapV(22, '#fff'))}${iconBtn(ic.pause(20, DARK.accentInk), { active: true })}</div></div>` : '';
  return `<div style="position:absolute;inset:0;background:${p.bg}">${prompterText(p, { offset, lines })}</div>${top}${listen}${pill}`;
}

/** Abstract out-of-focus room: no people, original shapes only. */
function roomBg() {
  return `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#2b2622 0%,#3a312a 45%,#4a3c31 100%)"></div>
<div style="position:absolute;left:-40px;top:300px;width:260px;height:520px;border-radius:12px;background:linear-gradient(180deg,#5a4636,#3e3127);filter:blur(10px);opacity:.9"></div>
<div style="position:absolute;left:-10px;top:330px;width:200px;height:6px;background:#7a604a;filter:blur(3px);box-shadow:0 110px 0 #7a604a,0 220px 0 #7a604a,0 330px 0 #7a604a"></div>
<div style="position:absolute;left:10px;top:250px;width:40px;height:70px;background:#9c6b47;filter:blur(6px);box-shadow:60px 10px 0 #4f6b5c,110px -5px 0 #b48a5a,40px 120px 0 #6d7f8f,95px 125px 0 #a65b45,20px 230px 0 #8b7a55,80px 235px 0 #59707a"></div>
<div style="position:absolute;right:30px;top:420px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,#ffe2b0 0%,rgba(255,200,130,.5) 35%,transparent 70%);filter:blur(4px)"></div>
<div style="position:absolute;right:60px;top:520px;width:90px;height:260px;background:linear-gradient(180deg,#3d5a45,#2b4031);border-radius:45px 45px 10px 10px;filter:blur(9px)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(180deg,transparent,#1e1915);"></div>`;
}

function recordScreen({ recording = true, secs = '0:08', section = 'Whole script', takes = 2, sheet = false }) {
  const box = `<div style="position:absolute;left:10px;right:10px;top:118px;height:${956 * 0.38}px;border-radius:16px;overflow:hidden;background:rgba(0,0,0,0.55)">
<div style="position:absolute;inset:0">${prompterText(CLASSIC, { fs: 34, lh: Math.round(34 * 1.35), readLine: 0.25, viewH: 956 * 0.38, offset: 0 })}</div></div>`;
  const top = `<div style="position:absolute;top:62px;left:12px;right:12px;display:flex;align-items:center;gap:10px">
${iconBtn(ic.close(24, '#fff'), { bg: 'rgba(0,0,0,0.4)' })}<span style="flex:1"></span>
${recording ? `<span style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.5);border-radius:14px;padding:5px 10px"><span style="width:10px;height:10px;border-radius:5px;background:#FF3B30"></span><span style="color:#fff;font-weight:700">${secs}</span></span>` : ''}
${iconBtn(ic.flipCam(24, '#fff'), { bg: 'rgba(0,0,0,0.4)' })}</div>`;
  const bottom = `<div style="position:absolute;left:0;right:0;bottom:52px;display:flex;align-items:center;justify-content:space-around">
<span style="width:110px;height:36px;border-radius:18px;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px">${esc(section)}</span>
<span style="width:78px;height:78px;border-radius:39px;border:5px solid #fff;display:flex;align-items:center;justify-content:center"><span style="width:${recording ? 30 : 60}px;height:${recording ? 30 : 60}px;border-radius:${recording ? 6 : 30}px;background:#FF3B30"></span></span>
<span style="width:110px;height:36px;border-radius:18px;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px">${takes ? `${takes} ✓` : ''}</span></div>`;
  const sh = sheet ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div>
<div style="position:absolute;left:8px;right:8px;bottom:34px;font-size:20px;text-align:center">
<div style="background:rgba(242,242,246,.94);border-radius:14px;overflow:hidden">
<div style="padding:14px;color:#7a7a80;font-size:13px;font-weight:600">Section</div>
${['Whole script', 'Intro', 'The dough', 'Rolling and cutting', 'Sign-off'].map((s, i) => `<div style="border-top:.5px solid rgba(60,60,67,.29);padding:17px;color:#0A84FF;${i === 2 ? 'font-weight:600' : ''}">${s}</div>`).join('')}
</div><div style="margin-top:8px;background:#fff;border-radius:14px;padding:17px;color:#0A84FF;font-weight:600">Cancel</div></div>` : '';
  return `${roomBg()}${box}${top}${bottom}${sh}`;
}

function editorScreen({ th = LIGHT, fitSheet = true }) {
  const chip = (t) => `<span style="height:36px;padding:0 12px;border-radius:18px;background:${th.chip};color:${th.ink};font-weight:600;font-size:15px;display:inline-flex;align-items:center">${t}</span>`;
  const body = `<span style="color:${th.sub}"># </span><b>Intro</b>
Hi, I’m Sam. Today I’ll show you how to make <span style="color:${th.sub}">*</span>fresh pasta<span style="color:${th.sub}">*</span> with just two ingredients. <span style="color:${th.accent}">[breathe]</span>

No machine, no fancy tools. Just flour, eggs and about ten minutes.

<span style="color:${th.sub}"># </span><b>The dough</b>
Make a well in the flour and crack the eggs right into the middle. <span style="color:${th.sub}">[[show the bowl to camera]]</span>

Mix with a fork, then knead for five minutes until it’s smooth.

<span style="color:${th.sub}"># </span><b>Rolling and cutting</b>
Roll it thin enough to see your hand through it…`;
  const fit = fitSheet ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.28)"></div>
<div style="position:absolute;left:58px;right:58px;top:300px;background:rgba(246,246,248,.97);border-radius:16px;overflow:hidden;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)">
<div style="padding:20px 16px 14px;font-weight:700;font-size:17px;color:#111">Fit the read to…</div>
${['30 s', '60 s', '90 s', '2 m', '3 m', 'Cancel'].map((s, i) => `<div style="border-top:.5px solid rgba(60,60,67,.29);padding:13px;font-size:17px;color:#0A84FF;${i === 1 ? 'font-weight:700;background:rgba(10,132,255,.08)' : ''}">${s}</div>`).join('')}</div>` : '';
  return `<div style="position:absolute;inset:0;background:${th.bg}"></div>${statusBar(th.ink)}
<div style="position:absolute;top:58px;left:8px;right:8px;height:44px;display:flex;align-items:center;justify-content:space-between;color:${th.ink}">
<span style="display:flex;align-items:center;font-size:17px">${ic.chevL(26, th.ink)}<span>Scripts</span></span>${iconBtn(ic.doc(24, th.ink))}</div>
<div style="position:absolute;top:104px;left:16px;right:16px">
<div style="font-size:26px;font-weight:800;color:${th.ink};padding:4px 0 10px">Fresh pasta in 10 minutes</div>
<div style="display:flex;background:${th.chip};border-radius:10px;padding:3px;gap:3px">
<span style="flex:1;height:38px;border-radius:8px;background:${th.card};display:flex;align-items:center;justify-content:center;font-weight:700;color:${th.ink};font-size:14px">Write</span>
<span style="flex:1;height:38px;display:flex;align-items:center;justify-content:center;color:${th.sub};font-size:14px;font-weight:500">Preview</span></div>
<div style="display:flex;gap:8px;padding:12px 0">${['Section', 'Bold', 'Pause', 'Note', 'Break'].map(chip).join('')}</div>
<div style="font-size:18px;line-height:26px;color:${th.ink};white-space:pre-wrap">${body}</div></div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:8px 16px 42px;border-top:.5px solid ${th.line};background:${th.bg}">
<div style="display:flex;align-items:center;justify-content:space-between">
<span style="color:${th.sub};font-variant-numeric:tabular-nums;font-size:15px">1:00 at 152 wpm</span>
<span style="display:flex;align-items:center">${iconBtn(ic.minus(18, th.ink))}${iconBtn(ic.plus(18, th.ink))}<span style="border:1px solid ${th.line};border-radius:16px;padding:0 10px;height:34px;display:inline-flex;align-items:center;font-weight:600;color:${th.ink};margin-left:4px;font-size:15px">Fit to time</span></span></div>
<div style="color:${th.sub};margin:4px 0 8px;font-size:15px">Rehearsals: 4 · best 0:58</div>
<div style="display:flex;gap:10px">
<span style="flex:1;height:48px;border-radius:14px;background:${th.accent};color:${th.accentInk};font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px">${ic.play(18, th.accentInk)}Prompt</span>
<span style="flex:1;height:48px;border-radius:14px;background:${th.chip};color:${th.ink};font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px">${ic.video(18, th.ink)}Record</span></div></div>${fit}`;
}

function libraryScreen({ th = LIGHT }) {
  const rows = [
    { t: 'Fresh pasta in 10 minutes', p: 'Hi, I’m Sam. Today I’ll show you how to make fresh pasta with just two ingredients.', m: '212 words · 1:23', pin: true },
    { t: 'Channel trailer', p: 'Every week I take one recipe your grandma made and make it in under fifteen minutes.', m: '96 words · 0:38', pin: true },
    { t: 'Monday team update', p: 'Three things this week: the launch date moved, we hired two people, and the new office…', m: '340 words · 2:14' },
    { t: 'Best man speech', p: 'For those who don’t know me, I’ve known Alex since we were seven and he still owes me…', m: '688 words · 4:31' },
    { t: 'Pitch: 60 seconds', p: 'Most people waste twenty minutes a day looking for their keys. We fixed that.', m: '148 words · 0:59' },
    { t: 'Welcome to Cue', p: 'Read this out loud to try it. The line in the middle of the screen is your reading line.', m: '93 words · 0:37' },
  ];
  return `<div style="position:absolute;inset:0;background:${th.bg}"></div>${statusBar(th.ink)}
<div style="position:absolute;top:58px;right:8px;height:44px;display:flex">${iconBtn(ic.download(24, th.ink))}${iconBtn(ic.gear(24, th.ink))}</div>
<div style="position:absolute;top:104px;left:16px;font-size:34px;font-weight:800;color:${th.ink};letter-spacing:-.4px">Scripts</div>
<div style="position:absolute;top:158px;left:16px;right:16px;height:44px;border-radius:12px;background:${th.chip};display:flex;align-items:center;gap:8px;padding:0 12px;color:${th.sub};font-size:16px">${ic.search(18, th.sub)}Search scripts</div>
<div style="position:absolute;top:212px;left:16px;right:16px;display:flex;flex-direction:column;gap:10px">
${rows.map((r) => `<div style="background:${th.card};border:.5px solid ${th.line};border-radius:14px;padding:14px;display:flex;align-items:center">
<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px">${r.pin ? ic.pin(14, th.accent) : ''}<span style="font-size:17px;font-weight:700;color:${th.ink}">${esc(r.t)}</span></div>
<div style="font-size:14px;line-height:19px;color:${th.sub};margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(r.p)}</div>
<div style="font-size:12px;color:${th.sub};margin-top:6px;font-variant-numeric:tabular-nums">${r.m}</div></div>${ic.more(22, th.sub)}</div>`).join('')}</div>
<div style="position:absolute;left:16px;right:16px;bottom:50px;height:54px;border-radius:14px;background:${th.accent};color:${th.accentInk};font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 8px 24px rgba(232,85,43,.35)">${ic.plus(18, th.accentInk)}New script</div>`;
}

function plusScreen({ th = DARK }) {
  const f = [
    [ic.mic, 'Voice Pace and Voice Follow, unlimited', 'The words move when you talk and wait when you stop.'],
    [ic.text, 'Caption files', 'Export .srt and .vtt timed to your reading speed.'],
    [ic.palette, 'Prompter colours', 'Paper, night red and high contrast.'],
    [ic.doc, 'Import Word documents', 'Bring in .docx scripts with headings kept.'],
    [ic.stats, 'Rehearsal stats', 'Every full read is timed so you can see yourself improve.'],
  ];
  // Voice Follow ships with the store build's speech module; until then the first row reads "Voice Pace, unlimited".
  f[0][1] = 'Voice Pace, unlimited';
  return `<div style="position:absolute;inset:0;background:#000"></div>
<div style="position:absolute;left:0;right:0;top:56px;bottom:0;background:${th.bg};border-radius:12px 12px 0 0">
<div style="height:56px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;color:${th.ink}">Cue Plus</div>
<div style="padding:8px 20px">
<div style="font-size:24px;font-weight:800;color:${th.ink}">One payment. Yours for good. No subscription.</div>
<div style="font-size:15px;line-height:21px;color:${th.sub};margin:8px 0 14px">The teleprompter, recording and every script stay free. Plus adds extras and never takes anything away.</div>
${f.map(([icn, t, b]) => `<div style="display:flex;gap:14px;align-items:center;padding:14px;border-radius:14px;border:.5px solid ${th.line};background:${th.card};margin-top:10px">${icn(24, th.accent)}<div><div style="font-size:16px;font-weight:700;color:${th.ink}">${t}</div><div style="color:${th.sub};margin-top:2px;font-size:14px;line-height:19px">${b}</div></div></div>`).join('')}
<div style="margin-top:20px;height:48px;border-radius:14px;background:${th.accent};color:${th.accentInk};font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px">Get Plus</div>
<div style="margin-top:10px;height:48px;border-radius:14px;background:${th.chip};color:${th.ink};font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px">Restore purchase</div>
</div></div>${statusBar('#fff')}`;
}

// ---- page layout ----
function page({ head, sub, screen, mode = 'dark', glow = '#FF6A3D', screenBg = '#000', phoneTop = 206 }) {
  const dark = mode === 'dark';
  const bg = dark
    ? `radial-gradient(80% 45% at 50% 66%, ${glow}55, transparent 70%), radial-gradient(60% 22% at 50% 0%, ${glow}22, transparent 70%), linear-gradient(180deg,#151517,#0B0B0D)`
    : `radial-gradient(80% 45% at 50% 66%, ${glow}33, transparent 70%), linear-gradient(180deg,#FBF9F5,#F1EDE5)`;
  const ink = dark ? '#F3F2EE' : '#1A1A1C';
  const subInk = dark ? '#B4B2BA' : '#5E5D63';
  return `<div style="position:absolute;inset:0;background:${bg}"></div>
<div style="position:absolute;left:28px;right:28px;top:52px;text-align:center">
<h1 data-fit style="font:800 37px/1.08 'Inter Display','Inter',sans-serif;letter-spacing:-.9px;color:${ink};text-wrap:balance">${head}</h1>
${sub ? `<p data-fit style="margin-top:12px;font:500 17px/1.3 'Inter',sans-serif;color:${subInk};text-wrap:balance">${sub}</p>` : ''}</div>
<div style="position:absolute;left:0;right:0;top:${phoneTop}px;display:flex;justify-content:center">${phone(screen, { width: 336, bg: screenBg })}</div>`;
}
const A = (s) => `<span style="color:#FF6A3D">${s}</span>`;
const AL = (s) => `<span style="color:#E8552B">${s}</span>`;

const shots = [
  { n: '01', name: 'waits-for-you', html: page({ head: `A teleprompter that ${A('waits for you')}`, sub: 'Voice Pace scrolls only while you talk', screen: prompterScreen({ speaking: true, lines: SCRIPT.slice(0, 3) }) }) },
  { n: '02', name: 'pause', html: page({ head: `Stop talking.<br>The words ${A('wait')}.`, sub: 'No more chasing the script', screen: prompterScreen({ speaking: false, offset: 120, timer: '0:31', showPill: false }) }) },
  { n: '03', name: 'record', html: page({ head: `Read and record ${A('at the lens')}`, sub: 'Every take saved to Photos. No watermark, ever.', screen: recordScreen({}), glow: '#FFB070' }) },
  { n: '04', name: 'sections', html: page({ head: `Retake just the bit ${A('you fluffed')}`, sub: 'Record one section at a time', screen: recordScreen({ recording: false, section: 'The dough', takes: 3, sheet: true }), glow: '#FFB070' }) },
  { n: '05', name: 'fit-time', html: page({ mode: 'light', head: `Fit any script to ${AL('60 seconds')}`, sub: 'Read time and pace while you write', screen: editorScreen({}), screenBg: LIGHT.bg, glow: '#E8552B' }) },
  { n: '06', name: 'library', html: page({ mode: 'light', head: `Every script, ${AL('one tap away')}`, sub: 'Search, pin, duplicate and import', screen: libraryScreen({}), screenBg: LIGHT.bg, glow: '#E8552B' }) },
  { n: '07', name: 'controls', html: page({ head: `Big, clear text. ${A('Your speed.')}`, sub: 'Mirror and flip for beam-splitter rigs', screen: prompterScreen({ listening: false, mode: 'Steady', speedPct: 110, timer: '0:09', p: PAPER, offset: 60, lines: SCRIPT.slice(0, 3) }), screenBg: PAPER.bg, glow: '#FFB070' }) },
  { n: '08', name: 'plus', html: page({ head: `Pay once. ${A('No subscription.')}`, sub: 'The teleprompter and recording stay free', screen: plusScreen({}) }) },
];

await renderShots({ shots, outDir: join(appRoot, 'store', 'jpg', 'ios') });
