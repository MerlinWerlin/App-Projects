import { copyTable } from '../i18n/lazyCopy';
import type { Key } from './keys';

/**
 * Keyboard sheet logic. Pure TS (no React Native) so it is unit-tested against MockTv.
 *
 * Live typing sends only the change between the previous and the next field value:
 * deletes become BACKSPACE keys, appends become one text op, and an edit in the middle
 * backspaces to the common prefix and retypes the rest (TVs only edit at the cursor end).
 */
export type TypeOp = { type: 'text'; text: string } | { type: 'key'; key: Key };

export type KeyboardMode = 'live' | 'enter';

/** Translated on read (t() getters). */
export const KEYBOARD_MODE_LABEL: Record<KeyboardMode, string> = copyTable({
  live: 'core.keyboard.live',
  enter: 'core.keyboard.enter',
});

/** Split by code point so emoji and other surrogate pairs count as one character. */
function chars(s: string): string[] {
  return Array.from(s);
}

export function diffText(prev: string, next: string): TypeOp[] {
  const a = chars(prev);
  const b = chars(next);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  const ops: TypeOp[] = [];
  for (let i = p; i < a.length; i += 1) ops.push({ type: 'key', key: 'BACKSPACE' });
  const added = b.slice(p).join('');
  if (added.length > 0) ops.push({ type: 'text', text: added });
  return ops;
}

/** Session-like sink: RemoteSession matches this (its send* never throw, they return ok). */
export interface TypeSink {
  sendText(text: string): Promise<boolean>;
  sendKey(key: Key): Promise<boolean>;
}

/**
 * Serialises typing ops in order, so fast typing never reorders text and backspaces.
 * `sent` is what has been queued to the TV so far (the baseline for the next diff).
 */
export class LiveTyper {
  private sent = '';
  private chain: Promise<boolean> = Promise.resolve(true);

  constructor(private readonly sink: TypeSink) {}

  /** Text the TV should be showing once the queue drains. */
  get text(): string {
    return this.sent;
  }

  /** Queue the ops that take the TV from the last value to `next`. Resolves true if every op succeeded. */
  update(next: string): Promise<boolean> {
    const ops = diffText(this.sent, next);
    this.sent = next;
    return this.enqueue(ops);
  }

  /** Send-on-Enter mode: type the whole text (diffed against anything already sent), then ENTER. */
  submit(text: string): Promise<boolean> {
    const ops = diffText(this.sent, text);
    ops.push({ type: 'key', key: 'ENTER' });
    this.sent = '';
    return this.enqueue(ops);
  }

  /** Remove everything this typer has sent, using backspaces. */
  clear(): Promise<boolean> {
    return this.update('');
  }

  /** Forget the baseline without sending anything (e.g. the sheet reopened or the TV changed). */
  reset(value = ''): void {
    this.sent = value;
  }

  /** Resolves once every queued op has run. */
  idle(): Promise<boolean> {
    return this.chain;
  }

  private enqueue(ops: TypeOp[]): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      let ok = true;
      for (const op of ops) {
        const r = op.type === 'text' ? await this.sink.sendText(op.text) : await this.sink.sendKey(op.key);
        if (!r) ok = false;
      }
      return ok;
    };
    const next = this.chain.then(run, run);
    this.chain = next;
    return next;
  }
}
