/**
 * Lost-remote help for the add-TV flow (T71, docs/MARKET.md "What users hate" #6, takeaway 4).
 *
 * People often install a remote app because the physical remote is lost, but some TVs need a
 * confirmation on the TV itself the first time:
 *   - 'allow': the TV shows "Allow this device?" and someone must select Allow on the TV
 *     (Samsung Tizen, LG webOS).
 *   - 'pin':   the TV shows a code or PIN that is typed into the phone. Nothing has to be pressed on
 *     the TV (Google TV, Fire TV, Vizio, Philips).
 *   - 'key':   a Pre-Shared Key is set in the TV's own menus (Sony Bravia), so the TV's menus must be
 *     reached once.
 *   - 'none':  no TV-side step (Roku ECP, infrared, the demo TV).
 * `needsPhysicalRemoteOnce` is true when the first pairing needs input on the TV (its remote, or the
 * TV's own buttons). Derived from what each driver's pairing does (src/core/drivers/*), not from
 * hardware testing. Pure: no React Native, no I/O; the screen maps the result to catalogue copy.
 */
import { FETCH_ONLY_CAPS, irSetupOffered, isSupported, type AddCandidate, type TransportCaps } from './addTv';
import { PLATFORM_LABEL, type Platform } from './types';

export type PairingNoticeKind = 'allow' | 'pin' | 'key' | 'none';

export interface PairingNotice {
  kind: PairingNoticeKind;
  /** The first pairing needs input on the TV itself (its remote or its own buttons). */
  needsPhysicalRemoteOnce: boolean;
}

const NOTICES: Record<Platform, PairingNotice> = {
  roku: { kind: 'none', needsPhysicalRemoteOnce: false },
  samsung: { kind: 'allow', needsPhysicalRemoteOnce: true },
  webos: { kind: 'allow', needsPhysicalRemoteOnce: true },
  androidtv: { kind: 'pin', needsPhysicalRemoteOnce: false },
  firetv: { kind: 'pin', needsPhysicalRemoteOnce: false },
  vizio: { kind: 'pin', needsPhysicalRemoteOnce: false },
  philips: { kind: 'pin', needsPhysicalRemoteOnce: false },
  sony: { kind: 'key', needsPhysicalRemoteOnce: true },
  ir: { kind: 'none', needsPhysicalRemoteOnce: false },
  mock: { kind: 'none', needsPhysicalRemoteOnce: false },
};

/** What the TV of `platform` asks for on first pairing. */
export function pairingNotice(platform: Platform): PairingNotice {
  const n = NOTICES[platform] ?? NOTICES.mock;
  return { kind: n.kind, needsPhysicalRemoteOnce: n.needsPhysicalRemoteOnce };
}

/** Same for a found TV; demo candidates walk through their `pairAs` platform. */
export function candidateNotice(c: Pick<AddCandidate, 'platform' | 'pairAs'>): PairingNotice {
  return pairingNotice(c.pairAs ?? c.platform);
}

/** Real platforms in display order (not 'ir' or 'mock'). */
const REAL_PLATFORMS: readonly Platform[] = ['roku', 'samsung', 'webos', 'sony', 'androidtv', 'firetv', 'vizio', 'philips'];

export interface LostRemoteHelp {
  /** Platforms Couch can pair with right now (this transport) that need nothing pressed on the TV. */
  noConfirm: Platform[];
  /** Platforms Couch can pair with right now whose first pairing needs input on the TV once. */
  needsTvOnce: Platform[];
  /** A Wake-on-LAN sender exists in this build (TVs already paired, with a known MAC). */
  wake: boolean;
  /** Offer the infrared path (Android only; the IR screen says when the phone has no emitter). */
  ir: boolean;
}

/**
 * Content of the "Lost your remote?" sheet. Only platforms Couch can control with the given
 * transport are listed, so it never promises a TV the app cannot reach yet.
 */
export function lostRemoteHelp(opts: { os: string; caps?: TransportCaps | undefined; hasUdpSender: boolean }): LostRemoteHelp {
  const caps = opts.caps ?? FETCH_ONLY_CAPS;
  const usable = REAL_PLATFORMS.filter((p) => isSupported(p, caps));
  return {
    noConfirm: usable.filter((p) => !pairingNotice(p).needsPhysicalRemoteOnce),
    needsTvOnce: usable.filter((p) => pairingNotice(p).needsPhysicalRemoteOnce),
    wake: opts.hasUdpSender,
    ir: irSetupOffered(opts.os),
  };
}

/**
 * "Roku, Samsung and LG": platform names (data, not translated) joined for the active language with
 * Intl.ListFormat when the engine has it, else with ", ".
 */
export function platformList(platforms: readonly Platform[], bcp47: string): string {
  const names = platforms.map((p) => PLATFORM_LABEL[p]);
  try {
    const LF = (Intl as unknown as { ListFormat?: new (l: string, o: object) => { format(items: string[]): string } }).ListFormat;
    if (LF) return new LF(bcp47, { style: 'long', type: 'conjunction' }).format(names);
  } catch {
    // Unknown tag or no ListFormat: fall through.
  }
  return names.join(', ');
}
