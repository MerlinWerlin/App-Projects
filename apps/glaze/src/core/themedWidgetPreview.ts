import { calendarMonth, DESIGNED_SIZE, localeFirstWeekday, type DesignedWidget } from './designedWidgets.ts';
import type { DesignedReadings } from './designedWidgetPreview.ts';
import type { HomeOptionSize } from './widgetOptions.ts';
import type { WidgetIdentity } from './widgetIdentity.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
type Box = { x: number; y: number; w: number; h: number };

export function originalFaceBox(size: HomeOptionSize): Box {
  const side = size === 'large' ? 364 : 170;
  return { x: 0, y: size === 'large' ? 9 : 0, w: side, h: side };
}

function hand(angle: number, length: number, width: number, style: WidgetIdentity['hands'], cy: number): string {
  let profile: [number, number][];
  switch (style) {
    case 'needle': profile = [[-8, -width], [length, 0], [-8, width]]; break;
    case 'sword': profile = [[-5, -width], [length * .72, -width], [length, 0], [length * .72, width], [-5, width]]; break;
    case 'leaf': profile = [[-4, 0], [length * .32, -width * 1.3], [length, 0], [length * .32, width * 1.3]]; break;
    case 'wedge': profile = [[-5, -width * .55], [length * .76, -width * 1.45], [length, 0], [length * .76, width * 1.45], [-5, width * .55]]; break;
    default: profile = [[-5, -width], [length - 1, -width], [length, 0], [length - 1, width], [-5, width]];
  }
  const c = Math.cos(angle), s = Math.sin(angle);
  return profile.map(([along, across], i) => `${i ? 'L' : 'M'} ${50 + c * along - s * across} ${cy + s * along + c * across}`).join(' ') + ' Z';
}

/** Render the same authored paths, live values and family layout as ThemedWidgetDrawing.swift. */
export function themedWidgetSvg(d: DesignedWidget, identity: WidgetIdentity, size: HomeOptionSize, values: DesignedReadings): string {
  const { w, h } = DESIGNED_SIZE[size];
  const wide = size === 'medium', large = size === 'large';
  const locale = values.locale ?? 'en-AU', date = values.date;
  const art = values.originalArtwork ?? null;
  const elements: string[] = [], definitions: string[] = [];
  const box = (x: number, y: number, width: number, height = width): Box => ({ x, y, w: width, h: height });
  const transform = (b: Box) => `translate(${b.x} ${b.y}) scale(${b.w / 100} ${b.h / 100})`;
  const path = (data: string, b: Box, colour: string, opacity = 1, stroke?: number) => {
    const paint = stroke === undefined ? `fill="${colour}"` : `fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
    elements.push(`<path d="${data}" transform="${transform(b)}" ${paint} opacity="${opacity}"/>`);
  };
  const rect = (b: Box, colour: string, opacity = 1, radius = 0) => elements.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${radius}" fill="${colour}" opacity="${opacity}"/>`);
  const line = (x: number, y: number, endX: number, endY: number, colour: string, opacity: number, width = 1) => elements.push(`<line x1="${x}" y1="${y}" x2="${endX}" y2="${endY}" stroke="${colour}" opacity="${opacity}" stroke-width="${width}" stroke-linecap="round"/>`);
  const circle = (x: number, y: number, r: number, colour: string) => elements.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/>`);
  const font = d.font === 'serif' ? 'Georgia,serif' : d.font === 'mono' ? 'Menlo,monospace' : 'ui-rounded,system-ui,sans-serif';
  const text = (value: string, x: number, y: number, nominal: number, width: number, colour = d.ink, weight = 600, anchor = 'middle') => {
    const estimate = [...value].length * nominal * .62;
    const fitted = Math.min(nominal, nominal * width / Math.max(1, estimate));
    elements.push(`<text x="${x}" y="${y}" font-size="${fitted}" font-weight="${weight}" fill="${colour}" text-anchor="${anchor}" dominant-baseline="central" alignment-baseline="central">${esc(value)}</text>`);
  };
  const number = (value: number, digits = 1) => new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: digits }).format(value);
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(date);
  const insetClip = (id: string, b: Box) => definitions.push(`<clipPath id="${id}"><path d="${identity.inner}" transform="${transform(b)}"/></clipPath>`);

  if (d.kind === 'clock') {
    const b = originalFaceBox(size);
    const original = identity.originalFace === 'alpine' && art !== null;
    if (original) {
      elements.push(`<image href="${esc(art)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`);
    } else {
      path(identity.outline, b, d.ink, .045);
      insetClip('face', b);
      elements.push('<g clip-path="url(#face)">');
      path(identity.detail, box(b.x + b.w * .05, b.y + b.h * .36, b.w * .9, b.h * .58), d.accent, .36, 1.8);
      path(identity.subject, box(b.x + b.w * .14, b.y + b.h * .18, b.w * .72, b.h * .64), d.secondary, .47, 2.15);
      elements.push('</g>');
      path(identity.outline, b, d.secondary, .76, .9);
      path(identity.inner, b, d.accent, .55, .55);
      path(identity.minutes, b, d.secondary, .68, .45);
      path(identity.hours, b, d.ink, .97, 1.18);
      for (const [i, n] of [12, 3, 6, 9].entries()) {
        const a = i * Math.PI / 2 - Math.PI / 2;
        const r = identity.cardinals[i] / 100 * b.w;
        const x = b.x + b.w / 2 + Math.cos(a) * r, y = b.y + b.h / 2 + Math.sin(a) * r;
        circle(x, y, b.w * .049, d.background[0]);
        text(number(n), x, y, b.w * .072, b.w * .14, d.ink, 650);
      }
    }
    const hour = date.getHours() % 12, minute = date.getMinutes();
    const cy = original ? 47.3 : 50;
    const hourShape = hand((hour + minute / 60) * Math.PI / 6 - Math.PI / 2, 21, 1.85, identity.hands, cy);
    const minuteShape = hand(minute * Math.PI / 30 - Math.PI / 2, 32, 1.2, identity.hands, cy);
    for (const p of [hourShape, minuteShape]) path(p, b, d.background[0], .9, 2.05);
    path(hourShape, b, original ? '#DFBA87' : d.secondary);
    path(minuteShape, b, original ? '#FFF4DC' : d.ink);
    circle(b.x + b.w * .5, b.y + b.h * cy / 100, b.w * .023, original ? '#FFF4DC' : d.ink);
    if (wide) {
      path(identity.outline, box(179, 13, 178, 144), d.ink, .052);
      path(identity.inner, box(179, 13, 178, 144), d.accent, .35, .6);
      path(identity.detail, box(244, 21, 47, 35), d.secondary, .62, 2.6);
      const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatToParts(date);
      const period = parts.find(p => p.type === 'dayPeriod')?.value;
      const time = parts.filter(p => p.type === 'hour' || p.type === 'minute' || p.type === 'literal' && p.value.includes(':')).map(p => p.value).join('');
      text(time, 268, 82, 49, 153, d.ink, 650);
      if (period) text(period, 268, 112, 12, 100, d.secondary);
      text(fmt({ weekday: 'short', day: 'numeric', month: 'short' }), 268, 134, 14, 148, d.secondary);
    }
  } else if (d.kind === 'battery') {
    const level = values.battery !== null && Number.isInteger(values.battery) && values.battery >= 0 && values.battery <= 100 ? values.battery : null;
    const value = level === null ? '\u2014' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(level / 100);
    const label = values.batteryLabel ?? 'Battery';
    const isColumn = identity.gauge === 'column';
    const artworkBox = isColumn ? (large ? box(18, 54, 144, 268) : wide ? box(15, 13, 124, 145) : box(5, 20, 70, 125)) :
      (large ? box(51, 18, 262, 235) : wide ? box(8, 12, 138, 145) : box(27, 5, 116, 111));
    const valueX = wide ? 250 : isColumn ? (large ? 258 : 122) : w / 2;
    const valueY = large ? (isColumn ? 170 : 132) : wide ? 67 : isColumn ? 75 : 61;
    const valueWidth = wide ? 183 : isColumn ? (large ? 165 : 81) : w - 23;
    path(identity.outline, artworkBox, d.ink, .06);
    path(identity.detail, artworkBox, d.accent, .24, 1.4);
    if (isColumn) {
      insetClip('charge', artworkBox);
      elements.push('<g clip-path="url(#charge)">');
      if (level !== null && level > 0) {
        const extent = artworkBox.h * .9 * level / 100;
        const fillY = artworkBox.y + artworkBox.h * .95 - extent;
        rect(box(artworkBox.x, fillY, artworkBox.w, extent), d.accent, .7);
        line(artworkBox.x, fillY, artworkBox.x + artworkBox.w, fillY, d.secondary, .7, 1.3);
      }
      path(identity.subject, box(artworkBox.x + artworkBox.w * .15, artworkBox.y + artworkBox.h * .19, artworkBox.w * .7, artworkBox.h * .62), d.ink, .83, 2.5);
      elements.push('</g>');
      path(identity.outline, artworkBox, d.secondary, .75, 1.2);
    } else {
      path(identity.subject, artworkBox, d.secondary, wide ? .78 : .36, 2.2);
      const railX = wide ? 155 : large ? 35 : 14, railW = wide ? 191 : w - railX * 2;
      const railY = large ? 253 : wide ? 101 : 111, railH = large ? 50 : 21;
      if (identity.gauge === 'tiles') {
        const tile = railW / 10;
        for (let i = 0; i < 10; i++) {
          const amount = Math.max(0, Math.min(1, (level ?? 0) / 10 - i));
          const b = box(railX + i * tile, railY, tile - 1, railH);
          path(identity.outline, b, d.secondary, .18);
          if (amount > 0) {
            definitions.push(`<clipPath id="cell${i}"><rect x="${b.x}" y="${b.y}" width="${b.w * amount}" height="${b.h}"/></clipPath>`);
            elements.push(`<g clip-path="url(#cell${i})">`);
            path(identity.outline, b, d.accent);
            elements.push('</g>');
          }
        }
      } else if (identity.gauge === 'trail') {
        const y = railY + railH * .55;
        const lift = railH * .48;
        const travel = (fraction: number) => y - Math.sin(fraction * Math.PI) * lift;
        const rail = (end: number) => Array.from({ length: 25 }, (_, i) => {
          const f = i / 24 * end;
          return `${i ? 'L' : 'M'} ${railX + railW * f} ${travel(f)}`;
        }).join(' ');
        elements.push(`<path d="${rail(1)}" fill="none" stroke="${d.secondary}" stroke-width="${large ? 7 : 4}" opacity=".23" stroke-linecap="round"/>`);
        if (level !== null && level > 0) {
          const progress = level / 100;
          elements.push(`<path d="${rail(progress)}" fill="none" stroke="${d.accent}" stroke-width="${large ? 7 : 4}" stroke-linecap="round"/>`);
          circle(railX + railW * progress, travel(progress), large ? 6 : 3.5, d.ink);
        }
      } else {
        const tank = box(railX, railY - 3, railW, railH + 6);
        path(identity.outline, tank, d.secondary, .18);
        insetClip('basin', tank);
        elements.push('<g clip-path="url(#basin)">');
        if (level !== null && level > 0) rect(box(railX, tank.y, railW * level / 100, tank.h), d.accent, .9);
        path(identity.detail, tank, d.ink, .38, .65);
        elements.push('</g>');
        path(identity.outline, tank, d.secondary, .5, .6);
      }
    }
    if (!wide && !isColumn) rect(box(valueX - valueWidth / 2, valueY - (large ? 47 : 27), valueWidth, large ? 94 : 54), d.background[0], .72, large ? 30 : 15);
    text(value, valueX, valueY, large ? 85 : wide ? 67 : isColumn ? 41 : 52, valueWidth, d.ink, 700);
    text(label, valueX, large ? (isColumn ? 234 : 327) : wide ? 144 : 148, large ? 23 : 13, valueWidth, d.secondary, 500);
  } else {
    const first = localeFirstWeekday(locale);
    const month = calendarMonth(date, first), rtl = /^(ar|he|fa|ur)/.test(locale);
    const gridX = wide ? 148 : large ? 25 : 12, gridW = wide ? 203 : large ? 314 : 146;
    const top = wide ? 34 : large ? 106 : 50, row = wide ? 17.4 : large ? 34 : 15, col = gridW / 7;
    const header = box(7, 7, wide ? 129 : w - 14, wide ? h - 14 : large ? 79 : 35);
    const motifBox = wide ? box(26, 24, 91, 115) : large ? box(226, 5, 106, 78) : box(120, 5, 42, 36);
    if (identity.calendar === 'band') rect(header, d.accent, .22, large ? 12 : 7);
    if (identity.calendar === 'folio') {
      rect(box(6, 6, w - 12, h - 12), d.ink, .047, large ? 22 : 11);
      line(wide ? 139 : 8, 13, wide ? 139 : 8, h - 13, d.accent, .52, 1.5);
    }
    if (identity.calendar === 'ticket') {
      rect(header, d.ink, .095, large ? 16 : 7);
      for (let i = 0; i < 13; i++) {
        const x = wide ? 138 : 13 + (w - 26) * i / 12;
        const y = wide ? 14 + (h - 28) * i / 12 : large ? 91 : 43;
        line(x, y, x + (wide ? 0 : 4), y + (wide ? 4 : 0), d.secondary, .48);
      }
    }
    if (identity.calendar === 'board' || identity.calendar === 'ledger') {
      for (let i = 0; i < 7; i++) line(gridX, top + row * (.65 + i), gridX + gridW, top + row * (.65 + i), d.secondary, identity.calendar === 'board' ? .24 : .30, .65);
      if (identity.calendar === 'board') for (let i = 0; i <= 7; i++) line(gridX + i * col, top - row * .47, gridX + i * col, top + row * 6.65, d.secondary, .21, .65);
    }
    path(identity.detail, box(gridX + gridW * .11, top + row, gridW * .78, row * 5.4), d.accent, .16, 1.3);
    path(identity.subject, motifBox, d.secondary, wide ? .39 : .60, wide ? 1.7 : 2.6);
    if (wide) {
      rect(box(19, 54, 108, 62), d.background[0], .72, 12);
      text(fmt({ weekday: 'short' }), 72, 40, 15, 108, d.secondary);
      text(number(month.today), 72, 84, 54, 102, d.ink, 700);
      text(fmt({ month: 'short', year: 'numeric' }), 72, 131, 14, 114, d.secondary);
    } else {
      text(fmt({ month: 'long' }), large ? 24 : 16, large ? 35 : 22, large ? 33 : 18, large ? 193 : 99, d.ink, 700, 'start');
      text(fmt({ year: 'numeric' }), large ? 25 : 17, large ? 69 : 37, large ? 16 : 10, 75, d.secondary, 600, 'start');
    }
    for (let i = 0; i < 7; i++) {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 1 + (i + first) % 7));
      text(weekday, gridX + ((rtl ? 6 - i : i) + .5) * col, top, large ? 15 : 10, col, d.secondary);
    }
    month.cells.forEach((day, index) => {
      if (day === null) return;
      const column = index % 7, x = gridX + ((rtl ? 6 - column : column) + .5) * col;
      const y = top + row * (Math.floor(index / 7) + 1.18);
      const today = day === month.today, diameter = large ? 31 : 18;
      if (today) path(identity.outline, box(x - diameter / 2, y - diameter / 2, diameter), d.accent);
      text(number(day), x, y, large ? 19 : 12, col - 1, today ? d.onAccent : d.ink, today ? 700 : 550);
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="paint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${d.background[0]}"/><stop offset="1" stop-color="${d.background[1]}"/></linearGradient>${definitions.join('')}</defs><rect width="${w}" height="${h}" fill="url(#paint)"/><g font-family="${font}" style="font-variant-numeric:tabular-nums">${elements.join('')}</g></svg>`;
}
