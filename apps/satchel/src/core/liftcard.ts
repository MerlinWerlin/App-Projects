// T157: "Where is the lift?" as a full-screen phrase card (app/phrase-card.tsx?phrase=lift), the way the Toilets tab's
// "Ask for a toilet" opens "Where is the toilet?". The line is the step-free card's own `liftAsk` sentence from
// src/content/stepfree_lines.json, in the phrase screen's languages (the same twelve), with a `roman` guide added for
// non-Latin scripts. Every one of those lines is marked "check": true (written by the model, not yet read by a native
// speaker), and the card says so: nothing here claims a line was verified. Pure TypeScript, fully offline.
import { findLanguage, isPhraseId, type PhraseId, type PhraseLang, type PhraseTable } from './phrases.ts';
import { hasAccessNeeds, type StepFreePrefs, type StepFreeTable } from './stepfree.ts';

/** The phrase-card route param that opens the lift card instead of the stepped phrase list. */
export const LIFT_CARD = 'lift';
const LIFT_LINE = 'liftAsk';

export type LiftCard = {
  lang: PhraseLang;
  english: string;
  text: string;
  /** How to say it, for non-Latin scripts; null for Latin ones. */
  roman: string | null;
  /** True until a native speaker has read the line (always true today). */
  check: boolean;
};

/** The lift card in a language, or null when the table has no line for it. Latin-ness comes from the phrase table. */
export function liftCard(sf: StepFreeTable, phrases: PhraseTable, lang: PhraseLang): LiftCard | null {
  const english = sf.sentences.find((s) => s.id === LIFT_LINE)?.en?.trim();
  const line = sf.languages.find((l) => l.code === lang)?.lines[LIFT_LINE];
  const text = line?.text?.trim();
  if (!english || !line || !text) return null;
  const latin = findLanguage(phrases, lang)?.latin ?? true;
  // Anything not explicitly marked checked is shown as unchecked: a missing flag never reads as verified.
  return { lang, english, text, roman: latin ? null : line.roman?.trim() || null, check: line.check !== false };
}

/** What a phrase-card ?phrase= param asks for: the lift card, one of the phrase list's cards, or nothing known. */
export function parseCardParam(v: unknown): { kind: 'lift' } | { kind: 'phrase'; id: PhraseId } | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === LIFT_CARD) return { kind: 'lift' };
  return isPhraseId(s) ? { kind: 'phrase', id: s } : null;
}

/** Content problems (empty = good): every phrase language has the lift line, romanised when non-Latin, marked for a check. */
export function liftCardProblems(sf: StepFreeTable, phrases: PhraseTable): string[] {
  const out: string[] = [];
  if (!sf.sentences.some((s) => s.id === LIFT_LINE && s.en?.trim())) out.push('no English lift line');
  for (const l of phrases.languages) {
    const line = sf.languages.find((x) => x.code === l.code)?.lines[LIFT_LINE];
    if (!line?.text?.trim()) {
      out.push(`${l.code}: no lift line`);
      continue;
    }
    if (line.check !== true) out.push(`${l.code}: lift line not marked for a native-speaker check`);
    if (!l.latin && !line.roman?.trim()) out.push(`${l.code}: lift line has no romanisation`);
    if (l.latin && line.roman) out.push(`${l.code}: Latin-script lift line should not carry a romanisation`);
  }
  return out;
}

/**
 * Whether the Map offers "Ask for a lift" under the Layers button: only while the Lifts kind of place is switched on,
 * and then when the downloaded city has lifts to show or access needs are set on this phone (so it doesn't sit under
 * every map for everyone while packs carry no lifts yet).
 */
export function showLiftAsk(liftsOn: boolean, liftCount: number, prefs: Pick<StepFreePrefs, 'needs'> | null | undefined): boolean {
  return liftsOn && (liftCount > 0 || hasAccessNeeds(prefs));
}
