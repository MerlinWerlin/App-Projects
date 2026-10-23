/**
 * Infrared code-test setup (prototype v2 irSheet / irTest / irSave):
 *   brand -> testing (code n of total, send Volume up, "did it work?") -> naming -> done
 * "No" on the last set ends in 'exhausted'. Pure TS; the transmitter is injected.
 * Codes are UNVERIFIED on real TVs (see CODES.md).
 */
import { t } from '../../i18n/core';
import { encode } from './protocols';
import { NOT_SURE, candidatesFor, codeFor, irBrandChoiceLabel, type IrBrand, type IrBrandChoice, type IrCandidate } from './codes';
import type { IrTransmitter } from './transmitter';

/** What the setup produces: everything a Tv needs except id/host, plus how to find the code set again. */
export interface IrTvDraft {
  platform: 'ir';
  name: string;
  model: string;
  irBrand: IrBrand;
  irSet: number;
}

export type IrSetupState =
  | { step: 'brand' }
  | {
      step: 'testing';
      choice: IrBrandChoice;
      candidates: IrCandidate[];
      /** 1-based position among candidates (the big number on screen). */
      n: number;
      total: number;
      /** Volume up was sent at least once for this set. */
      sent: boolean;
      sending: boolean;
      error: string | null;
    }
  | { step: 'naming'; choice: IrBrandChoice; candidate: IrCandidate; n: number; name: string }
  | { step: 'done'; tv: IrTvDraft }
  | { step: 'exhausted'; choice: IrBrandChoice; message: string };

/** 'TV n' with the lowest n >= 1 not already used by an existing name. */
export function defaultTvName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((s) => s.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`tv ${n}`)) n++;
  return `TV ${n}`;
}

export function exhaustedMessage(choice: IrBrandChoice): string {
  return t('core.ir.exhausted', { brand: irBrandChoiceLabel(choice), notSure: irBrandChoiceLabel(NOT_SURE) });
}

export class IrSetup {
  private s: IrSetupState = { step: 'brand' };
  private subs = new Set<() => void>();

  constructor(
    private readonly transmitter: IrTransmitter,
    private readonly existingNames: () => readonly string[] = () => [],
  ) {}

  get state(): IrSetupState {
    return this.s;
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  private set(next: IrSetupState): IrSetupState {
    this.s = next;
    for (const cb of this.subs) cb();
    return next;
  }

  pickBrand(choice: IrBrandChoice): IrSetupState {
    const candidates = candidatesFor(choice);
    if (candidates.length === 0) return this.set({ step: 'exhausted', choice, message: exhaustedMessage(choice) });
    return this.set({ step: 'testing', choice, candidates, n: 1, total: candidates.length, sent: false, sending: false, error: null });
  }

  /** Transmits VOL_UP of the current set. Never throws: a failure lands in state.error. */
  async sendTest(): Promise<boolean> {
    const s = this.s;
    if (s.step !== 'testing' || s.sending) return false;
    const cand = s.candidates[s.n - 1];
    const code = cand ? codeFor(cand.codeSet, 'VOL_UP') : undefined;
    if (!code) {
      this.set({ ...s, error: t('core.ir.noVolumeUp') });
      return false;
    }
    this.set({ ...s, sending: true, error: null });
    try {
      const f = encode(code);
      await this.transmitter.transmit(f.frequency, f.pattern);
      if (this.s.step === 'testing' && this.s.n === s.n) this.set({ ...this.s, sending: false, sent: true });
      return true;
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : t('core.ir.sendFailed');
      if (this.s.step === 'testing' && this.s.n === s.n) this.set({ ...this.s, sending: false, error: msg });
      return false;
    }
  }

  /** "Yes, it worked". */
  yes(): IrSetupState {
    const s = this.s;
    if (s.step !== 'testing') return s;
    const candidate = s.candidates[s.n - 1];
    if (!candidate) return s;
    return this.set({ step: 'naming', choice: s.choice, candidate, n: s.n, name: defaultTvName(this.existingNames()) });
  }

  /** "No, try next". After the last set: 'exhausted'. */
  no(): IrSetupState {
    const s = this.s;
    if (s.step !== 'testing') return s;
    if (s.n >= s.total) return this.set({ step: 'exhausted', choice: s.choice, message: exhaustedMessage(s.choice) });
    return this.set({ ...s, n: s.n + 1, sent: false, sending: false, error: null });
  }

  setName(name: string): IrSetupState {
    const s = this.s;
    if (s.step !== 'naming') return s;
    return this.set({ ...s, name });
  }

  /** "Save TV": returns the draft (also in state.tv), or null when not naming. */
  save(): IrTvDraft | null {
    const s = this.s;
    if (s.step !== 'naming') return null;
    const name = s.name.trim() || defaultTvName(this.existingNames());
    const { brand, set } = s.candidate;
    const tv: IrTvDraft = { platform: 'ir', name, model: t('core.ir.model', { brand, set }), irBrand: brand, irSet: set };
    this.set({ step: 'done', tv });
    return tv;
  }

  /** Back to the brand grid (from testing, naming or exhausted). */
  restart(): IrSetupState {
    return this.set({ step: 'brand' });
  }
}
