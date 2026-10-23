/**
 * The phone's own Wi-Fi IPv4, for the automatic subnet probe (no IP typing). The provider is injected
 * (src/native/network.ts wraps expo-network); this module only validates what it returns. Only a
 * literal RFC 1918 address is accepted: a carrier, loopback, link-local or "0.0.0.0" answer (no Wi-Fi)
 * means "unknown", and the probe is skipped. Never throws.
 */
import { isRfc1918Host } from './lanHost';

/** Returns the phone's Wi-Fi IPv4 address, or null when unknown. May reject; callers guard it. */
export type PhoneIpProvider = () => Promise<string | null>;

export const PHONE_IP_TIMEOUT_MS = 1500;

/** The provider's address if it is a private LAN IPv4 (trimmed), else null. Never throws. */
export async function resolvePhoneIp(
  provider: PhoneIpProvider | null | undefined,
  opts: { timeoutMs?: number } = {},
): Promise<string | null> {
  if (!provider) return null;
  const timeoutMs = opts.timeoutMs ?? PHONE_IP_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const ip = await Promise.race([Promise.resolve().then(provider), timeout]);
    return validPhoneIp(ip);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** A trimmed RFC 1918 IPv4 string, or null for anything else. */
export function validPhoneIp(ip: unknown): string | null {
  if (typeof ip !== 'string') return null;
  const s = ip.trim();
  return isRfc1918Host(s) ? s : null;
}
