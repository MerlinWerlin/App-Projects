/** Source helpers. Only standards bodies, regulators and government pages are linked in the UI (no brands). */
import type { Source, Verified } from './types';

export const s = (label: string, url: string, verified: Verified = 'primary'): Source => ({ label, url, verified });

const PUBLIC_HOSTS = [
  'gov.au', 'govt.nz', 'gov.uk', 'gov.ie', 'osha.gov', 'hse.gov.uk', 'hsa.ie', 'irishstatutebook.ie', 'nsai.ie',
  'abcb.gov.au', 'safeworkaustralia.gov.au', 'worksafe.govt.nz', 'building.govt.nz', 'niwa.co.nz', 'bom.gov.au',
  'bcpublications.ca', 'worksafebc.com', 'metalroofing.org.nz', 'standards.org.au', 'bsigroup.com', 'ontario.ca',
];

/** True when the URL belongs to a regulator, standards body or government site (safe to link in the UI). */
export function isPublicSource(url: string): boolean {
  const host = /^https?:\/\/([^/]+)/i.exec(url)?.[1]?.toLowerCase() ?? '';
  return PUBLIC_HOSTS.some(h => host === h || host.endsWith('.' + h) || host.endsWith(h));
}

export const VERIFIED_LABEL: Record<Verified, string> = {
  primary: 'From the standard, code or maker’s data sheet',
  secondary: 'From a secondary source',
  unverified: 'Not verified: check locally',
};
