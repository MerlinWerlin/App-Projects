import { initialNumpad, pressDigit, pressOk, type NumpadState } from './numpad';

function typeAll(chars: string): { state: NumpadState; sent: (string | null)[] } {
  let state = initialNumpad();
  const sent: (string | null)[] = [];
  for (const ch of chars) {
    const r = pressDigit(state, ch);
    state = r.state;
    sent.push(r.send);
  }
  return { state, sent };
}

describe('numpad state', () => {
  it('starts empty', () => {
    expect(initialNumpad().show).toBe('');
  });

  it('each digit returns its NUM_ key and shows it', () => {
    const { state, sent } = typeAll('7-2');
    expect(sent).toEqual(['NUM_7', 'NUM_DASH', 'NUM_2']);
    expect(state.show).toBe('7-2');
  });

  it('shows only the last 5 characters', () => {
    const { state, sent } = typeAll('1234567');
    expect(state.show).toBe('34567');
    expect(sent).toHaveLength(7);
  });

  it('ignores non-digit input', () => {
    const s = initialNumpad();
    const r = pressDigit(s, 'a');
    expect(r.send).toBeNull();
    expect(r.state).toBe(s);
    expect(r.close).toBe(false);
    expect(pressDigit(s, '12').send).toBeNull();
  });

  it('OK sends ENTER, closes and resets', () => {
    const { state } = typeAll('12');
    const r = pressOk(state);
    expect(r.send).toBe('ENTER');
    expect(r.close).toBe(true);
    expect(r.state.show).toBe('');
  });
});
