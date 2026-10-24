/**
 * Caption export: turns a script into timed subtitle cues (SRT or WebVTT) at a reading speed,
 * so a recorded take can be captioned without uploading audio anywhere. Pure TS.
 */
import { CUE_SECONDS, clampWpm, splitWords, type ParsedScript } from './script';

export interface Caption {
  start: number;
  end: number;
  text: string;
}

/** Groups spoken text into caption lines of at most `maxChars` (and at most ~7 words). */
export function buildCaptions(p: ParsedScript, wpm: number, maxChars = 42, offsetSeconds = 0): Caption[] {
  const secPerWord = 60 / clampWpm(wpm);
  const out: Caption[] = [];
  let t = offsetSeconds;
  let line: string[] = [];
  let lineStart = t;
  const flush = () => {
    if (!line.length) return;
    out.push({ start: lineStart, end: t, text: line.join(' ') });
    line = [];
  };
  for (const b of p.blocks) {
    if (b.kind !== 'para') continue;
    for (const s of b.segments) {
      if (s.kind === 'cue') {
        flush();
        t += CUE_SECONDS;
        continue;
      }
      if (s.kind !== 'text') continue;
      for (const w of splitWords(s.text)) {
        const candidate = [...line, w].join(' ');
        if (line.length && (candidate.length > maxChars || line.length >= 7)) flush();
        if (!line.length) lineStart = t;
        line.push(w);
        t += secPerWord;
        if (/[.!?]$/.test(w)) flush();
      }
    }
    flush();
  }
  return out;
}

function stamp(sec: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

export function toSrt(caps: Caption[]): string {
  return caps.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
}

export function toVtt(caps: Caption[]): string {
  return `WEBVTT\n\n${caps.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}
