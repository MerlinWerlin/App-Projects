import type { TvApp } from './types';

/**
 * Official app icons for the main streaming services, fetched at runtime from Apple's public
 * iTunes Search API (owner decision, 22 Oct 2026: tiles show the real apps).
 *
 * - Nothing is bundled: the icon is the service's own App Store artwork, downloaded on the phone
 *   and shown as served (never redrawn, recoloured or cropped into a new mark).
 * - Order of preference in the Apps tab: the icon the connected TV supplies, then this store icon,
 *   then the house tile (offline, unknown app, or no match).
 * - Pure TS (fetch is injected for tests).
 */

export interface StoreService {
  /** Stable id used for demo apps ("svc.netflix"). */
  id: string;
  /** Display name, as on the TV. */
  name: string;
  /** Search term for the iTunes Search API. */
  term: string;
  /** Lower-case fragment the App Store title must contain (guards against look-alike apps). */
  title: string;
  /** Lower-case fragment the seller name must contain, when known. */
  seller?: string;
  /** Other names a TV may use for the same app (lower-case, normalised). */
  aliases?: readonly string[];
  /** Where the service is mainly watched (groups the demo list and the Choose apps screen). */
  region: ServiceRegion;
}

/** Main market of a service. 'global' = everywhere. */
export type ServiceRegion = 'global' | 'au' | 'us' | 'uk' | 'eu';
export const SERVICE_REGIONS: readonly ServiceRegion[] = ['global', 'au', 'us', 'uk', 'eu'];

/** Global first, then Australia, USA, UK and Europe (owner-1022: popular apps in the US and Europe). */
export const STORE_SERVICES: readonly StoreService[] = [
  // Global
  { id: 'svc.netflix', name: 'Netflix', term: 'netflix', title: 'netflix', seller: 'netflix', region: 'global' },
  { id: 'svc.youtube', name: 'YouTube', term: 'youtube', title: 'youtube', seller: 'google', region: 'global' },
  { id: 'svc.disneyplus', name: 'Disney+', term: 'disney+', title: 'disney+', seller: 'disney', aliases: ['disney plus', 'disneyplus'], region: 'global' },
  { id: 'svc.primevideo', name: 'Prime Video', term: 'amazon prime video', title: 'prime video', seller: 'amazon', aliases: ['amazon prime video', 'prime'], region: 'global' },
  { id: 'svc.appletv', name: 'Apple TV', term: 'apple tv', title: 'apple tv', seller: 'apple', region: 'global' },
  { id: 'svc.paramountplus', name: 'Paramount+', term: 'paramount+', title: 'paramount', seller: 'cbs', aliases: ['paramount plus'], region: 'global' },
  { id: 'svc.max', name: 'Max', term: 'max stream hbo', title: 'max', seller: 'warner', aliases: ['hbo max'], region: 'global' },
  { id: 'svc.spotify', name: 'Spotify', term: 'spotify', title: 'spotify', seller: 'spotify', region: 'global' },
  { id: 'svc.youtubemusic', name: 'YouTube Music', term: 'youtube music', title: 'youtube music', seller: 'google', region: 'global' },
  { id: 'svc.twitch', name: 'Twitch', term: 'twitch', title: 'twitch', seller: 'twitch', region: 'global' },
  { id: 'svc.plex', name: 'Plex', term: 'plex', title: 'plex', seller: 'plex', region: 'global' },
  { id: 'svc.crunchyroll', name: 'Crunchyroll', term: 'crunchyroll', title: 'crunchyroll', seller: 'crunchyroll', region: 'global' },
  { id: 'svc.ted', name: 'TED', term: 'ted talks', title: 'ted', seller: 'ted conferences', aliases: ['ted talks'], region: 'global' },
  { id: 'svc.dazn', name: 'DAZN', term: 'dazn', title: 'dazn', seller: 'dazn', region: 'global' },
  { id: 'svc.plutotv', name: 'Pluto TV', term: 'pluto tv', title: 'pluto', seller: 'pluto', region: 'global' },
  { id: 'svc.rakutentv', name: 'Rakuten TV', term: 'rakuten tv', title: 'rakuten', seller: 'rakuten', region: 'global' },
  { id: 'svc.mubi', name: 'MUBI', term: 'mubi', title: 'mubi', seller: 'mubi', region: 'global' },
  // Australia
  { id: 'svc.stan', name: 'Stan', term: 'stan streaming', title: 'stan', seller: 'stan', region: 'au' },
  { id: 'svc.binge', name: 'BINGE', term: 'binge', title: 'binge', seller: 'streamotion', region: 'au' },
  { id: 'svc.kayo', name: 'Kayo Sports', term: 'kayo sports', title: 'kayo', seller: 'streamotion', aliases: ['kayo'], region: 'au' },
  { id: 'svc.foxtelgo', name: 'Foxtel GO', term: 'foxtel go', title: 'foxtel', seller: 'foxtel', aliases: ['foxtel'], region: 'au' },
  { id: 'svc.iview', name: 'ABC iview', term: 'abc iview', title: 'iview', seller: 'australian broadcasting', aliases: ['iview'], region: 'au' },
  { id: 'svc.sbs', name: 'SBS On Demand', term: 'sbs on demand', title: 'sbs', seller: 'sbs', aliases: ['sbs'], region: 'au' },
  { id: 'svc.7plus', name: '7plus', term: '7plus', title: '7plus', seller: 'seven', aliases: ['7 plus'], region: 'au' },
  { id: 'svc.9now', name: '9Now', term: '9now', title: '9now', seller: 'nine', aliases: ['9 now'], region: 'au' },
  { id: 'svc.10play', name: '10 Play', term: '10 play', title: '10', seller: 'network ten', aliases: ['10play', '10'], region: 'au' },
  // USA
  { id: 'svc.hulu', name: 'Hulu', term: 'hulu', title: 'hulu', seller: 'hulu', region: 'us' },
  { id: 'svc.peacock', name: 'Peacock', term: 'peacock tv', title: 'peacock', seller: 'peacock', region: 'us' },
  { id: 'svc.youtubetv', name: 'YouTube TV', term: 'youtube tv', title: 'youtube tv', seller: 'google', region: 'us' },
  { id: 'svc.espn', name: 'ESPN', term: 'espn', title: 'espn', seller: 'espn', region: 'us' },
  { id: 'svc.sling', name: 'Sling TV', term: 'sling tv', title: 'sling', seller: 'sling', aliases: ['sling'], region: 'us' },
  { id: 'svc.fubo', name: 'Fubo', term: 'fubo', title: 'fubo', seller: 'fubo', aliases: ['fubotv'], region: 'us' },
  { id: 'svc.tubi', name: 'Tubi', term: 'tubi', title: 'tubi', seller: 'tubi', region: 'us' },
  { id: 'svc.starz', name: 'STARZ', term: 'starz', title: 'starz', seller: 'starz', region: 'us' },
  { id: 'svc.discoveryplus', name: 'discovery+', term: 'discovery+', title: 'discovery', seller: 'discovery', aliases: ['discovery plus'], region: 'us' },
  { id: 'svc.pbs', name: 'PBS', term: 'pbs video', title: 'pbs', seller: 'pbs', aliases: ['pbs video'], region: 'us' },
  { id: 'svc.philo', name: 'Philo', term: 'philo tv', title: 'philo', seller: 'philo', region: 'us' },
  // UK
  { id: 'svc.bbciplayer', name: 'BBC iPlayer', term: 'bbc iplayer', title: 'iplayer', seller: 'bbc', aliases: ['iplayer'], region: 'uk' },
  { id: 'svc.itvx', name: 'ITVX', term: 'itvx', title: 'itvx', seller: 'itv', region: 'uk' },
  { id: 'svc.channel4', name: 'Channel 4', term: 'channel 4', title: 'channel 4', seller: 'channel four', aliases: ['all 4', 'all4'], region: 'uk' },
  { id: 'svc.my5', name: 'My5', term: 'my5 channel 5', title: 'my5', seller: 'channel 5', aliases: ['5', 'channel 5'], region: 'uk' },
  { id: 'svc.nowtv', name: 'NOW', term: 'now tv', title: 'now', seller: 'sky', aliases: ['now tv'], region: 'uk' },
  { id: 'svc.skygo', name: 'Sky Go', term: 'sky go', title: 'sky go', seller: 'sky', region: 'uk' },
  { id: 'svc.britbox', name: 'BritBox', term: 'britbox', title: 'britbox', seller: 'britbox', region: 'uk' },
  // Europe
  { id: 'svc.canalplus', name: 'CANAL+', term: 'canal+', title: 'canal', seller: 'canal', aliases: ['canal plus', 'mycanal'], region: 'eu' },
  { id: 'svc.francetv', name: 'france.tv', term: 'france tv', title: 'france', seller: 'france', aliases: ['france tv'], region: 'eu' },
  { id: 'svc.arte', name: 'ARTE', term: 'arte', title: 'arte', seller: 'arte', region: 'eu' },
  { id: 'svc.ardmediathek', name: 'ARD Mediathek', term: 'ard mediathek', title: 'ard', seller: 'ard', aliases: ['ard'], region: 'eu' },
  { id: 'svc.zdf', name: 'ZDF', term: 'zdf', title: 'zdf', seller: 'zdf', aliases: ['zdfmediathek'], region: 'eu' },
  { id: 'svc.joyn', name: 'Joyn', term: 'joyn', title: 'joyn', seller: 'joyn', region: 'eu' },
  { id: 'svc.rtlplus', name: 'RTL+', term: 'rtl+', title: 'rtl', seller: 'rtl', aliases: ['rtl plus'], region: 'eu' },
  { id: 'svc.raiplay', name: 'RaiPlay', term: 'raiplay', title: 'raiplay', seller: 'rai', region: 'eu' },
  { id: 'svc.mediaset', name: 'Mediaset Infinity', term: 'mediaset infinity', title: 'mediaset', seller: 'mediaset', region: 'eu' },
  { id: 'svc.movistarplus', name: 'Movistar Plus+', term: 'movistar plus+', title: 'movistar', seller: 'telefonica', aliases: ['movistar+'], region: 'eu' },
  { id: 'svc.rtveplay', name: 'RTVE Play', term: 'rtve play', title: 'rtve', seller: 'rtve', region: 'eu' },
  { id: 'svc.npostart', name: 'NPO Start', term: 'npo start', title: 'npo', seller: 'npo', region: 'eu' },
  { id: 'svc.videoland', name: 'Videoland', term: 'videoland', title: 'videoland', seller: 'videoland', region: 'eu' },
  { id: 'svc.viaplay', name: 'Viaplay', term: 'viaplay', title: 'viaplay', seller: 'viaplay', region: 'eu' },
  { id: 'svc.svtplay', name: 'SVT Play', term: 'svt play', title: 'svt', seller: 'svt', region: 'eu' },
  { id: 'svc.nrktv', name: 'NRK TV', term: 'nrk tv', title: 'nrk', seller: 'nrk', region: 'eu' },
  { id: 'svc.drtv', name: 'DRTV', term: 'drtv', title: 'drtv', seller: 'dr', aliases: ['dr tv'], region: 'eu' },
  { id: 'svc.skyshowtime', name: 'SkyShowtime', term: 'skyshowtime', title: 'skyshowtime', seller: 'skyshowtime', region: 'eu' },
];

/** Catalogue entries for one region, in catalogue order. */
export function servicesIn(region: ServiceRegion): StoreService[] {
  return STORE_SERVICES.filter((s) => s.region === region);
}

/** Lower-case, accents and punctuation (except +) removed, single spaces. */
export function normName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The catalogue entry for a TV app (by demo id, name or alias), or null. */
export function serviceFor(app: Pick<TvApp, 'id' | 'name'>): StoreService | null {
  const byId = STORE_SERVICES.find((s) => s.id === app.id);
  if (byId) return byId;
  const n = normName(app.name);
  if (!n) return null;
  return (
    STORE_SERVICES.find((s) => normName(s.name) === n || (s.aliases ?? []).some((a) => normName(a) === n)) ?? null
  );
}

export interface StoreResult {
  trackName?: string;
  sellerName?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
}

/** Picks the matching store result: title must contain the service's title fragment, seller preferred. */
export function pickResult(svc: StoreService, results: readonly StoreResult[]): StoreResult | null {
  const ok = results.filter((r) => typeof r.trackName === 'string' && normName(r.trackName).includes(normName(svc.title)));
  if (ok.length === 0) return null;
  if (svc.seller) {
    const bySeller = ok.find((r) => typeof r.sellerName === 'string' && normName(r.sellerName).includes(normName(svc.seller!)));
    if (bySeller) return bySeller;
  }
  return ok[0] ?? null;
}

/** https artwork URL from a result (512 px preferred), or null. */
export function artworkOf(r: StoreResult | null): string | null {
  const u = r?.artworkUrl512 ?? r?.artworkUrl100;
  return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) ? u : null;
}

export function searchUrl(svc: StoreService, country: string): string {
  return `https://itunes.apple.com/search?term=${encodeURIComponent(svc.term)}&entity=software&country=${encodeURIComponent(country)}&limit=8`;
}

type FetchJson = (url: string) => Promise<unknown>;

const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
};

/** Minimal async key-value store (AsyncStorage-shaped). */
export interface IconKv {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const STORE_ICONS_KEY = 'couch.storeIcons.v1';
/** Found icons are kept on the phone this long, so each service is looked up about once a month. */
export const STORE_ICON_TTL_MS = 30 * 24 * 60 * 60_000;
/**
 * Apple's Search API allows roughly 20 requests a minute per phone. Lookups run one at a time with
 * this gap, so a TV with 40 apps never trips the limit (fb-1022e: Stan's icon vanished once the demo
 * grew to 38 apps and the burst of parallel lookups was refused).
 */
export const STORE_LOOKUP_GAP_MS = 3_100;

/**
 * Store icon lookups: memoised per service, saved on the phone for STORE_ICON_TTL_MS, failures
 * retried after retryAfterMs. Network lookups are queued (one at a time, minGapMs apart) in the order
 * they are asked for, so the caller decides priority (favourites first). Tries AU, then US.
 */
export class StoreIconSource {
  private readonly ok = new Map<string, string>();
  private readonly failedAt = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<string | null>>();
  private queue: Promise<void> = Promise.resolve();
  private lastCallAt = -Infinity;
  private kv: IconKv | null;
  private loaded: Promise<void> | null = null;
  private saved: Record<string, { uri: string; at: number }> = {};

  constructor(
    private readonly opts: {
      fetchJson?: FetchJson;
      countries?: readonly string[];
      now?: () => number;
      retryAfterMs?: number;
      minGapMs?: number;
      sleep?: (ms: number) => Promise<void>;
      kv?: IconKv | null;
    } = {},
  ) {
    this.kv = opts.kv ?? null;
  }

  /** Persist found icons in this store (the app passes AsyncStorage). */
  attachStore(kv: IconKv | null): void {
    if (this.kv || !kv) return;
    this.kv = kv;
    this.loaded = null;
  }

  /** Synchronous answer when known: a URI, null (recent failure / unknown app) or undefined. */
  peek(app: Pick<TvApp, 'id' | 'name'>): string | null | undefined {
    const svc = serviceFor(app);
    if (!svc) return null;
    const hit = this.ok.get(svc.id);
    if (hit) return hit;
    const f = this.failedAt.get(svc.id);
    if (f !== undefined && this.now() - f < (this.opts.retryAfterMs ?? 120_000)) return null;
    return undefined;
  }

  get(app: Pick<TvApp, 'id' | 'name'>): Promise<string | null> {
    const svc = serviceFor(app);
    if (!svc) return Promise.resolve(null);
    const known = this.peek(app);
    if (known !== undefined) return Promise.resolve(known);
    const running = this.inflight.get(svc.id);
    if (running) return running;
    const p = this.load()
      .then(() => this.ok.get(svc.id) ?? this.enqueue(svc))
      .then(
        (uri) => {
          this.inflight.delete(svc.id);
          if (uri) {
            if (this.ok.get(svc.id) !== uri) this.remember(svc.id, uri);
          } else this.failedAt.set(svc.id, this.now());
          return uri;
        },
        () => {
          this.inflight.delete(svc.id);
          this.failedAt.set(svc.id, this.now());
          return null;
        },
      );
    this.inflight.set(svc.id, p);
    return p;
  }

  markFailed(app: Pick<TvApp, 'id' | 'name'>): void {
    const svc = serviceFor(app);
    if (svc) {
      this.ok.delete(svc.id);
      this.failedAt.set(svc.id, this.now());
      if (this.saved[svc.id]) {
        delete this.saved[svc.id];
        this.persist();
      }
    }
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private load(): Promise<void> {
    if (!this.kv) return Promise.resolve();
    if (!this.loaded) {
      const kv = this.kv;
      this.loaded = kv
        .getItem(STORE_ICONS_KEY)
        .then((raw) => {
          const doc = raw ? (JSON.parse(raw) as unknown) : null;
          if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;
          const now = this.now();
          for (const [id, v] of Object.entries(doc as Record<string, unknown>)) {
            const e = v as { uri?: unknown; at?: unknown } | null;
            if (!e || typeof e.uri !== 'string' || typeof e.at !== 'number') continue;
            if (!/^https:\/\/[^\s]+$/i.test(e.uri) || now - e.at > STORE_ICON_TTL_MS) continue;
            this.saved[id] = { uri: e.uri, at: e.at };
            if (!this.ok.has(id)) this.ok.set(id, e.uri);
          }
        })
        .catch(() => {});
    }
    return this.loaded;
  }

  private remember(id: string, uri: string): void {
    this.ok.set(id, uri);
    this.saved[id] = { uri, at: this.now() };
    this.persist();
  }

  private persist(): void {
    if (!this.kv) return;
    void this.kv.setItem(STORE_ICONS_KEY, JSON.stringify(this.saved)).catch(() => {});
  }

  /** Runs one service's lookup in the shared queue. */
  private enqueue(svc: StoreService): Promise<string | null> {
    const run = this.queue.then(() => this.lookup(svc));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async throttle(): Promise<void> {
    const gap = this.opts.minGapMs ?? STORE_LOOKUP_GAP_MS;
    const wait = this.lastCallAt + gap - this.now();
    if (wait > 0) await (this.opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(wait);
    this.lastCallAt = this.now();
  }

  private async lookup(svc: StoreService): Promise<string | null> {
    const fetchJson = this.opts.fetchJson ?? defaultFetchJson;
    const countries = this.opts.countries ?? ['au', 'us'];
    for (const c of countries) {
      try {
        await this.throttle();
        const body = (await fetchJson(searchUrl(svc, c))) as { results?: StoreResult[] } | null;
        const uri = artworkOf(pickResult(svc, body?.results ?? []));
        if (uri) return uri;
      } catch {
        // try the next country
      }
    }
    return null;
  }
}

/** Shared instance for the app. */
export const storeIcons = new StoreIconSource();
