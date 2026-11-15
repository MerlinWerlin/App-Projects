// 1.0.0 (master review, 15 Nov 2026): what a traveller sees about where a bundled fact came from. One short line,
// "Source: Wikipedia, checked 31 Oct 2026", next to the one-line "Verify locally" warning. Never the data
// pipeline's own words (import ratings, "bundled table", "public list, not an official national source").

const NAMES: Readonly<Record<string, string>> = {
  'en.wikipedia.org': 'Wikipedia',
  'wikipedia.org': 'Wikipedia',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A readable name for a source host: "Wikipedia" for en.wikipedia.org, otherwise the host without "www.". */
export function sourceName(host: string): string {
  const h = String(host ?? '').trim().toLowerCase().replace(/^www\./, '');
  return NAMES[h] ?? h;
}

/** "2026-10-31" -> "31 Oct 2026"; anything else is returned as given. */
export function checkedDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return String(iso ?? '');
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return iso;
  return `${Number(m[3])} ${MONTHS[mo - 1]} ${m[1]}`;
}

/** Words from the data pipeline that never reach the screen. */
const PIPELINE = /\bsource\b|\bofficial\b|\bbundled\b|\bimport(ed|'s|’s)?\b|\bpublic list\b|\bconfidence\b|\btable\b/i;

/** A table note as the traveller should see it: only its useful sentences ("119 serves ambulance and fire"). */
export function travellerNote(note: string | null | undefined): string {
  const sentences = String(note ?? '')
    .split(/(?<=[.;!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.filter((s) => !PIPELINE.test(s)).join(' ');
}
