// T174 Share itinerary (owner, 14 Nov: "share a created itinerary from the app to another iphone in case phones
// die"). One sheet, offline, no server: choose the whole trip or one day, booking codes on (default, with a short
// privacy note) or off, then send it with the system share sheet (AirDrop, Messages, Mail, WhatsApp, Files) as:
//  1. Calendar file (.ics), the default: any iPhone can add it to Calendar; on a phone with Satchel it opens the
//     importer and comes back exactly (src/core/ics.ts writes Satchel's own X-SATCHEL-* lines).
//  2. Satchel trip file (.satchel, the whole trip): every detail, opened straight into Satchel (T15 import, checked).
//  3. Readable text: the day-by-day plan for anyone, any phone, or to print.
// Builders: src/core/ics.ts, src/core/tripfile.ts (via src/state/tripTransfer.ts), src/core/itinerarytext.ts.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../core/format.ts';
import { buildIcs, icsFileName, type IcsScope } from '../core/ics.ts';
import { daysWithPlans, itineraryText } from '../core/itinerarytext.ts';
import type { Trip } from '../core/model.ts';
import { shareCalendarFile } from '../native/calendarFile.ts';
import { haptic } from '../native/device.ts';
import { shareText } from '../native/share.ts';
import { useApp } from '../state/app.tsx';
import { exportTrip } from '../state/tripTransfer.ts';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { icsWords } from './AddToCalendar.tsx';
import { IconBadge, type Tone } from './hero.tsx';
import { Body, Button, Chip, Label, PressableScale, ToggleRow, Warning } from './kit.tsx';
import { itineraryWords } from './SharePlan.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Way = 'calendar' | 'satchel' | 'text';

/** The trip with booking codes taken out (when the traveller turns codes off). */
const withoutCodes = (trip: Trip): Trip => ({ ...trip, items: trip.items.map(({ ref: _ref, ...rest }) => rest) });

/** The Share itinerary button (header icon or full button) and its sheet. */
export function ShareItinerary({ trip, day, compact }: { trip: Trip; day?: string; compact?: boolean }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(true);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [codes, setCodes] = useState(true);
  const [busy, setBusy] = useState<Way | null>(null);
  const [failed, setFailed] = useState(false);
  const days = useMemo(() => daysWithPlans(trip), [trip]);
  const oneDay = pickedDay && days.includes(pickedDay) ? pickedDay : day && days.includes(day) ? day : days[0] ?? trip.startDate;
  const icsScope: IcsScope = whole ? { kind: 'trip' } : { kind: 'day', date: oneDay };
  const hasCodes = trip.items.some((i) => (i.ref ?? '').trim());

  const show = () => {
    setWhole(true);
    setPickedDay(null);
    setCodes(true);
    setFailed(false);
    setOpen(true);
  };

  const send = async (way: Way) => {
    if (busy) return;
    setBusy(way);
    setFailed(false);
    let ok = false;
    if (way === 'calendar') {
      const r = buildIcs(trip, icsWords(t), { scope: icsScope, includeCodes: codes, includeNotes: true });
      ok = r.count > 0 && (await shareCalendarFile(icsFileName(trip, icsScope), r.text, t('shareit.dialog', { name: trip.name }))) === 'shared';
    } else if (way === 'satchel') {
      const r = await exportTrip(codes ? trip : withoutCodes(trip), t('shareit.dialog', { name: trip.name }));
      ok = r.ok;
    } else {
      const text = itineraryText(trip, itineraryWords(t), { scope: whole ? { kind: 'trip' } : { kind: 'day', date: oneDay }, includeCodes: codes, lang });
      ok = (await shareText(text, t('share.subject', { name: trip.name }))) !== 'failed';
    }
    setBusy(null);
    if (ok) {
      haptic.success();
      setOpen(false);
      return;
    }
    setFailed(true);
    AccessibilityInfo.announceForAccessibility(t('shareit.failed'));
  };

  const wayRow = ({ way, icon, tone, title, body, primary }: { way: Way; icon: IconName; tone: Tone; title: string; body: string; primary?: boolean }) => (
    <PressableScale
      key={way}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ busy: busy === way }}
      onPress={() => send(way)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, borderWidth: primary ? 2 : 1, borderColor: primary ? theme.accentStrong : theme.line, backgroundColor: theme.card }}
    >
      <IconBadge name={icon} tone={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{body}</Text>
      </View>
      <Ionicons name={busy === way ? 'hourglass-outline' : 'share-outline'} size={20} color={theme.accentInk} />
    </PressableScale>
  );

  return (
    <>
      {compact ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('shareit.open')}
          accessibilityHint={t('shareit.openHint')}
          onPress={show}
          style={{ width: TOUCH, minHeight: TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }}
        >
          <Ionicons name="share-outline" size={20} color={theme.ink} />
        </PressableScale>
      ) : (
        <Button label={t('shareit.open')} hint={t('shareit.openHint')} kind="quiet" icon="share-outline" onPress={show} />
      )}
      <Modal visible={open} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => setOpen(false)} style={{ flex: 1, minHeight: TOUCH, backgroundColor: theme.scrim }} />
          <View accessibilityViewIsModal style={{ maxHeight: '90%', backgroundColor: theme.paper, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, borderWidth: 1, borderColor: theme.line }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: insets.bottom + space.l, gap: space.m }}>
              <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
                {t('shareit.title')}
              </Text>
              <Body muted>{t('shareit.body')}</Body>

              <Label>{t('shareit.what')}</Label>
              <View style={{ flexDirection: 'row', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('shareit.what')}>
                <Chip label={t('shareit.whole')} selected={whole} onPress={() => setWhole(true)} />
                <Chip label={t('shareit.oneDay')} selected={!whole} onPress={() => setWhole(false)} />
              </View>
              {!whole && days.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('share.pickDay')}>
                  <View style={{ flexDirection: 'row', gap: space.s }}>
                    {days.map((d) => (
                      <Chip key={d} label={formatDay(d, lang)} selected={d === oneDay} onPress={() => setPickedDay(d)} />
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              {hasCodes ? (
                <>
                  <ToggleRow label={t('shareit.codes')} hint={t('shareit.codesHint')} value={codes} onChange={setCodes} />
                  <Text style={[typeScale.small, { color: theme.muted }]}>{t('shareit.codesNote')}</Text>
                </>
              ) : null}

              <Label>{t('shareit.how')}</Label>
              {wayRow({ way: 'calendar', icon: 'calendar', tone: 'accent', title: t('shareit.calendar'), body: t('shareit.calendarBody'), primary: true })}
              {wayRow({ way: 'satchel', icon: 'briefcase', tone: 'sea', title: t('shareit.satchel'), body: t('shareit.satchelBody') })}
              {wayRow({ way: 'text', icon: 'document-text', tone: 'teal', title: t('shareit.text'), body: t('shareit.textBody') })}
              {failed ? <Warning text={t('shareit.failed')} /> : null}
              <Text style={[typeScale.small, { color: theme.muted }]}>{t('shareit.offline')}</Text>
              <Button label={t('common.close')} kind="quiet" onPress={() => setOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
