/**
 * Tiny XML helpers for UPnP (T76). Pure TypeScript: React Native has no DOMParser, and UPnP device
 * descriptions / SOAP replies are flat enough that namespace-agnostic element matching is enough.
 * Not a general XML parser: it does not handle nested elements with the same name (callers only
 * ask for leaf elements such as friendlyName, controlURL or CurrentTransportState, or for
 * <service> blocks, which never nest).
 */

/** Escapes a value for XML text or a double- or single-quoted attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Decodes the five predefined entities and numeric character references. &amp; is decoded last. */
export function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (m, h: string) => fromCodePoint(parseInt(h, 16), m))
    .replace(/&#([0-9]+);/g, (m, d: string) => fromCodePoint(parseInt(d, 10), m))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function fromCodePoint(cp: number, fallback: string): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return fallback;
  return String.fromCodePoint(cp);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Raw inner XML of every element with this local name (any or no namespace prefix). */
export function elementsXml(xml: string, localName: string): string[] {
  const n = escapeRe(localName);
  const re = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${n}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${n}\\s*>)`, 'g');
  const out: string[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1] ?? '');
  return out;
}

/** Text of an element body: CDATA kept verbatim, everything else entity-decoded, trimmed. */
export function textContent(inner: string): string {
  let out = '';
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let last = 0;
  for (let m = re.exec(inner); m; m = re.exec(inner)) {
    out += unescapeXml(inner.slice(last, m.index)) + (m[1] ?? '');
    last = m.index + m[0].length;
  }
  out += unescapeXml(inner.slice(last));
  return out.trim();
}

/** Text of the first element with this local name, or null when there is none. */
export function firstText(xml: string, localName: string): string | null {
  const els = elementsXml(xml, localName);
  return els.length > 0 ? textContent(els[0]!) : null;
}
