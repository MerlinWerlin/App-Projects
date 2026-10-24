// Tools: calculators and reference charts that work offline.
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, type MessageKey } from '../../src/i18n';
import { usePlus } from '../../src/plus/entitlement';
import { font, radius, space, useColors } from '../../src/theme/tokens';
import { FadeIn, type IconName, Label, PressableScale, ScreenScroll, Title } from '../../src/ui/kit';

const TOOLS: ReadonlyArray<{ key: string; icon: IconName; group: 'make' | 'ref'; plus?: boolean }> = [
  { key: 'ball', icon: 'circle', group: 'make' },
  { key: 'evenly', icon: 'shuffle', group: 'make' },
  { key: 'convert', icon: 'repeat', group: 'make' },
  { key: 'gauge', icon: 'maximize', group: 'make' },
  { key: 'yarn', icon: 'package', group: 'make' },
  { key: 'price', icon: 'tag', group: 'make', plus: true },
  { key: 'glossary', icon: 'book-open', group: 'ref' },
  { key: 'hooks', icon: 'edit-2', group: 'ref' },
  { key: 'weights', icon: 'layers', group: 'ref' },
  { key: 'sizes', icon: 'square', group: 'ref' },
];

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const plus = usePlus();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.s }}>
      <ScreenScroll>
        <Title>{t('tools.title')}</Title>
        {(['make', 'ref'] as const).map((g) => (
          <View key={g} style={{ marginTop: space.l, gap: space.s }}>
            <Label>{t(`tools.group.${g}`)}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
              {TOOLS.filter((x) => x.group === g).map((x, i) => (
                <FadeIn key={x.key} delay={i * 30} style={{ width: '47%', flexGrow: 1 }}>
                  <Tile icon={x.icon} title={t(`tool.${x.key}.title` as MessageKey)} body={t(`tool.${x.key}.blurb` as MessageKey)} locked={!!x.plus && !plus} onPress={() => router.push(`/tools/${x.key}`)} />
                </FadeIn>
              ))}
            </View>
          </View>
        ))}
      </ScreenScroll>
    </View>
  );
}

function Tile({ icon, title, body, onPress, locked }: { icon: IconName; title: string; body: string; onPress: () => void; locked: boolean }) {
  const { c } = useColors();
  return (
    <PressableScale label={`${title}. ${body}`} onPress={onPress} style={{ backgroundColor: c.surface, borderRadius: radius.l, padding: space.l, gap: 8, minHeight: 130 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={20} color={c.accent} />
        </View>
        {locked ? <Text style={{ fontFamily: font.heavy, fontSize: 11, color: c.accent }}>PLUS</Text> : null}
      </View>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.bodyBold, fontSize: 16, color: c.ink }}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.body, fontSize: 13, color: c.ink2 }}>
        {body}
      </Text>
    </PressableScale>
  );
}
