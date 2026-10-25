import type { KvStore } from './store';

/**
 * First-launch language line (release standard 1, 25 Oct 2026): "Language: English · Change" on the first
 * screen, shown in the first session only. Pure TS, unit-tested in Node (languageHint.test.ts).
 *
 * - The decision is made once per app run (start()): nothing stored yet means this is the first session, so the
 *   line shows, and the "seen" flag is written straight away so the next launch never shows it.
 * - dismiss() (the person tapped Change) hides it at once for the rest of this session too.
 * - Storage errors hide the line: better to miss the hint than to nag every launch.
 */
export const LANGUAGE_HINT_KEY = 'couch.languageHint.v1';

export type LanguageHintState = 'loading' | 'show' | 'hidden';

export class LanguageHint {
  private state: LanguageHintState = 'loading';
  private started: Promise<void> | null = null;
  private subs = new Set<() => void>();

  constructor(
    private readonly kv: KvStore,
    private readonly key: string = LANGUAGE_HINT_KEY,
  ) {}

  getState(): LanguageHintState {
    return this.state;
  }

  visible(): boolean {
    return this.state === 'show';
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  private setState(s: LanguageHintState): void {
    if (s === this.state) return;
    this.state = s;
    for (const cb of this.subs) cb();
  }

  /** Decide for this run (idempotent). Never throws. */
  start(): Promise<void> {
    if (!this.started) this.started = this.decide();
    return this.started;
  }

  private async decide(): Promise<void> {
    let raw: string | null;
    try {
      raw = await this.kv.getItem(this.key);
    } catch {
      this.setState('hidden');
      return;
    }
    // Tapped before the read finished: stay hidden.
    if (this.state === 'hidden') return;
    if (raw !== null) {
      this.setState('hidden');
      return;
    }
    this.setState('show');
    await this.markSeen();
  }

  /** The person tapped Change: hide now and never again. Never throws. */
  async dismiss(): Promise<void> {
    this.setState('hidden');
    await this.markSeen();
  }

  private async markSeen(): Promise<void> {
    try {
      await this.kv.setItem(this.key, '1');
    } catch {
      // Not persisted: at worst the line shows once more next launch.
    }
  }
}
