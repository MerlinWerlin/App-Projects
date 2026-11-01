// T14 Save to Satchel: "Add to a trip" for a PDF or image shared to Satchel (app/openin/index.tsx sends it here with
// the incoming copy's path). The traveller picks the trip and the kind of booking; Continue copies the file into
// attachments/ (the same storage as Attachments in the booking form, src/native/files.ts) and opens the normal new
// booking form with it attached (src/state/openinStash.ts). Nothing is saved until Save there; leaving the form
// without saving deletes the copy, as for any file added in the form. "Don't save" here deletes the incoming copy.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { ITEM_KINDS, newId, type ItemKind } from '../../src/core/model.ts';
import { mimeForKind } from '../../src/core/openin.ts';
import { makeAttachment } from '../../src/core/tickets.ts';
import { copyIntoApp } from '../../src/native/files.ts';
import { discardIncoming, incomingExists } from '../../src/native/openin.ts';
import { useApp } from '../../src/state/app.tsx';
import { stashIncomingFile } from '../../src/state/openinStash.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../../src/ui/hero.tsx';
import { KIND_ICON, kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Chip, EmptyState, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';

export default function OpenInAddScreen() {
  const params = useLocalSearchParams<{ file?: string; name?: string; kind?: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const file = typeof params.file === 'string' ? params.file : '';
  const name = typeof params.name === 'string' ? params.name : '';
  const fileKind = params.kind === 'image' ? 'image' : 'pdf';
  const today = todayIn(deviceZone());

  // Trips still to come or under way first (soonest first), then past trips (most recent first).
  const sorted = useMemo(() => {
    const live = trips.filter((x) => x.endDate >= today).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    const past = trips.filter((x) => x.endDate < today).sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
    return [...live, ...past];
  }, [trips, today]);
  const [picked, setPicked] = useState<string | null>(null);
  const tripId = picked && trips.some((x) => x.id === picked) ? picked : sorted[0]?.id ?? null;
  const trip = trips.find((x) => x.id === tripId);
  const [kind, setKind] = useState<ItemKind>('flight');
  const [gone, setGone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!file) setGone(true);
    else void incomingExists(file).then((ok) => live && !ok && setGone(true));
    return () => {
      live = false;
    };
  }, [file]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const cancel = () => {
    void discardIncoming(file);
    leave();
  };

  const go = async () => {
    if (busy) return;
    if (!trip) {
      AccessibilityInfo.announceForAccessibility(t('openin.add.chooseTrip'));
      return;
    }
    setBusy(true);
    setProblem(null);
    const id = newId('att');
    const saved = await copyIntoApp(file, 'attachments', id, name || (fileKind === 'pdf' ? 'file.pdf' : 'image.jpg'));
    setBusy(false);
    if (!saved.ok) {
      setProblem(t('openin.add.saveFailed'));
      AccessibilityInfo.announceForAccessibility(t('openin.add.saveFailed'));
      return;
    }
    const attachment = makeAttachment({ id, uri: saved.uri, name, mime: mimeForKind(fileKind, name), kind });
    void discardIncoming(file);
    const date = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;
    router.replace({ pathname: '/item-edit', params: { tripId: trip.id, kind, date, openin: stashIncomingFile(attachment) } });
  };

  if (gone) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('openin.failed.title')} body={t('openin.add.gone')} action={<Button label={t('openin.back')} hint={t('openin.backHint')} kind="secondary" onPress={leave} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeInView style={{ gap: space.l }}>
        <HeroHeader tone="trips" illustration="ticket" eyebrow={t('openin.add.eyebrow')} title={t('openin.add.title')} subtitle={t('openin.add.subtitle')} compact />

        <SectionCard title={t('openin.add.file')} icon={fileKind === 'pdf' ? 'document-text-outline' : 'image-outline'} tone="sea">
          <View accessible accessibilityLabel={`${t('openin.add.file')}: ${name || t(`openin.add.fileKind.${fileKind}`)}, ${t(`openin.add.fileKind.${fileKind}`)}`}>
            <Text style={[typeScale.body, { color: theme.ink, fontFamily: fonts.bodyBold }]} numberOfLines={2}>
              {name || t(`openin.add.fileKind.${fileKind}`)}
            </Text>
            <Body muted>{t(`openin.add.fileKind.${fileKind}`)}</Body>
          </View>
        </SectionCard>

        {sorted.length === 0 ? (
          <EmptyState
            art="suitcase"
            title={t('openin.add.noTrips.title')}
            body={t('openin.add.noTrips.body')}
            action={<Button label={t('openin.add.newTrip')} hint={t('openin.add.newTripHint')} icon="add" onPress={() => router.push('/trip-edit')} />}
          />
        ) : (
          <SectionCard title={t('openin.add.trip')} icon="airplane-outline" tone="accent">
            <View accessibilityRole="radiogroup" accessibilityLabel={t('openin.add.trip')} style={{ gap: space.s }}>
              {sorted.map((x) => {
                const selected = x.id === tripId;
                const dates = t('openin.add.tripDates', { from: formatDay(x.startDate, lang), to: formatDay(x.endDate, lang) });
                return (
                  <PressableScale
                    key={x.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${x.name}, ${dates}`}
                    accessibilityHint={t('openin.add.tripHint')}
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => setPicked(x.id)}
                    style={{
                      minHeight: TOUCH,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.m,
                      paddingHorizontal: space.m,
                      paddingVertical: space.s,
                      borderRadius: radius.m,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? theme.accent : theme.line,
                      backgroundColor: selected ? theme.accentSoft : theme.card,
                    }}
                  >
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? theme.accentInk : theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.body, { color: selected ? theme.accentInk : theme.ink, fontFamily: fonts.bodyBold }]} numberOfLines={2}>
                        {x.name}
                      </Text>
                      <Text style={[typeScale.small, { color: theme.muted }]}>{dates}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </SectionCard>
        )}

        {sorted.length > 0 ? (
          <SectionCard title={t('openin.add.kind')} icon="pricetag-outline" tone="teal">
            <View accessibilityRole="radiogroup" accessibilityLabel={t('openin.add.kind')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {ITEM_KINDS.map((k) => (
                <Chip
                  key={k}
                  label={t(kindKey(k))}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                  icon={<Ionicons name={KIND_ICON[k]} size={16} color={kind === k ? theme.accentInk : theme.muted} />}
                />
              ))}
            </View>
          </SectionCard>
        ) : null}

        {problem ? <Warning text={problem} /> : null}
        {sorted.length > 0 ? <Button label={t('openin.add.continue')} hint={t('openin.add.continueHint')} icon="arrow-forward" onPress={go} /> : null}
        <Button label={t('openin.add.cancel')} hint={t('openin.add.cancelHint')} kind="quiet" onPress={cancel} />
      </FadeInView>
    </Screen>
  );
}
