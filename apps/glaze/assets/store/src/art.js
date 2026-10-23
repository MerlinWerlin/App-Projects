// Glaze store art kit (T67). Everything here is original: glyphs, wallpapers, widgets and
// in-app screens are drawn from scratch with SVG/CSS in Glaze's own theme palettes
// (window.GLAZE_DATA, generated from src/core by ../render.mjs). No logos, no characters.
/* eslint-disable */
(function () {
  const D = window.GLAZE_DATA;
  const byId = Object.fromEntries(D.themes.map((t) => [t.id, t]));
  const theme = (id) => byId[id] || D.themes[0];

  // ---------- colour ----------
  const hex = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const lum = (h) => {
    const c = hex(h).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const isDark = (h) => lum(h) < 0.18;

  // Seeded random so every render is identical.
  function rng(seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---------- glyphs (24x24, stroke 2, round caps; drawn for Glaze) ----------
  const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const G = {
    camera: ['M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z', C(12, 13, 3.4)],
    image: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z', 'M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5', C(15.5, 9, 1.3)],
    music: ['M9 18V6l10-2v12', C(6.5, 18, 2.5), C(16.5, 16, 2.5)],
    chat: ['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
    heart: ['M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z'],
    mail: ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z', 'M3.5 7l8.5 6.5L20.5 7'],
    clock: [C(12, 12, 9), 'M12 7.5V12l3 2'],
    calendar: ['M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z', 'M4 10h16M8.5 3.5v4M15.5 3.5v4'],
    pin: ['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z', C(12, 10, 2.3)],
    book: ['M4 5.5c3-1.3 5.6-1 8 .8v13c-2.4-1.8-5-2.1-8-.8Z', 'M20 5.5c-3-1.3-5.6-1-8 .8v13c2.4-1.8 5-2.1 8-.8Z'],
    sun: [C(12, 12, 4), 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'],
    moon: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z'],
    star: ['M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z'],
    cloud: ['M7 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.3A4.7 4.7 0 0 1 17.5 18.5Z'],
    note: ['M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20V4a.5.5 0 0 1 0-.5Z', 'M9 11h7M9 14.5h7M9 18h4'],
    sliders: ['M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1', C(15, 7, 2), C(9, 12, 2), C(17, 17, 2)],
    compass: [C(12, 12, 9), 'M15.5 8.5l-2 5-5 2 2-5Z'],
    bag: ['M5 8h14l-1 12H6Z', 'M9 10V7a3 3 0 0 1 6 0v3'],
    play: ['M8 5.5v13l10.5-6.5Z'],
    drop: ['M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z'],
    bed: ['M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5', C(7, 11.5, 1.8)],
    smile: [C(12, 12, 9), 'M8.5 14a4.5 4.5 0 0 0 7 0', 'M9 9.5h.01M15 9.5h.01'],
    shoe: ['M3 16.5V9l4 1 2-2 3 3 6 1.5a3 3 0 0 1 3 3v1Z', 'M3 16.5h18v1.5H3Z'],
    plus: ['M12 5v14M5 12h14'],
    sparkle: ['M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z'],
    lock: ['M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
    torch: ['M8 3.5h8v4l-2 3V20h-4v-9.5l-2-3Z', 'M8 7.5h8'],
    // From Glaze's in-house set (src/render/inhouse.ts, original artwork).
    leaf: ['M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z', 'M5 19l8-8'],
    paw: ['M12 12.5c-3 0-6 3.4-6 5.6A2.3 2.3 0 0 0 8.4 20.4c1.4 0 2.2-.6 3.6-.6s2.2.6 3.6.6a2.3 2.3 0 0 0 2.4-2.3c0-2.2-3-5.6-6-5.6Z', C(5, 10.5, 1.4), C(9, 6.2, 1.5), C(15, 6.2, 1.5), C(19, 10.5, 1.4)],
    plane: ['M12 2.5a1.5 1.5 0 0 1 1.5 1.5v5l7.5 4.5V16l-7.5-2.5V19l2 1.5V22L12 21l-3.5 1v-1.5l2-1.5v-5.5L3 16v-2.5L10.5 9V4A1.5 1.5 0 0 1 12 2.5Z'],
    utensils: ['M5 3v5a2 2 0 0 0 4 0V3', 'M7 3v18', 'M17 21V3c-2 1.5-3 4-3 7v3h3'],
    game: ['M7 8h10a5 5 0 0 1 4.9 6l-.4 2a2.6 2.6 0 0 1-4.6 1.1L15.5 15h-7l-1.4 2.1a2.6 2.6 0 0 1-4.6-1.1l-.4-2A5 5 0 0 1 7 8Z', 'M8 10.5v3M6.5 12h3'],
    ticket: ['M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4Z', 'M15 6.5v1.5M15 11.25v1.5M15 16v1.5'],
  };
  const glyph = (name, colour, size = 24, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${(G[name] || G.star).map((d) => `<path d="${d}"/>`).join('')}</svg>`;

  const APPS = [
    ['camera', 'Camera'], ['image', 'Photos'], ['music', 'Music'], ['chat', 'Chat'],
    ['mail', 'Mail'], ['calendar', 'Calendar'], ['pin', 'Maps'], ['note', 'Notes'],
    ['book', 'Books'], ['cloud', 'Weather'], ['game', 'Games'], ['plane', 'Travel'],
    ['utensils', 'Recipes'], ['paw', 'Pets'], ['bag', 'Shop'], ['sliders', 'Settings'],
    ['heart', 'Health'], ['compass', 'Browser'], ['ticket', 'Tickets'], ['clock', 'Clock'],
  ];

  // Icon tile: glyph colour from the theme; tile is accent or surface, whichever reads better.
  function tile(t, g, size = 62, extra = '') {
    const p = t.palette;
    const onAccent = contrast(p.glyph, p.accent) >= contrast(p.glyph, p.surface);
    const base = onAccent ? p.accent : p.surface;
    const hi = mix(base, '#FFFFFF', 0.28);
    const r = size * 0.2237;
    return `<div class="tile" style="width:${size}px;height:${size}px;border-radius:${r}px;background:linear-gradient(160deg,${hi},${base} 60%,${mix(base, '#000000', 0.08)});${extra}">
      <div class="sheen" style="border-radius:${r}px"></div>${glyph(g, p.glyph, size * 0.5, 2)}</div>`;
  }

  // ---------- wallpapers ----------
  const MOTIF = {
    'cherry-blossom': 'blossom', 'sakura-sprint': 'blossom', 'romantic-lace': 'blossom', 'strawberry-dessert': 'blossom', 'macaron-box': 'blossom', 'shino-blush': 'blossom',
    'celestial-night': 'stars', 'starry-gaze': 'stars', 'moonflower': 'stars', 'lavender-field': 'stars', 'raku-smoke': 'stars', 'gilded-noir': 'stars',
    'moon-phase': 'moon', 'little-ghosts': 'ghosts', 'moonlit-bats': 'ghosts',
    'pumpkin-patch': 'pumpkins', 'lantern-hollow': 'pumpkins', 'lantern-row': 'lanterns', 'marigold': 'lanterns', 'sodium-glow': 'lanterns',
    'night-drive': 'synth', 'arcade-pink': 'synth', 'candy-arcade': 'synth', 'pocket-arcade': 'synth', 'tram-wire': 'synth', 'last-train': 'synth', 'wet-asphalt': 'synth',
    'cloud-nine': 'clouds', 'still-water': 'clouds', 'first-frost': 'clouds', 'seaside-shells': 'waves', 'cobalt-slip': 'waves', 'aurora-veil': 'aurora',
  };
  const motifOf = (t) => MOTIF[t.id] || (t.categories.includes('nature') ? 'leaves' : 'blobs');

  function wallpaper(t, w = 390, h = 844, seed = t.id) {
    const p = t.palette;
    const R = rng(seed);
    const dark = isDark(p.bg);
    const top = dark ? mix(p.bg, '#000000', 0.25) : mix(p.bg, '#FFFFFF', 0.3);
    const bottom = dark ? mix(p.bg, p.accent, 0.28) : mix(p.bg, p.accent, 0.22);
    let art = '';
    const m = motifOf(t);
    const soft = mix(p.accent, dark ? p.bg : '#FFFFFF', 0.45);
    if (m === 'blossom') {
      for (let i = 0; i < 16; i++) {
        const x = R() * w, y = R() * h, r = 14 + R() * 26, rot = R() * 72;
        const col = i % 3 ? soft : mix(p.accent, '#FFFFFF', 0.15);
        let petals = '';
        for (let k = 0; k < 5; k++) petals += `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.42}" ry="${r * 0.58}" transform="rotate(${k * 72})" fill="${col}"/>`;
        art += `<g transform="translate(${x},${y}) rotate(${rot})" opacity="${0.55 + R() * 0.45}">${petals}<circle r="${r * 0.18}" fill="${mix(p.accent, '#FFE9A8', 0.6)}"/></g>`;
      }
      art += `<path d="M-10 ${h * 0.22} C ${w * 0.3} ${h * 0.18}, ${w * 0.55} ${h * 0.3}, ${w + 10} ${h * 0.16}" stroke="${mix(p.ink, p.bg, 0.55)}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    } else if (m === 'stars' || m === 'moon') {
      for (let i = 0; i < 90; i++) art += `<circle cx="${R() * w}" cy="${R() * h}" r="${0.6 + R() * 1.6}" fill="${p.ink}" opacity="${0.3 + R() * 0.6}"/>`;
      for (let i = 0; i < 9; i++) {
        const x = R() * w, y = R() * h, s = 8 + R() * 14;
        art += `<path transform="translate(${x},${y}) scale(${s / 12})" d="M0 -12c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" fill="${p.accent}"/>`;
      }
      if (m === 'moon') {
        for (let k = 0; k < 5; k++) {
          const cx = 55 + k * 70, cy = h * 0.6, r = 22;
          art += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${mix(p.accent, p.bg, 0.75)}"/><path d="M${cx} ${cy - r} A ${r} ${r} 0 0 ${k < 2 ? 0 : 1} ${cx} ${cy + r} A ${r * Math.abs(1 - k / 2)} ${r} 0 0 ${k % 2 ? 1 : 0} ${cx} ${cy - r}Z" fill="${p.accent}"/>`;
        }
      } else {
        art += `<circle cx="${w * 0.74}" cy="${h * 0.62}" r="74" fill="${p.accent}" opacity="0.95"/><circle cx="${w * 0.74 + 30}" cy="${h * 0.62 - 22}" r="70" fill="${bottom}"/>`;
      }
    } else if (m === 'ghosts') {
      for (let i = 0; i < 7; i++) {
        const x = 40 + R() * (w - 80), y = 120 + R() * (h - 240), s = 0.8 + R() * 0.9;
        art += `<g transform="translate(${x},${y}) scale(${s}) rotate(${-12 + R() * 24})" opacity="0.92"><path d="M-22 26V-4a22 22 0 0 1 44 0v30l-7.3-6-7.4 6-7.3-6-7.3 6-7.4-6Z" fill="${mix(p.ink, '#FFFFFF', 0.4)}"/><circle cx="-7" cy="-3" r="3" fill="${p.bg}"/><circle cx="7" cy="-3" r="3" fill="${p.bg}"/><ellipse cx="0" cy="7" rx="3" ry="4" fill="${p.bg}" opacity=".7"/></g>`;
      }
      for (let i = 0; i < 40; i++) art += `<circle cx="${R() * w}" cy="${R() * h}" r="${0.8 + R() * 1.4}" fill="${p.accent}" opacity="${0.4 + R() * 0.5}"/>`;
    } else if (m === 'pumpkins') {
      for (let i = 0; i < 6; i++) {
        const x = 40 + R() * (w - 80), y = h * 0.45 + R() * h * 0.5, s = 0.9 + R() * 1.2;
        art += `<g transform="translate(${x},${y}) scale(${s})"><path d="M0 -20c1-6 4-9 8-10" stroke="${mix(p.bg, '#4E7A2C', 0.7)}" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="-12" cy="0" rx="14" ry="19" fill="${mix(p.accent, '#000', 0.12)}"/><ellipse cx="12" cy="0" rx="14" ry="19" fill="${mix(p.accent, '#000', 0.12)}"/><ellipse cx="0" cy="0" rx="14" ry="20" fill="${p.accent}"/></g>`;
      }
      for (let i = 0; i < 18; i++) art += `<path transform="translate(${R() * w},${R() * h * 0.5}) rotate(${R() * 360})" d="M0 0q6 -10 14 -4q-6 2 -14 4Z" fill="${mix(p.accent, '#C8A050', 0.4)}" opacity=".7"/>`;
    } else if (m === 'lanterns') {
      art += `<path d="M-10 120 Q ${w / 2} 210 ${w + 10} 110" stroke="${mix(p.ink, p.bg, 0.5)}" stroke-width="2" fill="none"/>`;
      for (let i = 0; i < 6; i++) {
        const x = 30 + i * ((w - 60) / 5), y = 140 + Math.sin((i / 5) * Math.PI) * 40;
        art += `<g transform="translate(${x},${y})"><line y1="-18" y2="0" stroke="${mix(p.ink, p.bg, 0.5)}" stroke-width="2"/><circle cy="30" r="44" fill="${p.accent}" opacity=".18"/><rect x="-16" y="4" width="32" height="48" rx="15" fill="${p.accent}"/><rect x="-9" y="0" width="18" height="6" rx="2" fill="${mix(p.accent, '#000', 0.4)}"/><rect x="-9" y="50" width="18" height="6" rx="2" fill="${mix(p.accent, '#000', 0.4)}"/><path d="M-6 8v40M6 8v40" stroke="${mix(p.accent, '#000', 0.25)}" stroke-width="1.5"/></g>`;
      }
      for (let i = 0; i < 30; i++) art += `<circle cx="${R() * w}" cy="${h * 0.4 + R() * h * 0.6}" r="${1 + R() * 2.5}" fill="${p.accent}" opacity="${0.3 + R() * 0.6}"/>`;
    } else if (m === 'synth') {
      const hy = h * 0.6;
      art += `<defs><linearGradient id="sun${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(p.accent, '#FFE27A', 0.5)}"/><stop offset="1" stop-color="${p.accent}"/></linearGradient><clipPath id="sc${seed}"><rect x="0" y="0" width="${w}" height="${hy}"/></clipPath></defs>`;
      art += `<g clip-path="url(#sc${seed})"><circle cx="${w / 2}" cy="${hy}" r="120" fill="url(#sun${seed})"/>`;
      for (let k = 0; k < 6; k++) art += `<rect x="0" y="${hy - 14 - k * 18}" width="${w}" height="${3 + k * 0.6}" fill="${top}"/>`;
      art += `</g>`;
      for (let k = 0; k < 12; k++) {
        const y = hy + Math.pow(k / 11, 2) * (h - hy);
        art += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="${p.accent}" stroke-width="${1 + k * 0.15}" opacity="${0.35 + k * 0.04}"/>`;
      }
      for (let k = -8; k <= 8; k++) art += `<line x1="${w / 2 + k * 12}" y1="${hy}" x2="${w / 2 + k * 110}" y2="${h}" stroke="${p.accent}" stroke-width="1.4" opacity=".55"/>`;
      for (let i = 0; i < 50; i++) art += `<circle cx="${R() * w}" cy="${R() * hy * 0.8}" r="${0.6 + R() * 1.2}" fill="${p.ink}" opacity="${0.3 + R() * 0.6}"/>`;
    } else if (m === 'clouds') {
      for (let i = 0; i < 7; i++) {
        const x = R() * w, y = 80 + R() * (h - 120), s = 0.7 + R() * 1.1;
        art += `<g transform="translate(${x},${y}) scale(${s})" fill="${dark ? mix(p.bg, '#FFFFFF', 0.2) : '#FFFFFF'}" opacity="${0.75 + R() * 0.25}"><circle cx="-28" cy="6" r="20"/><circle cx="0" cy="-6" r="28"/><circle cx="30" cy="6" r="20"/><rect x="-48" y="6" width="98" height="20" rx="10"/></g>`;
      }
      art += `<circle cx="${w * 0.78}" cy="${h * 0.14}" r="40" fill="${mix(p.accent, '#FFFFFF', 0.4)}"/>`;
    } else if (m === 'waves') {
      for (let k = 0; k < 9; k++) {
        const y = h * 0.38 + k * 52;
        art += `<path d="M0 ${y} q 32 -22 65 0 t 65 0 t 65 0 t 65 0 t 65 0 t 65 0 V ${h} H 0Z" fill="${mix(p.accent, p.bg, 0.15 + 0.08 * (8 - k))}" opacity="${0.35 + k * 0.07}"/>`;
      }
      art += `<circle cx="${w * 0.25}" cy="${h * 0.2}" r="46" fill="${mix(p.accent, '#FFFFFF', 0.55)}"/>`;
    } else if (m === 'aurora') {
      art += `<defs><filter id="bl${seed}"><feGaussianBlur stdDeviation="28"/></filter></defs>`;
      art += `<g filter="url(#bl${seed})" opacity=".9"><path d="M-40 260 C 100 160, 220 380, 430 220 L 430 330 C 260 470, 120 280, -40 380Z" fill="${p.accent}"/><path d="M-40 420 C 120 330, 260 520, 430 400 L 430 470 C 260 590, 120 420, -40 520Z" fill="${mix(p.accent, '#7A6CFF', 0.5)}"/></g>`;
      for (let i = 0; i < 70; i++) art += `<circle cx="${R() * w}" cy="${R() * h}" r="${0.6 + R() * 1.3}" fill="#FFFFFF" opacity="${0.3 + R() * 0.6}"/>`;
    } else if (m === 'leaves') {
      for (let i = 0; i < 22; i++) {
        const x = R() * w, y = R() * h, s = 0.9 + R() * 1.8, rot = R() * 360;
        art += `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"><path d="M-8 8C-8 -2 -2 -8 10 -9c-1 11-7 17-18 17Z" fill="${i % 2 ? p.accent : soft}" opacity="${0.6 + R() * 0.4}"/><path d="M-8 8l9-9" stroke="${p.bg}" stroke-width="1" opacity=".6"/></g>`;
      }
    } else {
      for (let i = 0; i < 6; i++) art += `<circle cx="${R() * w}" cy="${R() * h}" r="${60 + R() * 110}" fill="${i % 2 ? soft : p.accent}" opacity="${0.18 + R() * 0.2}"/>`;
    }
    return `<svg class="wall" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs><linearGradient id="g${seed}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g${seed})"/>${art}</svg>`;
  }

  // Original illustrated "photo" (a sunset over hills) for photo widgets and the video lock screen.
  function scene(kind = 'sunset', seed = 's') {
    if (kind === 'beach') {
      return `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs><linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B2A78"/><stop offset=".45" stop-color="#E06A8E"/><stop offset=".62" stop-color="#FFB37A"/><stop offset=".63" stop-color="#2E5C8A"/><stop offset="1" stop-color="#173252"/></linearGradient></defs><rect width="390" height="844" fill="url(#sky${seed})"/><circle cx="195" cy="520" r="70" fill="#FFE2A0"/><rect x="0" y="530" width="390" height="314" fill="#244A73"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<rect x="${120 - k * 6}" y="${540 + k * 22}" width="${150 + k * 12}" height="${4 + k * 0.6}" rx="2" fill="#FFD9A0" opacity="${0.8 - k * 0.08}"/>`).join('')}<path d="M0 700 Q 100 660 210 720 T 390 690 V 844 H 0Z" fill="#E7C08F"/><path d="M0 760 Q 120 720 230 780 T 390 760 V 844 H 0Z" fill="#D5A876"/><path d="M300 700 q 6 -60 -14 -120 M286 580 q -30 -6 -50 12 M286 580 q 30 -14 52 -2 M286 580 q -14 -22 -38 -24 M286 580 q 18 -26 40 -24" stroke="#1E1530" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
    }
    return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs><linearGradient id="ss${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB1C8"/><stop offset=".6" stop-color="#FFD9A8"/></linearGradient></defs><rect width="200" height="200" fill="url(#ss${seed})"/><circle cx="130" cy="92" r="30" fill="#FFF3C9"/><path d="M0 130 Q 50 90 100 125 T 200 110 V200H0Z" fill="#9FC79A"/><path d="M0 160 Q 70 120 130 160 T 200 150 V200H0Z" fill="#6FA37A"/>${[20, 48, 80, 150, 175].map((x, i) => `<g transform="translate(${x},${170 + (i % 2) * 10})"><line y1="0" y2="-14" stroke="#3E6B44" stroke-width="2"/><circle cy="-16" r="5" fill="${['#FF8FB1', '#FFE27A', '#FFFFFF'][i % 3]}"/></g>`).join('')}</svg>`;
  }

  // ---------- widgets ----------
  const fontOf = (t) => ({ serif: "'Lora',serif", script: "'Lora',serif", mono: "'DejaVu Sans Mono',monospace", display: "'Poppins',sans-serif", rounded: "'Poppins',sans-serif" })[t.displayFont] || "'Poppins',sans-serif";
  function widgetBox(t, w, h, inner, opts = {}) {
    const p = t.palette;
    const st = opts.style || t.widget.style;
    let bg = p.surface, border = 'none';
    if (st === 'glass') bg = rgba(p.surface, isDark(p.surface) ? 0.62 : 0.7);
    if (st === 'outline') { bg = rgba(p.bg, 0.78); border = `2px solid ${p.accent}`; }
    return `<div class="widget ${opts.cls || ''}" style="width:${w}px;height:${h}px;background:${opts.bg || bg};border:${border};color:${p.ink};${opts.css || ''}">${inner}</div>`;
  }
  const W = {
    clock(t, w, h) {
      const p = t.palette;
      if (w < 200) return widgetBox(t, w, h, `<div class="wl" style="color:${p.accent}">Sunday</div><div style="font:600 52px/1 ${fontOf(t)};letter-spacing:-1px;margin-top:6px">9:41</div><div class="ws" style="margin-top:auto">18 October</div>`);
      return widgetBox(t, w, h, `<div style="display:flex;align-items:center;height:100%;gap:18px"><div style="flex:1"><div class="wl" style="color:${p.accent}">Sunday 18 October</div><div style="font:600 70px/1 ${fontOf(t)};letter-spacing:-2px;margin-top:6px">9:41</div></div>${glyph(motifOf(t) === 'stars' || isDark(p.bg) ? 'moon' : 'sun', p.accent, 58, 1.8)}</div>`);
    },
    calendar(t, w, h) {
      const p = t.palette;
      let cells = '';
      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      for (const d of days) cells += `<span style="opacity:.55;font-weight:700">${d}</span>`;
      for (let i = 0; i < 3; i++) cells += '<span></span>';
      for (let d = 1; d <= 31; d++) cells += d === 18 ? `<span style="background:${p.accent};color:${contrast(p.surface, p.accent) > contrast(p.ink, p.accent) ? p.surface : p.ink};border-radius:50%;font-weight:700">${d}</span>` : `<span>${d}</span>`;
      return widgetBox(t, w, h, `<div class="wl" style="color:${p.accent};text-transform:uppercase;letter-spacing:1px">October</div><div class="grid7">${cells}</div>`);
    },
    photo(t, w, h) {
      return widgetBox(t, w, h, `${scene('sunset', t.id + w)}<div class="cap">Picnic day</div>`, { css: 'padding:0;overflow:hidden', bg: 'transparent' });
    },
    quote(t, w, h) {
      const p = t.palette;
      return widgetBox(t, w, h, `<div style="font:500 ${w < 200 ? 17 : 20}px/1.3 'Lora',serif;font-style:italic">Small steps, soft days, big dreams.</div><div style="margin-top:auto;display:flex;gap:6px;align-items:center">${glyph('sparkle', p.accent, 16)}<span class="ws">Today's note</span></div>`);
    },
    battery(t, w, h) {
      const p = t.palette, r = 40, c = 2 * Math.PI * r;
      return widgetBox(t, w, h, `<svg width="${w - 36}" height="${h - 36}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" stroke="${rgba(p.ink, 0.14)}" stroke-width="10" fill="none"/><circle cx="50" cy="50" r="${r}" stroke="${p.accent}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${c * 0.76} ${c}" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="22" fill="${p.ink}">76%</text></svg>`, { css: 'align-items:center;justify-content:center' });
    },
    countdown(t, w, h) {
      const p = t.palette;
      return widgetBox(t, w, h, `<div class="wl" style="color:${p.accent}">Beach trip</div><div style="font:700 56px/1 ${fontOf(t)};margin-top:8px">12</div><div class="ws">days to go</div>`);
    },
    water(t, w, h) {
      const p = t.palette;
      let cups = '';
      for (let i = 0; i < 8; i++) cups += `<span class="cup" style="background:${i < 6 ? p.accent : rgba(p.ink, 0.12)}"></span>`;
      return widgetBox(t, w, h, `<div style="display:flex;align-items:center;gap:8px">${glyph('drop', p.accent, 22)}<span class="wl">Water</span></div><div style="font:700 34px/1.1 'Poppins';margin-top:8px">1,500<span style="font-size:18px;opacity:.6"> / 2,000 ml</span></div><div style="display:flex;gap:5px;margin-top:8px">${cups}</div>${btn(p, '150 ml')}`);
    },
    sleep(t, w, h) {
      const p = t.palette;
      return widgetBox(t, w, h, `<div style="display:flex;align-items:center;gap:8px">${glyph('bed', p.accent, 22)}<span class="wl">Sleep</span></div><div style="font:700 32px/1.1 'Poppins';margin-top:10px">7 h 30</div>${btn(p, '1 hr')}`);
    },
    mood(t, w, h) {
      const p = t.palette;
      const faces = ['M8 15.5a5 5 0 0 1 8 0', 'M8.5 15h7', 'M8.5 14a4.5 4.5 0 0 0 7 0', 'M7.5 13.5a5.5 5.5 0 0 0 9 0'];
      return widgetBox(t, w, h, `<div style="display:flex;align-items:center;gap:8px">${glyph('smile', p.accent, 22)}<span class="wl">Mood today</span></div><div style="display:flex;gap:10px;margin-top:14px;justify-content:space-between">${faces.map((f, i) => `<div style="width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${i === 3 ? p.accent : rgba(p.ink, 0.08)}"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${i === 3 ? p.surface : p.ink}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="${f}"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.6"/></svg></div>`).join('')}</div>`);
    },
    year(t, w, h) {
      const p = t.palette;
      let dots = '';
      for (let i = 0; i < 120; i++) dots += `<span style="background:${i < 96 ? p.accent : rgba(p.ink, 0.15)}"></span>`;
      return widgetBox(t, w, h, `<div style="display:flex;justify-content:space-between"><span class="wl">October</span><span class="ws">80% of the month</span></div><div class="dots">${dots}</div>`);
    },
  };
  function btn(p, label) {
    const on = contrast(p.surface, p.accent) >= 3 ? p.surface : p.ink;
    return `<div class="wbtn" style="background:${p.accent};color:${on}">${glyph('plus', on, 16, 3)}<span>${label}</span></div>`;
  }
  function widget(kind, t, size, solid = false) {
    const dims = { s: [155, 155], m: [342, 155], l: [342, 338] }[size];
    if (solid) t = { ...t, widget: { ...t.widget, style: 'solid' } };
    return W[kind](t, dims[0], dims[1]);
  }

  // ---------- phone screens (390x844) ----------
  function statusBar(ink) {
    return `<div class="status" style="color:${ink}"><span>9:41</span><span class="island"></span><span class="sb">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="${ink}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"><path d="M1.5 4.5a9.5 9.5 0 0 1 13 0M4 7.3a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="${ink}"/></svg>
      <svg width="26" height="13" viewBox="0 0 26 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="${ink}" opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="${ink}"/><rect x="23.5" y="4.5" width="1.6" height="4" rx=".8" fill="${ink}" opacity=".45"/></svg></span></div>`;
  }

  // rows: [{w:[[kind,size],...]}, {icons:n, from:k}, ...]
  function home(t, rows, opts = {}) {
    const p = t.palette;
    const labelInk = isDark(p.bg) ? '#FFFFFF' : p.ink;
    let y = 64, html = '', appIdx = opts.appFrom || 0;
    for (const r of rows) {
      if (r.w) {
        let x = 24, hmax = 0;
        for (const [kind, size] of r.w) {
          const [ww, hh] = { s: [155, 155], m: [342, 155], l: [342, 338] }[size];
          html += `<div class="abs" style="left:${x}px;top:${y}px">${widget(kind, t, size)}</div>`;
          x += ww + 32;
          hmax = Math.max(hmax, hh);
        }
        y += hmax + 26;
      } else if (r.icons) {
        for (let i = 0; i < r.icons; i++) {
          const [g, label] = APPS[appIdx++ % APPS.length];
          html += `<div class="abs app" style="left:${24 + i * 93.3}px;top:${y}px">${tile(t, g)}<div class="lbl" style="color:${labelInk}">${label}</div></div>`;
        }
        y += 100;
      }
    }
    const dockApps = [['chat'], ['image'], ['music'], ['compass']];
    const dock = `<div class="dock" style="background:${rgba(isDark(p.bg) ? '#FFFFFF' : '#FFFFFF', isDark(p.bg) ? 0.14 : 0.42)}">${dockApps.map(([g]) => tile(t, g)).join('')}</div>`;
    const dots = `<div class="pdots"><span style="background:${labelInk}"></span><span style="background:${labelInk};opacity:.4"></span><span style="background:${labelInk};opacity:.4"></span></div>`;
    return `<div class="screen">${wallpaper(t)}${statusBar(labelInk)}${html}${opts.noDock ? '' : dots + dock}</div>`;
  }

  function lock(t, opts = {}) {
    const p = t.palette;
    const ink = '#FFFFFF';
    const bg = opts.video ? scene('beach', 'lock') : wallpaper(t);
    const acc = (inner) => `<div class="accw">${inner}</div>`;
    const accs = [
      acc(`<svg width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" stroke="rgba(255,255,255,.3)" stroke-width="5" fill="none"/><circle cx="23" cy="23" r="19" stroke="#fff" stroke-width="5" fill="none" stroke-dasharray="90 200" stroke-linecap="round" transform="rotate(-90 23 23)"/><text x="23" y="28" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="13" fill="#fff">76</text></svg>`),
      acc(glyph('moon', '#fff', 30)),
      `<div class="accr"><div style="font:600 15px Inter">Beach trip</div><div style="font:500 13px Inter;opacity:.8">12 days to go</div></div>`,
    ].join('');
    return `<div class="screen">${bg}<div class="scrim-top"></div>${statusBar(ink)}
      <div class="lockdate">${glyph('lock', ink, 18)}<span>Sunday 18 October</span></div>
      <div class="lockclock" style="font-family:${opts.font || "'Poppins'"}">9:41</div>
      <div class="accrow">${accs}</div>
      ${opts.live ? `<div class="livepill">${glyph('play', '#fff', 14, 2.5)}<span>Live</span></div>` : ''}
      <div class="lockbtn" style="left:44px">${glyph('torch', '#fff', 24)}</div><div class="lockbtn" style="right:44px">${glyph('camera', '#fff', 24)}</div><div class="homebar"></div></div>`;
  }

  // ---------- in-app screens (Design v2 light palette) ----------
  const V = { bg: '#F4F1F7', surface: '#FFFFFF', fill: '#ECE7F1', ink: '#1D1A21', ink2: '#5E5766', tint: '#A2337F', tintSoft: '#FBE1F1', onTintSoft: '#7A1F5E' };
  const PAST = { berry: ['#FFD3EA', '#7A1F5E'], lilac: ['#E3D9FF', '#4B2F9A'], mint: ['#C9F1DE', '#16633F'], butter: ['#FFEDB0', '#6E4D00'], peach: ['#FFDCCB', '#8A3413'], sky: ['#CFE7FF', '#174D86'] };

  // Mini theme preview: a whole home screen scaled down into a tall card.
  function mini(t, w, h, rows) {
    const s = w / 390;
    return `<div class="mini" style="width:${w}px;height:${h}px"><div style="transform:scale(${s});transform-origin:0 0;width:390px;height:${h / s}px;position:relative;overflow:hidden">${home(t, rows || [{ w: [['clock', 'm']] }, { icons: 4 }, { w: [['calendar', 's'], ['photo', 's']] }, { icons: 4 }])}</div></div>`;
  }
  function plusBadge() {
    return `<span class="plusb">${glyph('sparkle', '#7A1F5E', 11, 2.4)}Plus</span>`;
  }
  function tabBar(active) {
    const tabs = [['star', 'Themes'], ['calendar', 'Widgets'], ['image', 'Icons'], ['sun', 'Wallpapers'], ['play', 'Live']];
    return `<div class="tabbar">${tabs.map(([g, l]) => `<div class="tab" style="color:${l === active ? V.tint : '#8A8292'}">${glyph(g, l === active ? V.tint : '#8A8292', 24)}<span>${l}</span></div>`).join('')}</div>`;
  }
  function appScreen(title, body, active, opts = {}) {
    return `<div class="screen app-ui" style="background:${V.bg}">${statusBar(V.ink)}<div class="lt">${title}</div>${opts.sub ? `<div class="ltsub">${opts.sub}</div>` : ''}<div class="body" style="top:${opts.sub ? 134 : 110}px">${body}</div>${tabBar(active)}</div>`;
  }

  function themesScreen() {
    const cats = [['Cute', 'berry', 'heart'], ['Pastel', 'lilac', 'cloud'], ['Nature', 'mint', 'leaf'], ['Seasonal', 'peach', 'star'], ['Neon', 'sky', 'sparkle']];
    const bubbles = cats.map(([l, k, g], i) => `<div class="bubble ${i === 0 ? 'sel' : ''}" style="background:${PAST[k][0]}">${glyph(g, PAST[k][1], i === 0 ? 44 : 36, 2.2)}<span style="color:${PAST[k][1]}">${l}</span></div>`).join('');
    const ids = ['cherry-blossom', 'strawberry-dessert', 'cloud-nine', 'macaron-box'];
    const cards = ids.map((id) => {
      const t = theme(id);
      return `<div class="tcard">${mini(t, 173, 250)}<div class="tname"><span>${t.name}</span>${t.plus ? plusBadge() : '<span class="freeb">Free</span>'}</div></div>`;
    }).join('');
    return appScreen('Themes', `<div class="count">${D.total} themes · ${D.free} free</div><div class="bubbles">${bubbles}</div><div class="tgrid">${cards}</div>`, 'Themes');
  }

  function studioScreen(t) {
    const p = t.palette;
    const sw = [p.accent, '#F7A8D8', '#B8A6FF', '#8FD8B5', '#FFD66B', '#FFB08F', '#1D1A21'];
    const fonts = [["'Poppins'", 'Rounded'], ["'Lora'", 'Serif'], ["'DejaVu Sans Mono'", 'Mono'], ["'Inter'", 'Clean']];
    return appScreen('Widget Studio', `
      <div class="studio-prev" style="background:${mix(p.bg, '#FFFFFF', 0.2)}">${widget('countdown', t, 's')}${widget('quote', t, 's')}</div>
      <div class="group">
        <div class="ghead">Background</div>
        <div class="chips">${['Photo', 'Colour', 'Gradient', 'Theme art'].map((c, i) => `<span class="chip ${i === 0 ? 'on' : ''}">${c}</span>`).join('')}</div>
        <div class="ghead">Colour</div>
        <div class="sw">${sw.map((c, i) => `<span style="background:${c};${i === 0 ? `box-shadow:0 0 0 3px #fff,0 0 0 5.5px ${V.tint}` : ''}"></span>`).join('')}</div>
        <div class="ghead">Font</div>
        <div class="chips">${fonts.map(([f, l], i) => `<span class="chip ${i === 1 ? 'on' : ''}" style="font-family:${f}">${l}</span>`).join('')}</div>
        <div class="ghead" style="display:flex;justify-content:space-between"><span>Text size</span><span style="color:${V.ink2}">110%</span></div>
        <div class="slider"><span style="width:62%"></span><i style="left:62%"></i></div>
      </div>
      <div class="cta">Add widget</div>`, 'Widgets');
  }

  function wallScreen() {
    const tiles = [['night-drive', true], ['cherry-blossom', false], ['aurora-veil', true], ['little-ghosts', true]];
    const html = tiles.map(([id, live]) => {
      const t = theme(id);
      return `<div class="wtile">${wallpaper(t, 390, 844, id + 'w')}${live ? `<span class="liveb"><i></i>LIVE</span>` : ''}<span class="wname">${t.name}</span></div>`;
    }).join('');
    return appScreen('Wallpapers', `<div class="seg"><span>Still</span><span class="on">Live</span><span>Pairs</span></div><div class="wgrid">${html}</div>`, 'Wallpapers');
  }

  function seasonScreen() {
    const rows = [['Halloween', ['pumpkin-patch', 'little-ghosts', 'whimsy-forest'], 'peach', 'Now'], ['Diwali', ['marigold', 'lantern-row', 'sodium-glow'], 'butter', 'Soon'], ['Christmas', ['copper-red', 'eucalyptus', 'celestial-night'], 'mint', 'December'], ['Lunar New Year', ['lantern-row', 'copper-red', 'cherry-blossom'], 'berry', 'New year']];
    const html = rows.map(([name, ids, k, when]) => `<div class="season"><div class="shead"><span class="sname">${name}</span><span class="when" style="background:${PAST[k][0]};color:${PAST[k][1]}">${when}</span></div><div class="srow">${ids.map((id) => `<div>${mini(theme(id), 104, 150, [{ w: [['clock', 'm']] }, { icons: 4 }, { icons: 4 }])}</div>`).join('')}</div></div>`).join('');
    return appScreen('Seasonal', html, 'Themes', { sub: 'Collections that arrive with the day' });
  }

  function phone(inner, w = 390) {
    return `<div class="phone"><div class="phone-in">${inner}</div></div>`;
  }

  // Cut-out (floating) pieces for style A.
  const cut = {
    widget: (kind, t, size) => widget(kind, t, size),
    tile: (t, g, s = 86) => tile(t, g, s),
  };

  function sparkle(x, y, s, colour, rot = 0) {
    return `<svg class="abs" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)" width="${s}" height="${s}" viewBox="0 0 24 24"><path d="${G.sparkle[0]}" fill="${colour}"/></svg>`;
  }
  function bubble(x, y, s) {
    return `<div class="abs bub" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px"></div>`;
  }

  window.GlazeArt = { D, theme, mix, rgba, isDark, contrast, glyph, tile, wallpaper, scene, widget, home, lock, themesScreen, studioScreen, wallScreen, seasonScreen, phone, cut, sparkle, bubble, PAST, V, APPS };
})();
