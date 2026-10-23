// Glaze store shots (T67): copy + layout for both styles. Headlines and subcaptions are mirrored
// in docs/STORE.md; change them in both places.
//   style a: serif headline on top, soft pastel gradient, tilted phone, floating cut-outs, sparkles
//   style b: full-bleed screen, bold rounded caption on highlight boxes at the bottom
/* eslint-disable */
(function () {
  const A = window.GlazeArt;
  const { D, theme } = A;
  const FOOT = 'No ads · No weekly subscription';

  const SHOTS = [
    {
      id: 'hook',
      head: 'Themes, icons and live lock screens.',
      head2: 'One price. No weekly subscription.',
      sub: 'Glaze Plus is a one-time purchase. Start free.',
      t: 'cherry-blossom',
      screen: (t) => A.home(t, [{ w: [['clock', 'm']] }, { icons: 4 }, { w: [['calendar', 's'], ['photo', 's']] }, { icons: 4 }]),
      grad: ['#FFD3EA', '#E3D9FF', '#CFE7FF'],
      float: (t) => [
        [A.widget('quote', t, 's', true), 262, 470, 0.72, 8],
        [A.tile(t, 'heart', 90), 22, 560, 1, -12],
        [A.tile(theme('celestial-night'), 'moon', 76), 330, 760, 1, 10],
      ],
      box: '#FFFFFF',
      box2: '#A2337F',
    },
    {
      id: 'count',
      head: `${D.total} original themes`,
      sub: `${D.free} free to start. Cute, cosy, neon, seasonal and more, all drawn by us.`,
      t: 'cherry-blossom',
      screen: () => A.themesScreen(),
      grad: ['#FFEDB0', '#FFDCCB', '#FFD3EA'],
      float: () => [
        [A.tile(theme('celestial-night'), 'star', 88), 300, 430, 1, 12],
        [A.tile(theme('matcha-cafe'), 'leaf', 80), 18, 520, 1, -10],
        [A.tile(theme('retro-diner'), 'music', 76), 336, 700, 1, 8],
        [A.tile(theme('night-drive'), 'game', 84), 10, 780, 1, -6],
      ],
      box: '#FFEDB0',
    },
    {
      id: 'widgets',
      head: 'Every theme has matching widgets',
      sub: 'Clock, calendar, photo, quote and battery, in small, medium and large.',
      t: 'celestial-night',
      screen: (t) => A.home(t, [{ w: [['clock', 'm']] }, { w: [['calendar', 's'], ['battery', 's']] }, { icons: 4 }, { w: [['quote', 'm']] }]),
      grad: ['#E3D9FF', '#CFE7FF', '#FFD3EA'],
      float: (t) => [
        [A.widget('countdown', t, 's', true), 292, 300, 0.66, 9],
        [A.widget('photo', theme('cloud-nine'), 's', true), -6, 640, 0.66, -9],
      ],
      box: '#F5C96B',
    },
    {
      id: 'studio',
      head: 'Make every widget yours',
      sub: 'Choose a photo, colours, fonts and size, then add it to your Home Screen.',
      t: 'strawberry-dessert',
      screen: (t) => A.studioScreen(t),
      grad: ['#FFDCCB', '#FFD3EA', '#E3D9FF'],
      float: (t) => [
        [A.widget('clock', t, 's', true), 282, 470, 0.68, 10],
        [`<div class="swtray">${['#E0475B', '#F7A8D8', '#B8A6FF', '#8FD8B5', '#FFD66B'].map((c) => `<span style="background:${c}"></span>`).join('')}</div>`, 6, 760, 1, -8],
      ],
      box: '#FFD3EA',
    },
    {
      id: 'interactive',
      head: 'Tap to log water, sleep and mood',
      sub: 'Interactive habit widgets that work right on your Home Screen.',
      t: 'cloud-nine',
      screen: (t) => A.home(t, [{ w: [['water', 'm']] }, { w: [['sleep', 's'], ['battery', 's']] }, { w: [['mood', 'm']] }, { icons: 4 }]),
      grad: ['#CFE7FF', '#C9F1DE', '#FFEDB0'],
      float: (t) => [
        [`<div class="tap"><div class="ring"></div>${A.tile(t, 'drop', 84)}</div>`, 316, 450, 1, 6],
        [A.tile(theme('moon-phase'), 'bed', 80), 14, 700, 1, -10],
      ],
      box: '#CFE7FF',
    },
    {
      id: 'live',
      head: 'Wallpapers that move',
      sub: 'Still and live wallpapers, plus matching Lock and Home Screen pairs.',
      t: 'night-drive',
      screen: () => A.wallScreen(),
      grad: ['#E3D9FF', '#FFD3EA', '#FFDCCB'],
      float: () => [
        [`<div class="pair p2"><div class="pairin">${A.home(theme('aurora-veil'), [{ w: [['clock', 'm']] }, { icons: 4 }, { w: [['calendar', 's'], ['battery', 's']] }, { icons: 4 }])}</div></div><div class="pair"><div class="pairin">${A.lock(theme('aurora-veil'))}</div></div>`, 318, 430, 1, 8],
      ],
      box: '#FF4FB8',
      boxInk: '#FFFFFF',
    },
    {
      id: 'livelock',
      head: 'Your own video on your Lock Screen',
      sub: 'Live Lock Screen for iOS 26, made from your own clips. Free in Glaze.',
      t: 'night-drive',
      screen: (t) => A.lock(t, { video: true, live: true }),
      grad: ['#FFDCCB', '#FFD3EA', '#E3D9FF'],
      float: () => [
        [`<div class="strip">${[0, 1, 2, 3].map((i) => `<span>${A.scene('beach', 'f' + i)}</span>`).join('')}<b class="h1"></b><b class="h2"></b></div>`, 10, 700, 1, -6],
        [`<div class="playb">${A.glyph('play', '#FFFFFF', 34, 2.5)}</div>`, 330, 470, 1, 0],
      ],
      box: '#FFB37A',
    },
    {
      id: 'seasonal',
      head: 'A fresh look for every season',
      sub: 'Halloween, Diwali, Christmas, Lunar New Year and more, ready when the day comes.',
      t: 'pumpkin-patch',
      screen: () => A.seasonScreen(),
      grad: ['#FFDCCB', '#FFEDB0', '#C9F1DE'],
      float: () => [
        [A.tile(theme('pumpkin-patch'), 'star', 86), 316, 440, 1, 10],
        [A.tile(theme('little-ghosts'), 'moon', 78), 14, 600, 1, -12],
        [A.tile(theme('cherry-blossom'), 'heart', 74), 340, 800, 1, 8],
      ],
      box: '#F08A2C',
      boxInk: '#2B1A10',
    },
  ];

  const q = new URLSearchParams(location.search);
  const style = q.get('style') || 'a';
  const n = Math.max(1, Math.min(SHOTS.length, Number(q.get('shot') || 1)));
  const s = SHOTS[n - 1];
  const t = theme(s.t);
  const root = document.getElementById('canvas');
  const screenHtml = s.screen(t);

  if (style === 'a') {
    const [g1, g2, g3] = s.grad;
    const sp = [
      [36, 250, 26, '#FFFFFF', 0], [380, 300, 18, '#FFFFFF', 20], [60, 900, 20, '#FFFFFF', 0], [370, 620, 22, '#FFFFFF', 15], [18, 420, 14, '#A2337F', 0], [395, 880, 14, '#A2337F', 0],
    ];
    const head = s.head2 ? `${s.head} <em>${s.head2}</em>` : s.head;
    root.innerHTML = `<div class="bgA" style="background:linear-gradient(165deg,${g1} 0%,${g2} 55%,${g3} 100%)"><div class="blob" style="left:-80px;top:380px;background:${g3}"></div><div class="blob" style="right:-90px;top:120px;background:${g1}"></div></div>
      <div class="hdrA"><div class="headA ${s.head2 ? 'long' : ''}">${head}</div>
      <div class="subA">${s.sub}</div>${n > 1 ? `<div class="footA">${FOOT}</div>` : ''}</div>
      <div class="phonewrap">${A.phone(screenHtml)}</div>
      ${s.float(t).map(([html, x, y, sc, rot]) => `<div class="float" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg) scale(${sc})">${html}</div>`).join('')}
      ${sp.map(([x, y, z, c, r]) => A.sparkle(x, y, z, c, r)).join('')}
      ${A.bubble(392, 250, 26)}${A.bubble(14, 300, 18)}${A.bubble(396, 560, 22)}`;
  } else {
    const ink = s.boxInk || '#1D1A21';
    const lines = s.head2 ? [[s.head, '#FFFFFF', '#1D1A21'], [s.head2, s.box2, '#FFFFFF']] : [[s.head, s.box, ink]];
    root.innerHTML = `<div class="fullB">${screenHtml}</div><div class="scrimB"></div>
      <div class="capB">${lines.map(([txt, bg, fg], i) => `<div class="hbox" style="background:${bg};color:${fg};transform:rotate(${i % 2 ? 1.5 : -2}deg)">${txt}</div>`).join('')}
      <div class="subB">${s.sub}</div>${n > 1 ? `<div class="footB">${FOOT}</div>` : ''}</div>`;
  }
  window.__ready = true;
})();
