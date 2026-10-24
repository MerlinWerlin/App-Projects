// Step mode: the written pattern split into rows/rounds. The current one is highlighted and follows the
// counter; tap any step to jump there. A compact counter is docked at the bottom.
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bump, mainCounter, setValue } from '../../../src/core/model';
import { stepLabel, type PatternStep } from '../../../src/core/pattern';
import type { Terms } from '../../../src/core/terms';
import { t } from '../../../src/i18n';
import { changeCounters, useProject } from '../../../src/store/data';
import { useSettings } from '../../../src/store/settings';
import { font, radius, space, useColors } from '../../../src/theme/tokens';
import { speakCount } from '../../../src/ui/Counter';
import { haptic } from '../../../src/ui/haptics';
import { Body, IconButton, Label, Segmented } from '../../../src/ui/kit';
import { usePattern } from '../../../src/ui/usePattern';

export default function PatternScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProject(id);
  const { c } = useColors();
  const settings = useSettings();
  const [terms, setTerms] = useState<Terms>(settings.terms);
  const pattern = usePattern(p, terms);
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<PatternStep>>(null);
  const [showIntro, setShowIntro] = useState(false);

  const main = p ? mainCounter(p) : undefined;
  const steps = pattern?.steps ?? [];
  const current = main ? Math.min(main.value, Math.max(0, steps.length - 1)) : 0;

  useEffect(() => {
    if (!steps.length) return;
    const id2 = setTimeout(() => {
      try {
        list.current?.scrollToIndex({ index: current, viewPosition: 0.3, animated: !settings.reduceMotion });
      } catch {
        // list not laid out yet
      }
    }, 120);
    return () => clearTimeout(id2);
  }, [current, steps.length, settings.reduceMotion]);

  if (!p || !main || !pattern) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.l }}>
        <Body muted>{t('pattern.none')}</Body>
      </View>
    );
  }

  const jump = (i: number) => {
    haptic('select');
    changeCounters(p.id, (cs) => setValue(cs, main.id, i), i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: p.name,
          headerRight: () => <IconButton icon="edit" label={t('pattern.editText')} onPress={() => router.push(`/project/${p.id}/paste`)} />,
        }}
      />
      <FlatList
        ref={list}
        data={steps}
        keyExtractor={(s) => String(s.i)}
        contentContainerStyle={{ padding: space.l, paddingBottom: 200, gap: 8 }}
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        ListHeaderComponent={
          <View style={{ gap: space.m, marginBottom: space.s }}>
            <Segmented
              options={[
                { value: 'US', label: t('terms.us') },
                { value: 'UK', label: t('terms.uk') },
              ]}
              value={terms}
              onChange={setTerms}
            />
            {p.pattern?.terms !== terms ? (
              <Body small muted>
                {t('pattern.converted', { from: p.pattern?.terms ?? 'US', to: terms })}
              </Body>
            ) : null}
            {pattern.intro.length ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('pattern.intro')} onPress={() => setShowIntro(!showIntro)} style={{ backgroundColor: c.surface, borderRadius: radius.m, padding: space.m }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Label>{t('pattern.intro')}</Label>
                  <Feather name={showIntro ? 'chevron-up' : 'chevron-down'} size={16} color={c.ink3} />
                </View>
                {showIntro ? (
                  <Body small style={{ marginTop: 6 }} selectable>
                    {pattern.show(pattern.intro.join('\n'))}
                  </Body>
                ) : null}
              </Pressable>
            ) : null}
            {pattern.issues.size ? (
              <Body small style={{ color: c.warn }}>
                {t('pattern.issuesFound', { count: pattern.issues.size })}
              </Body>
            ) : null}
          </View>
        }
        ListFooterComponent={
          pattern.outro.length ? (
            <View style={{ marginTop: space.m }}>
              <Body small muted selectable>
                {pattern.show(pattern.outro.join('\n'))}
              </Body>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const done = index < main.value;
          const on = index === current && main.value < steps.length;
          const prev = steps[index - 1];
          const issue = pattern.issues.get(item.i);
          return (
            <View>
              {item.section && item.section !== prev?.section ? (
                <Text accessibilityRole="header" style={{ fontFamily: font.displayMed, fontSize: 18, color: c.ink, marginTop: index ? space.l : 0, marginBottom: 6 }}>
                  {item.section}
                </Text>
              ) : null}
              {item.notes.length ? (
                <Body small muted style={{ marginBottom: 6, paddingHorizontal: 4 }}>
                  {pattern.show(item.notes.join(' '))}
                </Body>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${stepLabel(item)}. ${pattern.show(item.text)}${done ? `. ${t('pattern.doneA11y')}` : ''}`}
                accessibilityHint={t('pattern.jumpHint')}
                accessibilityState={{ selected: on }}
                onPress={() => jump(index)}
                style={{
                  flexDirection: 'row',
                  gap: space.m,
                  padding: space.m,
                  borderRadius: radius.m,
                  backgroundColor: on ? c.highlight : c.surface,
                  borderWidth: on ? 2 : 0,
                  borderColor: c.accent,
                  opacity: done ? 0.55 : 1,
                }}
              >
                <View style={{ width: 64 }}>
                  <Text style={{ fontFamily: font.heavy, fontSize: 13, color: on ? c.accent : c.ink2 }}>{stepLabel(item).split(' · ')[0]}</Text>
                  {item.of && item.of.total > 1 ? <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: c.ink3 }}>{`${item.of.k}/${item.of.total}`}</Text> : null}
                  {done ? <Feather name="check" size={16} color={c.good} style={{ marginTop: 4 }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.8} style={{ fontFamily: on ? font.bodyBold : font.body, fontSize: on ? 18 : 16, lineHeight: on ? 26 : 22, color: c.ink }}>
                    {pattern.show(item.text)}
                  </Text>
                  {issue ? (
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.warn, marginTop: 4 }}>
                      {issue.kind === 'count' ? t('pattern.countWarn', { got: issue.got, expected: issue.expected }) : t('pattern.usesWarn', { got: issue.got, expected: issue.expected })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + space.s, paddingTop: space.m, paddingHorizontal: space.l, backgroundColor: c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('counter.minusA11y', { label: main.label })}
          onPress={() => {
            haptic('select');
            changeCounters(p.id, (cs) => bump(cs, main.id, -1), Math.max(0, main.value - 1));
          }}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="minus" size={26} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${main.label} ${main.value}`}>
          <Text style={{ fontFamily: font.heavy, fontSize: 12, color: c.ink2, textTransform: 'uppercase', letterSpacing: 1 }}>{t('pattern.done')}</Text>
          <Text style={{ fontFamily: font.display, fontSize: 36, color: c.ink, fontVariant: ['tabular-nums'] }}>
            {main.value}
            <Text style={{ fontSize: 18, color: c.ink3 }}>{` / ${steps.length}`}</Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('pattern.markDone')}
          onPress={() => {
            haptic('tap');
            changeCounters(p.id, (cs) => bump(cs, main.id, 1), main.value + 1);
            speakCount(main.label, main.value + 1);
            if (main.value + 1 === steps.length) haptic('success');
          }}
          style={({ pressed }) => ({ width: 120, height: 64, borderRadius: 32, backgroundColor: pressed ? c.ink : c.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 })}
        >
          <Feather name="check" size={24} color={c.accentInk} />
          <Text style={{ fontFamily: font.heavy, fontSize: 16, color: c.accentInk }}>{t('pattern.doneBtn')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
