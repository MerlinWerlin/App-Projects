import { Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/tokens';
import { useTypography } from '../theme/typography';

// Temporary screen body used by the T01 scaffold; replaced as each screen is built.
export function Placeholder({ title, note }: { title: string; note: string }) {
  const ty = useTypography();
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: c.paper }}>
      <Text style={{ ...ty.face('display'), fontSize: 28, color: c.graphite, marginBottom: space.sm }}>{title}</Text>
      <Text style={{ ...ty.face('body'), fontSize: 16, color: c.muted, textAlign: 'center' }}>{note}</Text>
    </View>
  );
}
