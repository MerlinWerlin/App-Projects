// T121 Help cards: the people you travel with, each with an "If I'm lost" card and (once a need is ticked) an access
// needs card, shown big in the local language with English under it (app/helpcard.tsx). The language follows the
// phrase screen (trip country, else last used, else phone zone; src/ui/phrases.ts) and can be changed here. Companions
// on the trip without a card are offered with one tap; anyone else (a child, a friend) can be added by name.
// Everything is kept on this phone only (src/state/helpcards.ts), never in a shared trip file.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { focusTrip } from '../src/core/glance.ts';
import { cardsOf, companionsWithoutCard, hotelForCards, MAX_PEOPLE, type CardKind, type HelpPerson } from '../src/core/helpcards.ts';
import { parseLangParam, PHRASE_LANGS, type PhraseLang } from '../src/core/phrases.ts';
import { helpPhotoPath } from '../src/native/helpcardPhoto.ts';
import { useApp } from '../src/state/app.tsx';
import { useHelpPeople } from '../src/state/helpcards.ts';
import { useTrips } from '../src/state/trips.tsx';
import { elevated, fonts, radius, rhythm, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, IconBadge, SectionCard } from '../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen } from '../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE, usePhraseLang } from '../src/ui/phrases.ts';

const KIND_ICON = { lost: 'help-buoy-outline', needs: 'accessibility-outline' } as const;

export default function HelpCardsScreen() {
  const params = useLocalSearchParams<{ lang?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [people, loaded] = useHelpPeople();
  const { lang, from, setLang } = usePhraseLang(parseLangParam(params.lang));
  const trip = focusTrip(trips, todayIn(deviceZone()));
  const offers = companionsWithoutCard(trip, people);
  // Not memoised: a cheap scan, and the stay "now" depends on the clock.
  const hotel = hotelForCards(trips, Date.now());
  const native = (l: PhraseLang) => PHRASE_TABLE.languages.find((x) => x.code === l)?.native ?? l;
  const full = people.length >= MAX_PEOPLE;

  const open = (p: HelpPerson, kind: CardKind) => router.push({ pathname: '/helpcard', params: { id: p.id, kind, lang } });
  const edit = (p: HelpPerson) => router.push({ pathname: '/helpcard-edit', params: { id: p.id } });

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="emergency" illustration="none" title={t('helpcards.title')} subtitle={t('helpcards.intro')} />
      </FadeInView>

      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('helpcards.language')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('helpcards.language')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {PHRASE_LANGS.map((l) => (
            <Chip
              key={l}
              label={t('helpcards.langOption', { native: native(l), english: t(LANG_KEY[l]) })}
              selected={l === lang}
              hint={t('helpcards.langHint')}
              onPress={() => setLang(l)}
            />
          ))}
        </View>
        {from === 'trip' ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.langFromTrip')}</Text> : null}
      </View>

      <View style={{ gap: rhythm.stack }}>
        {loaded && people.length === 0 ? <EmptyState art="lifebuoy" title={t('helpcards.emptyTitle')} body={t('helpcards.emptyBody')} /> : null}
        {people.map((p) => (
          <PersonRow key={p.id} person={p} onOpen={(k) => open(p, k)} onEdit={() => edit(p)} />
        ))}
      </View>

      <SectionCard title={t('helpcards.add.title')} icon="person-add-outline" tone="teal">
        {full ? <Body muted>{t('helpcards.add.full', { n: MAX_PEOPLE })}</Body> : null}
        {!full && offers.length ? (
          <View style={{ gap: space.s }}>
            <Label>{t('helpcards.add.companions')}</Label>
            {offers.map((c) => (
              <Button
                key={c.id}
                kind="secondary"
                icon="person-add-outline"
                label={t('helpcards.add.companion', { name: c.name })}
                hint={t('helpcards.add.companionHint')}
                onPress={() => router.push({ pathname: '/helpcard-edit', params: { companionId: c.id, tripId: trip?.id ?? '' } })}
              />
            ))}
          </View>
        ) : null}
        {!full ? <Button kind={offers.length ? 'quiet' : 'primary'} icon="add-outline" label={t('helpcards.add.someone')} hint={t('helpcards.add.someoneHint')} onPress={() => router.push('/helpcard-edit')} /> : null}
      </SectionCard>

      <View style={{ gap: space.xs }}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{hotel ? t('helpcards.hotelFrom', { name: hotel.name }) : t('helpcards.hotelNone')}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.privacy')}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.check')}</Text>
      </View>
      <Button kind="quiet" icon="language-outline" label={t('helpcards.phrases')} hint={t('helpcards.phrasesHint')} onPress={() => router.push({ pathname: '/phrases', params: { lang } })} />
      <Button kind="quiet" icon="image-outline" label={t('signs.fromHelpcards')} hint={t('signs.fromHelpcardsHint')} onPress={() => router.push({ pathname: '/signs', params: { lang } })} />
    </Screen>
  );
}

function PersonRow({ person, onOpen, onEdit }: { person: HelpPerson; onOpen: (kind: CardKind) => void; onEdit: () => void }) {
  const { t, theme } = useApp();
  const cards = cardsOf(person);
  return (
    <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, ...elevated(theme, 'low') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        {person.photoUri ? (
          <Image
            accessible
            accessibilityLabel={t('helpcards.photoOf', { name: person.name })}
            source={{ uri: helpPhotoPath(person.photoUri) }}
            resizeMode="cover"
            style={{ width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.seaSoft }}
          />
        ) : (
          <IconBadge name="person-outline" tone="sea" />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.ink }}>
            {person.name}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
            {person.callPhone ? t('helpcards.row.calls', { who: person.callName || person.callPhone }) : t('helpcards.row.noCall')}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('helpcards.row.edit', { name: person.name })}
          accessibilityHint={t('helpcards.row.editHint')}
          onPress={onEdit}
          style={{ width: 48, alignItems: 'center' }}
        >
          <Ionicons name="create-outline" size={22} color={theme.sea} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {cards.map((k) => (
          <Button
            key={k}
            kind={k === 'lost' ? 'primary' : 'secondary'}
            icon={KIND_ICON[k]}
            label={k === 'lost' ? t('helpcards.row.lost') : t('helpcards.row.needs')}
            hint={t(k === 'lost' ? 'helpcards.row.lostHint' : 'helpcards.row.needsHint', { name: person.name })}
            onPress={() => onOpen(k)}
          />
        ))}
      </View>
    </View>
  );
}
