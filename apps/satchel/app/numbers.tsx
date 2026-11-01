// T148 Numbers and prices trainer: learn to read and hear numbers in the 12 phrase languages (src/core/numbers.ts).
// - Number reader: type any whole number 0-999,999 (or tap Another number) and see it in words, in local script,
//   with kana for Japanese and a romanised reading for non-Latin scripts, plus one "good to know" rule per language.
// - At the till: a typed amount in a country's currency, written the way the price tag shows it and read out with
//   the currency word. Countries: the trip's first, then the main ones (More countries shows every one).
// - Quiz: 10 seeded questions (see the number in words, pick it from 4), 15 s each, quicker answers score more;
//   languages from the trip first ("Trip mix" takes turns between them). Best scores stay on this phone.
// Every generated reading carries the "checked by a fluent speaker: not yet" caption. Text only (no speech helper in
// the app). Questions change with a short timed fade and the timer bar runs linearly; with Reduce Motion both are
// static (the seconds count still shows). Params: ?lang=, ?country= (ISO2), ?section=read|till|quiz.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { focusTrip } from '../src/core/glance.ts';
import { newSeed } from '../src/core/games.ts';
import {
  buildQuiz,
  groupedDigits,
  parseTillAmount,
  parseWhole,
  pointsFor,
  QUESTION_MS,
  QUIZ_LENGTH,
  QUIZ_LEVELS,
  recordScore,
  scoreKey,
  spellNumber,
  tillCard,
  tillCountryOrder,
  tillCurrency,
  tillDigits,
  type NumberReading,
  type QuizLevel,
  type QuizQuestion,
} from '../src/core/numbers.ts';
import { languageForCountry, parseLangParam, type PhraseLang } from '../src/core/phrases.ts';
import { signLangOrder } from '../src/core/signs.ts';
import { tripCountries } from '../src/core/todos.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { saveNumbersScores, useNumbersScores } from '../src/state/numbers.ts';
import { useTrips } from '../src/state/trips.tsx';
import { fadeIn, fadeOut } from '../src/theme/motion.ts';
import { elevated, radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader } from '../src/ui/hero.tsx';
import { Body, Button, Chip, Label, PressableScale, Screen, TextField } from '../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE, usePhraseLang } from '../src/ui/phrases.ts';
import { displayCountryName } from '../src/ui/useTravelStats.ts';
import { casualNumber, casualPrice } from '../src/core/followups107.ts';
import { CasualLine } from '../src/ui/followups107.tsx';

type Mode = 'read' | 'till' | 'quiz';
const MODES: Mode[] = ['read', 'till', 'quiz'];
/** The till countries shown before "More countries": one or two per language. */
const MAIN_TILL = ['JP', 'CN', 'TW', 'HK', 'KR', 'TH', 'VN', 'ES', 'MX', 'FR', 'BE', 'DE', 'CH', 'IT', 'BR', 'PT', 'ID'];

/** The reading block: local script large, kana, romanised line, and the not-checked caption. */
function ReadingView({ reading, size = 28 }: { reading: NumberReading; size?: number }) {
  const { t, theme } = useApp();
  const lineHeight = Math.round(size * 1.3);
  return (
    <View style={{ gap: space.xs }}>
      <Text selectable accessibilityLanguage={reading.lang} maxFontSizeMultiplier={1.6} style={{ fontSize: size, lineHeight, fontWeight: '700', color: theme.ink }}>
        {reading.text}
      </Text>
      {reading.kana ? (
        <Text style={[typeScale.small, { color: theme.muted }]}>
          {t('numbers.kana')} {reading.kana}
        </Text>
      ) : null}
      {reading.roman ? (
        <Text style={[typeScale.small, { color: theme.muted, fontStyle: 'italic' }]}>
          {t('numbers.reading')} {reading.roman}
        </Text>
      ) : null}
      {reading.needsCheck ? <Text style={[typeScale.small, { fontSize: 12, color: theme.muted }]}>{t('numbers.notChecked')}</Text> : null}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{label}</Label>
      </View>
      {children}
    </View>
  );
}

export default function NumbersScreen() {
  const params = useLocalSearchParams<{ lang?: string; country?: string; section?: string }>();
  const { t, theme, lang: appLang } = useApp();
  const { trips } = useTrips();
  const paramCountry = typeof params.country === 'string' ? params.country.toUpperCase() : null;
  const paramLang = parseLangParam(params.lang) ?? (paramCountry ? languageForCountry(PHRASE_TABLE, paramCountry) : null);
  const { lang, setLang } = usePhraseLang(paramLang);
  const [mode, setMode] = useState<Mode>(() => (MODES.includes(params.section as Mode) ? (params.section as Mode) : 'read'));

  const countries = useMemo(() => {
    const trip = focusTrip(trips, todayIn(deviceZone()));
    return [...(paramCountry ? [paramCountry] : []), ...(trip ? tripCountries(trip) : [])];
  }, [trips, paramCountry]);
  const order = useMemo(() => signLangOrder(PHRASE_TABLE, countries), [countries]);
  const languageName = (l: PhraseLang) => t(LANG_KEY[l]);
  const native = (l: PhraseLang) => PHRASE_TABLE.languages.find((x) => x.code === l)?.native ?? l;

  const langPicker = (
    <Section label={t('numbers.language')}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('numbers.language')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {order.langs.map((l) => (
          <Chip key={l} label={t('phrases.langOption', { native: native(l), english: languageName(l) })} selected={l === lang} onPress={() => setLang(l)} />
        ))}
      </View>
      {order.tripLangs.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.langFromTrip')}</Text> : null}
    </Section>
  );

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" title={t('numbers.heroTitle')} subtitle={t('numbers.subtitle')} />
      </FadeInView>
      <Section label={t('numbers.mode')}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('numbers.mode')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {MODES.map((m) => (
            <Chip key={m} label={t(`numbers.mode.${m}` as Key)} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
      </Section>
      {mode === 'read' ? (
        <>
          {langPicker}
          <Reader lang={lang} country={countries.find((c) => languageForCountry(PHRASE_TABLE, c) === lang) ?? null} languageName={languageName} />
        </>
      ) : mode === 'till' ? (
        <Till countries={countries} appLang={appLang} languageName={languageName} />
      ) : (
        <>
          {langPicker}
          <Quiz lang={lang} tripLangs={order.tripLangs} languageName={languageName} />
        </>
      )}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.disclaimer')}</Text>
    </Screen>
  );
}

// ---------------------------------------------------------------- number reader

function Reader({ lang, country, languageName }: { lang: PhraseLang; country: string | null; languageName: (l: PhraseLang) => string }) {
  const { t, theme } = useApp();
  const [text, setText] = useState('12345');
  const n = parseWhole(text);
  const reading = n === null ? null : spellNumber(lang, n, { country });
  // T151: how the number is often said (Thai ร้อย without หนึ่ง, Vietnamese ngàn), when it differs.
  const casual = n === null ? null : casualNumber(lang, n, country);
  const casualA11y = casual ? ` ${t('f107.numbers.casualA11y', { text: casual.roman ?? casual.text })}` : '';
  const another = () => {
    const r = Math.random();
    const v = r < 0.3 ? Math.floor(Math.random() * 100) : r < 0.7 ? Math.floor(Math.random() * 10_000) : Math.floor(Math.random() * 1_000_000);
    setText(String(v));
  };
  return (
    <View style={{ gap: space.m }}>
      <TextField label={t('numbers.read.field')} value={text} onChange={setText} placeholder={t('numbers.read.placeholder')} inputMode="numeric" autoCapitalize="none" error={text.trim() && n === null ? t('numbers.read.error') : undefined} />
      <View style={{ flexDirection: 'row' }}>
        <Button kind="secondary" icon="shuffle" label={t('numbers.read.another')} hint={t('numbers.read.anotherHint')} onPress={another} />
      </View>
      {reading ? (
        <View
          accessible
          accessibilityLabel={t('numbers.read.cardA11y', { number: groupedDigits(reading.value), language: languageName(lang), text: reading.roman ?? reading.text, check: t('numbers.notChecked') }) + casualA11y}
          style={[{ padding: space.l, borderRadius: radius.l, gap: space.m }, elevated(theme, 'low')]}
        >
          <Text style={[typeScale.title, { color: theme.accentInk, fontVariant: ['tabular-nums'] }]}>{groupedDigits(reading.value)}</Text>
          <ReadingView reading={reading} />
          <CasualLine casual={casual} />
        </View>
      ) : null}
      <View style={{ gap: space.xs, padding: space.m, borderRadius: radius.m, backgroundColor: theme.seaSoft }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('numbers.read.tip')}</Text>
        <Text style={[typeScale.small, { color: theme.ink }]}>{t(`numbers.rule.${lang}` as Key)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- at the till

function Till({ countries, appLang, languageName }: { countries: string[]; appLang: string; languageName: (l: PhraseLang) => string }) {
  const { t, theme } = useApp();
  const order = useMemo(() => tillCountryOrder(PHRASE_TABLE, countries), [countries]);
  const [country, setCountry] = useState<string>(() => order.fromTrip[0] ?? 'JP');
  const [all, setAll] = useState(false);
  const [text, setText] = useState('1250');
  const shown = all ? order.countries : order.countries.filter((c) => order.fromTrip.includes(c) || MAIN_TILL.includes(c) || c === country);
  const currency = tillCurrency(country) ?? 'EUR';
  const digits = tillDigits(currency);
  const minor = parseTillAmount(text, currency);
  const card = minor === null ? null : tillCard(PHRASE_TABLE, country, minor);
  // T151: the casual way to say the price (十二块五, năm mươi ngàn), when it differs.
  const casual = card ? casualPrice(card.lang, minor ?? 0, card.currency, card.country) : null;
  const casualA11y = casual ? ` ${t('f107.numbers.casualA11y', { text: casual.roman ?? casual.text })}` : '';
  const name = (c: string) => displayCountryName(c, appLang);
  const error = text.trim() && minor === null ? (digits ? t('numbers.till.error', { digits: String(digits) }) : t('numbers.till.errorWhole', { currency })) : undefined;

  return (
    <View style={{ gap: space.l }}>
      <Section label={t('numbers.till.country')}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('numbers.till.country')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {shown.map((c) => (
            <Chip key={c} label={name(c)} selected={c === country} onPress={() => setCountry(c)} />
          ))}
        </View>
        {order.fromTrip.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.till.fromTrip')}</Text> : null}
        <View style={{ flexDirection: 'row' }}>
          <Button
            kind="quiet"
            icon={all ? 'chevron-up' : 'chevron-down'}
            label={all ? t('numbers.till.fewer') : t('numbers.till.more')}
            hint={all ? t('numbers.till.fewerHint') : t('numbers.till.moreHint')}
            onPress={() => setAll(!all)}
          />
        </View>
      </Section>
      <TextField label={t('numbers.till.field', { currency })} value={text} onChange={setText} placeholder={t('numbers.till.placeholder')} inputMode={digits ? 'decimal' : 'numeric'} autoCapitalize="none" error={error} />
      {card ? (
        <View
          accessible
          accessibilityLabel={t('numbers.till.cardA11y', { country: name(card.country), written: card.written, language: languageName(card.lang), spoken: card.spoken.roman ?? card.spoken.text, check: t('numbers.notChecked') }) + casualA11y}
          style={[{ padding: space.l, borderRadius: radius.l, gap: space.m }, elevated(theme, 'low')]}
        >
          <View style={{ gap: space.xs }}>
            <Label>{t('numbers.till.written')}</Label>
            <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 34, lineHeight: 42, fontWeight: '700', color: theme.accentInk, fontVariant: ['tabular-nums'] }}>
              {card.written}
            </Text>
          </View>
          <View style={{ gap: space.xs }}>
            <Label>{`${t('numbers.till.spoken')} · ${languageName(card.lang)}`}</Label>
            <ReadingView reading={card.spoken} size={24} />
            <CasualLine casual={casual} />
          </View>
        </View>
      ) : (
        <Body muted>{t('numbers.till.empty')}</Body>
      )}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.till.note')}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- quiz

type Answer = { picked: number | null; points: number };

function Quiz({ lang, tripLangs, languageName }: { lang: PhraseLang; tripLangs: PhraseLang[]; languageName: (l: PhraseLang) => string }) {
  const { t, theme, reduceMotion } = useApp();
  const [scores] = useNumbersScores();
  const [level, setLevel] = useState<QuizLevel>('prices');
  const [mix, setMix] = useState(tripLangs.length > 1);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [msLeft, setMsLeft] = useState(QUESTION_MS);
  const [result, setResult] = useState<{ score: number; right: number; newBest: boolean } | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const bar = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(0);

  const useMix = mix && tripLangs.length > 1;
  const key = scoreKey(useMix ? 'mix' : lang, level);
  const q = questions?.[index] ?? null;
  const answered = answers.length > index;

  // The clock for the current question: a seconds count (always) and a linear bar (not with Reduce Motion).
  useEffect(() => {
    if (!q || answered) return;
    startedAt.current = Date.now();
    setMsLeft(QUESTION_MS);
    bar.setValue(1);
    const anim = reduceMotion ? null : Animated.timing(bar, { toValue: 0, duration: QUESTION_MS, easing: Easing.linear, useNativeDriver: true });
    anim?.start();
    const tick = setInterval(() => {
      const left = QUESTION_MS - (Date.now() - startedAt.current);
      setMsLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(tick);
        answer(null);
      }
    }, 250);
    return () => {
      clearInterval(tick);
      anim?.stop();
    };
  }, [q, answered, reduceMotion]);

  const start = () => {
    const langs = useMix ? tripLangs : [lang];
    setQuestions(buildQuiz(newSeed(Date.now()), langs, level, QUIZ_LENGTH));
    setIndex(0);
    setAnswers([]);
    setResult(null);
    fade.setValue(1);
  };

  function answer(picked: number | null) {
    if (!q) return;
    setAnswers((old) => {
      if (old.length > index) return old;
      const left = QUESTION_MS - (Date.now() - startedAt.current);
      const right = picked === q.answer;
      const points = pointsFor(right, left);
      AccessibilityInfo.announceForAccessibility(
        picked === null ? t('numbers.quiz.timeUp', { number: groupedDigits(q.answer) }) : right ? t('numbers.quiz.right', { points: String(points) }) : t('numbers.quiz.wrong', { number: groupedDigits(q.answer) }),
      );
      return [...old, { picked, points }];
    });
  }

  const next = () => {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      const score = answers.reduce((s, a) => s + a.points, 0);
      const right = answers.filter((a, i) => a.picked === questions[i]?.answer).length;
      saveNumbersScores((old) => recordScore(old, key, score).state);
      setResult({ score, right, newBest: score > (scores.best[key] ?? 0) });
      setQuestions(null);
      return;
    }
    fadeOut(fade, reduceMotion).start(() => {
      setIndex(index + 1);
      fadeIn(fade, reduceMotion).start();
    });
  };

  const stop = () => {
    setQuestions(null);
    setAnswers([]);
    setResult(null);
  };

  const best = scores.best[key] ?? 0;
  const seconds = Math.ceil(msLeft / 1000);

  if (!q) {
    return (
      <View style={{ gap: space.l }}>
        <Section label={t('numbers.quiz.level')}>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('numbers.quiz.level')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {QUIZ_LEVELS.map((l) => (
              <Chip key={l} label={t(`numbers.quiz.level.${l}` as Key)} selected={level === l} onPress={() => setLevel(l)} />
            ))}
            {tripLangs.length > 1 ? <Chip label={t('numbers.quiz.mix')} hint={t('numbers.quiz.mixHint')} selected={useMix} onPress={() => setMix(!mix)} /> : null}
          </View>
        </Section>
        {result ? (
          <View accessibilityLiveRegion="polite" style={[{ padding: space.l, borderRadius: radius.l, gap: space.s }, elevated(theme, 'low')]}>
            <View accessibilityRole="header">
              <Text style={[typeScale.title, { color: theme.ink }]}>{t('numbers.quiz.doneTitle')}</Text>
            </View>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {t('numbers.quiz.score', { score: String(result.score), right: String(result.right), count: String(QUIZ_LENGTH) })}
            </Text>
            {result.newBest ? <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('numbers.quiz.newBest')}</Text> : null}
          </View>
        ) : (
          <Body>{t('numbers.quiz.intro', { count: String(QUIZ_LENGTH), seconds: String(QUESTION_MS / 1000) })}</Body>
        )}
        {best ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.quiz.best', { best: String(best) })}</Text> : null}
        <View style={{ flexDirection: 'row' }}>
          <Button
            icon="play"
            label={result ? t('numbers.quiz.again') : t('numbers.quiz.start')}
            hint={result ? t('numbers.quiz.againHint') : t('numbers.quiz.startHint', { count: String(QUIZ_LENGTH) })}
            onPress={start}
          />
        </View>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('numbers.quiz.scoresNote')}</Text>
      </View>
    );
  }

  const mine = answers[index];
  const last = index + 1 >= (questions?.length ?? 0);
  return (
    <View style={{ gap: space.l }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('numbers.quiz.progress', { n: String(index + 1), count: String(questions?.length ?? 0) })}</Text>
        <Text accessibilityLabel={`${t('numbers.quiz.timerA11y')}: ${t('numbers.quiz.timeLeft', { seconds: String(seconds) })}`} style={[typeScale.small, { color: seconds <= 3 && !answered ? theme.danger : theme.muted, fontVariant: ['tabular-nums'] }]}>
          {t('numbers.quiz.timeLeft', { seconds: String(answered ? 0 : seconds) })}
        </Text>
      </View>
      {reduceMotion ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 6, borderRadius: radius.pill, backgroundColor: theme.line, overflow: 'hidden' }}>
          <Animated.View style={{ height: 6, backgroundColor: theme.accentStrong, transform: [{ scaleX: answered ? 0 : bar }], transformOrigin: 'left' }} />
        </View>
      )}
      <Animated.View style={{ opacity: fade, gap: space.l }}>
        <View style={[{ padding: space.l, borderRadius: radius.l, gap: space.s }, elevated(theme, 'low')]}>
          <Label>{`${t('numbers.quiz.prompt')} · ${languageName(q.lang)}`}</Label>
          <ReadingView reading={q.reading} size={q.reading.text.length > 30 ? 22 : 28} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {q.choices.map((c) => {
            const isAnswer = c === q.answer;
            const isPicked = mine?.picked === c;
            const bg = !answered ? theme.cardRaised : isAnswer ? theme.okSoft : isPicked ? theme.dangerSoft : theme.cardRaised;
            const border = !answered ? theme.line : isAnswer ? theme.ok : isPicked ? theme.danger : theme.line;
            return (
              <View key={c} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('numbers.quiz.choiceA11y', { number: groupedDigits(c) })}
                accessibilityState={{ disabled: answered, selected: isPicked }}
                disabled={answered}
                onPress={() => answer(c)}
                style={{ minHeight: TOUCH + 8, borderRadius: radius.m, borderWidth: 1.5, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: space.s }}
              >
                <Text style={[typeScale.bodyStrong, { fontSize: 20, color: theme.ink, fontVariant: ['tabular-nums'] }]}>{groupedDigits(c)}</Text>
              </PressableScale>
              </View>
            );
          })}
        </View>
        {answered ? (
          <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: mine?.picked === q.answer ? theme.ok : theme.danger }]}>
            {mine?.picked === null
              ? t('numbers.quiz.timeUp', { number: groupedDigits(q.answer) })
              : mine?.picked === q.answer
                ? t('numbers.quiz.right', { points: String(mine.points) })
                : t('numbers.quiz.wrong', { number: groupedDigits(q.answer) })}
          </Text>
        ) : null}
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {answered ? (
          <Button
            icon={last ? 'trophy-outline' : 'arrow-forward'}
            label={last ? t('numbers.quiz.finish') : t('numbers.quiz.next')}
            hint={last ? t('numbers.quiz.finishHint') : t('numbers.quiz.nextHint')}
            onPress={next}
          />
        ) : null}
        <Button kind="quiet" label={t('numbers.quiz.stop')} hint={t('numbers.quiz.stopHint')} onPress={stop} />
      </View>
    </View>
  );
}
