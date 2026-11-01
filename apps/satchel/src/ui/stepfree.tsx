// T156 step-free travel, the showing side: the wheelchair tag line (Map pins and Nearby), the Toilets quick filter
// bar, the booking access notes, the airport-day assistance row, the readiness row words and the entry card. Logic in
// src/core/stepfree.ts; the needs are kept on this phone (src/state/stepfree.ts).
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { Item } from '../core/model.ts';
import type { Check } from '../core/readiness.ts';
import {
  accessFlagsFor,
  airportAssistance,
  ASSISTANCE_NOTICE_HOURS,
  hasAccessNeeds,
  readAccess,
  toggleAccessFlag,
  withAccess,
  type AccessFlag,
  type AccessNeed,
  type StepFreePrefs,
  type WheelchairLevel,
} from '../core/stepfree.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useStepFree } from '../state/stepfree.ts';
import { useTrips } from '../state/trips.tsx';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { SectionCard } from './hero.tsx';
import { Body, Button, PressableScale, TextField } from './kit.tsx';
import { AccessIcon } from './stepfreeIcons.tsx';
import { useMinute } from './TripPass.tsx';

export const NEED_KEY: Record<AccessNeed, Key> = {
  wheelchair: 'stepfree.need.wheelchair',
  stepFree: 'stepfree.need.stepFree',
  pram: 'stepfree.need.pram',
  walkLimited: 'stepfree.need.walkLimited',
};
const WC_KEY: Record<WheelchairLevel, Key> = { yes: 'stepfree.wc.yes', limited: 'stepfree.wc.limited', no: 'stepfree.wc.no' };
const FLAG_KEY: Record<AccessFlag, Key> = { stepFreeRoom: 'stepfree.flag.stepFreeRoom', assistance: 'stepfree.flag.assistance', lift: 'stepfree.flag.lift' };

export const wheelchairText = (t: T, level: WheelchairLevel | undefined): string => (level ? t(WC_KEY[level]) : '');

/** "Wheelchair access" / "Limited…" / "No…" with the wheel mark, for a map card or a Nearby row. Nothing when unknown. */
export function WheelchairLine({ level, small }: { level: WheelchairLevel | undefined; small?: boolean }) {
  const { t, theme } = useApp();
  if (!level) return null;
  const colour = level === 'yes' ? theme.ok : level === 'limited' ? theme.warn : theme.muted;
  return (
    <View accessible accessibilityLabel={t(WC_KEY[level])} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <AccessIcon id="wheelchair" size={small ? 18 : 22} tone={level === 'yes' ? 'ok' : 'muted'} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: small ? 13 : 14, color: colour }}>{t(WC_KEY[level])}</Text>
    </View>
  );
}

/** The ODbL source line shown under a wheelchair tag on a map card. */
export function WheelchairSource() {
  const { t, theme } = useApp();
  return <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('stepfree.wc.source')}</Text>;
}

/** Toilets tab: the "accessible first" line and the Accessible only switch chip. Nothing when no needs are set. */
export function ToiletAccessBar({ prefs, count, onToggle }: { prefs: StepFreePrefs; count: number; onToggle: () => void }) {
  const { t, theme } = useApp();
  if (!hasAccessNeeds(prefs)) return null;
  const on = prefs.accessibleOnly;
  return (
    <View style={{ gap: space.xs }}>
      <PressableScale
        accessibilityRole="switch"
        accessibilityLabel={t('stepfree.toilets.onlyA11y', { n: count })}
        accessibilityHint={t('stepfree.toilets.onlyHint')}
        accessibilityState={{ checked: on }}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: space.s,
          paddingHorizontal: space.m,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: on ? theme.ok : theme.line,
          backgroundColor: on ? theme.okSoft : theme.card,
        }}
      >
        <AccessIcon id="toilet" size={24} tone={on ? 'ok' : 'sea'} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink }}>{`${t('stepfree.toilets.only')} · ${count}`}</Text>
      </PressableScale>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('stepfree.toilets.first')}</Text>
    </View>
  );
}

/** Booking detail: step-free room / assistance booked / lift ticks for the kind, and a short note. Kept on the booking. */
export function ItemAccessSlot({ item }: { item: Item }) {
  const { t, theme } = useApp();
  const { saveItem } = useTrips();
  const [prefs] = useStepFree();
  const access = readAccess(item.access);
  const [note, setNote] = useState(access?.note ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => setNote(readAccess(item.access)?.note ?? ''), [item.access]);
  const flags = accessFlagsFor(item.kind);
  // Shown when the traveller set needs, or the booking already carries notes (e.g. from a shared trip).
  if (!hasAccessNeeds(prefs) && !access) return null;
  const save = async (next: Item) => {
    if (!(await saveItem(next))) Alert.alert(t('error.item.save.title'), t('error.item.save.body'));
  };
  const saveNote = async () => {
    await save(withAccess(item, { ...(access ?? {}), note }));
    setSaved(true);
  };
  return (
    <SectionCard title={t('stepfree.notes.title')} subtitle={t('stepfree.notes.intro')} icon="accessibility-outline" tone="ok">
      {flags.map((f) => {
        const on = access?.[f] === true;
        return (
          <PressableScale
            key={f}
            accessibilityRole="checkbox"
            accessibilityLabel={t(FLAG_KEY[f])}
            accessibilityHint={t('stepfree.flagHint')}
            accessibilityState={{ checked: on }}
            onPress={() => save(toggleAccessFlag(item, f))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}
          >
            <AccessIcon id={f === 'lift' ? 'lift' : f === 'assistance' ? 'walkLimited' : 'stepFree'} size={28} tone={on ? 'ok' : 'muted'} />
            <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t(FLAG_KEY[f])}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: on ? theme.ok : theme.muted }}>{on ? t('common.on') : t('common.off')}</Text>
          </PressableScale>
        );
      })}
      <TextField
        label={t('stepfree.notes.note')}
        value={note}
        onChange={(v) => {
          setNote(v);
          setSaved(false);
        }}
        placeholder={t('stepfree.notes.notePlaceholder')}
        multiline
      />
      {note.trim() !== (access?.note ?? '') ? <Button kind="secondary" label={t('stepfree.notes.save')} hint={t('stepfree.notes.saveHint')} onPress={saveNote} /> : null}
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.ok }]}>
          {t('stepfree.notes.saved')}
        </Text>
      ) : null}
    </SectionCard>
  );
}

/** Airport day (ticket view and booking detail): booked or not, with generic advice and the tick. Journeys only. */
export function AirportAssistanceRow({ item }: { item: Item }) {
  const { t, theme } = useApp();
  const { saveItem } = useTrips();
  const [prefs] = useStepFree();
  const now = useMinute();
  const a = airportAssistance(item, prefs, now);
  if (!a) return null;
  const text = a.booked ? t('stepfree.airport.booked') : a.late ? t('stepfree.airport.late') : t('stepfree.airport.todo', { hours: ASSISTANCE_NOTICE_HOURS });
  const toggle = async () => {
    if (!(await saveItem(toggleAccessFlag(item, 'assistance')))) Alert.alert(t('error.item.save.title'), t('error.item.save.body'));
  };
  return (
    <View style={{ gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: a.booked ? theme.okSoft : theme.warnSoft }}>
      <View accessible accessibilityLabel={`${t('stepfree.airport.title')}. ${text}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <AccessIcon id="wheelchair" size={32} tone={a.booked ? 'ok' : 'sea'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('stepfree.airport.title')}</Text>
          <Text style={[typeScale.small, { color: theme.ink }]}>{text}</Text>
        </View>
      </View>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={t('stepfree.airport.mark')}
        accessibilityHint={t('stepfree.airport.markHint')}
        accessibilityState={{ checked: a.booked }}
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Body>{t('stepfree.airport.mark')}</Body>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: a.booked ? theme.ok : theme.ink }}>{a.booked ? t('common.on') : t('common.off')}</Text>
      </PressableScale>
    </View>
  );
}

/** The readiness row's sentence (src/ui/ReadinessCard.tsx). */
export function assistanceDetail(t: T, c: Check): string {
  if (c.reason === 'all') return t('stepfree.readiness.all');
  if (c.reason === 'some') return t('stepfree.readiness.some', { done: c.done ?? 0, total: c.total ?? 0 });
  return (c.total ?? 0) === 1 ? t('stepfree.readiness.none1') : t('stepfree.readiness.none', { total: c.total ?? 0 });
}

/** Entry to the step-free screen (Settings and the trip screen): says which needs are on. */
export function StepFreeEntry() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [prefs] = useStepFree();
  const on = prefs.needs.map((n) => t(NEED_KEY[n])).join(', ');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('stepfree.entry')}. ${on ? t('stepfree.entryOn', { needs: on }) : t('stepfree.entryOff')}`}
      accessibilityHint={t('stepfree.entryHint')}
      onPress={() => router.push('/stepfree')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.l, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card }}
    >
      <AccessIcon id={prefs.needs[0] ?? 'stepFree'} size={36} tone={on ? 'ok' : 'sea'} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('stepfree.entry')}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{on ? t('stepfree.entryOn', { needs: on }) : t('stepfree.entryOff')}</Text>
      </View>
    </PressableScale>
  );
}
