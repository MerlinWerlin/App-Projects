import { advance, createToastStore, emptyToasts, enqueue, MAX_PENDING, TOAST_MS, toastHaptic } from './toastQueue';

describe('toast queue', () => {
  it('shows one at a time, in order', () => {
    let s = enqueue(emptyToasts, 'One');
    s = enqueue(s, 'Two');
    expect(s.visible?.message).toBe('One');
    expect(s.pending.map((t) => t.message)).toEqual(['Two']);
    s = advance(s);
    expect(s.visible?.message).toBe('Two');
    s = advance(s);
    expect(s.visible).toBeNull();
  });
  it('drops identical consecutive messages, allows them again later', () => {
    let s = enqueue(emptyToasts, 'Saved', 'success');
    expect(enqueue(s, 'Saved', 'success')).toBe(s);
    s = enqueue(s, 'Other');
    expect(enqueue(s, 'Other')).toBe(s);
    s = enqueue(s, 'Saved', 'success');
    expect(s.pending.map((t) => t.message)).toEqual(['Other', 'Saved']);
  });
  it('ignores blank messages and trims', () => {
    expect(enqueue(emptyToasts, '   ')).toBe(emptyToasts);
    expect(enqueue(emptyToasts, ' Hi ').visible?.message).toBe('Hi');
  });
  it('caps the pending queue', () => {
    let s = enqueue(emptyToasts, 'v');
    for (let i = 0; i < 10; i++) s = enqueue(s, `m${i}`);
    expect(s.pending.length).toBe(MAX_PENDING);
    expect(s.pending[s.pending.length - 1]?.message).toBe('m9');
  });
  it('ids are unique', () => {
    let s = enqueue(emptyToasts, 'a');
    s = enqueue(s, 'b');
    expect(s.pending[0]?.id).not.toBe(s.visible?.id);
  });
  it('timing and haptics', () => {
    expect(TOAST_MS).toBe(2200);
    expect(toastHaptic('success')).toBe('success');
    expect(toastHaptic('warning')).toBe('warning');
    expect(toastHaptic('info')).toBe('light');
  });
});

describe('toast store', () => {
  it('notifies, and stale done() calls are ignored', () => {
    const st = createToastStore();
    let n = 0;
    const off = st.subscribe(() => n++);
    st.show('A');
    st.show('B');
    const a = st.get().visible!.id;
    st.done(a + 100);
    expect(st.get().visible?.message).toBe('A');
    st.done(a);
    expect(st.get().visible?.message).toBe('B');
    expect(n).toBe(3);
    st.show('B');
    expect(n).toBe(3);
    off();
    st.reset();
    expect(n).toBe(3);
    expect(st.get()).toEqual(emptyToasts);
  });
});
