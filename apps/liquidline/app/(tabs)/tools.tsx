import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAccess } from '../../src/state/access.ts';
import { useCountry } from '../../src/state/prefs.ts';
import { RADIUS, SPACE, usePalette } from '../../src/theme/tokens.ts';
import { Card, Label, Screen, Small } from '../../src/ui/kit.tsx';
import { SettingsButton } from './index.tsx';

type Tool = { href: Href; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; free?: boolean; tone?: 'low' | 'high' };

export default function ToolsScreen() {
  const p = usePalette();
  const c = useCountry();
  const a = useAccess();
  const tools: Tool[] = [
    { href: '/evac', title: 'Evacuation', detail: 'Checklist, vacuum target and decay test timer', icon: 'timer-outline', tone: 'low' },
    { href: '/lineset', title: 'Line set & pipe', detail: `Sizes by capacity, ${c.lineSetWord} lengths stocked in ${c.name}`, icon: 'git-merge-outline' },
    { href: '/load', title: 'Room load', detail: 'Rough cooling and heating estimate', icon: 'home-outline', tone: 'high' },
    { href: '/flare', title: 'Flare torque', detail: 'Typical nut torque by tube size', icon: 'build-outline' },
    { href: '/convert', title: 'Converter', detail: 'Pressure, temperature, vacuum, capacity, airflow', icon: 'swap-horizontal-outline', free: true },
    { href: '/chart', title: 'PT chart', detail: 'Printable-style chart for any refrigerant', icon: 'grid-outline', free: true },
    { href: '/info', title: 'Refrigerant facts', detail: 'Safety class, GWP, glide, uses', icon: 'flask-outline', free: true },
    { href: '/sources', title: `Rules in ${c.name}`, detail: 'Licence, standards and sources', icon: 'shield-checkmark-outline', free: true },
  ];
  return (
    <Screen title="Tools" subtitle={c.guided ? `Set up for ${c.name}` : 'Generic metric defaults'} right={<SettingsButton />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
        {tools.map((t) => {
          const color = t.tone === 'low' ? p.low : t.tone === 'high' ? p.high : p.text;
          const locked = !t.free && !a.canCalc;
          return (
            <Pressable
              key={String(t.href)}
              testID={`tool-${String(t.href).slice(1)}`}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${t.detail}${locked ? '. Needs the free trial or unlock' : ''}`}
              onPress={() => router.push(t.href)}
              style={({ pressed }) => ({ width: '47.5%', flexGrow: 1, minHeight: 150, backgroundColor: p.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.sm, borderWidth: 1, borderColor: p.line, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Ionicons name={t.icon} size={34} color={color} />
                {locked ? <Ionicons name="lock-closed" size={18} color={p.text3} /> : null}
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: p.text }}>{t.title}</Text>
              <Text style={{ fontSize: 14, lineHeight: 18, color: p.text2 }}>{t.detail}</Text>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <Label>Always check</Label>
        <Small>Liquidline is an aid for licensed technicians. The equipment manufacturer’s data and your local regulations take precedence over anything shown here.</Small>
      </Card>
    </Screen>
  );
}
