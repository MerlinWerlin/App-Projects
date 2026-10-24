import { MemoryKv, WELCOME_BODY, displayTitle, duplicate, makeScript, parseLibrary, recordTake, searchScripts, serializeLibrary, sortScripts, upsert } from './library';
import { DEFAULT_PREFS, parsePrefs } from './prefs';
import { buildCaptions, toSrt, toVtt } from './captions';
import { parseScript } from './script';
import { canUse, parseEntitlement } from '../plus/entitlement';

describe('library', () => {
  it('round trips and ignores corrupt data', async () => {
    const kv = new MemoryKv();
    const a = makeScript('hello world', '', 1);
    await kv.setItem('k', serializeLibrary([a]));
    expect(parseLibrary(await kv.getItem('k'))).toEqual([a]);
    for (const raw of [null, '', '{', '[]', '{"version":2}', '{"version":1,"scripts":[1,{"id":3}]}']) expect(parseLibrary(raw)).toEqual([]);
  });
  it('sorts pinned first then recent, searches, upserts', () => {
    const a = { ...makeScript('alpha', '', 1), updatedAt: 1 };
    const b = { ...makeScript('beta', '', 2), updatedAt: 2 };
    const c = { ...makeScript('gamma', '', 3), updatedAt: 0, pinned: true };
    expect(sortScripts([a, b, c]).map((s) => s.body)).toEqual(['gamma', 'beta', 'alpha']);
    expect(searchScripts([a, b, c], 'ET')).toEqual([b]);
    expect(upsert([a], { ...a, body: 'x' })[0]!.body).toBe('x');
    expect(upsert([a], b).length).toBe(2);
  });
  it('titles, duplicates and takes', () => {
    expect(displayTitle({ title: '', body: '' }, 'Untitled')).toBe('Untitled');
    expect(displayTitle({ title: '', body: '# Pitch\nhi' }, 'U')).toBe('Pitch');
    const d = duplicate(makeScript('x', 'Talk', 1), '(copy)', 5);
    expect(d.title).toBe('Talk (copy)');
    let s = makeScript('x');
    for (let i = 0; i < 25; i++) s = recordTake(s, i);
    expect(s.takes!.length).toBe(20);
  });
  it('welcome script parses with sections', () => {
    expect(parseScript(WELCOME_BODY).sections.length).toBe(3);
  });
});

describe('prefs', () => {
  it('defaults and clamps', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('nope')).toEqual(DEFAULT_PREFS);
    const p = parsePrefs(JSON.stringify({ fontSize: 999, pace: 'warp', mirrorH: true }));
    expect(p.fontSize).toBe(96);
    expect(p.pace).toBe('steady');
    expect(p.mirrorH).toBe(true);
  });
});

describe('captions', () => {
  it('builds srt and vtt', () => {
    const caps = buildCaptions(parseScript('Hello there. This is a test of captions that wraps across lines nicely. [pause] End.'), 120);
    expect(caps.length).toBeGreaterThan(2);
    expect(caps[0]!.text).toBe('Hello there.');
    expect(caps[0]!.end).toBeCloseTo(1, 5);
    expect(toSrt(caps)).toContain('00:00:00,000 --> 00:00:01,000');
    expect(toVtt(caps).startsWith('WEBVTT')).toBe(true);
    for (const c of caps) expect(c.text.length).toBeLessThanOrEqual(42);
  });
});

describe('entitlement', () => {
  it('free by default, plus only from a valid doc', () => {
    expect(parseEntitlement(null).tier).toBe('free');
    expect(parseEntitlement('{"version":1,"tier":"plus","source":"hack"}').tier).toBe('free');
    expect(parseEntitlement('{"version":1,"tier":"plus","source":"restore","updatedAt":1}').tier).toBe('plus');
    expect(canUse('free', 'voice')).toBe(false);
    expect(canUse('plus', 'voice')).toBe(true);
  });
});
