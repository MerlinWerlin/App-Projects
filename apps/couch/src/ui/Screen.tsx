import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from './Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { useT } from '../i18n/react';

/**
 * Lets a gesture surface (the touchpad) stop the page from scrolling while a finger is down,
 * so vertical swipes go to the TV instead of scrolling the screen. No-op outside <Screen>.
 */
const ScrollLockCtx = createContext<(locked: boolean) => void>(() => {});
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockCtx);
}

/** One reading column (prototype .wrap: max 420 wide, 16 gutter, 14 gap). */
export function Screen({ children, safeTop = true, bg }: { children: ReactNode; safeTop?: boolean; bg?: string }) {
  const t = useTheme();
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const setLocked = useCallback((locked: boolean) => setScrollEnabled(!locked), []);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg ?? t.bg }]} edges={safeTop ? ['top'] : []}>
      <ScrollLockCtx.Provider value={setLocked}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </ScrollLockCtx.Provider>
    </SafeAreaView>
  );
}

/** `color` overrides the muted ink (the remote's cinema-glow stage uses a light ink for AA). */
export function FreePromise({ color }: { color?: string } = {}) {
  const t = useTheme();
  const tr = useT();
  return <Text style={[styles.promise, { color: color ?? t.muted }]}>{tr('ui.screen.freePromise')}</Text>;
}

export function DemoNote({ color }: { color?: string } = {}) {
  const t = useTheme();
  const tr = useT();
  return <Text style={[styles.demo, { color: color ?? t.muted }]}>{tr('ui.screen.demoNote')}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: space.gutter,
    paddingTop: 16,
    paddingBottom: 40,
    gap: space.gap,
  },
  promise: { fontFamily: fonts.textSemi, fontSize: 13, textAlign: 'center' },
  demo: { fontFamily: fonts.text, fontSize: 11.5, textAlign: 'center' },
});
