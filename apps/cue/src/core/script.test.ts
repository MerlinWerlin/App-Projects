import { autoTitle, formatDuration, normWord, parseScript, readSeconds, splitWords, wpmForTarget } from './script';

describe('parseScript', () => {
  const p = parseScript('# Intro\nHello *big* world. [pause]\n[[secret note]] Again\n\n---\n# Two\nBye now');
  it('finds sections, breaks and words', () => {
    expect(p.sections.map((s) => s.title)).toEqual(['Intro', 'Two']);
    expect(p.blocks.map((b) => b.kind)).toEqual(['heading', 'para', 'break', 'heading', 'para']);
    expect(p.words).toEqual(['hello', 'big', 'world', 'again', 'bye', 'now']);
    expect(p.cueCount).toBe(1);
  });
  it('marks emphasis, cues and notes and never speaks notes', () => {
    const para = p.blocks[1]!;
    if (para.kind !== 'para') throw new Error('para');
    expect(para.segments.some((s) => s.kind === 'text' && s.emph && s.text === 'big')).toBe(true);
    expect(para.segments.some((s) => s.kind === 'cue' && s.label === 'pause')).toBe(true);
    expect(para.segments.some((s) => s.kind === 'note' && s.text === 'secret note')).toBe(true);
  });
  it('word indexes line up with segments', () => {
    const para = p.blocks[1]!;
    if (para.kind !== 'para') throw new Error('para');
    const again = para.segments.find((s) => s.kind === 'text' && s.text.includes('Again'));
    expect(again && again.kind === 'text' ? again.firstWord : -1).toBe(3);
  });
  it('survives junk', () => {
    for (const s of ['', '[[unclosed', '[', '****', '# ', '---', '\r\n\r\n']) expect(() => parseScript(s)).not.toThrow();
  });
});

describe('words and timing', () => {
  it('normalises', () => {
    expect(normWord("Don't,")).toBe('dont');
    expect(normWord('Café')).toBe('cafe');
  });
  it('splits CJK per character', () => {
    expect(splitWords('こんにちは').length).toBe(5);
  });
  it('estimates read time and target speed', () => {
    const p = parseScript(Array(140).fill('word').join(' '));
    expect(readSeconds(p, 140)).toBe(60);
    expect(wpmForTarget(p, 30)).toBe(260);
    expect(wpmForTarget(p, 120)).toBe(70);
  });
  it('formats', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
  it('auto titles', () => {
    expect(autoTitle('\n# Hello there [pause]\nmore')).toBe('Hello there');
    expect(autoTitle('x'.repeat(60)).endsWith('…')).toBe(true);
  });
});
