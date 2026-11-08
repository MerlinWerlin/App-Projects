// T156 Step-free travel: the traveller's access needs (wheelchair, step-free, pram or stroller, limited walking), kept
// on this phone only (src/state/stepfree.ts), what they change across the app, a "show a local" card in the stay
// country's language (the phrase screen's own pick: trip country, else last used, else phone zone) built from the
// help-card lines plus src/content/stepfree_lines.json, and generic travel-assistance advice (no company names).
// T157: "Ask for a lift" opens "Where is the lift?" as a full-screen phrase card (app/phrase-card.tsx?phrase=lift).
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { HelpTable } from '../src/core/helpcards.ts';
import { LIFT_CARD } from '../src/core/liftcard.ts';
import { ACCESS_NEEDS, ASSISTANCE_NOTICE_HOURS, needsCard, needsCardText, toggleNeed, type StepFreeTable } from '../src/core/stepfree.ts';
import helpData from '../src/content/helpcards.json';
import sfData from '../src/content/stepfree_lines.json';
import { shareText as shareSheet } from '../src/native/share.ts';
import { useApp } from '../src/state/app.tsx';
import { useStepFree } from '../src/state/stepfree.ts';
import { fonts, radius, rhythm, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../src/ui/hero.tsx';
import { Body, Button, PressableScale, Screen } from '../src/ui/kit.tsx';
import { LANG_KEY, usePhraseLang } from '../src/ui/phrases.ts';
import { NEED_KEY } from '../src/ui/stepfree.tsx';
import { AccessIcon } from '../src/ui/stepfreeIcons.tsx';

const HELP = helpData as HelpTable;
const SF = sfData as StepFreeTable;

export default function StepFreeScreen() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [prefs, change] = useStepFree();
  const { lang } = usePhraseLang(null);
  const [shareFailed, setShareFailed] = useState(false);
  const card = useMemo(() => needsCard(prefs.needs, HELP, SF, lang), [prefs.needs, lang]);

  const share = async () => {
    setShareFailed(false);
    if ((await shareSheet(needsCardText(card), t('stepfree.cardHeader'))) === 'failed') setShareFailed(true);
  };

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="trips" illustration="none" title={t('stepfree.title')} subtitle={t('stepfree.subtitle')} />
      </FadeInView>

      <SectionCard title={t('stepfree.needsHeader')} icon="accessibility-outline" tone="teal">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {ACCESS_NEEDS.map((n) => {
            const on = prefs.needs.includes(n);
            return (
              <PressableScale
                key={n}
                accessibilityRole="checkbox"
                accessibilityLabel={t(NEED_KEY[n])}
                accessibilityHint={t('stepfree.needHint')}
                accessibilityState={{ checked: on }}
                onPress={() => change((p) => toggleNeed(p, n))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.s,
                  paddingHorizontal: space.m,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: on ? theme.ok : theme.line,
                  backgroundColor: on ? theme.okSoft : theme.card,
                }}
              >
                <AccessIcon id={n} size={28} tone={on ? 'ok' : 'sea'} />
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink }}>{t(NEED_KEY[n])}</Text>
              </PressableScale>
            );
          })}
        </View>
        {prefs.needs.length ? null : <Body muted>{t('stepfree.needsNone')}</Body>}
      </SectionCard>

      <SectionCard title={t('stepfree.cardHeader')} subtitle={t('stepfree.cardIntro')} icon="language-outline" tone="sea">
        {card.lines.length ? (
          <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: theme.cardRaised, borderWidth: 1, borderColor: theme.line }}>
            {[card.title, ...card.lines].map((l) => (
              <View key={l.id} accessible accessibilityLabel={l.local === l.en ? l.en : t('stepfree.cardA11y', { local: l.local, en: l.en })} style={{ gap: 2 }}>
                <Text selectable accessibilityLanguage={l.lang} maxFontSizeMultiplier={1.6} style={{ fontSize: 24, lineHeight: 32, fontWeight: '700', color: theme.ink }}>
                  {l.local}
                </Text>
                {l.local !== l.en ? <Text style={[typeScale.small, { color: theme.muted }]}>{l.en}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <Body muted>{t('stepfree.cardEmpty')}</Body>
        )}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('stepfree.cardLang', { lang: t(LANG_KEY[lang]) })}</Text>
        {card.lines.length ? <Button kind="secondary" icon="share-outline" label={t('stepfree.cardShare')} hint={t('stepfree.cardShareHint')} onPress={share} /> : null}
        {shareFailed ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('helpcards.card.shareFailed')}</Text> : null}
        <Button
          kind="secondary"
          icon="chatbubble-ellipses-outline"
          label={t('f110.lift.ask')}
          hint={t('f110.lift.askHint')}
          onPress={() => router.push({ pathname: '/phrase-card', params: { phrase: LIFT_CARD, lang } })}
        />
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('stepfree.cardCheck')}</Text>
        <Button kind="quiet" icon="people-outline" label={t('stepfree.helpCards')} hint={t('stepfree.helpCardsHint')} onPress={() => router.push({ pathname: '/helpcards', params: { lang } })} />
      </SectionCard>

      <SectionCard title={t('stepfree.doesHeader')} icon="sparkles-outline" tone="ok">
        <View style={{ gap: rhythm.tight }}>
          <Row icon="toilet" text={t('stepfree.does.toilets')} />
          <Row icon="lift" text={t('stepfree.does.map')} />
          <Row icon="walkLimited" text={t('stepfree.does.trips')} />
        </View>
      </SectionCard>

      <SectionCard title={t('stepfree.adviceHeader')} icon="airplane-outline" tone="warn">
        <Body>{t('stepfree.advice.notice', { hours: ASSISTANCE_NOTICE_HOURS })}</Body>
        <Body>{t('stepfree.advice.tell')}</Body>
        <Body>{t('stepfree.advice.mark')}</Body>
        <Body muted>{t('stepfree.advice.own')}</Body>
      </SectionCard>

      <Text style={[typeScale.small, { color: theme.muted, paddingBottom: space.xl }]}>{t('stepfree.privacy')}</Text>
    </Screen>
  );
}

function Row({ icon, text }: { icon: 'toilet' | 'lift' | 'walkLimited'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
      <AccessIcon id={icon} size={32} />
      <View style={{ flex: 1 }}>
        <Body>{text}</Body>
      </View>
    </View>
  );
}
