// T74 airport day, the editing side: the flight form's "At the airport" section (terminal, gate, boarding and
// bag-drop times on the departure airport's clock, flight type, airport buffer and travel time for this flight, with
// a live leave-by preview and warnings), the Settings defaults section, and the shared prefs hook. Logic in
// src/core/leaveby.ts. app/item-edit.tsx only needs useAirportForm + <AirportFields>, so the hook into that screen
// stays a few lines.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View, type AccessibilityActionEvent } from 'react-native';
import { zoneCity } from '../core/format.ts';
import {
  AIRPORT_PREFS_KEY,
  airportDraft,
  airportPlan,
  badClock,
  BUFFER_STEP,
  DEFAULT_AIRPORT_PREFS,
  MAX_BUFFER,
  MAX_TRAVEL,
  normaliseAirportPrefs,
  SCOPES,
  stepMinutes,
  TRAVEL_STEP,
  withAirport,
  type AirportDraft,
  type AirportPrefs,
  type AirportPlan,
  type AirportWarning,
} from '../core/leaveby.ts';
import type { Item } from '../core/model.ts';
import { draftChanged } from '../core/trips.ts';
import { isLocalDateTime, isValidZone } from '../core/tz.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { TimeField } from './DateTimeField.tsx';
import { Body, Button, Card, Chip, Label, PressableScale, TextField, Warning } from './kit.tsx';

/** The Settings defaults (travel time, domestic and international buffers), shared by every screen that shows them. */
export function useAirportPrefs(): [AirportPrefs, (p: Partial<AirportPrefs>) => void] {
  const [stored, setStored] = usePersisted<AirportPrefs>(AIRPORT_PREFS_KEY, DEFAULT_AIRPORT_PREFS);
  return [normaliseAirportPrefs(stored), (p) => setStored((old) => ({ ...normaliseAirportPrefs(old), ...p }))];
}

export type AirportForm = {
  draft: AirportDraft;
  set: (k: keyof AirportDraft, v: string) => void;
  /** True when the airport fields differ from where the form started (for the leave-unsaved check). */
  changed: boolean;
  /** The item to save with these fields (kept on a flight, dropped on other kinds; unknown keys from before kept). */
  apply: <I extends Item>(item: I) => I;
};

/** Airport form state for the booking being edited (or a new one). */
export function useAirportForm(prev?: Item): AirportForm {
  const [initial] = useState<AirportDraft>(() => airportDraft(prev?.airport));
  const [draft, setDraft] = useState<AirportDraft>(initial);
  return {
    draft,
    set: (k, v) => setDraft((o) => ({ ...o, [k]: v })),
    changed: draftChanged(initial, draft),
    apply: (item) => withAirport(item, draft, prev?.airport),
  };
}

/** A visible - / + button. Screen readers skip it: the adjustable row around it carries the same actions. */
function StepButton({ icon, label, hint, enabled, onPress }: { icon: 'add' | 'remove'; label: string; hint: string; enabled: boolean; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !enabled }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      disabled={!enabled}
      onPress={onPress}
      style={{ width: TOUCH, height: TOUCH, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}
    >
      <Ionicons name={icon} size={24} color={theme.ink} />
    </PressableScale>
  );
}

/** Minutes as one adjustable control (VoiceOver swipe up / down) with visible less / more buttons. */
export function MinutesRow({
  label,
  shown,
  value,
  step,
  max,
  onChange,
}: {
  label: string;
  shown: string;
  /** Null: not set yet; the first step lands near half an hour. */
  value: number | null;
  step: number;
  max: number;
  onChange: (min: number) => void;
}) {
  const { t, theme } = useApp();
  const lower = value === null ? 30 - step : stepMinutes(value, -1, step, max);
  const raise = value === null ? 30 : stepMinutes(value, 1, step, max);
  const canLower = value === null || lower !== value;
  const canRaise = value === null || raise !== value;
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment' && canRaise) onChange(raise);
    else if (e.nativeEvent.actionName === 'decrement' && canLower) onChange(lower);
  };
  const vars = { step };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={t('airport.adjustHint', vars)}
      accessibilityValue={{ text: shown }}
      accessibilityActions={[
        { name: 'increment', label: t('airport.more') },
        { name: 'decrement', label: t('airport.less') },
      ]}
      onAccessibilityAction={onAction}
      accessibilityLiveRegion="polite"
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m }}
    >
      <StepButton icon="remove" label={t('airport.less')} hint={t('airport.lessHint', vars)} enabled={canLower} onPress={() => onChange(lower)} />
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink, fontVariant: ['tabular-nums'] }}>{shown}</Text>
      <StepButton icon="add" label={t('airport.more')} hint={t('airport.moreHint', vars)} enabled={canRaise} onPress={() => onChange(raise)} />
    </View>
  );
}

const WARN_KEY: Record<AirportWarning, Key> = {
  boardingAfterDeparture: 'airport.warn.boardingAfterDeparture',
  bagDropAfterDeparture: 'airport.warn.bagDropAfterDeparture',
  bagDropAfterBoarding: 'airport.warn.bagDropAfterBoarding',
  boardingSkipped: 'airport.warn.boardingSkipped',
  bagDropSkipped: 'airport.warn.bagDropSkipped',
};

/** The plan's warnings as sentences (shared by the form and the ticket). */
export function warningTexts(plan: AirportPlan, t: ReturnType<typeof useApp>['t']): string[] {
  const time = (local: string | undefined) => local?.slice(11, 16) ?? '';
  return plan.warnings.map((w) =>
    t(WARN_KEY[w], {
      time: w === 'boardingSkipped' ? time(plan.boarding?.local) : w === 'bagDropSkipped' ? time(plan.bagDrop?.local) : time(plan.departure.local),
    }),
  );
}

/** "Leave by 17:00" / "At the airport by 18:00" for a plan, on the departure airport's clock. */
export function leaveText(plan: AirportPlan, t: ReturnType<typeof useApp>['t']): string {
  const city = zoneCity(plan.tz);
  const z = (local: string) => t('item.zone', { time: local.slice(11, 16), city });
  if (plan.leaveBy) return t('airport.leaveBy', { time: z(plan.leaveBy.local) });
  return t(plan.arriveByBagDrop ? 'airport.arriveByBagDrop' : 'airport.arriveBy', { time: z(plan.arriveBy.local) });
}

/** One clock field with a Clear button (a time picked by mistake can be removed again). */
function ClockField({ k, label, typed, hint, form, zone }: { k: 'boarding' | 'bagDrop'; label: string; typed: string; hint: string; form: AirportForm; zone: string }) {
  const { t } = useApp();
  const v = form.draft[k];
  return (
    <View style={{ gap: space.xs }}>
      <TimeField label={label} typedLabel={typed} value={v} onChange={(x) => form.set(k, x)} hint={hint} zone={zone} error={badClock(v) ? t('airport.badTime') : undefined} />
      {v ? <Button label={t('airport.clear', { field: label })} hint={t('airport.clearHint')} kind="quiet" onPress={() => form.set(k, '')} /> : null}
    </View>
  );
}

/**
 * The flight form's airport section. `start` is the departure as typed (date, time, zone) and `endTz` the arrival
 * zone, for the live preview and the domestic / international guess.
 */
export function AirportFields({ form, start, endTz }: { form: AirportForm; start: { date: string; time: string; tz: string }; endTz: string }) {
  const { t, theme } = useApp();
  const [prefs] = useAirportPrefs();
  const d = form.draft;
  const local = `${start.date}T${start.time}`;
  const zoneOk = isValidZone(start.tz);
  const plan =
    zoneOk && /^\d{2}:\d{2}$/.test(start.time) && isLocalDateTime(local)
      ? airportPlan(
          form.apply({ id: '', tripId: '', kind: 'flight', title: '', start: { local, tz: start.tz }, end: isValidZone(endTz) ? { local, tz: endTz } : undefined, attachments: [] }),
          prefs,
        )
      : null;
  const scopeName = (s: string) => t(s === 'domestic' ? 'airport.scope.domestic' : 'airport.scope.international');
  const city = zoneOk ? zoneCity(start.tz) : start.tz;
  const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);
  const buffer = num(d.bufferMin) ?? plan?.bufferMin ?? null;
  const travel = num(d.travelMin) ?? plan?.travelMin ?? prefs.travelMin;

  return (
    <View style={{ gap: space.m, borderTopWidth: 1, borderColor: theme.line, paddingTop: space.m }}>
      <View accessibilityRole="header">
        <Label>{t('airport.form.title')}</Label>
      </View>
      <Body muted>{t('airport.form.body', { city })}</Body>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <TextField label={t('airport.terminal')} value={d.terminal} onChange={(v) => form.set('terminal', v)} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('airport.gate')} value={d.gate} onChange={(v) => form.set('gate', v)} autoCapitalize="none" />
        </View>
      </View>
      <ClockField k="boarding" label={t('airport.boarding')} typed={t('airport.boardingTyped')} hint={t('airport.boardingHint')} form={form} zone={start.tz} />
      <ClockField k="bagDrop" label={t('airport.bagDrop')} typed={t('airport.bagDropTyped')} hint={t('airport.bagDropHint')} form={form} zone={start.tz} />

      <Label>{t('airport.scope')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('airport.scope')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {SCOPES.map((s) => (
          <Chip key={s} label={scopeName(s)} selected={(d.scope || plan?.scope) === s} onPress={() => form.set('scope', s)} />
        ))}
      </View>
      {!d.scope && plan ? <Body muted>{t('airport.scopeGuess', { scope: scopeName(plan.scope) })}</Body> : null}

      <Label>{t('airport.buffer')}</Label>
      <MinutesRow
        label={t('airport.buffer')}
        shown={buffer === null ? t('pickers.notSet') : t('airport.bufferValue', { min: buffer })}
        value={buffer}
        step={BUFFER_STEP}
        max={MAX_BUFFER}
        onChange={(m) => form.set('bufferMin', String(m))}
      />
      {d.bufferMin ? (
        <Button label={t('airport.useDefault')} hint={t('airport.useDefaultHint')} kind="quiet" onPress={() => form.set('bufferMin', '')} />
      ) : plan ? (
        <Body muted>{t('airport.bufferDefault', { scope: scopeName(plan.scope).toLocaleLowerCase() })}</Body>
      ) : null}

      <Label>{t('airport.travel')}</Label>
      <MinutesRow
        label={t('airport.travel')}
        shown={travel === null ? t('airport.travelNone') : t('airport.travelValue', { min: travel })}
        value={travel}
        step={TRAVEL_STEP}
        max={MAX_TRAVEL}
        onChange={(m) => form.set('travelMin', String(m))}
      />
      {d.travelMin ? (
        <Button label={t('airport.useDefault')} hint={t('airport.useDefaultHint')} kind="quiet" onPress={() => form.set('travelMin', '')} />
      ) : prefs.travelMin !== null ? (
        <Body muted>{t('airport.travelDefault')}</Body>
      ) : null}

      {plan ? (
        <View accessible accessibilityLiveRegion="polite" style={{ gap: space.xs, backgroundColor: theme.seaSoft, borderRadius: radius.m, padding: space.m }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{leaveText(plan, t)}</Text>
          {!plan.leaveBy ? <Body>{t('airport.noTravel')}</Body> : null}
          <Body muted>{t('airport.guidance')}</Body>
        </View>
      ) : null}
      {plan ? warningTexts(plan, t).map((w) => <Warning key={w} text={w} />) : null}
    </View>
  );
}

/** Settings: the usual travel time to the airport and the domestic / international airport buffers. */
export function AirportSettings() {
  const { t } = useApp();
  const [prefs, setPrefs] = useAirportPrefs();
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('airport.settings.title')}</Label>
      </View>
      <Card>
        <MinutesRow
          label={t('airport.settings.travelLabel')}
          shown={t('airport.settings.travel', { value: prefs.travelMin === null ? t('airport.settings.travelNone') : t('airport.settings.travelMin', { min: prefs.travelMin }) })}
          value={prefs.travelMin}
          step={TRAVEL_STEP}
          max={MAX_TRAVEL}
          onChange={(m) => setPrefs({ travelMin: m })}
        />
        {prefs.travelMin !== null ? (
          <Button label={t('airport.settings.clearTravel')} hint={t('airport.settings.clearTravelHint')} kind="quiet" onPress={() => setPrefs({ travelMin: null })} />
        ) : null}
        <MinutesRow
          label={t('airport.settings.domesticLabel')}
          shown={t('airport.settings.domestic', { min: prefs.domesticMin })}
          value={prefs.domesticMin}
          step={BUFFER_STEP}
          max={MAX_BUFFER}
          onChange={(m) => setPrefs({ domesticMin: m })}
        />
        <MinutesRow
          label={t('airport.settings.internationalLabel')}
          shown={t('airport.settings.international', { min: prefs.internationalMin })}
          value={prefs.internationalMin}
          step={BUFFER_STEP}
          max={MAX_BUFFER}
          onChange={(m) => setPrefs({ internationalMin: m })}
        />
        <Body muted>{t('airport.settings.body')}</Body>
      </Card>
    </View>
  );
}
