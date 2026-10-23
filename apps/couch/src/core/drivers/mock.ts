import { Emitter, type DriverEvent, type TvDriver, type VoiceStream } from '../driver';
import type { Key } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import { driverError } from './errors';

/** One line in the MockTv event log. */
export interface MockLogEntry {
  at: number;
  what: string;
  ms: number;
}

export interface MockTvOptions {
  /** Base latency in ms (prototype demo TVs use 24–38 ms). */
  baseMs?: number;
  /** +/- jitter in ms around baseMs. */
  jitterMs?: number;
  /** Random source in [0,1); inject for deterministic tests. */
  random?: () => number;
  /** Clock; inject for deterministic tests. */
  now?: () => number;
  /** Sleep used to simulate latency; tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
  on?: boolean;
  volume?: number;
  apps?: TvApp[];
}

/** Fallback demo apps for a bare MockTv: the real services (owner decision 22 Oct 2026); icons are
 * fetched at runtime from the App Store (src/core/storeIcons.ts). The demo session passes the same set. */
export const DEMO_APPS: TvApp[] = [
  { id: 'svc.netflix', name: 'Netflix', pinned: true },
  { id: 'svc.youtube', name: 'YouTube', pinned: true },
  { id: 'svc.disneyplus', name: 'Disney+', pinned: true },
  { id: 'svc.stan', name: 'Stan' },
  { id: 'svc.primevideo', name: 'Prime Video' },
  { id: 'svc.iview', name: 'ABC iview' },
];

/** Demo inputs (prototype v2 labels). The demo TV starts on HDMI 1. */
export const DEMO_INPUTS: readonly TvInput[] = [
  { id: 'tv', name: 'TV' },
  { id: 'hdmi1', name: 'HDMI 1' },
  { id: 'hdmi2', name: 'HDMI 2' },
  { id: 'hdmi3', name: 'HDMI 3' },
  { id: 'hdmi4', name: 'HDMI 4' },
  { id: 'av', name: 'AV' },
];

/** The mock cannot transcribe audio; every demo voice request "hears" this phrase (like the prototype). */
export const DEMO_VOICE_PHRASE = 'find cooking shows';

/** Demo voice stream: extra `transcript` / `bytes` fields let the UI and tests see what was "heard". */
export interface MockVoiceStream extends VoiceStream {
  readonly transcript: string;
  readonly bytes: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Demo driver: behaves like a TV (power state, volume, apps, latency) without any network.
 * Powers demo mode for App Review and screenshots, and is the reference for driver tests.
 */
export class MockTv implements TvDriver {
  readonly platform = 'mock' as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>([
    'keys',
    'text',
    'apps',
    'launch',
    'volume',
    'powerOn',
    'touchpad',
    'inputs',
    'numbers',
    'colorKeys',
    'voice',
  ]);

  readonly log: MockLogEntry[] = [];
  connected = false;
  isOn: boolean;
  vol: number;
  muted = false;
  text = '';
  foregroundApp: string | null = null;
  lastMs: number | null = null;
  /** Id of the current input (DEMO_INPUTS). */
  input = 'hdmi1';

  private readonly events = new Emitter();
  private readonly baseMs: number;
  private readonly jitterMs: number;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly apps: TvApp[];

  constructor(opts: MockTvOptions = {}) {
    this.baseMs = opts.baseMs ?? 30;
    this.jitterMs = opts.jitterMs ?? 8;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
    this.isOn = opts.on ?? true;
    this.vol = opts.volume ?? 14;
    this.apps = (opts.apps ?? DEMO_APPS).map((a) => ({ ...a }));
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    this.connected = true;
    this.events.emit({ type: 'state', state: this.isOn ? 'connected' : 'off' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  /** Latency for the next command: max(9, base +/- jitter), like the prototype. */
  nextLatency(): number {
    return Math.max(9, Math.round(this.baseMs + (this.random() * 2 - 1) * this.jitterMs));
  }

  private async record(what: string): Promise<void> {
    const ms = this.nextLatency();
    await this.sleep(ms);
    this.lastMs = ms;
    this.log.push({ at: this.now(), what, ms });
    this.events.emit({ type: 'sent', what, ms });
  }

  private ensureReady(allowOff = false): void {
    if (!this.connected) throw driverError('not_connected', 'core.driver.common.notConnected');
    if (!this.isOn && !allowOff) throw driverError('tv_off', 'core.driver.demo.off');
  }

  async sendKey(key: Key): Promise<void> {
    if (key === 'POWER') {
      this.ensureReady(true);
      this.isOn = !this.isOn;
      await this.record(key);
      this.events.emit({ type: 'state', state: this.isOn ? 'connected' : 'off' });
      return;
    }
    this.ensureReady();
    if (key === 'VOL_UP') this.vol = Math.min(100, this.vol + 1);
    if (key === 'VOL_DOWN') this.vol = Math.max(0, this.vol - 1);
    if (key === 'MUTE') this.muted = !this.muted;
    if (key === 'BACKSPACE') this.text = this.text.slice(0, -1);
    if (key === 'HOME') this.foregroundApp = null;
    if (key === 'SOURCE') {
      // Like a TV remote's Source button: step to the next input, wrapping.
      const i = DEMO_INPUTS.findIndex((x) => x.id === this.input);
      this.input = DEMO_INPUTS[(i + 1) % DEMO_INPUTS.length]?.id ?? this.input;
    }
    await this.record(key);
  }

  async sendText(text: string): Promise<void> {
    this.ensureReady();
    this.text += text;
    await this.record(`TEXT ${JSON.stringify(text)}`);
  }

  async launchApp(appId: string): Promise<void> {
    this.ensureReady();
    const app = this.apps.find((a) => a.id === appId);
    if (!app) throw driverError('unsupported', 'core.driver.demo.appNotInstalled', { app: appId });
    this.foregroundApp = app.id;
    await this.record(`LAUNCH ${app.id}`);
  }

  async listInputs(): Promise<TvInput[]> {
    this.ensureReady();
    return DEMO_INPUTS.map((x) => ({ ...x, current: x.id === this.input }));
  }

  async setInput(inputId: string): Promise<void> {
    this.ensureReady();
    if (!DEMO_INPUTS.some((x) => x.id === inputId)) throw driverError('unsupported', 'core.driver.demo.noInput', { input: inputId });
    this.input = inputId;
    await this.record(`INPUT ${inputId}`);
  }

  async listApps(): Promise<TvApp[]> {
    this.ensureReady();
    return this.apps.map((a) => ({ ...a }));
  }

  async volume(): Promise<number> {
    this.ensureReady();
    return this.vol;
  }

  /** Simulated Wake-on-LAN. */
  async powerOn(): Promise<void> {
    this.ensureReady(true);
    if (!this.isOn) {
      this.isOn = true;
      await this.record('POWER_ON');
      this.events.emit({ type: 'state', state: 'connected' });
    }
  }

  /** Demo native voice: audio chunks are counted, end() sends the fixed demo phrase. */
  async beginVoice(): Promise<MockVoiceStream> {
    this.ensureReady();
    let done = false;
    let bytes = 0;
    const stream: MockVoiceStream = {
      transcript: DEMO_VOICE_PHRASE,
      get bytes() {
        return bytes;
      },
      sendAudio: (chunk: Uint8Array) => {
        if (!done) bytes += chunk.length;
      },
      end: async () => {
        if (done) return;
        done = true;
        this.ensureReady();
        await this.record(`VOICE ${JSON.stringify(DEMO_VOICE_PHRASE)}`);
      },
      cancel: () => {
        done = true;
      },
    };
    return stream;
  }
}
