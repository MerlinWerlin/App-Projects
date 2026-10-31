// T78 When things go wrong: offline step-by-step guides (lost passport, lost card, lost phone, theft report, missed
// flight, delayed bag, medical problem, scam) opened from the Emergency tab, plus "My important numbers" (card-block
// lines, embassy, airline, accommodation, other) kept on this phone only. Pure TypeScript: the guide structure comes
// from src/content/troubles.json (passed in by the caller), the words from the i18n catalogue (trouble.*).
//
// Each step can offer actions that use what the traveller already saved: the local emergency number for the
// Emergency tab's country, the insurer and contacts on the emergency card, a group of important numbers, a vault
// document, the hotel address card, a phrase card, or Nearest help. `stepActions` turns a step's action list into
// what the screen can show right now: something to tap, a "set it up" link, or nothing.
//
// Privacy: important numbers live under IMPORTANT_NUMBERS_KEY on this phone. The .satchel trip file (tripfile.ts)
// only ever sees one trip, so they never go in it, like the emergency card.
import { FALLBACK_NUMBER, telUri, type RowDisplay, type Service } from './emergency.ts';
import type { DocKind, EmergencyCard } from './model.ts';

// ------------------------------------------------------------------ content

export const TROUBLE_TONES = ['sea', 'teal', 'ok', 'warn', 'danger', 'accent'] as const;
export type TroubleTone = (typeof TROUBLE_TONES)[number];

export type TroubleStep = { id: string; actions: string[] };
export type TroubleGuide = { id: string; icon: string; tone: TroubleTone; steps: TroubleStep[] };
export type TroubleTable = { version: number; checked?: string; note?: string; guides: TroubleGuide[] };

export const MIN_STEPS = 5;
export const MAX_STEPS = 9;

/** The line every guide shows under its title. */
export const GUIDANCE_KEY = 'trouble.guidance';

export const findGuide = (table: TroubleTable, id: string | null | undefined): TroubleGuide | null =>
  (id ? table.guides.find((g) => g.id === id) : undefined) ?? null;

export const guideTitleKey = (g: Pick<TroubleGuide, 'id'>) => `trouble.guide.${g.id}.title`;
export const guideSummaryKey = (g: Pick<TroubleGuide, 'id'>) => `trouble.guide.${g.id}.summary`;
export const stepTitleKey = (g: Pick<TroubleGuide, 'id'>, s: Pick<TroubleStep, 'id'>) => `trouble.step.${g.id}.${s.id}.title`;
export const stepBodyKey = (g: Pick<TroubleGuide, 'id'>, s: Pick<TroubleStep, 'id'>) => `trouble.step.${g.id}.${s.id}.body`;

/** Every catalogue key a guide screen shows, in reading order (title, summary, the guidance line, each step). */
export function guideKeys(g: TroubleGuide): string[] {
  return [guideTitleKey(g), guideSummaryKey(g), GUIDANCE_KEY, ...g.steps.flatMap((s) => [stepTitleKey(g, s), stepBodyKey(g, s)])];
}

// ------------------------------------------------------------------ actions

export const CALL_SERVICES = ['police', 'ambulance', 'general'] as const;
export type CallService = (typeof CALL_SERVICES)[number];

export const NUMBER_GROUPS = ['cardBlock', 'embassy', 'airline', 'accommodation', 'other'] as const;
export type NumberGroup = (typeof NUMBER_GROUPS)[number];
export const isNumberGroup = (v: unknown): v is NumberGroup => typeof v === 'string' && (NUMBER_GROUPS as readonly string[]).includes(v);

const DOC_KINDS: readonly DocKind[] = ['passport', 'visa', 'licence', 'insurance', 'other'];

export type StepAction =
  | { type: 'call'; service: CallService }
  | { type: 'insurer' }
  | { type: 'contact' }
  | { type: 'numbers'; group: NumberGroup }
  | { type: 'vault'; kind: DocKind }
  | { type: 'hotel' }
  | { type: 'phrase'; phrase: string }
  | { type: 'help' };

/** "call:police", "numbers:embassy", "vault:passport", "phrase:police", "insurer"... Null for anything unknown. */
export function parseAction(raw: string): StepAction | null {
  const [type, arg, extra] = String(raw ?? '').split(':');
  if (extra !== undefined) return null;
  switch (type) {
    case 'call':
      return (CALL_SERVICES as readonly string[]).includes(arg) ? { type: 'call', service: arg as CallService } : null;
    case 'numbers':
      return isNumberGroup(arg) ? { type: 'numbers', group: arg } : null;
    case 'vault':
      return (DOC_KINDS as readonly string[]).includes(arg) ? { type: 'vault', kind: arg as DocKind } : null;
    case 'phrase':
      return arg && /^[A-Za-z]+$/.test(arg) ? { type: 'phrase', phrase: arg } : null;
    case 'insurer':
    case 'contact':
    case 'hotel':
    case 'help':
      return arg === undefined ? { type } : null;
    default:
      return null;
  }
}

/** Everything wrong with a table: bad ids, step counts outside 5–9, duplicate ids, unknown actions or phrases. */
export function checkTable(table: TroubleTable, phraseIds: readonly string[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const g of table.guides) {
    if (!/^[a-z][A-Za-z]*$/.test(g.id)) out.push(`guide ${g.id}: bad id`);
    if (ids.has(g.id)) out.push(`guide ${g.id}: duplicate`);
    ids.add(g.id);
    if (!(TROUBLE_TONES as readonly string[]).includes(g.tone)) out.push(`guide ${g.id}: unknown tone ${g.tone}`);
    if (!/^[a-z-]+$/.test(g.icon)) out.push(`guide ${g.id}: bad icon ${g.icon}`);
    if (g.steps.length < MIN_STEPS || g.steps.length > MAX_STEPS) out.push(`guide ${g.id}: ${g.steps.length} steps`);
    const steps = new Set<string>();
    for (const s of g.steps) {
      if (!/^[a-z][A-Za-z]*$/.test(s.id)) out.push(`step ${g.id}.${s.id}: bad id`);
      if (steps.has(s.id)) out.push(`step ${g.id}.${s.id}: duplicate`);
      steps.add(s.id);
      for (const a of s.actions) {
        const p = parseAction(a);
        if (!p) out.push(`step ${g.id}.${s.id}: unknown action ${a}`);
        else if (p.type === 'phrase' && !phraseIds.includes(p.phrase)) out.push(`step ${g.id}.${s.id}: no phrase ${p.phrase}`);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ important numbers

export const IMPORTANT_NUMBERS_KEY = 'satchel.importantNumbers.v1';
export const LABEL_MAX = 60;

export type ImportantNumber = { id: string; group: NumberGroup; label: string; phone: string };

/** Stored numbers, cleaned: unknown groups become "other", blank or undialable rows are dropped, ids deduplicated. */
export function cleanNumbers(raw: unknown): ImportantNumber[] {
  if (!Array.isArray(raw)) return [];
  const out: ImportantNumber[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, LABEL_MAX) : '';
    const phone = typeof o.phone === 'string' ? o.phone.trim() : '';
    if (!id || seen.has(id) || !label || !telUri(phone)) continue;
    seen.add(id);
    out.push({ id, group: isNumberGroup(o.group) ? o.group : 'other', label, phone });
  }
  return out;
}

export type NumberErrors = { label?: 'required' | 'tooLong'; phone?: 'required' | 'invalid' };

export function validateNumber(label: string, phone: string): NumberErrors {
  const e: NumberErrors = {};
  const l = label.trim();
  if (!l) e.label = 'required';
  else if (l.length > LABEL_MAX) e.label = 'tooLong';
  const p = phone.trim();
  if (!p) e.phone = 'required';
  else if (!telUri(p) || /[^\d\s+()./-]/.test(p)) e.phone = 'invalid';
  return e;
}

export const hasNumberErrors = (e: NumberErrors) => !!(e.label || e.phone);

/** Adds a number, or replaces the one with the same id (editing keeps its place in the list). */
export function upsertNumber(list: ImportantNumber[], n: ImportantNumber): ImportantNumber[] {
  const clean: ImportantNumber = { ...n, label: n.label.trim(), phone: n.phone.trim() };
  const i = list.findIndex((x) => x.id === n.id);
  if (i < 0) return [...list, clean];
  const next = [...list];
  next[i] = clean;
  return next;
}

export const removeNumber = (list: ImportantNumber[], id: string) => list.filter((x) => x.id !== id);

export const numbersIn = (list: ImportantNumber[], group: NumberGroup) => list.filter((n) => n.group === group);

/** Non-empty groups in the fixed order (card block lines first), each in the order the numbers were added. */
export function groupNumbers(list: ImportantNumber[]): { group: NumberGroup; numbers: ImportantNumber[] }[] {
  return NUMBER_GROUPS.map((group) => ({ group, numbers: numbersIn(list, group) })).filter((x) => x.numbers.length > 0);
}

// ------------------------------------------------------------------ progress

export const TROUBLE_PROGRESS_KEY = 'satchel.troubles.progress.v1';

/** Ticked step ids per guide id. */
export type TroubleProgress = Record<string, string[]>;

/** Stored progress, cleaned against the table: unknown guides and steps are dropped, duplicates removed. */
export function cleanProgress(raw: unknown, table: TroubleTable): TroubleProgress {
  const out: TroubleProgress = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const g of table.guides) {
    const v = (raw as Record<string, unknown>)[g.id];
    if (!Array.isArray(v)) continue;
    const steps = g.steps.map((s) => s.id).filter((id) => v.includes(id));
    if (steps.length) out[g.id] = steps;
  }
  return out;
}

/** Ticks or unticks one step. Steps stay in guide order so the stored value is stable. */
export function toggleStep(progress: TroubleProgress, guide: TroubleGuide, stepId: string): TroubleProgress {
  if (!guide.steps.some((s) => s.id === stepId)) return progress;
  const cur = new Set(progress[guide.id] ?? []);
  if (cur.has(stepId)) cur.delete(stepId);
  else cur.add(stepId);
  const steps = guide.steps.map((s) => s.id).filter((id) => cur.has(id));
  const next = { ...progress };
  if (steps.length) next[guide.id] = steps;
  else delete next[guide.id];
  return next;
}

/** "Start over": clears one guide's ticks, leaving the others. */
export function resetGuide(progress: TroubleProgress, guideId: string): TroubleProgress {
  if (!(guideId in progress)) return progress;
  const next = { ...progress };
  delete next[guideId];
  return next;
}

export const isTicked = (progress: TroubleProgress, guideId: string, stepId: string) => (progress[guideId] ?? []).includes(stepId);

export type GuideProgress = { done: number; total: number; fraction: number; state: 'new' | 'started' | 'done'; nextStep: string | null };

export function progressOf(guide: TroubleGuide, progress: TroubleProgress): GuideProgress {
  const ticked = new Set(progress[guide.id] ?? []);
  const done = guide.steps.filter((s) => ticked.has(s.id)).length;
  const total = guide.steps.length;
  return {
    done,
    total,
    fraction: total ? done / total : 0,
    state: done === 0 ? 'new' : done === total ? 'done' : 'started',
    nextStep: guide.steps.find((s) => !ticked.has(s.id))?.id ?? null,
  };
}

/** How many guides have at least one tick (the Emergency tab card says "2 in progress"). */
export const guidesInProgress = (table: TroubleTable, progress: TroubleProgress) =>
  table.guides.filter((g) => progressOf(g, progress).state === 'started').length;

// ------------------------------------------------------------------ what a step can offer now

/** What the traveller already saved, as the guide screen sees it. */
export type TroubleContext = {
  /** The Emergency tab's chosen (or guessed) country, or null when none is known. */
  row: RowDisplay | null;
  card: EmergencyCard;
  numbers: ImportantNumber[];
  docs: { id: string; kind: DocKind; label: string }[];
  /** The stay the address card would open (battery.currentHotel), when it has an address. */
  hotel: { id: string; name: string } | null;
  /** Phrase ids that have a card (src/core/phrases.ts PHRASE_IDS). */
  phraseIds: readonly string[];
};

export type ResolvedAction =
  | { type: 'emergency'; service: CallService; number: string; fallback: boolean }
  | { type: 'insurer'; name: string; number: string }
  | { type: 'contact'; id: string; name: string; number: string }
  | { type: 'number'; id: string; group: NumberGroup; label: string; number: string }
  | { type: 'doc'; id: string; kind: DocKind; label: string }
  | { type: 'hotel'; id: string; name: string }
  | { type: 'phrase'; phrase: string }
  | { type: 'help' }
  /** Nothing saved yet: offer a link to where it's set up. */
  | { type: 'setup'; need: 'country' | 'card' | 'numbers' | 'vault'; group?: NumberGroup; kind?: DocKind };

/** The number to call for a service: its own line, else the general number, else the 112 fallback. */
export function emergencyNumber(row: RowDisplay, service: CallService): { number: string; fallback: boolean } {
  if (row.noNumber) return { number: FALLBACK_NUMBER, fallback: true };
  const own = service === 'general' ? null : row.lines.find((l) => l.services.includes(service as Service));
  const number = own?.number ?? row.coverNumber ?? row.lines[0].number;
  return { number, fallback: false };
}

/** The first vault document of a kind, in the order the caller passes (the vault's own sort). */
const docOfKind = (ctx: TroubleContext, kind: DocKind) => ctx.docs.find((d) => d.kind === kind) ?? null;

export function resolveAction(a: StepAction, ctx: TroubleContext): ResolvedAction[] {
  switch (a.type) {
    case 'call': {
      if (!ctx.row) return [{ type: 'setup', need: 'country' }];
      return [{ type: 'emergency', service: a.service, ...emergencyNumber(ctx.row, a.service) }];
    }
    case 'insurer': {
      const number = ctx.card.insurerPhone?.trim() ?? '';
      if (!telUri(number)) return [{ type: 'setup', need: 'card' }];
      return [{ type: 'insurer', name: ctx.card.insurer?.trim() ?? '', number }];
    }
    case 'contact': {
      const out: ResolvedAction[] = ctx.card.contacts
        .filter((c) => telUri(c.phone))
        .map((c) => ({ type: 'contact', id: c.id, name: c.name.trim(), number: c.phone.trim() }));
      return out.length ? out : [{ type: 'setup', need: 'card' }];
    }
    case 'numbers': {
      const out: ResolvedAction[] = numbersIn(ctx.numbers, a.group).map((n) => ({ type: 'number', id: n.id, group: n.group, label: n.label, number: n.phone }));
      return out.length ? out : [{ type: 'setup', need: 'numbers', group: a.group }];
    }
    case 'vault': {
      const d = docOfKind(ctx, a.kind);
      return d ? [{ type: 'doc', id: d.id, kind: d.kind, label: d.label }] : [{ type: 'setup', need: 'vault', kind: a.kind }];
    }
    case 'hotel':
      return ctx.hotel ? [{ type: 'hotel', id: ctx.hotel.id, name: ctx.hotel.name }] : [];
    case 'phrase':
      return ctx.phraseIds.includes(a.phrase) ? [{ type: 'phrase', phrase: a.phrase }] : [];
    case 'help':
      return [{ type: 'help' }];
  }
}

/** What a step shows now, in the order its actions are listed. Repeated set-up links are shown once. */
export function stepActions(step: TroubleStep, ctx: TroubleContext): ResolvedAction[] {
  const out: ResolvedAction[] = [];
  const setups = new Set<string>();
  for (const raw of step.actions) {
    const a = parseAction(raw);
    if (!a) continue;
    for (const r of resolveAction(a, ctx)) {
      if (r.type === 'setup') {
        const k = `${r.need}:${r.group ?? ''}:${r.kind ?? ''}`;
        if (setups.has(k)) continue;
        setups.add(k);
      }
      out.push(r);
    }
  }
  return out;
}
