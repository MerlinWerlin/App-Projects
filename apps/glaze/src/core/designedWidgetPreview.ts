// Original vector compositions used by the app's live previews and complete-theme contact sheets.
// WidgetKit draws the same semantic layouts in targets/widget/DesignedWidget.swift.
import { calendarMonth, DESIGNED_SIZE, type DesignedWidget } from './designedWidgets.ts';
import type { HomeOptionSize } from './widgetOptions.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export type DesignedReadings = { date: Date; battery: number | null; locale?: string; batteryLabel?: string; unavailableLabel?: string };

export function localeFirstWeekday(locale: string): number {
  try {
    const value = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } };
    const first = value.getWeekInfo?.().firstDay ?? value.weekInfo?.firstDay;
    if (first !== undefined) return first % 7;
  } catch { /* Older Hermes: use the same common regional defaults. */ }
  return /^(en-US|en-CA|ja|zh|ko|hi)/i.test(locale) ? 0 : 1;
}

export function designedWidgetSvg(d: DesignedWidget, size: HomeOptionSize, values: DesignedReadings): string {
  const { w, h } = DESIGNED_SIZE[size], wide = size === 'medium', large = size === 'large';
  const { date } = values, locale = values.locale ?? 'en-AU';
  const battery = values.battery !== null && Number.isInteger(values.battery) && values.battery >= 0 && values.battery <= 100 ? values.battery : null;
  const fontFamily = d.font === 'serif' ? 'Georgia,serif' : d.font === 'mono' ? 'Menlo,monospace' : 'ui-rounded,system-ui,sans-serif';
  const elements: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 1, opacity = 1) => elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`);
  const circle = (x: number, y: number, r: number, color: string, stroke = 0, opacity = 1) => elements.push(`<circle cx="${x}" cy="${y}" r="${r}" ${stroke ? `fill="none" stroke="${color}" stroke-width="${stroke}"` : `fill="${color}"`} opacity="${opacity}"/>`);
  const rect = (x: number, y: number, width: number, height: number, radius: number, color: string, opacity = 1) => elements.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${color}" opacity="${opacity}"/>`);
  const text = (value: string, x: number, y: number, fs: number, width: number, color = d.ink, weight = 500, anchor = 'middle') => {
    // Conservative width estimate keeps the full label legible in the in-app preview; the native
    // renderer measures actual locale glyphs instead of estimating.
    const estimated = [...value].length * fs * 0.57;
    const fitted = Math.max(fs * 0.64, Math.min(fs, fs * width / Math.max(1, estimated)));
    elements.push(`<text x="${x}" y="${y}" font-size="${fitted}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central">${esc(value)}</text>`);
  };
  const num = (n: number, digits = 1) => new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: digits }).format(n);
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(date);
  const dayDate = (long = false) => fmt({ weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' });
  const time = () => fmt({ hour: 'numeric', minute: '2-digit' });
  const ornament = d.accent;
  if (d.motif === 'orbit') {
    elements.push(`<path d="M ${w-33} 14 A 29 29 0 0 0 ${w-15} 36" fill="none" stroke="${ornament}" opacity=".24"/>`);circle(w-28,30,2.5,ornament,0,.6);
  } else if (d.motif === 'stars') {
    for (const [x,y,r] of [[w-18,18,5],[w-32,8,2]]) { line(x-r,y,x+r,y,ornament,1,.24);line(x,y-r,x,y+r,ornament,1,.24); }
  } else if (d.motif === 'leaf') {
    elements.push(`<path d="M ${w-34} ${h-8} Q ${w-33} ${h-33} ${w-8} ${h-34} Q ${w-9} ${h-9} ${w-34} ${h-8} M ${w-33} ${h-9} L ${w-11} ${h-31}" fill="none" stroke="${ornament}" opacity=".24"/>`);
  } else if (d.motif === 'wave') {
    for (const dy of [0,5]) elements.push(`<path d="M 8 ${h-8-dy} C 23 ${h-21-dy} 32 ${h+5-dy} 49 ${h-8-dy}" fill="none" stroke="${ornament}" opacity=".24"/>`);
  } else if (d.motif === 'grid') {
    for (let i=0;i<3;i++) {line(w-24+i*5,8,w-24+i*5,22,ornament,1,.24);line(w-24,8+i*5,w-10,8+i*5,ornament,1,.24);}
  } else if (d.motif === 'diamond') {
    elements.push(`<path d="M ${w-18} 8 l 8 8 -8 8 -8 -8 Z" fill="none" stroke="${ornament}" opacity=".24"/>`);
  } else if (d.motif === 'flower') {
    for(let i=0;i<5;i++)circle(w-18+Math.cos(i*2*Math.PI/5)*5,17+Math.sin(i*2*Math.PI/5)*5,3,ornament,1,.24);
  } else if (d.motif === 'stitch') {
    for(let i=0;i<4;i++)line(10+i*6,h-8,13+i*6,h-11,ornament,1,.24);
  }
  if (d.kind === 'clock') {
    if (d.clock === 'dial') {
      const cx=wide?84:w/2,cy=large?159:79,r=large?126:61;
      circle(cx,cy,r,d.line,1,.26);
      for(let i=0;i<60;i++) {const a=i*Math.PI/30-Math.PI/2,major=i%5===0,inside=r-(major?10:4);line(cx+Math.cos(a)*inside,cy+Math.sin(a)*inside,cx+Math.cos(a)*(r-2),cy+Math.sin(a)*(r-2),major?d.accent:d.line,major?1.8:.7,major?1:.5);}
      for(const [n,a] of [[12,-Math.PI/2],[3,0],[6,Math.PI/2],[9,Math.PI]])text(num(n),cx+Math.cos(a)*(r-23),cy+Math.sin(a)*(r-23),large?19:12,35,d.secondary);
      const minute=date.getMinutes(),ha=(date.getHours()%12+minute/60)*Math.PI/6-Math.PI/2,ma=minute*Math.PI/30-Math.PI/2;
      line(cx,cy,cx+Math.cos(ha)*r*.46,cy+Math.sin(ha)*r*.46,d.ink,large?7:4);
      line(cx,cy,cx+Math.cos(ma)*r*.72,cy+Math.sin(ma)*r*.72,d.accent,large?4:2.8);circle(cx,cy,large?6:4,d.accent);
      if(wide){text(time(),249,65,44,184,d.ink,600);text(dayDate(),249,108,15,184,d.secondary);line(172,37,172,133,d.line,1,.18);}
      else if(large){text(time(),w/2,313,34,w-40,d.ink,600);text(dayDate(true),w/2,352,17,w-40,d.secondary);}
      else text(dayDate(),w/2,150,13,w-28,d.secondary);
    } else if (d.clock === 'split') {
      const cx=wide?131:w/2,cy=large?164:78,bw=large?128:wide?104:65,bh=large?170:84,gap=large?12:7,left=cx-gap/2-bw,right=cx+gap/2;
      for(const x of [left,right]){rect(x,cy-bh/2,bw,bh,large?15:8,d.ink,.055);line(x+4,cy,x+bw-4,cy,d.line,1,.17);}
      const hour12=new Intl.DateTimeFormat(locale,{hour:'numeric'}).resolvedOptions().hour12,hr=hour12?(date.getHours()%12||12):date.getHours();
      text(num(hr,2),left+bw/2,cy,large?92:wide?64:42,bw-6,d.ink,600);text(num(date.getMinutes(),2),right+bw/2,cy,large?92:wide?64:42,bw-6,d.ink,600);
      if(wide){text(fmt({weekday:'short'}),310,66,16,83,d.accent);text(fmt({day:'numeric',month:'short'}),310,98,15,83,d.secondary);}
      else text(dayDate(true),w/2,large?307:145,large?20:13,w-26,d.secondary);
      if(hour12){const period=new Intl.DateTimeFormat(locale,{hour:'numeric'}).formatToParts(date).find(p=>p.type==='dayPeriod')?.value??'';text(period,wide?310:w/2,large?266:wide?127:122,large?14:11,wide?83:w-28,d.secondary);}
    } else {
      text(time(),w/2,large?166:78,large?96:wide?78:51,w-24,d.ink,600);text(dayDate(true),w/2,large?266:132,large?23:14,w-28,d.secondary);line(w*.3,large?302:151,w*.7,large?302:151,d.accent,2,.45);
    }
  } else if (d.kind === 'battery') {
    const value=battery===null?'—':num(battery),label=values.batteryLabel??'Battery';
    if(d.battery==='ring'){
      const cx=wide?88:w/2,cy=large?161:78,r=large?118:57,sw=large?13:7;
      circle(cx,cy,r,d.line,sw,.14);
      if(battery!==null&&battery>0)elements.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.accent}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${Math.PI*2*r*battery/100} ${Math.PI*2*r}" transform="rotate(-90 ${cx} ${cy})"/>`);
      text(value,cx,cy-4,large?84:44,r*1.65,d.ink,600);if(battery!==null)text('%',cx,cy+(large?48:27),large?24:14,40,d.secondary);
      if(wide){text(label,267,64,23,154,d.secondary);if(battery===null)text(values.unavailableLabel??'Unavailable',267,102,15,154,d.secondary);}
      else text(label,w/2,large?327:150,large?23:13,w-26,d.secondary);
    }else{
      text(value+(battery===null?'':'%'),w/2,large?133:64,large?92:wide?65:51,w-24,d.ink,600);
      const x=wide||large?35:22,bw=w-x*2,y=large?225:109,bh=large?40:19;
      if(d.battery==='cells'){const gap=large?6:3,cw=(bw-9*gap)/10;for(let i=0;i<10;i++){rect(x+i*(cw+gap),y,cw,bh,large?5:2,d.line,.14);const fill=battery===null?0:Math.max(0,Math.min(1,battery/10-i));if(fill>0)rect(x+i*(cw+gap),y,cw*fill,bh,large?5:2,d.accent);}}
      else {rect(x,y,bw,bh,bh/2,d.line,.14);if(battery!==null&&battery>0)rect(x,y,bw*battery/100,bh,bh/2,d.accent);for(let i=1;i<4;i++)line(x+bw*i/4,y+4,x+bw*i/4,y+bh-4,d.background[0],1,.8);}
      text(label,w/2,large?319:150,large?23:13,w-26,d.secondary);
    }
    if(large&&battery===null)text(values.unavailableLabel??'Unavailable',w/2,h-27,15,w-30,d.secondary);
  } else {
    const firstWeekday=localeFirstWeekday(locale),m=calendarMonth(date,firstWeekday),rtl=/^(ar|he|fa|ur)/.test(locale);
    const gx=wide?148:large?26:12,gw=wide?201:large?312:146,top=wide?37:large?104:52,rh=wide?17:large?34:15,cw=gw/7;
    if(wide){text(fmt({weekday:'short'}),74,32,16,116,d.accent);text(num(m.today),74,82,62,116,d.ink,600);text(fmt({month:'short',year:'numeric'}),74,135,14,116,d.secondary);line(137,23,137,148,d.line,1,.18);}
    else {text(fmt({month:'long'}),large?27:14,large?39:23,large?29:19,large?220:108,d.ink,600,'start');text(fmt({year:'numeric'}),w-(large?27:14),large?42:25,large?16:12,70,d.secondary,500,'end');if(large)text(fmt({weekday:'long',day:'numeric'}),27,75,16,280,d.secondary,500,'start');}
    for(let col=0;col<7;col++) {const weekday=(firstWeekday+col)%7,x=gx+((rtl?6-col:col)+.5)*cw;const wd=new Intl.DateTimeFormat(locale,{weekday:'narrow'}).format(new Date(2026,10,1+weekday));text(wd,x,top,large?15:10,cw,d.secondary,600);}
    m.cells.forEach((day,cell)=>{if(day===null)return;const col=cell%7,row=Math.floor(cell/7),x=gx+((rtl?6-col:col)+.5)*cw,y=top+rh*(row+1.18);if(day===m.today)circle(x,y,large?14:9,d.accent);text(num(day),x,y,large?19:12,cw,day===m.today?d.onAccent:d.ink,day===m.today?700:500);});
    if(large)line(27,350,w-27,350,d.line,1,.15);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${d.background[0]}"/><stop offset="1" stop-color="${d.background[1]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#background)"/><g font-family="${fontFamily}" style="font-variant-numeric:tabular-nums">${elements.join('')}</g></svg>`;
}
