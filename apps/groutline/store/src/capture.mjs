/**
 * Captures real Groutline screens from the web build for the App Store screenshots.
 * Drives a local headless Chrome over the DevTools protocol (no extra packages): 440 × 956 CSS px at scale 3
 * = 1320 × 2868 (APP_IPHONE_67, 6.9"). Seeds the app's own on-device storage with saved jobs so each calculator
 * opens showing a real result, then scrolls the screen's scroll view to the given element.
 *
 *   node store/src/capture.mjs <dev-server-url> <out-dir>
 * Needs `npx expo start --web` running. Output: raw-<name>.png per shot.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = process.argv[2] ?? 'http://localhost:8131';
const OUT = process.argv[3] ?? 'store/raw';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const now = Date.UTC(2026, 10, 20, 9, 30);
const job = (id, name, tool, inputs, summary) => ({ id, name, tool, inputs, summary, country: 'AU', createdAt: now, updatedAt: now });
const JOBS = [
  job('tiles', 'Smith ensuite floor', 'tiles', { surface: 'floor', rows: JSON.stringify([{ a: '3200', b: '2700', cut: false }, { a: '900', b: '600', cut: true }]), tileId: 'au-600x600-4', tileL: '600', tileW: '600', tileT: '9', perBox: '4', boxArea: '1.44', joint: '3', layout: 'straight', waste: '' }, ['28 tiles', '7 cartons']),
  job('setout', 'Kitchen floor set-out', 'setout', { length: '4200', width: '3300', tileId: 'au-600x600-4', tileL: '600', tileW: '600', tileT: '9', perBox: '', boxArea: '', joint: '3', gap: '5', modeX: 'best', modeY: 'best' }, ['Set-out']),
  job('grout', 'Laundry grout', 'materials', { mode: 'grout', area: '14.5', tileId: '', tileL: '300', tileW: '300', tileT: '8', perBox: '', boxArea: '', joint: '3', groutId: 'au-cg2-5', groutBag: '', groutK: '1.6', groutExtra: '' }, ['Grout']),
  job('falls', 'Walk-in shower falls', 'falls', { drain: 'point', basis: 'plane', length: '1500', width: '1200', dx: '', dy: '', ratio: '1:80', thick: '20' }, ['Falls']),
  job('wp', 'Main bathroom membrane', 'materials', { mode: 'membrane', area: '', wpMode: 'room', roomL: '2700', roomW: '2100', showerL: '1200', showerW: '900', showerWalls: '2', door: '820', wallH: '1800', upturn: '150', wholeFloor: true, wpId: 'au-pu-20', wpRate: '', wpCoats: '2', wpPack: '' }, ['Membrane']),
  job('stairs', 'Front steps', 'stairs', { steps: '5', width: '1200', going: '300', riser: '170', tileRisers: true, tileId: 'au-300x600-8', tileL: '600', tileW: '300', tileT: '9.5', perBox: '', boxArea: '', joint: '3', buildUp: '15', footRaised: false, landingTiled: true, nosing: '2500' }, ['Stairs']),
];

// break-ui worst case (WORST=1): same data boundary (saved jobs), realistic extremes.
if (process.env.WORST) {
  JOBS.length = 0;
  JOBS.push(
    job('tiles', 'Northwind Industries warehouse floor, stage 2 (east mezzanine) re-tile', 'tiles', { surface: 'floor', rows: JSON.stringify([{ a: '96000', b: '48500', cut: false }, { a: '12000', b: '8000', cut: false }, { a: '2400', b: '2400', cut: true }, { a: '1200', b: '900', cut: true }]), tileId: '', tileL: '25', tileW: '25', tileT: '4', perBox: '', boxArea: '0.093', joint: '1.5', layout: 'herringbone', waste: '' }, ['big']),
    job('setout', 'Car park ramp', 'setout', { length: '64000', width: '38000', tileId: '', tileL: '100', tileW: '100', tileT: '9', perBox: '', boxArea: '', joint: '2', gap: '10', modeX: 'wall', modeY: 'best' }, ['x']),
    job('falls', 'Gym change room', 'falls', { drain: 'point', basis: 'valley', length: '12000', width: '9500', dx: '200', dy: '9300', ratio: '1:200', thick: '45' }, ['x']),
    job('grout', 'Pool', 'materials', { mode: 'grout', area: '4850', tileId: '', tileL: '20', tileW: '20', tileT: '4', perBox: '', boxArea: '', joint: '1', groutId: 'au-epoxy-2', groutBag: '', groutK: '1.6', groutExtra: '' }, ['x']),
    job('wp', 'x', 'materials', { mode: 'membrane', area: '', wpMode: 'room', roomL: '20000', roomW: '15000', showerL: '1200', showerW: '900', showerWalls: '3', door: '1800', wallH: '2400', upturn: '200', wholeFloor: true, wpId: 'au-pu-4', wpRate: '', wpCoats: '2', wpPack: '' }, ['x']),
    job('stairs', 'Stadium stand', 'stairs', { steps: '100', width: '24000', going: '400', riser: '120', tileRisers: true, tileId: '', tileL: '1200', tileW: '600', tileT: '20', perBox: '', boxArea: '', joint: '5', buildUp: '35', footRaised: false, landingTiled: false, nosing: '2500' }, ['x']),
  );
}
/** name, path, text to scroll to (or null for top). */
const SHOTS = [
  ['01-tiles', '/tool/tiles?job=tiles', 'How it'],
  ['02-setout', '/tool/setout?job=setout', 'How it'],
  ['03-falls', '/tool/falls?job=falls', 'How it'],
  ['04-membrane', '/tool/materials?job=wp', 'How it'],
  ['05-grout', '/tool/materials?job=grout', 'How it'],
  ['06-stairs', '/tool/stairs?job=stairs', 'How it'],
  ['07-home', '/', null],
  ['08-country', '/welcome', null],
  ['09-unlock', '/unlock', null],
  // Design-review set (not store shots): the top of each calculator, plus the other screens.
  ['10-tiles-top', '/tool/tiles?job=tiles', null],
  ['11-setout-top', '/tool/setout?job=setout', null],
  ['12-materials-top', '/tool/materials?job=wp', null],
  ['13-falls-top', '/tool/falls?job=falls', null],
  ['14-trim-top', '/tool/trim', null],
  ['15-stairs-top', '/tool/stairs?job=stairs', null],
  ['16-jobs', '/jobs', null],
  ['17-settings', '/settings', null],
  ['18-standards', '/standards', null],
  ['19-setout-steps', '/tool/setout?job=setout', 'How it', 150],
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const port = 9333;
const profile = join(tmpdir(), `groutline-shots-${Date.now()}`);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-color-profile=srgb', '--lang=en-AU', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Emulation.setLocaleOverride', { locale: 'en-AU' }).catch(() => undefined);
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.W ?? 440), height: Number(process.env.H ?? 956), deviceScaleFactor: Number(process.env.DPR ?? 3), mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.SCHEME ?? 'light' }] });
await send('Page.navigate', { url: BASE });
await sleep(6000);
await evaluate(`localStorage.setItem('groutline.prefs.v1', ${JSON.stringify(JSON.stringify({ country: 'AU', units: null, haptics: true }))});
  localStorage.setItem('groutline.access.v1', ${JSON.stringify(JSON.stringify({ plus: true, trialStart: null }))});
  localStorage.setItem('groutline.jobs.v1', ${JSON.stringify(JSON.stringify(JOBS))}); true`);

for (const [name, path, anchor, lift = 0] of SHOTS) {
  if (ONLY && !ONLY.includes(name)) continue;
  if (name === '10-tiles-top') await evaluate(`localStorage.setItem('groutline.access.v1', ${JSON.stringify(JSON.stringify({ plus: true, trialStart: null }))}); true`);
  if (name === '09-unlock') await evaluate(`localStorage.setItem('groutline.prefs.v1', ${JSON.stringify(JSON.stringify({ country: 'AU', units: null, haptics: true }))}); localStorage.setItem('groutline.access.v1', ${JSON.stringify(JSON.stringify({ plus: false, trialStart: null }))}); true`);
  if (name === '08-country') await evaluate(`localStorage.setItem('groutline.prefs.v1', ${JSON.stringify(JSON.stringify({ country: null, units: null, haptics: true }))}); true`);
  await send('Page.navigate', { url: BASE + path });
  await sleep(4500);
  if (anchor) {
    const ok = await evaluate(`(() => {
      const el = [...document.querySelectorAll('div')].find(d => d.childElementCount === 0 && d.textContent.trim().startsWith(${JSON.stringify(anchor)}));
      if (!el) return false;
      let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && getComputedStyle(s).overflowY !== 'visible')) s = s.parentElement;
      if (!s) return false;
      const top = el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - (${lift || 0} || (s.clientHeight - 150));
      s.scrollTop = Math.max(0, top); return true;
    })()`);
    if (!ok) console.warn(`${name}: anchor "${anchor}" not found`);
    await sleep(700);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `raw-${name}.png`), Buffer.from(data, 'base64'));
  console.log('captured', name);
}
ws.close();
chrome.kill();
