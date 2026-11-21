// Shared building blocks: Screen, Title, Body, Card, PressableScale, Button, EmptyState, ToggleRow.
// Every control names itself to screen readers; touch targets are at least 48 pt; colours come from tokens.
// Design pass 3 ("paper ticket stock"): flat cards with a hairline edge, die-cut corners, carbon-ink primary buttons,
// chips that fill like a punched ticket when chosen, the iOS switch for toggles. Haptics only where something commits
// or a value ticks (selection), never on every tap. Props are unchanged; new props are optional.
import { Ionicons } from '@expo/vector-icons';
import { useRef, type ComponentProps, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, Switch, Text, TextInput, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { duration, easeOut, pressScale } from '../theme/motion.ts';
import { elevated, fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { SpotArt, type SpotKind } from './illustrations/index.tsx';
import { Mascot, type MascotPose } from './Mascot.tsx';

// T169: `tabs` = a fixed (non-scrolling) tab screen whose list runs down to the tab bar, which already keeps clear of
// the home indicator, so no bottom inset or extra gap.
export function Screen({ children, scroll = true, tabs = false }: { children: ReactNode; scroll?: boolean; tabs?: boolean }) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.l, paddingBottom: tabs ? 0 : insets.bottom + space.xxl, paddingHorizontal: space.l, gap: tabs ? space.s : space.l };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: theme.paper }, pad]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={pad}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  return (
    <Text accessibilityRole="header" style={[typeScale.displayL, { color: theme.ink }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { theme } = useApp();
  return <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: muted ? theme.muted : theme.ink }}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  return (
    <View
      style={[
        // T120: the shared elevation (raised surface, dark-mode hairline edge, light-mode shadow).
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.l, gap: space.s },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Pressable that answers on press-in: scales to 0.97 in 120 ms ease-out (with Reduce Motion it dims instead of
 * moving) and commits on release. `feedback` adds one haptic for a press that commits ('press') or a value that ticks
 * ('selection'); plain navigation taps stay silent. `animate={false}` turns the press look off (low-battery
 * essentials: no animation at all).
 */
export function PressableScale(props: PressableProps & { children: ReactNode; animate?: boolean; feedback?: 'press' | 'selection' }) {
  const { reduceMotion } = useApp();
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;
  const { children, style, onPress, animate = true, feedback, ...rest } = props;
  const to = (v: number) => {
    if (!animate) return;
    if (reduceMotion) {
      dim.setValue(v === 1 ? 1 : 0.7);
      return;
    }
    Animated.timing(scale, { toValue: v, duration: duration.fast, easing: easeOut, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      {...rest}
      onPressIn={() => to(pressScale)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (feedback === 'press') haptic.press();
        else if (feedback === 'selection') haptic.tap();
        onPress?.(e);
      }}
      hitSlop={8}
      pressRetentionOffset={16}
    >
      <Animated.View style={[{ minHeight: TOUCH, justifyContent: 'center', opacity: dim, transform: [{ scale }] }, style as StyleProp<ViewStyle>]}>{children}</Animated.View>
    </Pressable>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * primary: carbon ink fill (accentStrong, AA with onAccent; a destination theme tints it). secondary: ink outline.
 * quiet: hairline outline. Die-cut corners, not pills. `icon` puts an Ionicons glyph before the label.
 */
export function Button({
  label,
  onPress,
  hint,
  kind = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
  kind?: 'primary' | 'secondary' | 'quiet';
  icon?: IconName;
}) {
  const { theme } = useApp();
  const primary = kind === 'primary';
  const secondary = kind === 'secondary';
  const fg = primary ? theme.onAccent : theme.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      feedback={primary ? 'press' : undefined}
      style={{
        flexDirection: 'row',
        gap: space.s,
        minHeight: 50,
        backgroundColor: primary ? theme.accentStrong : 'transparent',
        borderRadius: radius.m,
        paddingHorizontal: space.xl,
        borderWidth: primary ? 0 : secondary ? 1.5 : 1,
        borderColor: secondary ? theme.ink : theme.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={18} color={fg} />
        </View>
      ) : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: fg }}>{label}</Text>
    </PressableScale>
  );
}

/**
 * Empty or nothing-found state, straight on the page (no box): the mascot, an illustration (T91 `art`, original spot
 * art, decorative) or a plain glyph; a title (screen-reader header), a body with the next step, and an optional
 * action. `mascot` wins over `art`, `art` over `icon`.
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
  art,
  mascot,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: IconName;
  art?: SpotKind;
  /** The mascot in this tab's pose (wins over `art` and `icon`). */
  mascot?: MascotPose;
}) {
  const { theme } = useApp();
  return (
    <View style={{ alignItems: 'flex-start', gap: space.s, paddingVertical: space.l }}>
      {mascot ? (
        <Mascot pose={mascot} size={140} style={{ alignSelf: 'center', marginBottom: space.s }} />
      ) : art ? (
        <View style={{ alignSelf: 'center', marginBottom: space.s }}>
          <SpotArt kind={art} size={132} />
        </View>
      ) : icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={30} color={theme.muted} />
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
        {title}
      </Text>
      <Body muted>{body}</Body>
      {action ? <View style={{ alignSelf: 'stretch', marginTop: space.s }}>{action}</View> : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme, t } = useApp();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      accessibilityValue={{ text: value ? t('common.on') : t('common.off') }}
      onPress={() => {
        haptic.tap();
        onChange(!value);
      }}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}
    >
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
      </View>
      {/* The iOS switch itself; the row is the one control screen readers hear. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.tap();
            onChange(v);
          }}
          trackColor={{ true: theme.ok, false: theme.line }}
          ios_backgroundColor={theme.line}
        />
      </View>
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  multiline,
  autoCapitalize = 'sentences',
  inputMode,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  /** 'tel' gives the phone keypad and lets the system offer the user's own phone numbers to fill in. */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
  onFocus?: () => void;
}) {
  const { theme } = useApp();
  const tel = inputMode === 'tel';
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        multiline={multiline}
        autoCapitalize={tel ? 'none' : autoCapitalize}
        autoCorrect={false}
        inputMode={inputMode}
        keyboardType={tel ? 'phone-pad' : undefined}
        textContentType={tel ? 'telephoneNumber' : undefined}
        autoComplete={tel ? 'tel' : undefined}
        style={{
          minHeight: multiline ? 96 : TOUCH,
          borderWidth: 1,
          borderColor: error ? theme.danger : theme.line,
          borderRadius: radius.m,
          paddingHorizontal: space.m,
          paddingVertical: space.s,
          backgroundColor: theme.card,
          color: theme.ink,
          fontFamily: fonts.body,
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A selectable chip (radio semantics). */
export function Chip({ label, selected, onPress, icon, a11yLabel, hint }: { label: string; selected: boolean; onPress: () => void; icon?: ReactNode; a11yLabel?: string; hint?: string }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      feedback="selection"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.m,
        borderRadius: radius.s,
        borderWidth: 1,
        borderColor: selected ? theme.accentStrong : theme.line,
        backgroundColor: selected ? theme.accentStrong : 'transparent',
      }}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: selected ? theme.onAccent : theme.ink }}>{label}</Text>
    </PressableScale>
  );
}

export function Warning({ text }: { text: string }) {
  const { theme } = useApp();
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', gap: space.s, backgroundColor: theme.warnSoft, borderRadius: radius.m, borderWidth: 1, borderColor: theme.warn, padding: space.m }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="alert-circle" size={20} color={theme.warn} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: theme.ink }}>{text}</Text>
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  return <Text style={[typeScale.caption, { color: theme.muted }]}>{children}</Text>;
}
