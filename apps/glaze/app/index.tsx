import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useColorsV2 } from '../src/theme/useTokens';

/**
 * "/" opens Themes. No header (app/_layout.tsx registers this route with headerShown false, fb-1024 A) and the app
 * background behind the redirect, so the opening animation hands straight over to Themes.
 */
export default function Index() {
  const { c } = useColorsV2();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Redirect href="/themes" />
    </View>
  );
}
