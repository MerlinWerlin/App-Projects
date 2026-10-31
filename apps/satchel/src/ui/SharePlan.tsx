// T71 "Share plan" on the trip screen: a sheet to choose the whole trip, one day or from today, and whether to add
// booking codes (off by default), with a preview of the exact text; Share opens the system share sheet with it.
// Text only (src/core/itinerarytext.ts): documents, attachments, notes and the emergency card are never in it.
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../core/format.ts';
import { daysWithPlans, itineraryText, type ItineraryScope, type ItineraryWords } from '../core/itinerarytext.ts';
import { journalToday } from '../core/journal.ts';
import type { Trip } from '../core/model.ts';
import { tripPhase } from '../core/timeline.ts';
import type { T } from '../i18n/core.ts';
import { haptic } from '../native/device.ts';
import { shareText } from '../native/share.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { kindKey } from './kinds.tsx';
import { Body, Button, Chip, Label, ToggleRow } from './kit.tsx';

/** The catalogue wording for the itinerary text. */
export function itineraryWords(t: T): ItineraryWords {
  return {
    kind: (k) => t(kindKey(k)),
    dates: (range, n) => t('share.text.dates', { range, n }),
    dayHeading: (day, city) => t('share.text.day', { day, city }),
    zoneTime: (time, city) => t('share.text.zoneTime', { time, city }),
    noTime: t('share.text.noTime'),
    arrives: (time) => t('share.text.arrives', { time }),
    code: (ref) => t('share.text.code', { ref }),
    nothing: t('share.text.nothing'),
  };
}

type ScopeKind = ItineraryScope['kind'];

export function SharePlan({ trip }: { trip: Trip }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ScopeKind>('trip');
  const [day, setDay] = useState<string | null>(null);
  const [codes, setCodes] = useState(false);
  const [failed, setFailed] = useState(false);

  const days = useMemo(() => daysWithPlans(trip), [trip]);
  const today = journalToday(trip);
  const onNow = tripPhase(trip, today) === 'active';
  const chosenDay = day && days.includes(day) ? day : days.includes(today) ? today : (days[0] ?? trip.startDate);
  const scope: ItineraryScope = kind === 'day' ? { kind, date: chosenDay } : kind === 'from' && onNow ? { kind, date: today } : { kind: 'trip' };
  const text = useMemo(() => itineraryText(trip, itineraryWords(t), { scope, includeCodes: codes, lang }), [trip, t, lang, codes, scope.kind, chosenDay, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = () => {
    setKind('trip');
    setDay(null);
    setCodes(false);
    setFailed(false);
    setOpen(true);
  };
  const send = async () => {
    const r = await shareText(text, t('share.subject', { name: trip.name }));
    if (r === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('share.failed'));
      return;
    }
    if (r === 'shared') haptic.success();
    setOpen(false);
  };

  const scopes: ScopeKind[] = onNow ? ['trip', 'day', 'from'] : ['trip', 'day'];
  return (
    <>
      <Button label={t('share.open')} hint={t('share.openHint')} kind="quiet" icon="share-outline" onPress={show} />
      <Modal visible={open} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            accessibilityHint={t('share.cancelHint')}
            onPress={() => setOpen(false)}
            style={{ flex: 1, minHeight: 48, backgroundColor: theme.scrim }}
          />
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: '88%',
              backgroundColor: theme.card,
              borderTopLeftRadius: radius.l,
              borderTopRightRadius: radius.l,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: insets.bottom + space.l, gap: space.m }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
                {t('share.title')}
              </Text>
              <Body muted>{t('share.body')}</Body>
              <Label>{t('share.scope')}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('share.scope')}>
                {scopes.map((k) => (
                  <Chip key={k} label={t(`share.scope.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
                ))}
              </View>
              {kind === 'day' && days.length ? (
                <View style={{ gap: space.s }}>
                  <Label>{t('share.pickDay')}</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('share.pickDay')}>
                    <View style={{ flexDirection: 'row', gap: space.s }}>
                      {days.map((d) => (
                        <Chip key={d} label={formatDay(d, lang)} selected={d === chosenDay} onPress={() => setDay(d)} />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : null}
              <ToggleRow label={t('share.codes')} hint={t('share.codesHint')} value={codes} onChange={setCodes} />
              <Label>{t('share.preview')}</Label>
              <View style={{ backgroundColor: theme.paper, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.m, maxHeight: 260 }}>
                <ScrollView nestedScrollEnabled>
                  <Text selectable style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.ink }}>
                    {text.trim()}
                  </Text>
                </ScrollView>
              </View>
              {failed ? <ErrorNotice title={t('share.title')} body={t('share.failed')} action={t('common.tryAgain')} actionHint={t('share.sendHint')} onAction={send} /> : null}
              <View style={{ flexDirection: 'row', gap: space.m }}>
                <View style={{ flex: 1 }}>
                  <Button label={t('common.cancel')} hint={t('share.cancelHint')} kind="quiet" onPress={() => setOpen(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label={t('share.send')} hint={t('share.sendHint')} icon="share-outline" onPress={send} />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
