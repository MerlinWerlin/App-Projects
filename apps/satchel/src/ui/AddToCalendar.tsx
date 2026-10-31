// T89 "Add to Calendar": a button (or a 48 pt calendar icon for day headers) that opens a sheet for a whole trip,
// one day or one booking. The sheet says how many bookings go in, offers booking codes and private notes (both off
// each time it opens), then writes a standard .ics file and opens the share sheet, where Calendar adds it.
// File text: src/core/ics.ts (UTC times from each booking's own zone). File + share: src/native/calendarFile.ts.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../core/format.ts';
import { buildIcs, icsFileName, itemsInScope, type IcsScope, type IcsWords } from '../core/ics.ts';
import { isTransport, type Trip } from '../core/model.ts';
import type { T } from '../i18n/core.ts';
import { haptic } from '../native/device.ts';
import { shareCalendarFile, type CalendarShareResult } from '../native/calendarFile.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { kindKey } from './kinds.tsx';
import { Body, Button, PressableScale, ToggleRow } from './kit.tsx';

/** The catalogue wording for the event text inside the file. */
export function icsWords(t: T): IcsWords {
  return {
    kind: (k) => t(kindKey(k)),
    starts: (k, at) =>
      isTransport(k) ? t('calendar.event.departs', { at }) : k === 'hotel' ? t('calendar.event.checkIn', { at }) : k === 'car' ? t('calendar.event.pickUp', { at }) : t('calendar.event.starts', { at }),
    ends: (k, at) =>
      isTransport(k) ? t('calendar.event.arrives', { at }) : k === 'hotel' ? t('calendar.event.checkOut', { at }) : k === 'car' ? t('calendar.event.dropOff', { at }) : t('calendar.event.ends', { at }),
    zoneTime: (time, city) => t('calendar.event.zoneTime', { time, city }),
    code: (ref) => t('calendar.event.code', { ref }),
    notes: (text) => t('calendar.event.notes', { text }),
  };
}

type Failure = Exclude<CalendarShareResult, 'shared'> | null;

export function AddToCalendar({ trip, scope, compact = false }: { trip: Trip; scope: IcsScope; compact?: boolean }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState(false);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Failure>(null);

  const day = scope.kind === 'day' ? formatDay(scope.date, lang) : '';
  const [label, a11yLabel, hint, title] =
    scope.kind === 'trip'
      ? [t('calendar.addTrip'), t('calendar.addTrip'), t('calendar.addTripHint'), t('calendar.title.trip')]
      : scope.kind === 'day'
        ? [t('calendar.addDay'), t('calendar.addDayA11y', { day }), t('calendar.addDayHint'), t('calendar.title.day', { day })]
        : [t('calendar.addItem'), t('calendar.addItem'), t('calendar.addItemHint'), t('calendar.title.item')];

  // Built only while the sheet is open (the day icons on a long trip cost nothing until tapped).
  const result = useMemo(() => (open ? buildIcs(trip, icsWords(t), { scope, includeCodes: codes, includeNotes: notes }) : null), [open, trip, t, codes, notes, scope]);
  // The switches show only when something in scope has a code / notes to add.
  const scoped = useMemo(() => (open ? itemsInScope(trip, scope) : []), [open, trip, scope]);
  const hasCodes = scoped.some((i) => (i.ref ?? '').trim());
  const hasNotes = scoped.some((i) => (i.notes ?? '').trim());
  const hasStay = !!result && /DTSTART;VALUE=DATE/.test(result.text);

  const show = () => {
    setCodes(false);
    setNotes(false);
    setFailed(null);
    setBusy(false);
    setOpen(true);
  };
  const send = async () => {
    if (!result || result.count === 0 || busy) return;
    setBusy(true);
    const r = await shareCalendarFile(icsFileName(trip, scope), result.text, t('calendar.shareTitle', { name: trip.name }));
    setBusy(false);
    if (r === 'shared') {
      haptic.success();
      setOpen(false);
      return;
    }
    setFailed(r);
    AccessibilityInfo.announceForAccessibility(t('calendar.error.title'));
  };
  const errorBody = failed === 'write' ? t('calendar.error.write') : failed === 'unavailable' ? t('calendar.error.unavailable') : t('calendar.error.share');

  return (
    <>
      {compact ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={hint}
          onPress={show}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill }}
        >
          <Ionicons name="calendar-outline" size={22} color={theme.sea} />
        </PressableScale>
      ) : (
        <Button label={label} hint={hint} kind="quiet" icon="calendar-outline" onPress={show} />
      )}
      {open ? (
        <Modal visible transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              accessibilityHint={t('calendar.cancelHint')}
              onPress={() => setOpen(false)}
              style={{ flex: 1, minHeight: TOUCH, backgroundColor: theme.scrim }}
            />
            <View
              accessibilityViewIsModal
              style={{ maxHeight: '88%', backgroundColor: theme.card, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, borderWidth: 1, borderColor: theme.line }}
            >
              <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: insets.bottom + space.l, gap: space.m }}>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
                  {title}
                </Text>
                {result && result.count > 0 ? (
                  <>
                    <Body muted>{t('calendar.body')}</Body>
                    <View accessible accessibilityLiveRegion="polite">
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink, fontVariant: ['tabular-nums'] }}>
                        {result.count === 1 ? t('calendar.countOne') : t('calendar.count', { n: result.count })}
                      </Text>
                    </View>
                    {hasStay ? <Body muted>{t('calendar.stays')}</Body> : null}
                  </>
                ) : (
                  <Body>{t('calendar.nothing')}</Body>
                )}
                {result && result.skipped > 0 ? <Body muted>{result.skipped === 1 ? t('calendar.skippedOne') : t('calendar.skipped', { n: result.skipped })}</Body> : null}
                {result && result.count > 0 ? (
                  <>
                    {hasCodes ? <ToggleRow label={t('calendar.codes')} hint={t('calendar.codesHint')} value={codes} onChange={setCodes} /> : null}
                    {hasNotes ? <ToggleRow label={t('calendar.notes')} hint={t('calendar.notesHint')} value={notes} onChange={setNotes} /> : null}
                    <Body muted>{t('calendar.never')}</Body>
                    <Body muted>{t('calendar.again')}</Body>
                  </>
                ) : null}
                {failed ? (
                  <ErrorNotice
                    title={t('calendar.error.title')}
                    body={errorBody}
                    action={failed === 'unavailable' ? undefined : t('common.tryAgain')}
                    actionHint={t('calendar.sendHint')}
                    onAction={failed === 'unavailable' ? undefined : send}
                  />
                ) : null}
                <View style={{ flexDirection: 'row', gap: space.m }}>
                  <View style={{ flex: 1 }}>
                    <Button label={t('common.cancel')} hint={t('calendar.cancelHint')} kind="quiet" onPress={() => setOpen(false)} />
                  </View>
                  {result && result.count > 0 ? (
                    <View style={{ flex: 1 }}>
                      <Button label={t('calendar.send')} hint={t('calendar.sendHint')} icon="calendar-outline" onPress={send} />
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
