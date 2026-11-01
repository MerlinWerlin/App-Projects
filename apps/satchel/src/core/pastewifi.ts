// T112 (run-97 follow-up): Wi-Fi network and password lines in a pasted hotel confirmation, so Paste a booking can
// offer to fill the booking's Stay details (src/core/staydetails.ts, phone-only). Pure TypeScript, no RN imports.
//
// Reads labelled lines only, never guesses from free text:
//   "Wi-Fi network: Harbour Guest"   "WiFi name: Harbour Guest"   "SSID: Harbour Guest"   "Network: Harbour Guest"
//   "Wi-Fi password: sea;breeze"      "WLAN key: ..."              "Wi-Fi: Harbour Guest / Password: sea breeze"
// A bare "Password:" (or "Key:") only counts when a Wi-Fi word is on the same line or a Wi-Fi network was
// found within the two lines above, so an account password in the same email isn't taken for the Wi-Fi.
// Values like "free", "available" or "in all rooms" are not network names. Nothing found -> null.
import { LIMITS } from './staydetails.ts';

export type PastedWifi = { name: string; password: string };

const WIFI = '(?:wi[\\s-]?fi|wlan|wireless(?:\\s+internet)?|internet)';
const NAME_LABEL = new RegExp(`^\\s*(?:${WIFI}\\s*(?:network(?:\\s+name)?|name|ssid)?|network(?:\\s+name)?|ssid)\\s*(?:\\(ssid\\))?\\s*[:=]\\s*(.+)$`, 'i');
const PASS_IN_LINE = new RegExp(`(?:\\b${WIFI}\\s*(?:password|passcode|pass|pw|key|code)|\\bpassword|\\bpasscode|\\bpw)\\s*[:=]\\s*(.+)$`, 'i');
const WIFI_WORD = new RegExp(`\\b${WIFI}\\b|\\bssid\\b`, 'i');
const BARE_PASS = /^\s*(?:password|passcode|pw|key)\s*[:=]\s*(.+)$/i;
/** Words that describe Wi-Fi rather than name a network. */
const NOT_A_NAME = /^(?:free|complimentary|included|available|yes|no|none|n\/a|high[\s-]?speed|in all rooms|throughout|on request|ask (?:at )?reception|see .*|provided)\b/i;
const NOT_A_PASSWORD = /^(?:none|no password|not required|n\/a|open|ask (?:at )?reception|see .*|on request|provided at check[\s-]?in)\b/i;

/** Quotes and the label-ending punctuation off a value; passwords keep inner spaces and symbols. */
function cleanValue(v: string): string {
  let s = v.trim();
  const q = /^(["'“‘«])(.*)(["'”’»])$/.exec(s);
  if (q) s = q[2];
  return s.trim();
}

/** "Harbour Guest / Password: x", "Harbour Guest, password x": the part before the password label. */
function splitNameAndPass(value: string): { name: string; password: string } {
  const m =
    /^(.*?)\s*[/|,;·-]?\s*\b(?:password|passcode|pass|pw|key|code)\s*[:=]\s*(.+)$/i.exec(value) ??
    /^(.*?)\s*[/|,;·]\s*(?:password|passcode|pw)\s+(.+)$/i.exec(value);
  if (m && m[1].trim()) return { name: m[1].trim(), password: m[2] };
  return { name: value, password: '' };
}

const okName = (s: string) => !!s && s.length <= LIMITS.wifiName && !NOT_A_NAME.test(s);
const okPassword = (s: string) => !!s && s.length <= LIMITS.wifiPassword && !NOT_A_PASSWORD.test(s) && !/\s{2,}/.test(s);

/** The Wi-Fi network and password in these lines (first ones found), or null when neither is there. */
export function findWifi(lines: readonly string[]): PastedWifi | null {
  let name = '';
  let password = '';
  let nameLine = -99;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!name) {
      const m = NAME_LABEL.exec(line);
      if (m && !/password|passcode|\bkey\b/i.test(line.slice(0, line.indexOf(m[1])))) {
        const parts = splitNameAndPass(m[1]);
        const n = cleanValue(parts.name);
        if (okName(n)) {
          name = n;
          nameLine = i;
          const p = cleanValue(parts.password);
          if (!password && okPassword(p)) password = p;
          continue;
        }
      }
    }
    if (!password) {
      const wifiHere = WIFI_WORD.test(line);
      const near = !!name && i - nameLine <= 2;
      const m = wifiHere ? PASS_IN_LINE.exec(line) : near ? BARE_PASS.exec(line) : null;
      if (m) {
        const p = cleanValue(m[1]);
        if (okPassword(p)) password = p;
      }
    }
  }
  return name || password ? { name, password } : null;
}

/**
 * Stay details with the pasted Wi-Fi filled in where they are still empty (a saved network or password is never
 * overwritten; a password is only added to the same network, or when no network is saved). Null when nothing changes.
 */
export function withPastedWifi<S extends { wifiName: string; wifiPassword: string; wifiSecurity: string }>(stay: S, wifi: PastedWifi): S | null {
  const next = { ...stay };
  if (!next.wifiName && wifi.name) next.wifiName = wifi.name.slice(0, LIMITS.wifiName);
  const sameNetwork = !stay.wifiName || stay.wifiName === wifi.name;
  if (!next.wifiPassword && wifi.password && sameNetwork) next.wifiPassword = wifi.password.slice(0, LIMITS.wifiPassword);
  if (next.wifiName === stay.wifiName && next.wifiPassword === stay.wifiPassword) return null;
  return next;
}
