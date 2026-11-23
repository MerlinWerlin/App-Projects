// Tools: two inset grouped lists, the iOS shape for a menu of destinations. On-the-job calculators first, reference
// after. Blue marks the low-side tool (evacuation), red the high-side one (room load).
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAccess } from '../../src/state/access.ts';
import { useCountry } from '../../src/state/prefs.ts';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../src/theme/tokens.ts';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';
import { Screen, Small } from '../../src/ui/kit.tsx';
import { SettingsButton } from './index.tsx';

type Tool = { href: Href; title: string; detail: string; icon: IconName; free?: boolean; tone?: 'low' | 'high' };

function Group({ title, tools, locked }: { title: string; tools: Tool[]; locked: boolean }) {
  const p = usePalette();
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: p.text, marginLeft: 4 }}>{title}</Text>
      <View style={{ backgroundColor: p.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: p.line, overflow: 'hidden' }}>
        {tools.map((t, i) => {
          const tint = t.tone === 'low' ? p.low : t.tone === 'high' ? p.high : p.text;
          const tile = t.tone === 'low' ? p.lowSoft : t.tone === 'high' ? p.highSoft : p.surface2;
          const isLocked = !t.free && locked;
          return (
            <Pressable
              key={String(t.href)}
              testID={`tool-${String(t.href).slice(1)}`}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${t.detail}${isLocked ? '. Needs the free trial or unlock' : ''}`}
              onPress={() => router.push(t.href)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH + 16, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: pressed ? p.surface2 : 'transparent' })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={24} color={tint} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: p.text }}>{t.title}</Text>
                <Text style={{ fontSize: 14, lineHeight: 18, color: p.text2 }}>{t.detail}</Text>
              </View>
              {isLocked ? <Icon name="lock-closed" size={16} color={p.text3} /> : null}
              <Icon name="chevron-forward" size={18} color={p.text3} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ToolsScreen() {
  const c = useCountry();
  const a = useAccess();
  const job: Tool[] = [
    { href: '/evac', title: 'Evacuation', detail: 'Checklist, vacuum target, decay test timer', icon: 'timer-outline', tone: 'low' },
    { href: '/lineset', title: 'Line set & pipe', detail: `Pipe sizes, ${c.lineSetWord} lengths stocked in ${c.name}`, icon: 'git-merge-outline' },
    { href: '/load', title: 'Room load', detail: 'Rough cooling and heating estimate', icon: 'home-outline', tone: 'high' },
    { href: '/flare', title: 'Flare torque', detail: 'Typical nut torque by tube size', icon: 'build-outline' },
  ];
  const ref: Tool[] = [
    { href: '/chart', title: 'PT chart', detail: 'Any refrigerant, 1, 2 or 5 degree steps', icon: 'grid-outline', free: true },
    { href: '/info', title: 'Refrigerant facts', detail: 'Safety class, GWP, glide, uses', icon: 'flask-outline', free: true },
    { href: '/convert', title: 'Converter', detail: 'Pressure, vacuum, capacity, airflow, charge', icon: 'swap-horizontal-outline', free: true },
    { href: '/sources', title: `Rules in ${c.name}`, detail: 'Licence, standards and sources', icon: 'shield-checkmark-outline', free: true },
  ];
  return (
    <Screen title="Tools" subtitle={c.guided ? `Set up for ${c.name}` : 'Generic metric defaults'} right={<SettingsButton />}>
      <Group title="On the job" tools={job} locked={!a.canCalc} />
      <Group title="Reference" tools={ref} locked={!a.canCalc} />
      <Small>Liquidline is an aid for licensed technicians. The equipment manufacturer’s data and your local regulations take precedence over anything shown here.</Small>
    </Screen>
  );
}
