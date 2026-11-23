import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { fonts, useTheme } from '../src/theme/theme.ts';
import { Screen } from '../src/ui/kit.tsx';
import { Paywall } from '../src/ui/Paywall.tsx';

export default function PaywallScreen() {
  const t = useTheme();
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerRight: () => (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" hitSlop={12} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: t.ink }}>Close</Text>
            </Pressable>
          ),
        }}
      />
      <Paywall />
    </Screen>
  );
}
