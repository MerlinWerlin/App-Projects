// T173 Add plans myself (owner, 14 Nov: "an add to itinerary actual thing which is like a select time - select
// address etc. if its left blank it doesnt get added"). One plan at a time: what kind (Flight, Stay, Tour, Food,
// Transport, Free time, Other), which trip day (only the trip's own dates), start and optional end time (the
// system time wheels), a title, and optional place or address, booking code and notes. Blank optional fields are
// left out; without a title nothing is saved and the field says so gently. "Save & add another" keeps the day and
// type for the next one; "Done" saves and closes. Opened with ?itemId= it edits that plan, with Delete.
// Logic in src/core/planform.ts. Params: tripId, day, itemId.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../src/core/format.ts';
import { destinationZone } from '../src/core/glance.ts';
import { itemFromPlan, newPlanForm, PLAN_TYPES, planDays, planFromItem, planIssues, type PlanForm, type PlanType } from '../src/core/planform.ts';
import { daySchedule } from '../src/core/dayview.ts';
import type { Key } from '../src/i18n/en.ts';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { toneColours, type Tone } from '../src/ui/hero.tsx';
import { Button, EmptyState, PressableScale, Screen, TextField } from '../src/ui/kit.tsx';
import { TimeField } from '../src/ui/DateTimeField.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<PlanType, IconName> = { flight: 'airplane', stay: 'bed', tour: 'flag', food: 'restaurant', transport: 'bus', free: 'sunny', other: 'ellipsis-horizontal' };
const TYPE_TONE: Record<PlanType, Tone> = { flight: 'sea', stay: 'accent', tour: 'teal', food: 'warn', transport: 'ok', free: 'ok', other: 'ink' };

export default function PlanEditScreen() {
  const params = useLocalSearchParams<{ tripId: string; day?: string; itemId?: string }>();
  const { t, theme, lang } = useApp();
  const { trips, saveTrip, deleteItem } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const trip = trips.find((x) => x.id === params.tripId);
  const editing = trip?.items.find((i) => i.id === params.itemId);
  const days = useMemo(() => (trip ? planDays(trip) : []), [trip]);
  // The day's own zone when it already has plans, else where the trip is going (never the phone's zone).
  const zoneFor = (day: string) => {
    if (!trip) return 'UTC';
    const s = daySchedule(trip, day, Date.now());
    return s.blocks.length ? s.zone : destinationZone(trip) || trip.homeTz;
  };
  const firstDay = (typeof params.day === 'string' && days.includes(params.day) ? params.day : days[0]) ?? '';
  const [form, setForm] = useState<PlanForm>(() => (editing ? planFromItem(editing) : newPlanForm(firstDay, zoneFor(firstDay))));
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState(0);
  const [saving, setSaving] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const set = (p: Partial<PlanForm>) => setForm((f) => ({ ...f, ...p }));
  const issues = planIssues(form);
  const show = (k: string) => tried && issues.includes(k as never);

  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('plan.title')} body={t('today.notFound')} />
      </Screen>
    );
  }

  const pickType = (type: PlanType) => {
    const fresh = newPlanForm(form.day, form.tz, type);
    // Switching to or from a stay resets the times to its usual check-in / check-out.
    set(type === 'stay' || form.type === 'stay' ? { type, start: fresh.start, end: fresh.end, endDay: fresh.endDay } : { type });
  };
  const pickDay = (day: string) => set({ day, tz: editing ? form.tz : zoneFor(day), endDay: form.endDay > day ? form.endDay : days[days.indexOf(day) + 1] ?? form.endDay });

  const save = async (another: boolean) => {
    setTried(true);
    if (issues.length || saving) {
      AccessibilityInfo.announceForAccessibility(t('plan.needTitle'));
      return;
    }
    const item = itemFromPlan(form, trip.id, editing);
    if (!item) return;
    setSaving(true);
    const items = editing ? trip.items.map((i) => (i.id === editing.id ? item : i)) : [...trip.items, item];
    const endDate = item.end && item.end.local.slice(0, 10) > trip.endDate ? item.end.local.slice(0, 10) : trip.endDate;
    const ok = await saveTrip({ ...trip, items, endDate });
    setSaving(false);
    if (!ok) {
      Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
      return;
    }
    haptic.success();
    if (another) {
      setAdded((n) => n + 1);
      setForm(newPlanForm(form.day, form.tz, form.type === 'stay' ? 'tour' : form.type));
      setTried(false);
      AccessibilityInfo.announceForAccessibility(t('plan.saved', { title: item.title }));
      scroller.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    router.back();
  };

  const remove = () =>
    editing &&
    Alert.alert(t('item.deleteConfirm', { title: editing.title }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!(await deleteItem(trip.id, editing.id))) {
            Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
            return;
          }
          router.back();
        },
      },
    ]);

  const typeLabel = (k: PlanType) => t(`plan.type.${k}` as Key);
  return (
    <>
      <Stack.Screen options={{ title: editing ? t('plan.editTitle') : t('plan.title') }} />
      <ScrollView
        ref={scroller}
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {added ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: space.s, alignItems: 'center', backgroundColor: theme.okSoft, borderRadius: radius.m, padding: space.m }}>
            <Ionicons name="checkmark-circle" size={20} color={theme.ok} />
            <Text style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>{added === 1 ? t('plan.addedOne') : t('plan.addedMany', { n: added })}</Text>
          </View>
        ) : null}

        {/* What kind */}
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
            {t('plan.what')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('plan.what')}>
            {PLAN_TYPES.map((k) => {
              const on = form.type === k;
              const tone = toneColours(theme, TYPE_TONE[k]);
              return (
                <PressableScale
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={typeLabel(k)}
                  onPress={() => pickType(k)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.s,
                    minHeight: TOUCH,
                    paddingHorizontal: space.m,
                    borderRadius: radius.pill,
                    backgroundColor: on ? tone.bg : theme.card,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? tone.fg : theme.line,
                  }}
                >
                  <Ionicons name={TYPE_ICON[k]} size={18} color={tone.fg} />
                  <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{typeLabel(k)}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* Title */}
        <TextField label={t(`plan.titleLabel.${form.type}` as Key)} value={form.title} onChange={(v) => set({ title: v })} error={show('title') ? t('plan.needTitle') : undefined} />

        {/* Which day */}
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
            {form.type === 'stay' ? t('plan.checkInDay') : t('plan.day')}
          </Text>
          <DayChips days={days} value={form.day} onPick={pickDay} />
          {show('day') ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('plan.needDay')}</Text> : null}
        </View>

        {/* When */}
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <TimeField
              label={form.type === 'stay' ? t('plan.checkInTime') : form.type === 'flight' ? t('plan.departs') : t('plan.start')}
              typedLabel={t('plan.startTyped')}
              value={form.start}
              onChange={(v) => set({ start: v })}
              hint={t('plan.startHint')}
              zone={form.tz}
            />
          </View>
          {form.type === 'stay' ? null : (
            <View style={{ flex: 1 }}>
              <TimeField
                label={form.type === 'flight' ? t('plan.lands') : t('plan.end')}
                typedLabel={t('plan.endTyped')}
                value={form.end}
                onChange={(v) => set({ end: v })}
                hint={t('plan.endHint')}
                zone={form.tz}
                error={show('end') ? t('plan.badTime') : undefined}
              />
            </View>
          )}
        </View>
        {form.type !== 'stay' && form.end ? <Button label={t('plan.clearEnd')} hint={t('plan.clearEndHint')} kind="quiet" icon="close" onPress={() => set({ end: '' })} /> : null}

        {/* A stay's check-out */}
        {form.type === 'stay' ? (
          <View style={{ gap: space.s }}>
            <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
              {t('plan.checkOutDay')}
            </Text>
            <DayChips days={days.filter((d) => d > form.day).concat(days.length && form.endDay > days[days.length - 1] ? [form.endDay] : [])} value={form.endDay} onPick={(d) => set({ endDay: d })} />
            {show('endDay') ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('plan.needCheckOut')}</Text> : null}
            <TimeField label={t('plan.checkOutTime')} typedLabel={t('plan.endTyped')} value={form.end} onChange={(v) => set({ end: v })} hint={t('plan.endHint')} zone={form.tz} />
          </View>
        ) : null}

        {/* Optional details */}
        <View style={{ gap: space.m }}>
          <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
            {t('plan.optional')}
          </Text>
          <TextField label={form.type === 'flight' ? t('plan.fromAirport') : t('plan.place')} value={form.place} onChange={(v) => set({ place: v })} />
          <TextField label={t('plan.code')} value={form.code} onChange={(v) => set({ code: v })} autoCapitalize="none" />
          <TextField label={t('plan.notes')} value={form.notes} onChange={(v) => set({ notes: v })} multiline />
        </View>

        <Text style={[typeScale.small, { color: theme.muted }]}>{t('plan.blankNote', { day: form.day ? formatDay(form.day, lang) : '' })}</Text>

        {editing ? (
          <>
            <Button label={t('plan.saveChanges')} hint={t('plan.doneHint')} icon="checkmark" onPress={() => save(false)} />
            <Button label={t('common.delete')} hint={t('plan.deleteHint')} kind="quiet" icon="trash-outline" onPress={() => remove()} />
          </>
        ) : (
          <>
            <Button label={t('plan.saveAnother')} hint={t('plan.saveAnotherHint')} icon="add" onPress={() => save(true)} />
            <Button label={t('plan.done')} hint={t('plan.doneHint')} kind="secondary" icon="checkmark" onPress={() => save(false)} />
          </>
        )}
      </ScrollView>
    </>
  );
}

/** Trip days as chips (only the trip's own dates), one row that scrolls sideways. */
function DayChips({ days, value, onPick }: { days: string[]; value: string; onPick: (d: string) => void }) {
  const { theme, lang } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
      {days.map((d) => {
        const on = d === value;
        const label = formatDay(d, lang);
        return (
          <PressableScale
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            onPress={() => onPick(d)}
            style={{ minHeight: TOUCH, paddingHorizontal: space.m, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? theme.accentStrong : theme.card, borderWidth: 1, borderColor: on ? theme.accentStrong : theme.line }}
          >
            <Text style={[typeScale.bodyStrong, { color: on ? theme.onAccent : theme.ink }]}>{label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
