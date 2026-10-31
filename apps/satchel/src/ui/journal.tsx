// Shared pieces of the trip journal UI (T64): mood / weather icons, the colourful day header (a hero gradient per
// day, cycling), the icon chip row used by the editor, and photo thumbnails. Colours come from theme tokens only;
// the only motion is the timed fade-rise of FadeInView (no springs).
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Text, View } from 'react-native';
import { JOURNAL_MOODS, JOURNAL_WEATHER, type JournalMood, type JournalPhoto, type JournalWeather } from '../core/journal.ts';
import type { Key } from '../i18n/en.ts';
import { appPath } from '../native/files.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, TOUCH, typeScale, type HeroTone } from '../theme/tokens.ts';
import { GradientFill, type IconName } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export const MOOD_ICONS: Record<JournalMood, IconName> = {
  joyful: 'happy-outline',
  relaxed: 'leaf-outline',
  adventurous: 'compass-outline',
  grateful: 'heart-outline',
  tired: 'moon-outline',
  meh: 'remove-circle-outline',
};
export const WEATHER_ICONS: Record<JournalWeather, IconName> = {
  sunny: 'sunny-outline',
  partly: 'partly-sunny-outline',
  cloudy: 'cloudy-outline',
  rain: 'rainy-outline',
  storm: 'thunderstorm-outline',
  snow: 'snow-outline',
};
export const moodKey = (m: JournalMood): Key => `journal.mood.${m}`;
export const weatherKey = (w: JournalWeather): Key => `journal.weather.${w}`;

/** Day headers cycle through these hero gradients (all AA with heroInk in both themes). */
export const DAY_TONES: readonly HeroTone[] = ['trips', 'map', 'wallet', 'toilets'];

/** Colourful day header: gradient band with "Day 3", the date and a page / photo count. One header for VoiceOver. */
export const DayHeader = memo(function DayHeader({ tone, label, date, meta }: { tone: number; label: string; date: string; meta: string }) {
  const { theme, t } = useApp();
  const hero = DAY_TONES[tone % DAY_TONES.length];
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('journal.dayA11y', { label, date, pages: meta })}
      style={{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero[hero][0] }}
    >
      <GradientFill tone={hero} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="book-outline" size={20} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.title, { color: theme.heroInk }]}>{label}</Text>
          <Text style={[typeScale.small, { color: theme.heroMuted }]}>{date}</Text>
        </View>
        <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{meta}</Text>
      </View>
    </View>
  );
});

/**
 * A row of icon chips with radio semantics; tapping the selected chip clears it (the field is optional).
 * `group` names the row for screen readers. T84: a caller may give each chip its own spoken label and hint (the
 * idea editor does); otherwise the journal's "{group}: {value}" is used.
 */
export function IconChips<V extends string>({
  group,
  values,
  selected,
  icon,
  label,
  onChange,
  a11yLabel,
  a11yHint,
}: {
  group: string;
  values: readonly V[];
  selected: V | undefined;
  icon: (v: V) => IconName;
  label: (v: V) => string;
  onChange: (v: V | undefined) => void;
  a11yLabel?: (v: V) => string;
  a11yHint?: (v: V, selected: boolean) => string;
}) {
  const { theme, t } = useApp();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={group} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      {values.map((v) => {
        const on = v === selected;
        return (
          <PressableScale
            key={v}
            accessibilityRole="radio"
            accessibilityLabel={a11yLabel ? a11yLabel(v) : t('journal.chip.a11y', { group, value: label(v) })}
            accessibilityHint={a11yHint ? a11yHint(v, on) : undefined}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(on ? undefined : v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              minHeight: TOUCH,
              paddingHorizontal: space.m,
              borderRadius: radius.pill,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? theme.accent : theme.line,
              backgroundColor: on ? theme.accentSoft : theme.cardRaised,
            }}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={icon(v)} size={20} color={on ? theme.accentInk : theme.sea} />
            </View>
            <Text style={[typeScale.bodyStrong, { fontSize: 15, color: on ? theme.accentInk : theme.ink }]}>{label(v)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export const MOODS = JOURNAL_MOODS;
export const WEATHERS = JOURNAL_WEATHER;

/** A square photo thumbnail from Satchel's own copy (rebased onto this install's documents folder). */
export const PhotoThumb = memo(function PhotoThumb({ photo, size, label }: { photo: JournalPhoto; size: number; label: string }) {
  const { theme } = useApp();
  return (
    <Image
      source={{ uri: appPath(photo.uri) }}
      accessible
      accessibilityLabel={label}
      resizeMode="cover"
      style={{ width: size, height: size, borderRadius: radius.m, backgroundColor: theme.line }}
    />
  );
});
