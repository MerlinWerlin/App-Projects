// Toasts with an optional action (Undo). One at a time; announced to screen readers.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, useColors } from '../theme/tokens';

interface ToastMsg {
  text: string;
  action?: { label: string; run: () => void };
}

const Ctx = createContext<(m: ToastMsg | string) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { c, dark } = useColors();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setMsg(null));
  }, [v]);

  const show = useCallback(
    (m: ToastMsg | string) => {
      const next = typeof m === 'string' ? { text: m } : m;
      setMsg(next);
      AccessibilityInfo.announceForAccessibility(next.text);
      Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, next.action ? 5000 : 2600);
    },
    [v, hide],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 90,
            opacity: v,
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: dark ? c.surface2 : c.ink,
              borderRadius: radius.m,
              paddingHorizontal: 16,
              minHeight: 52,
            }}
          >
            <Text style={{ flex: 1, color: dark ? c.ink : c.bg, fontFamily: font.bodySemi, fontSize: 15 }}>{msg.text}</Text>
            {msg.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={msg.action.label}
                onPress={() => {
                  msg.action?.run();
                  hide();
                }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
              >
                <Text style={{ color: c.accent, fontFamily: font.heavy, fontSize: 15 }}>{msg.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}
