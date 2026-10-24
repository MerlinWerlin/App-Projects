import { Follower, alignPosition, heardWords, wordSim } from './follow';
import { parseScript } from './script';

const script = parseScript(
  'Today I want to show you how the new garden layout works and why the tomatoes moved to the sunny corner of the yard',
).words;

describe('voice follow', () => {
  it('similarity', () => {
    expect(wordSim('garden', 'garden')).toBe(1);
    expect(wordSim('tomatoes', 'tomatos')).toBeGreaterThan(0.8);
    expect(wordSim('the', 'garden')).toBeLessThan(0.3);
  });
  it('moves forward on a matching phrase', () => {
    const at = alignPosition(script, heardWords('today i want to show you'), 0);
    expect(script[at]).toBe('how');
  });
  it('ignores ad-libs', () => {
    expect(alignPosition(script, heardWords('um sorry lets start again bananas'), 5)).toBe(5);
  });
  it('a single common word never jumps', () => {
    expect(alignPosition(script, ['the'], 0)).toBe(0);
  });
  it('tolerates a misheard word', () => {
    const at = alignPosition(script, heardWords('the new gardn layout works'), 6);
    expect(script[at]).toBe('and');
  });
  it('follower progresses through partial transcripts', () => {
    const f = new Follower(script);
    f.hear('today i want');
    f.hear('today i want to show you how the new');
    expect(script[f.position]).toBe('garden');
    f.hear('today i want to show you how the new garden layout works and why the tomatoes moved to the sunny corner of the yard');
    expect(f.done).toBe(true);
  });
});
