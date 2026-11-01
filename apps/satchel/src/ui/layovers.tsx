// T131 connections and layovers, the UI side (logic in src/core/layovers.ts):
// - ConnectionCard: between two legs on the trip timeline ("Change at Singapore · 1 h 25 min · Tight", land / leave
//   times on each leg's own clock, terminal and gate change, why it is tight, a nearby-place note) and, for a long
//   layover, a few general ideas shown on request (timed fade, static with Reduce Motion) with the local customs
//   link for that country.
// - LayoverBriefRow: the Your day row ("Change at Singapore: 1 h 25 min, terminal 1 to 3").
// - connectionsDetail: the readiness row's sentence.
// - useLegInfoForm + LegInfoFields: the journey form's terminal / gate fields; LegInfoLines: the journey detail.
// - LayoverSettings: the traveller's limits in Settings.
// - T134: OwnLimits on the connection card (this change's own tight / long limits, or "Use my usual limits"; stored
//   on this phone, LAYOVER_OVERRIDE_KEY), and the long-layover ideas' "Arrival card for <country>" button (the trip
//   screen opens that stop's arrival card at the top of the list).
// Tokens only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import { formatTime, zoneCity } from '../core/format.ts';
import {
  arrivalGate,
  arrivalTerminal,
  briefConnections,
  DEFAULT_LAYOVER_PREFS,
  departureGate,
  departureTerminal,
  LAYOVER_OVERRIDE_KEY,
  LAYOVER_PREFS_KEY,
  LAYOVER_STEP,
  legInfoDraft,
  LONG_IDEAS,
  MAX_LONG,
  MAX_TIGHT,
  MIN_LONG,
  normaliseLayoverPrefs,
  sameLayoverPrefs,
  setLayoverOverride,
  splitMinutes,
  terminalLabel,
  terminalNote,
  withLegInfo,
  type Connection,
  type ConnectionStatus,
  type LayoverPrefs,
  type LegInfoDraft,
  type LegInfoKey,
  type LongIdea,
} from '../core/layovers.ts';
import { isTransport, type Item, type ItemKind, type LocalDate, type Stamp, type Trip } from '../core/model.ts';
import type { Check } from '../core/readiness.ts';
import { draftChanged } from '../core/trips.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { MinutesRow } from './AirportFields.tsx';
import { CustomsLink } from './CustomsLink.tsx';
import { FadeInView, IconBadge, toneColours, type IconName, type Tone } from './hero.tsx';
import { Body, Button, Card, Label, PressableScale, TextField } from './kit.tsx';

// ------------------------------------------------------------------ prefs and words

const NO_OVERRIDES: unknown = [];

/**
 * T134: every change's own limits (raw stored rows; the core normalises them on each read) and a setter for one
 * change: null removes its row ("Use my usual limits").
 */
export function useLayoverOverrides(): [unknown, (tripId: string, c: Connection, p: Partial<LayoverPrefs> | null, usual: LayoverPrefs) => void] {
  const [stored, setStored] = usePersisted<unknown>(LAYOVER_OVERRIDE_KEY, NO_OVERRIDES);
  return [stored, (tripId, c, p, usual) => setStored((old: unknown) => setLayoverOverride(old, tripId, c.arrive.id, c.depart.id, p, usual))];
}

/** The traveller's limits from Settings, always complete and valid. */
export function useLayoverPrefs(): [LayoverPrefs, (p: Partial<LayoverPrefs>) => void] {
  const [stored, setStored] = usePersisted<LayoverPrefs>(LAYOVER_PREFS_KEY, DEFAULT_LAYOVER_PREFS);
  return [normaliseLayoverPrefs(stored), (p) => setStored((old) => ({ ...normaliseLayoverPrefs(old), ...p }))];
}

/** "1 h 25 min", "2 h", "45 min". */
export function durationText(t: T, min: number): string {
  const { h, m } = splitMinutes(min);
  if (!h) return t('layover.dur.m', { m });
  return m ? t('layover.dur.hm', { h, m }) : t('layover.dur.h', { h });
}

const STATUS_TONE: Record<ConnectionStatus, Tone> = { tight: 'warn', ok: 'ok', long: 'sea' };
const STATUS_ICON: Record<ConnectionStatus, IconName> = { tight: 'alert-circle', ok: 'swap-horizontal', long: 'cafe-outline' };

const statusWord = (t: T, s: ConnectionStatus) => t(s === 'tight' ? 'layover.status.tight' : s === 'long' ? 'layover.status.long' : 'layover.status.ok');

/** "14:05 Singapore time". */
const clock = (t: T, s: Stamp) => t('item.zone', { time: formatTime(s.local), city: zoneCity(s.tz) });

function terminalLine(t: T, c: Connection): string {
  const n = terminalNote(c);
  if (!n) return '';
  return n.kind === 'change' ? t('layover.card.terminalChange', n) : t('layover.card.terminalSame', { terminal: n.terminal });
}

function gateLine(t: T, c: Connection): string {
  const { from, to } = c.gate;
  if (from && to) return t('layover.card.gates', { from, to });
  if (to) return t('layover.card.gateTo', { to });
  if (from) return t('layover.card.gateFrom', { from });
  return '';
}

/** The Your day / readiness wording: "Change at Singapore: 1 h 25 min, terminal 1 to 3". */
export function briefText(t: T, c: Connection): string {
  const n = terminalNote(c);
  const terminals = !n ? '' : n.kind === 'change' ? t('layover.brief.terminalChange', n) : t('layover.brief.terminalSame', { terminal: n.terminal });
  const vars = { place: c.place || t('layover.brief.somewhere'), d: durationText(t, c.minutes), terminals };
  return t(c.status === 'tight' ? 'layover.brief.tight' : 'layover.brief.line', vars);
}

/** The readiness row's sentence (src/core/layovers.ts connectionsCheck). */
export function connectionsDetail(t: T, c: Check): string {
  if (c.reason !== 'tight') return t('layover.readiness.ok');
  const places = c.city || t('layover.brief.somewhere');
  return (c.done ?? 0) > 1 ? t('layover.readiness.tightMany', { n: c.done ?? 0, places }) : t('layover.readiness.tightOne', { places, d: durationText(t, c.minutes ?? 0) });
}

// ------------------------------------------------------------------ the connection card

function IdeaRow({ idea }: { idea: LongIdea }) {
  const { t, theme } = useApp();
  const icon: Record<LongIdea, IconName> = { rest: 'bed-outline', eat: 'restaurant-outline', walk: 'walk-outline', leave: 'exit-outline' };
  const title = t(`layover.idea.${idea}`);
  const body = t(`layover.idea.${idea}Body`);
  return (
    <View accessible accessibilityLabel={`${title}. ${body}`} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start', paddingVertical: space.xs }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
        <Ionicons name={icon[idea]} size={18} color={theme.sea} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

/** The card between the arriving and the departing leg on the trip timeline. */
/**
 * `arrival`: the change country's arrival card can open for this stop (trip screen; T134), with `onArrival` doing it.
 * `usual`: the traveller's limits from Settings, the starting point for this change's own ones.
 */
export const ConnectionCard = memo(function ConnectionCard({
  c,
  tripId,
  usual,
  arrival,
  onArrival,
}: {
  c: Connection;
  tripId: string;
  usual: LayoverPrefs;
  arrival?: { iso2: string; country: string } | null;
  onArrival?: (iso2: string) => void;
}) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [ideas, setIdeas] = useState(false);
  const [limits, setLimits] = useState(false);
  const tone = STATUS_TONE[c.status];
  const { fg, bg } = toneColours(theme, tone);
  const title = c.place ? t('layover.card.title', { place: c.place }) : t('layover.card.titleNoPlace');
  const d = durationText(t, c.minutes);
  const status = statusWord(t, c.status);
  const times = t('layover.card.times', { arrive: clock(t, c.arrive.end ?? c.arrive.start), depart: clock(t, c.depart.start) });
  const why = c.status === 'tight' ? t(c.crossBorder ? 'layover.card.tightWhyCross' : 'layover.card.tightWhy', { min: c.limit }) : '';
  const nearby = c.match === 'nearby' ? t('layover.card.nearby') : '';
  const terminals = terminalLine(t, c);
  const gates = gateLine(t, c);
  const more = [terminals, gates, why, nearby].filter(Boolean).join('. ');
  const unknownTerminals = !c.terminal.from && !c.terminal.to && !c.gate.from && !c.gate.to;
  return (
    <View style={{ marginVertical: space.xs, borderRadius: radius.m, borderWidth: 1, borderStyle: 'dashed', borderColor: fg, backgroundColor: bg, padding: space.m, gap: space.s }}>
      <View accessible accessibilityLabel={t('layover.card.a11y', { title, d, status, times, more })} style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <IconBadge name={STATUS_ICON[c.status]} tone={tone} size="s" />
          <Text style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>{title}</Text>
          <View style={{ borderRadius: radius.pill, backgroundColor: theme.card, paddingHorizontal: space.s, paddingVertical: 2 }}>
            <Text style={[typeScale.caption, { color: fg }]}>{status}</Text>
          </View>
        </View>
        <Text style={[typeScale.title, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{d}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{times}</Text>
        {terminals ? <Text style={[typeScale.small, { color: theme.ink }]}>{terminals}</Text> : null}
        {gates ? <Text style={[typeScale.small, { color: theme.ink }]}>{gates}</Text> : null}
        {why ? <Text style={[typeScale.small, { color: theme.ink }]}>{why}</Text> : null}
        {nearby ? <Text style={[typeScale.small, { color: theme.ink }]}>{nearby}</Text> : null}
      </View>
      {c.status === 'long' ? (
        <>
          <Button
            label={ideas ? t('layover.ideas.hide') : t('layover.ideas.show')}
            hint={ideas ? t('layover.ideas.hideHint') : t('layover.ideas.showHint')}
            kind="quiet"
            icon={ideas ? 'chevron-up' : 'bulb-outline'}
            onPress={() => setIdeas((v) => !v)}
          />
          {ideas ? (
            <FadeInView>
              <View style={{ gap: space.xs }}>
                <View accessibilityRole="header">
                  <Label>{t('layover.ideas.title', { d })}</Label>
                </View>
                {LONG_IDEAS.map((i) => (
                  <IdeaRow key={i} idea={i} />
                ))}
                {arrival && onArrival ? (
                  <Button
                    label={t('f103.arrival.open', { country: arrival.country })}
                    hint={t('f103.arrival.openHint', { country: arrival.country })}
                    kind="secondary"
                    icon="earth-outline"
                    onPress={() => onArrival(arrival.iso2)}
                  />
                ) : null}
                {c.country ? <CustomsLink iso2={c.country} tripId={tripId} /> : null}
                <Text style={[typeScale.small, { color: theme.muted }]}>{t('layover.ideas.general')}</Text>
              </View>
            </FadeInView>
          ) : null}
        </>
      ) : null}
      <Button
        label={limits ? t('f103.limits.close') : t('f103.limits.open')}
        hint={limits ? t('f103.limits.closeHint') : t('f103.limits.openHint')}
        kind="quiet"
        icon={limits ? 'chevron-up' : 'options-outline'}
        onPress={() => setLimits((v) => !v)}
      />
      {limits ? (
        <FadeInView>
          <OwnLimits c={c} tripId={tripId} usual={usual} />
        </FadeInView>
      ) : null}
      {unknownTerminals ? (
        <Button
          label={t('layover.card.addTerminals')}
          hint={t('layover.card.addTerminalsHint')}
          kind="quiet"
          icon="create-outline"
          onPress={() => router.push({ pathname: '/item-edit', params: { tripId, id: c.arrive.id } })}
        />
      ) : null}
    </View>
  );
});

/**
 * T134: this change's own limits. Shows the tight limit that applies to it (between countries or not) and the long
 * one; the first step starts from the usual limits. "Use my usual limits" removes the row.
 */
function OwnLimits({ c, tripId, usual }: { c: Connection; tripId: string; usual: LayoverPrefs }) {
  const { t, theme } = useApp();
  const [, setOwn] = useLayoverOverrides();
  const p = c.prefs;
  const tightKey = c.crossBorder ? 'tightCrossMin' : 'tightMin';
  return (
    <View style={{ gap: space.xs, borderTopWidth: 1, borderColor: theme.line, paddingTop: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('f103.limits.title')}</Label>
      </View>
      <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: c.own ? theme.ink : theme.muted }]}>
        {t(c.own ? 'f103.limits.own' : 'f103.limits.usual')}
      </Text>
      <MinutesRow
        label={t('f103.limits.tightLabel')}
        shown={t('f103.limits.tight', { min: p[tightKey] })}
        value={p[tightKey]}
        step={LAYOVER_STEP}
        max={MAX_TIGHT}
        onChange={(m) => setOwn(tripId, c, { [tightKey]: m }, usual)}
      />
      <MinutesRow
        label={t('f103.limits.longLabel')}
        shown={t('f103.limits.long', { d: durationText(t, p.longMin) })}
        value={p.longMin}
        step={LAYOVER_STEP}
        max={MAX_LONG}
        onChange={(m) => setOwn(tripId, c, { longMin: Math.max(MIN_LONG, m) }, usual)}
      />
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('f103.limits.body')}</Text>
      {c.own ? <Button label={t('f103.limits.reset')} hint={t('f103.limits.resetHint')} kind="quiet" icon="refresh" onPress={() => setOwn(tripId, c, null, usual)} /> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Your day

/** "Change at Singapore: 1 h 25 min, terminal 1 to 3" on the day of a change, until the next leg leaves. */
export function LayoverBriefRow({ trip, zone, today, now }: { trip: Trip; zone: string; today: LocalDate; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [prefs] = useLayoverPrefs();
  const [own] = useLayoverOverrides();
  const list = briefConnections(trip, zone, today, now, prefs, own);
  if (!list.length) return null;
  return (
    <>
      {list.map((c) => {
        const line = briefText(t, c);
        return (
          <View key={c.id}>
            <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={line}
              accessibilityHint={t('layover.brief.hint', { trip: trip.name })}
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id, day: today } })}
              style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name={c.status === 'tight' ? 'alert-circle-outline' : 'swap-horizontal'} size={18} color={theme.heroAccent} />
              </View>
              <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
                {line}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ the journey form and detail

export type LegInfoForm = {
  draft: LegInfoDraft;
  set: (k: LegInfoKey, v: string) => void;
  changed: boolean;
  /** The item to save with these fields (kept on a journey, dropped on other kinds; unknown keys kept). */
  apply: <I extends Item>(item: I) => I;
};

export function useLegInfoForm(prev?: Item): LegInfoForm {
  const [initial] = useState<LegInfoDraft>(() => legInfoDraft(prev?.legInfo));
  const [draft, setDraft] = useState<LegInfoDraft>(initial);
  return {
    draft,
    set: (k, v) => setDraft((o) => ({ ...o, [k]: v })),
    changed: draftChanged(initial, draft),
    apply: (item) => withLegInfo(item, draft, prev?.legInfo),
  };
}

/** Terminal and gate fields on a journey. A flight's departure ones are in its airport section, so only arrival here. */
export function LegInfoFields({ form, kind }: { form: LegInfoForm; kind: ItemKind }) {
  const { t, theme } = useApp();
  if (!isTransport(kind)) return null;
  const d = form.draft;
  const pair = (a: LegInfoKey, b: LegInfoKey, la: string, lb: string) => (
    <View style={{ flexDirection: 'row', gap: space.m }}>
      <View style={{ flex: 1 }}>
        <TextField label={la} value={d[a]} onChange={(v) => form.set(a, v)} autoCapitalize="words" />
      </View>
      <View style={{ flex: 1 }}>
        <TextField label={lb} value={d[b]} onChange={(v) => form.set(b, v)} autoCapitalize="none" />
      </View>
    </View>
  );
  return (
    <View style={{ gap: space.s, borderTopWidth: 1, borderColor: theme.line, paddingTop: space.m }}>
      <View accessibilityRole="header">
        <Label>{t('layover.form.title')}</Label>
      </View>
      <Body muted>{t('layover.form.body')}</Body>
      {kind === 'flight' ? null : pair('depTerminal', 'depGate', t('layover.form.depTerminal'), t('layover.form.depGate'))}
      {pair('arrTerminal', 'arrGate', t('layover.form.arrTerminal'), t('layover.form.arrGate'))}
    </View>
  );
}

/** "Arrives at terminal 3, gate 114" (and, for a train, ferry or bus, where it leaves from) on the journey detail. */
export function LegInfoLines({ item }: { item: Item }) {
  const { t } = useApp();
  if (!isTransport(item.kind)) return null;
  const line = (terminal: string | undefined, gate: string | undefined, which: 'arrival' | 'departure') => {
    const tl = terminal ? terminalLabel(terminal) : '';
    if (tl && gate) return t(which === 'arrival' ? 'layover.detail.arrivalBoth' : 'layover.detail.departureBoth', { terminal: tl, gate });
    if (tl) return t(which === 'arrival' ? 'layover.detail.arrival' : 'layover.detail.departure', { terminal: tl });
    if (gate) return t(which === 'arrival' ? 'layover.detail.arrivalGate' : 'layover.detail.departureGate', { gate });
    return '';
  };
  // A flight's departure terminal and gate show on its airport panel.
  const dep = item.kind === 'flight' ? '' : line(departureTerminal(item), departureGate(item), 'departure');
  const arr = line(arrivalTerminal(item), arrivalGate(item), 'arrival');
  if (!dep && !arr) return null;
  return (
    <>
      {dep ? <Body muted>{dep}</Body> : null}
      {arr ? <Body muted>{arr}</Body> : null}
    </>
  );
}

// ------------------------------------------------------------------ Settings

export function LayoverSettings() {
  const { t } = useApp();
  const [prefs, setPrefs] = useLayoverPrefs();
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('layover.settings.title')}</Label>
      </View>
      <Card>
        <MinutesRow
          label={t('layover.settings.tightLabel')}
          shown={t('layover.settings.tight', { min: prefs.tightMin })}
          value={prefs.tightMin}
          step={LAYOVER_STEP}
          max={MAX_TIGHT}
          onChange={(m) => setPrefs({ tightMin: m })}
        />
        <MinutesRow
          label={t('layover.settings.crossLabel')}
          shown={t('layover.settings.cross', { min: prefs.tightCrossMin })}
          value={prefs.tightCrossMin}
          step={LAYOVER_STEP}
          max={MAX_TIGHT}
          onChange={(m) => setPrefs({ tightCrossMin: m })}
        />
        <MinutesRow
          label={t('layover.settings.longLabel')}
          shown={t('layover.settings.long', { d: durationText(t, prefs.longMin) })}
          value={prefs.longMin}
          step={LAYOVER_STEP}
          max={MAX_LONG}
          onChange={(m) => setPrefs({ longMin: Math.max(MIN_LONG, m) })}
        />
        <Body muted>{t('layover.settings.body')}</Body>
        {sameLayoverPrefs(prefs, DEFAULT_LAYOVER_PREFS) ? null : (
          <Button label={t('layover.settings.reset')} hint={t('layover.settings.resetHint')} kind="quiet" icon="refresh" onPress={() => setPrefs(DEFAULT_LAYOVER_PREFS)} />
        )}
      </Card>
    </View>
  );
}
