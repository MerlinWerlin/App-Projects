// US <-> UK crochet terminology. Pure TS (runs in Node tests and the app).
//
// The same abbreviation means different stitches in the two systems ("dc" is a US double crochet but a UK
// treble's shorter cousin), so conversion is done in ONE pass with a combined regex: every match is looked up
// in the table for the source system, never re-converted.

export type Terms = 'US' | 'UK';

/** [US, UK] pairs. Longest phrases first so "half double crochet" wins over "double crochet". */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['half double crochet', 'half treble crochet'],
  ['double treble crochet', 'triple treble crochet'],
  ['single crochet', 'double crochet'],
  ['double crochet', 'treble crochet'],
  ['treble crochet', 'double treble crochet'],
  ['triple crochet', 'double treble crochet'],
  ['slip stitch', 'slip stitch'],
  ['yarn over', 'yarn round hook'],
  ['skip', 'miss'],
  ['gauge', 'tension'],
  ['sc2tog', 'dc2tog'],
  ['sc3tog', 'dc3tog'],
  ['hdc2tog', 'htr2tog'],
  ['hdc3tog', 'htr3tog'],
  ['dc2tog', 'tr2tog'],
  ['dc3tog', 'tr3tog'],
  ['dc4tog', 'tr4tog'],
  ['dc5tog', 'tr5tog'],
  ['tr2tog', 'dtr2tog'],
  ['fpsc', 'fpdc'],
  ['bpsc', 'bpdc'],
  ['fphdc', 'fphtr'],
  ['bphdc', 'bphtr'],
  ['fpdc', 'fptr'],
  ['bpdc', 'bptr'],
  ['fptr', 'fpdtr'],
  ['bptr', 'bpdtr'],
  ['hdc', 'htr'],
  ['dtr', 'trtr'],
  ['sc', 'dc'],
  ['dc', 'tr'],
  ['tr', 'dtr'],
  ['sl st', 'ss'],
  ['yo', 'yrh'],
  ['sk', 'miss'],
];

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
}

function buildTable(from: Terms): { re: RegExp; map: Map<string, string> } {
  const map = new Map<string, string>();
  const keys: string[] = [];
  for (const [us, uk] of PAIRS) {
    const src = from === 'US' ? us : uk;
    const dst = from === 'US' ? uk : us;
    // First pair wins for a given source key (e.g. UK "double treble crochet" -> US "treble crochet").
    if (map.has(src)) continue;
    map.set(src, dst);
    keys.push(src);
  }
  keys.sort((a, b) => b.length - a.length);
  // Word-ish boundaries: letters/digits must not touch the match ("dec" never matches "dc").
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${keys.map(escape).join('|')})(?![A-Za-z])`, 'gi');
  return { re, map };
}

const TABLES: Record<Terms, { re: RegExp; map: Map<string, string> }> = {
  US: buildTable('US'),
  UK: buildTable('UK'),
};

function matchCase(src: string, out: string): string {
  if (src.length > 1 && src === src.toUpperCase()) return out.toUpperCase();
  if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) {
    return out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

/** Convert pattern text between US and UK terms in a single pass. */
export function convertTerms(text: string, from: Terms, to: Terms): string {
  if (from === to) return text;
  const { re, map } = TABLES[from];
  re.lastIndex = 0;
  return text.replace(re, (m) => {
    const key = m.toLowerCase().replace(/\s+/g, ' ');
    const out = map.get(key);
    return out === undefined ? m : matchCase(m, out);
  });
}

/**
 * Guess which terms a pattern uses. US-only words: sc, hdc, single crochet, skip, gauge.
 * UK-only: htr, ss, miss, tension, yrh, "double crochet" without any single crochet.
 */
export function detectTerms(text: string): Terms | 'unknown' {
  const t = text.toLowerCase();
  let us = 0;
  let uk = 0;
  const count = (re: RegExp) => (t.match(re) || []).length;
  us += count(/(?<![a-z])sc(?:\d?tog)?(?![a-z])/g) * 2;
  us += count(/(?<![a-z])hdc(?![a-z])/g) * 2;
  us += count(/single crochet/g) * 2;
  us += count(/(?<![a-z])(?:skip|gauge)(?![a-z])/g);
  uk += count(/(?<![a-z])htr(?![a-z])/g) * 2;
  uk += count(/(?<![a-z])(?:ss|yrh)(?![a-z])/g);
  uk += count(/(?<![a-z])(?:miss|tension)(?![a-z])/g);
  uk += count(/uk terms/g) * 5;
  us += count(/us terms/g) * 5;
  if (us === 0 && uk === 0) return 'unknown';
  if (us === uk) return 'unknown';
  return us > uk ? 'US' : 'UK';
}

export interface StitchEntry {
  /** US abbreviation (the key). */
  us: string;
  /** UK abbreviation. */
  uk: string;
  usName: string;
  ukName: string;
  /** Short how-to in plain words (US terms; the UI converts when UK is chosen). */
  how: string;
  level: 'basic' | 'easy' | 'intermediate';
  /** Height in chains (turning chain), when it makes sense. */
  turningCh?: number;
}

/** Built-in stitch glossary. Plain-words instructions written for this app. */
export const STITCHES: ReadonlyArray<StitchEntry> = [
  { us: 'ch', uk: 'ch', usName: 'Chain', ukName: 'Chain', level: 'basic', how: 'Yarn over and pull through the loop on your hook.' },
  { us: 'sl st', uk: 'ss', usName: 'Slip stitch', ukName: 'Slip stitch', level: 'basic', how: 'Insert hook, yarn over, pull through the stitch and the loop on your hook in one go.' },
  { us: 'sc', uk: 'dc', usName: 'Single crochet', ukName: 'Double crochet', level: 'basic', turningCh: 1, how: 'Insert hook, yarn over, pull up a loop (2 loops), yarn over, pull through both.' },
  { us: 'hdc', uk: 'htr', usName: 'Half double crochet', ukName: 'Half treble', level: 'basic', turningCh: 2, how: 'Yarn over, insert hook, yarn over, pull up a loop (3 loops), yarn over, pull through all 3.' },
  { us: 'dc', uk: 'tr', usName: 'Double crochet', ukName: 'Treble', level: 'basic', turningCh: 3, how: 'Yarn over, insert hook, pull up a loop (3 loops), [yarn over, pull through 2] twice.' },
  { us: 'tr', uk: 'dtr', usName: 'Treble (triple) crochet', ukName: 'Double treble', level: 'easy', turningCh: 4, how: 'Yarn over twice, insert hook, pull up a loop (4 loops), [yarn over, pull through 2] three times.' },
  { us: 'dtr', uk: 'trtr', usName: 'Double treble', ukName: 'Triple treble', level: 'intermediate', turningCh: 5, how: 'Yarn over three times, insert hook, pull up a loop, [yarn over, pull through 2] four times.' },
  { us: 'inc', uk: 'inc', usName: 'Increase', ukName: 'Increase', level: 'basic', how: 'Work 2 stitches into the same stitch.' },
  { us: 'dec', uk: 'dec', usName: 'Decrease', ukName: 'Decrease', level: 'basic', how: 'Work 2 stitches together so they become 1 (sc2tog, or an invisible decrease in amigurumi).' },
  { us: 'invdec', uk: 'invdec', usName: 'Invisible decrease', ukName: 'Invisible decrease', level: 'easy', how: 'Insert hook in the front loop only of the next 2 stitches, yarn over, pull through both front loops, yarn over, pull through 2.' },
  { us: 'sc2tog', uk: 'dc2tog', usName: 'Single crochet 2 together', ukName: 'Double crochet 2 together', level: 'easy', how: 'Pull up a loop in each of the next 2 stitches (3 loops), yarn over, pull through all 3.' },
  { us: 'dc2tog', uk: 'tr2tog', usName: 'Double crochet 2 together', ukName: 'Treble 2 together', level: 'easy', how: '[Yarn over, insert, pull up a loop, yarn over, pull through 2] in each of the next 2 stitches, yarn over, pull through all 3.' },
  { us: 'MR', uk: 'MR', usName: 'Magic ring', ukName: 'Magic ring', level: 'easy', how: 'Wrap the yarn into a loop, work the first round into the loop, then pull the tail to close the centre.' },
  { us: 'BLO', uk: 'BLO', usName: 'Back loop only', ukName: 'Back loop only', level: 'basic', how: 'Work into the back loop of the stitch only. Makes a ridge on the front.' },
  { us: 'FLO', uk: 'FLO', usName: 'Front loop only', ukName: 'Front loop only', level: 'basic', how: 'Work into the front loop of the stitch only.' },
  { us: 'yo', uk: 'yrh', usName: 'Yarn over', ukName: 'Yarn round hook', level: 'basic', how: 'Wrap the yarn over the hook from back to front.' },
  { us: 'sk', uk: 'miss', usName: 'Skip', ukName: 'Miss', level: 'basic', how: 'Leave the next stitch unworked.' },
  { us: 'sp', uk: 'sp', usName: 'Space', ukName: 'Space', level: 'basic', how: 'The gap made by chains or skipped stitches; work into the space, not a stitch.' },
  { us: 'ch-sp', uk: 'ch-sp', usName: 'Chain space', ukName: 'Chain space', level: 'basic', how: 'The space under a chain; insert your hook under the chain itself.' },
  { us: 'st', uk: 'st', usName: 'Stitch', ukName: 'Stitch', level: 'basic', how: 'One stitch.' },
  { us: 'RS', uk: 'RS', usName: 'Right side', ukName: 'Right side', level: 'basic', how: 'The side that will face out.' },
  { us: 'WS', uk: 'WS', usName: 'Wrong side', ukName: 'Wrong side', level: 'basic', how: 'The side that will face in.' },
  { us: 'FO', uk: 'FO', usName: 'Fasten off', ukName: 'Fasten off', level: 'basic', how: 'Cut the yarn and pull the tail through the last loop to lock it.' },
  { us: 'fpdc', uk: 'fptr', usName: 'Front post double crochet', ukName: 'Front post treble', level: 'intermediate', how: 'Yarn over, insert hook from front to back to front around the post of the stitch, then finish as a double crochet.' },
  { us: 'bpdc', uk: 'bptr', usName: 'Back post double crochet', ukName: 'Back post treble', level: 'intermediate', how: 'Yarn over, insert hook from back to front to back around the post, then finish as a double crochet.' },
  { us: 'puff', uk: 'puff', usName: 'Puff stitch', ukName: 'Puff stitch', level: 'intermediate', how: '[Yarn over, insert, pull up a long loop] 3-5 times in the same stitch, yarn over, pull through all loops, chain 1 to close.' },
  { us: 'bobble', uk: 'bobble', usName: 'Bobble', ukName: 'Bobble', level: 'intermediate', how: 'Work 5 unfinished double crochets in one stitch (leave the last loop of each on the hook), yarn over, pull through all.' },
  { us: 'pc', uk: 'pc', usName: 'Popcorn', ukName: 'Popcorn', level: 'intermediate', how: 'Work 5 double crochets in one stitch, drop the loop, insert hook in the first one, pick up the dropped loop and pull through.' },
  { us: 'shell', uk: 'shell', usName: 'Shell', ukName: 'Shell', level: 'easy', how: 'Several tall stitches (often 5 dc) worked into the same stitch, fanning out.' },
  { us: 'V-st', uk: 'V-st', usName: 'V-stitch', ukName: 'V-stitch', level: 'easy', how: '(dc, ch 1, dc) in the same stitch.' },
  { us: 'cl', uk: 'cl', usName: 'Cluster', ukName: 'Cluster', level: 'intermediate', how: 'Several partly-made stitches finished together at the top.' },
  { us: 'rev sc', uk: 'rev dc', usName: 'Reverse single crochet (crab stitch)', ukName: 'Crab stitch', level: 'intermediate', how: 'Work single crochet from left to right (right-handed) for a corded edge.' },
  { us: 'tch', uk: 'tch', usName: 'Turning chain', ukName: 'Turning chain', level: 'basic', how: 'Chains made at the start of a row to reach the height of the stitches.' },
  { us: 'rep', uk: 'rep', usName: 'Repeat', ukName: 'Repeat', level: 'basic', how: 'Work the instructions again as shown.' },
];

export function stitchName(e: StitchEntry, terms: Terms): string {
  return terms === 'US' ? e.usName : e.ukName;
}

export function stitchAbbrev(e: StitchEntry, terms: Terms): string {
  return terms === 'US' ? e.us : e.uk;
}

/** Search the glossary by abbreviation or name in either system. */
export function searchStitches(q: string): StitchEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return STITCHES.slice();
  return STITCHES.filter(
    (e) =>
      e.us.toLowerCase() === s ||
      e.uk.toLowerCase() === s ||
      e.usName.toLowerCase().includes(s) ||
      e.ukName.toLowerCase().includes(s) ||
      e.us.toLowerCase().startsWith(s) ||
      e.uk.toLowerCase().startsWith(s),
  );
}
