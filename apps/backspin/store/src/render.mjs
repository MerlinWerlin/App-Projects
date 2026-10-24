#!/usr/bin/env node
/**
 * Backspin App Store screenshots: node apps/backspin/store/src/render.mjs
 *
 * Eight 1320x2868 JPEGs (APP_IPHONE_67) in apps/backspin/store/jpg/ios/: a short headline over a faithful mock of a
 * real Backspin screen in the original "Booth" look. Colours come from src/ui/theme.ts (BOOTH.dark), type sizes from
 * TYPE/SP, strings from src/i18n/en.ts, and the challenge lines and quips from src/content (all original or public
 * domain). The vinyl disc is drawn the way src/ui/kit.tsx draws it. Original art only: no logos, no real people,
 * no song lyrics under copyright, no competitor names.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..');
const repo = join(appRoot, '..', '..');
const { renderShots, phone, statusBar, esc } = await import(pathToFileURL(join(repo, 'scripts/store/shotkit.mjs')).href);

// ---- Booth dark (src/ui/theme.ts) ----
const C = {
  bg: '#14111F', card: '#1F1B2E', cardHi: '#2A2540', ink: '#F6F1FF', sub: '#B8AFD0', faint: '#7D7499', line: '#352F4D',
  rec: '#D63A2F', recInk: '#FFFFFF', rew: '#2FD6C2', rewInk: '#06201D', gold: '#FFC94A', good: '#5BE38B',
  recGrad: ['#E5483C', '#C8321F'], glow: '#FF5A4E', discBody: '#0B0912', discGroove: '#26213A', labelF: '#FF5A4E', labelB: '#2FD6C2', score: '#FFC94A',
};
const SP = (n) => n * 4;
const R = { s: 10, m: 16, l: 24, pill: 999 };
const T = {
  hero: 'font-size:34px;font-weight:800;letter-spacing:-0.5px',
  title: 'font-size:24px;font-weight:800;letter-spacing:-0.3px',
  h: 'font-size:18px;font-weight:700',
  body: 'font-size:16px;font-weight:400;line-height:22px',
  bodyB: 'font-size:16px;font-weight:700',
  small: 'font-size:13px;font-weight:500',
  line: 'font-size:26px;font-weight:800;line-height:32px;letter-spacing:-0.2px',
  num: 'font-size:64px;font-weight:900;letter-spacing:-2px;font-variant-numeric:tabular-nums',
};
const t = (kind, text, color = C.ink, extra = '') => `<div style="${T[kind]};color:${color};${extra}">${text}</div>`;
const card = (inner, { hi = false, extra = '' } = {}) => `<div style="background:${hi ? C.cardHi : C.card};border-radius:${R.l}px;padding:${SP(4)}px;border:.5px solid ${C.line};${extra}">${inner}</div>`;
const button = (title, { kind = 'primary', icon = '', small = false, extra = '' } = {}) => {
  const bg = kind === 'primary' ? `linear-gradient(135deg,${C.recGrad[0]},${C.recGrad[1]})` : kind === 'rewind' ? C.rew : kind === 'ghost' ? 'transparent' : C.cardHi;
  const fg = kind === 'primary' ? C.recInk : kind === 'rewind' ? C.rewInk : C.ink;
  return `<div style="background:${bg};border-radius:${R.pill}px;min-height:${small ? 44 : 54}px;padding:0 ${small ? SP(4) : SP(6)}px;display:flex;align-items:center;justify-content:center;gap:${SP(2)}px;${kind === 'ghost' ? `border:1.5px solid ${C.line};` : ''}${extra}">
${icon ? `<span style="font-size:${small ? 16 : 18}px">${icon}</span>` : ''}<span style="${small ? T.small : T.bodyB};font-weight:700;color:${fg}">${title}</span></div>`;
};
const chip = (label, on = false) => `<span style="padding:0 ${SP(4)}px;min-height:40px;display:inline-flex;align-items:center;border-radius:${R.pill}px;background:${on ? C.ink : C.cardHi};${T.small};font-weight:700;color:${on ? C.bg : C.ink}">${label}</span>`;

/** The vinyl disc from src/ui/kit.tsx (spin -1 = backwards, teal label). */
function disc(size, spin = 0, rot = 0, center = true) {
  const c = size / 2;
  const tri = `M ${c - c * 0.12} ${c - c * 0.14} L ${c + c * 0.16} ${c} L ${c - c * 0.12} ${c + c * 0.14} Z`;
  return `<svg width="${size}" height="${size}" style="display:block;${center ? 'margin:0 auto;' : 'flex:none;'}transform:rotate(${rot}deg)">
<circle cx="${c}" cy="${c}" r="${c - 1}" fill="${C.discBody}"/>
${[0.86, 0.74, 0.62, 0.5].map((f) => `<circle cx="${c}" cy="${c}" r="${c * f}" stroke="${C.discGroove}" stroke-width="1.2" fill="none"/>`).join('')}
<path d="M ${c} ${c * 0.08} A ${c * 0.92} ${c * 0.92} 0 0 1 ${c * 1.75} ${c * 0.6}" stroke="rgba(255,255,255,0.18)" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="${c}" cy="${c}" r="${c * 0.34}" fill="${spin < 0 ? C.labelB : C.labelF}"/>
<path d="${tri}" fill="#fff" ${spin < 0 ? `transform="rotate(180 ${c} ${c})"` : ''}/>
<circle cx="${c}" cy="${c}" r="3" fill="#000"/></svg>`;
}

/** Deterministic speech-like waveform peaks. */
function peaks(n, seed = 1, rev = false) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const env = Math.sin(Math.PI * x) ** 0.6 * (0.55 + 0.45 * Math.sin(x * 19 + seed));
    out.push(Math.max(0.06, Math.min(1, env * (0.5 + r() * 0.6))));
  }
  return rev ? out.reverse() : out;
}
const wave = (p, color, { height = 56, progress = 1 } = {}) => `<div style="display:flex;align-items:center;height:${height}px;gap:2px">${p.map((v, i) => `<div style="flex:1;height:${Math.max(3, v * height)}px;border-radius:2px;background:${i / p.length <= progress ? color : C.line}"></div>`).join('')}</div>`;

// ---- shared screen chrome ----
const bg = `<div style="position:absolute;inset:0;background:${C.bg}"></div>`;
function tabBar(active) {
  const tabs = [['🎙', 'Play'], ['🗂', 'Packs'], ['🎉', 'Party'], ['💾', 'Takes']];
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:88px;background:${C.card};border-top:.5px solid ${C.line};display:flex;padding-top:8px">
${tabs.map(([e, l], i) => `<div style="flex:1;text-align:center"><div style="font-size:22px;opacity:${i === active ? 1 : 0.55}">${e}</div><div style="font-size:10.5px;font-weight:700;margin-top:3px;color:${i === active ? C.rec : C.faint}">${l}</div></div>`).join('')}</div>`;
}
function navHeader(title) {
  return `<div style="position:absolute;top:58px;left:0;right:0;height:44px;display:flex;align-items:center;justify-content:center;background:${C.bg}">
<span style="position:absolute;left:8px;display:flex;align-items:center;color:${C.ink};font-size:17px"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Back</span>
<span style="font-weight:700;font-size:17px;color:${C.ink}">${title}</span></div>`;
}
const body = (inner, top = 70) => `<div style="position:absolute;left:${SP(5)}px;right:${SP(5)}px;top:${top}px">${inner}</div>`;

function steps(n) {
  const order = 4;
  return `<div style="display:flex;gap:6px;margin-top:${SP(3)}px">${Array.from({ length: order }, (_, i) => `<div style="flex:1;height:5px;border-radius:3px;background:${i <= n ? (n === 3 ? C.gold : C.rec) : C.line}"></div>`).join('')}</div>`;
}
function lineCard(label, line) {
  return card(`${t('small', label, C.sub)}${t('line', esc(line), C.ink, `margin-top:${SP(2)}px`)}`, { extra: `margin-top:${SP(3)}px` });
}
function recordArea({ live = true, secs = 2, levels = 30 }) {
  const lv = peaks(48, 7).map((v, i) => (i < 48 - levels ? 0.05 : v));
  return `<div style="display:flex;flex-direction:column;align-items:center;margin-top:${SP(6)}px">
<div style="width:100%;margin-bottom:${SP(5)}px">${wave(lv, C.rec, { height: 44 })}</div>
<div style="width:132px;height:132px;border-radius:66px;background:linear-gradient(160deg,${C.recGrad[0]},${C.recGrad[1]});display:flex;align-items:center;justify-content:center;box-shadow:0 6px ${live ? 40 : 20}px ${C.glow}${live ? 'B0' : '70'};transform:scale(${live ? 1.06 : 1})">
<div style="width:${live ? 40 : 50}px;height:${live ? 40 : 50}px;border-radius:${live ? 8 : 25}px;background:#fff"></div></div>
${t('bodyB', live ? `Recording… ${secs}s` : 'Hold to record', C.ink, `margin-top:${SP(4)}px;text-align:center`)}</div>`;
}

// ---- screens ----
function sayScreen() {
  return `${bg}${statusBar(C.ink)}${navHeader('Round')}${body(`
${t('small', 'Tongue twisters', C.sub)}${steps(0)}${t('h', '1 · Say it', C.ink, `margin-top:${SP(3)}px`)}
${lineCard('Say this line normally:', 'Six slick swans')}
${recordArea({ live: true, secs: 2 })}`, 112)}`;
}
function listenScreen() {
  const p = peaks(48, 3, true);
  return `${bg}${statusBar(C.ink)}${navHeader('Round')}${body(`
${t('small', 'Tongue twisters', C.sub)}${steps(1)}${t('h', '2 · Hear it backwards', C.ink, `margin-top:${SP(3)}px`)}
${lineCard('Say this line normally:', 'Six slick swans')}
<div style="margin-top:${SP(5)}px">${disc(150, -1, 38)}<div style="margin-top:${SP(3)}px">${wave(p, C.rew, { progress: 0.55 })}</div>
${t('small', 'Listen as many times as you like, then copy the sound you hear.', C.sub, `text-align:center;margin-top:${SP(2)}px`)}
<div style="display:flex;gap:${SP(2)}px;margin-top:${SP(4)}px;justify-content:center;align-items:center">${button('Pause', { kind: 'rewind', icon: '⏸' })}${chip('Slow', true)}${chip('Loop')}</div>
${button('Now copy it', { icon: '🎙', extra: `margin-top:${SP(5)}px` })}
<div style="display:flex;justify-content:center;margin-top:${SP(3)}px">${button('Redo the original', { kind: 'ghost', small: true })}</div></div>`, 112)}`;
}
function copyScreen() {
  return `${bg}${statusBar(C.ink)}${navHeader('Round')}${body(`
${t('small', 'Tongue twisters', C.sub)}${steps(2)}${t('h', '3 · Copy it', C.ink, `margin-top:${SP(3)}px`)}
${lineCard('Say this line normally:', 'Six slick swans')}
<div style="margin-top:${SP(4)}px;display:flex;align-items:center;gap:${SP(3)}px;background:${C.card};border-radius:${R.l}px;padding:${SP(3)}px">
<div style="width:44px;height:44px;border-radius:22px;background:${C.rew};display:flex;align-items:center;justify-content:center;color:${C.rewInk};font-size:16px">▶︎</div>
<div style="flex:1">${wave(peaks(48, 3, true), C.rew, { height: 36 })}</div></div>
${t('small', 'Copy the backwards sound, not the words.', C.sub, `text-align:center;margin-top:${SP(3)}px`)}
${recordArea({ live: true, secs: 3, levels: 40 })}`, 112)}`;
}
function revealScreen() {
  const tile = (label, color, seed, rev, on) => `<div style="width:calc(50% - 4px);background:${on ? C.cardHi : C.card};border-radius:${R.m}px;padding:${SP(3)}px;border:1.5px solid ${on ? color : C.line}">
${t('small', `${on ? '⏸' : '▶︎'} ${label}`, C.ink, 'font-weight:700')}<div style="margin-top:${SP(2)}px">${wave(peaks(24, seed, rev), color, { height: 24 })}</div></div>`;
  return `${bg}${statusBar(C.ink)}${navHeader('Round')}${body(`
${t('small', 'Tongue twisters', C.sub)}${steps(3)}${t('h', '4 · The flip', C.ink, `margin-top:${SP(3)}px`)}
${card(`<div style="text-align:center">${t('small', 'Closeness', C.sub)}${t('num', '87', C.score, 'line-height:72px')}
<div style="${T.h};letter-spacing:2px"><span style="color:${C.gold}">★★★★</span><span style="color:${C.line}">★</span></div>
${t('bodyB', 'You and the original are sound twins.', C.ink, `margin-top:${SP(3)}px`)}
${t('small', '“Six slick swans”', C.faint, `margin-top:${SP(2)}px`)}
<div style="display:flex;gap:${SP(5)}px;justify-content:center;margin-top:${SP(4)}px">${[['91', 'Sound'], ['84', 'Rhythm'], ['79', 'Length']].map(([n, l]) => `<div>${t('bodyB', n)}${t('small', l, C.sub)}</div>`).join('')}</div></div>`, { hi: true, extra: `margin-top:${SP(3)}px;padding:${SP(6)}px ${SP(4)}px` })}
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:${SP(4)}px">${tile('Original', C.rec, 5, false)}${tile('Backwards', C.rew, 5, true)}${tile('Your copy', C.rec, 9, false)}${tile('Flipped', C.gold, 9, true, true)}</div>
${t('small', 'Voice effect', C.sub, `margin-top:${SP(5)}px;margin-bottom:${SP(2)}px`)}
<div style="display:flex;flex-wrap:wrap;gap:8px">${['Normal', 'Chipmunk', 'Giant', 'Robot', 'Echo', 'Alien'].map((e, i) => chip(e, i === 3)).join('')}</div>
<div style="display:flex;gap:${SP(3)}px;margin-top:${SP(5)}px">${button('Share clip', { kind: 'rewind', icon: '⤴︎', extra: 'flex:1' })}${button('Save take', { kind: 'quiet', icon: '💾', extra: 'flex:1' })}</div>`, 112)}`;
}
function homeScreen() {
  return `${bg}${statusBar(C.ink)}${body(`
<div style="display:flex;align-items:center;justify-content:space-between"><div>${t('hero', 'Backspin')}${t('small', 'Rank: Echo Explorer', C.sub)}</div>
<div style="width:44px;height:44px;border-radius:22px;background:${C.card};display:flex;align-items:center;justify-content:center;color:${C.ink};font-size:18px">⚙︎</div></div>
<div style="display:inline-block;margin-top:${SP(4)}px;background:${C.cardHi};border-radius:${R.pill}px;padding:${SP(2)}px ${SP(4)}px;${T.small};font-weight:800;color:${C.ink}">🎟 7 free goes left</div>
${card(`<div style="display:flex;justify-content:space-between;align-items:center">${t('small', 'Today’s challenge', C.sub)}
<span style="background:${C.rec};border-radius:${R.pill}px;padding:${SP(1)}px ${SP(3)}px;${T.small};font-weight:800;color:${C.recInk}">🔥 4 day streak</span></div>
${t('line', 'The moon burped.', C.ink, `margin-top:${SP(3)}px`)}${t('bodyB', 'Play the daily ➜', C.rec, `margin-top:${SP(3)}px`)}`, { hi: true, extra: `margin-top:${SP(5)}px;padding:${SP(5)}px` })}
${card(`<div style="display:flex;align-items:center;gap:${SP(4)}px">${disc(72, 0, 0, false)}<div>${t('title', 'Quick play')}${t('small', 'A random line to copy', C.sub)}</div></div>`, { extra: `margin-top:${SP(4)}px;padding:${SP(5)}px` })}
<div style="display:flex;gap:${SP(3)}px;margin-top:${SP(3)}px">
${card(`<div style="font-size:28px">🗣</div>${t('bodyB', 'Freestyle', C.ink, `margin-top:${SP(2)}px`)}${t('small', 'Say anything you like', C.sub)}`, { extra: 'flex:1' })}
${card(`<div style="font-size:28px">🤝</div>${t('bodyB', 'Challenge a friend', C.ink, `margin-top:${SP(2)}px`)}${t('small', 'They record, you copy', C.sub)}`, { extra: 'flex:1' })}</div>
${card(`${t('bodyB', 'How it works')}${t('body', 'Record a line. Hear it backwards. Copy the backwards sound. Backspin flips your copy forwards, and the closer it sounds to the start, the higher you score.', C.sub, `margin-top:${SP(2)}px`)}`, { extra: `margin-top:${SP(6)}px` })}`, 66)}${tabBar(0)}`;
}
function partyScreen() {
  const players = ['Mia', 'Jordan', 'Nana', 'Leo'];
  return `${bg}${statusBar(C.ink)}${body(`
${t('hero', 'Party mode')}${t('body', 'Pass one phone around. Everyone gets their own line.', C.sub, `margin-top:${SP(1)}px`)}
<div style="display:flex;gap:${SP(3)}px;margin-top:${SP(5)}px">
${card(`<div style="font-size:26px">🎙</div>${t('bodyB', 'Copy it', C.ink, `margin-top:${SP(2)}px`)}${t('small', 'Each player copies a line. Highest closeness wins.', C.sub)}`, { hi: true, extra: `flex:1;border:2px solid ${C.rec}` })}
${card(`<div style="font-size:26px">🕵️</div>${t('bodyB', 'Guess it', C.ink, `margin-top:${SP(2)}px`)}${t('small', 'One player records secretly. Others hear only the backwards copy and guess the line.', C.sub)}`, { extra: `flex:1;border:2px solid ${C.line}` })}</div>
${t('small', 'PLAYERS', C.sub, `letter-spacing:1px;margin-top:${SP(6)}px;margin-bottom:${SP(2)}px`)}
<div style="display:flex;flex-direction:column;gap:8px">${players.map((n) => `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-height:50px;border-radius:${R.m}px;background:${C.card};color:${C.ink};padding:0 ${SP(4)}px;font-size:17px;font-weight:600;display:flex;align-items:center">${n}</div><span style="width:44px;text-align:center;color:${C.faint}">✕</span></div>`).join('')}</div>
<div style="display:flex;margin-top:${SP(3)}px">${button('Add player', { kind: 'ghost', small: true, icon: '＋' })}</div>
${t('small', 'ROUNDS', C.sub, `letter-spacing:1px;margin-top:${SP(6)}px;margin-bottom:${SP(2)}px`)}
<div style="display:flex;gap:8px">${['1', '2', '3', '5'].map((r) => chip(r, r === '3')).join('')}</div>
${button('Start party', { icon: '🎉', extra: `margin-top:${SP(8)}px` })}`, 66)}${tabBar(2)}`;
}
function packsScreen() {
  const packs = [['👋', 'Warm-up', 'Single words and easy wins', 140], ['🎉', 'Party lines', 'Silly announcements and dramatic declarations', 168], ['🐸', 'Animals & sound effects', 'Honks, quacks, pops and kerplunks', 122], ['🧸', 'Family & kids', 'Gentle and giggly, for all ages', 230], ['👅', 'Tongue twisters', 'Hard forwards, harder backwards', 127], ['🎶', 'Song lines', 'Old favourites to sing (all public domain)', 89], ['🦘', 'Aussie & friends', 'Fair dinkum phrases from around the world', 110]];
  return `${bg}${statusBar(C.ink)}${body(`${t('hero', 'Challenge packs')}
<div style="display:flex;flex-direction:column;gap:${SP(3)}px;margin-top:${SP(5)}px">${packs.map(([e, n, s, c]) => card(`<div style="display:flex;align-items:center;gap:${SP(4)}px">
<div style="width:56px;height:56px;border-radius:${R.m}px;background:${C.cardHi};display:flex;align-items:center;justify-content:center;font-size:30px;flex:none">${e}</div>
<div style="flex:1">${t('bodyB', esc(n))}${t('small', esc(s), C.sub)}${t('small', `${c} lines · Free`, C.good, `margin-top:${SP(1)}px;font-weight:700`)}</div><span style="color:${C.faint};font-size:20px">›</span></div>`, { extra: 'padding:12px 16px' })).join('')}</div>`, 66)}${tabBar(1)}`;
}
function plusScreen() {
  const f = ['Unlimited goes, forever', 'Every challenge pack, 950+ lines', 'All voice effects: chipmunk, giant, robot, echo, alien', 'Party mode for up to 8 players', 'Unlimited saved takes and 30-second takes'];
  return `<div style="position:absolute;inset:0;background:#000"></div>${statusBar('#fff')}
<div style="position:absolute;left:0;right:0;top:56px;bottom:0;background:${C.bg};border-radius:12px 12px 0 0">
<div style="height:52px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;color:${C.ink}">Backspin Plus</div>
<div style="padding:${SP(3)}px ${SP(5)}px">${disc(120, 1, -20)}
${t('title', 'One payment. Yours for life.', C.ink, `text-align:center;margin-top:${SP(5)}px`)}
${t('body', 'Your first 10 goes are free, with everything switched on. After that, one small payment unlocks Backspin for life:', C.sub, `text-align:center;margin-top:${SP(2)}px`)}
${t('bodyB', '7 free goes left', C.rew, `text-align:center;margin-top:${SP(2)}px`)}
${card(f.map((x) => `<div style="display:flex;gap:${SP(3)}px"><span style="color:${C.good}">✓</span>${t('body', x, C.ink, 'flex:1')}</div>`).join(''), { extra: `margin-top:${SP(5)}px;display:flex;flex-direction:column;gap:${SP(3)}px` })}
${button('Unlock Backspin Plus', { extra: `margin-top:${SP(6)}px` })}
${t('small', 'One-time purchase. No subscription, no ads, ever.', C.sub, `text-align:center;margin-top:${SP(3)}px`)}
<div style="display:flex;justify-content:center;margin-top:${SP(4)}px">${button('Restore purchase', { kind: 'ghost', small: true })}</div></div></div>`;
}

// ---- page layout ----
function page({ head, sub, screen, glow = C.glow, glow2 = C.rew, big = false }) {
  const bgCss = `radial-gradient(75% 40% at 50% 70%, ${glow}50, transparent 70%), radial-gradient(60% 30% at 85% 12%, ${glow2}30, transparent 70%), radial-gradient(50% 25% at 10% 30%, ${glow}22, transparent 70%), linear-gradient(180deg,#1B1630,#0E0B17)`;
  const ribbons = `<svg style="position:absolute;left:0;top:0" width="440" height="956" viewBox="0 0 440 956" fill="none">
<path d="M-20 300 C 90 250, 160 360, 260 300 S 420 250, 470 290" stroke="${C.rew}" stroke-opacity=".22" stroke-width="2"/>
<path d="M-20 318 C 90 268, 170 380, 270 318 S 420 270, 470 310" stroke="${C.glow}" stroke-opacity=".2" stroke-width="2"/>
<path d="M-20 820 C 100 760, 180 880, 280 820 S 430 770, 470 800" stroke="${C.gold}" stroke-opacity=".16" stroke-width="2"/></svg>`;
  return `<div style="position:absolute;inset:0;background:${bgCss}"></div>${ribbons}
<div style="position:absolute;left:26px;right:26px;top:50px;text-align:center">
<h1 data-fit style="font:800 38px/1.07 'Inter Display','Inter',sans-serif;letter-spacing:-1px;color:${C.ink};text-wrap:balance">${head}</h1>
${sub ? `<p data-fit style="margin-top:12px;font:500 17px/1.3 'Inter',sans-serif;color:${C.sub};text-wrap:balance">${sub}</p>` : ''}</div>
<div style="position:absolute;left:0;right:0;top:${big ? 214 : 206}px;display:flex;justify-content:center">${phone(screen, { width: big ? 396 : 336, bg: C.bg })}</div>`;
}
const Co = (s) => `<span style="color:${C.glow}">${s}</span>`;
const Te = (s) => `<span style="color:${C.rew}">${s}</span>`;
const Go = (s) => `<span style="color:${C.gold}">${s}</span>`;

const shots = [
  { n: '01', name: 'score', html: page({ head: `Sing it backwards. ${Go('Get a real score.')}`, sub: 'Sound, rhythm and length, out of 100', screen: revealScreen(), glow: '#FFC94A' }) },
  { n: '02', name: 'say-it', html: page({ head: `Say a line. ${Co('Any line.')}`, sub: '986 challenge lines, or freestyle', big: true, screen: sayScreen() }) },
  { n: '03', name: 'backwards', html: page({ head: `Hear it ${Te('backwards')}`, sub: 'Loop it, slow it down, play it again', big: true, screen: listenScreen(), glow: '#2FD6C2', glow2: '#FF5A4E' }) },
  { n: '04', name: 'copy-it', html: page({ head: `Copy that ${Co('strange sound')}`, sub: 'Then Backspin flips your copy forwards', big: true, screen: copyScreen() }) },
  { n: '05', name: 'party', html: page({ head: `Pass the phone. ${Co('Play together.')}`, sub: 'Party mode for 2 to 8 players', screen: partyScreen() }) },
  { n: '06', name: 'daily', html: page({ head: `A new challenge ${Go('every day')}`, sub: 'Keep your streak going', screen: homeScreen(), glow: '#FFC94A' }) },
  { n: '07', name: 'packs', html: page({ head: `${Te('7 packs')} of silly lines`, sub: 'Tongue twisters, animals, family and more', screen: packsScreen(), glow: '#2FD6C2', glow2: '#FFC94A' }) },
  { n: '08', name: 'plus', html: page({ head: `10 free goes. Then ${Co('yours for life.')}`, sub: 'One payment. No subscription, no ads.', screen: plusScreen() }) },
];

await renderShots({ shots, outDir: join(appRoot, 'store', 'jpg', 'ios') });
