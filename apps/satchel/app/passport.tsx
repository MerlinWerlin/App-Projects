// T103 Passport (owner-1031 D, "less bland"): every country and city the traveller has reached as an original
// illustrated stamp (src/ui/Stamp.tsx), on paper-texture pages (pure SVG pattern), newest first, with counts
// (countries, cities, continents) and a "First stamp" highlight for a newly finished trip. Tap a stamp for the trip
// it came from (its recap). Share a page as text (src/native/share.ts only shares text: no image capture in this
// build). All maths in src/core/stamps.ts. Free, offline, theme tokens only, timed fades only.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { freshTrip, stampDate, stampPages, stampsText, type PassportStamp } from '../src/core/stamps.ts';
import { haptic } from '../src/native/device.ts';
import { shareText } from '../src/native/share.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { space } from '../src/theme/tokens.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { FadeInView, HeroHeader, SectionCard, StatTile } from '../src/ui/hero.tsx';
import { Body, Button, Card, EmptyState, ToggleRow } from '../src/ui/kit.tsx';
import { PaperPage, Stamp, stampLabels, usePassport } from '../src/ui/Stamp.tsx';

const PER_PAGE = 6;

export default function PassportScreen() {
  const { t, theme } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const { collection, includeDemo, setIncludeDemo, hasDemo, today } = usePassport();
  const pages = useMemo(() => stampPages(collection.stamps, PER_PAGE), [collection]);
  const fresh = useMemo(() => freshTrip(collection, trips, today), [collection, trips, today]);
  const open = (s: PassportStamp) => router.push(`/recap/${s.tripId}`);
  const c = collection.counts;

  const header = (
    <View style={{ gap: space.m, marginBottom: space.m }}>
      <FadeInView>
        <HeroHeader tone="trips" illustration="passport" compact eyebrow={t('stamps.eyebrow')} title={t('stamps.title')} subtitle={t('stamps.subtitle')} />
      </FadeInView>
      {collection.stamps.length ? (
        <FadeInView delay={40}>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <StatTile value={c.countries} label={t('stamps.count.countries')} icon="flag-outline" tone="sea" />
            <StatTile value={c.cities} label={t('stamps.count.cities')} icon="business-outline" tone="teal" />
            <StatTile value={c.continents} label={t('stamps.count.continents')} icon="earth-outline" tone="accent" />
          </View>
        </FadeInView>
      ) : (
        <FadeInView delay={40}>
          <EmptyState
            art="compass"
            title={t('stamps.empty.title')}
            body={!includeDemo && collection.demoLeftOut > 0 ? t('stamps.empty.demoBody') : t('stamps.empty.body')}
            action={<Button label={t('stamps.empty.add')} hint={t('stamps.empty.addHint')} kind="quiet" icon="add" onPress={() => router.push('/trip-edit')} />}
          />
        </FadeInView>
      )}
      {fresh ? (
        <FadeInView delay={80}>
          <SectionCard
            icon="sparkles-outline"
            tone="accent"
            title={t('stamps.fresh.title', { trip: fresh.tripName })}
            subtitle={fresh.stamps.length === 1 ? t('stamps.fresh.one') : t('stamps.fresh.many', { n: fresh.stamps.length })}
          >
            <PaperPage>
              {fresh.stamps.slice(0, PER_PAGE).map((s, i) => (
                <Stamp key={s.key} stamp={s} first size={124} delay={i * 60} onPress={() => open(s)} />
              ))}
            </PaperPage>
          </SectionCard>
        </FadeInView>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: space.m, marginTop: space.m }}>
      {hasDemo ? (
        <Card>
          <ToggleRow label={t('travels.demo.toggle')} hint={t('travels.demo.hint')} value={includeDemo} onChange={setIncludeDemo} />
          {!includeDemo && collection.demoLeftOut ? <Body muted>{t('stamps.demoLeftOut')}</Body> : null}
        </Card>
      ) : null}
      <Body muted>{t('stamps.note')}</Body>
      {collection.stamps.length ? <Body muted>{t('stamps.share.note')}</Body> : null}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl }}
      data={pages}
      keyExtractor={(page) => page[0]?.key ?? 'empty'}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={{ height: space.m }} />}
      initialNumToRender={3}
      windowSize={5}
      renderItem={({ item: page, index }) => <StampPageView page={page} n={index + 1} total={pages.length} onOpen={open} />}
    />
  );
}

function StampPageView({ page, n, total, onOpen }: { page: PassportStamp[]; n: number; total: number; onOpen: (s: PassportStamp) => void }) {
  const { t, lang } = useApp();
  const [failed, setFailed] = useState(false);
  const text = useMemo(
    () =>
      stampsText(
        page,
        {
          heading: t('stamps.share.heading'),
          counts: (c) => t('stamps.share.counts', { countries: c.countries, cities: c.cities, continents: c.continents }),
          line: (place, date, mark) => t('stamps.share.line', { place, date, mark: t(mark === 'departed' ? 'stamps.mark.departed' : 'stamps.mark.arrived') }),
          footer: t('stamps.share.footer'),
        },
        (s) => stampLabels(s, t, lang).place,
        (d) => stampDate(d, lang),
      ),
    [page, t, lang],
  );
  const share = async () => {
    const res = await shareText(text, t('stamps.share.subject'));
    if (res === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('stamps.share.failed'));
      return;
    }
    setFailed(false);
    if (res === 'shared') haptic.success();
  };
  return (
    <FadeInView>
      <PaperPage
        label={t('stamps.page.label', { n, total })}
        footer={
          <View style={{ gap: space.s, marginTop: space.s }}>
            {failed ? <ErrorNotice title={t('stamps.page.share')} body={t('stamps.share.failed')} action={t('common.tryAgain')} actionHint={t('stamps.page.shareHint')} onAction={share} /> : null}
            <Button label={t('stamps.page.share')} hint={t('stamps.page.shareHint')} kind="quiet" icon="share-outline" onPress={share} />
          </View>
        }
      >
        {page.map((s, i) => (
          <Stamp key={s.key} stamp={s} delay={i * 50} onPress={() => onOpen(s)} />
        ))}
      </PaperPage>
    </FadeInView>
  );
}
