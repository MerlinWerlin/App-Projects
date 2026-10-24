/** Static preview with the prompter's colours, size and alignment (scaled down to fit the editor). */
import { ScrollView, Text, View } from 'react-native';
import type { Prefs } from '../core/prefs';
import type { ParsedScript } from '../core/script';
import type { PrompterPalette } from '../theme/theme';

export function ScriptPreview({ parsed, palette, prefs }: { parsed: ParsedScript; palette: PrompterPalette; prefs: Prefs }) {
  const fs = Math.max(18, Math.round(prefs.fontSize * 0.6));
  const lh = Math.round(fs * prefs.lineHeight);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg, marginHorizontal: 16, borderRadius: 14 }} contentContainerStyle={{ padding: 18 }}>
      {parsed.blocks.map((b, i) => {
        if (b.kind === 'break') return <View key={i} style={{ borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: palette.dim, marginVertical: 18 }} />;
        if (b.kind === 'heading')
          return (
            <Text key={i} style={{ color: palette.dim, fontWeight: '800', fontSize: fs * 0.6, letterSpacing: 1, marginTop: 10, textAlign: prefs.align }}>
              {b.text.toUpperCase()}
            </Text>
          );
        return (
          <Text key={i} style={{ color: palette.ink, fontSize: fs, lineHeight: lh, marginBottom: lh * 0.5, textAlign: prefs.align, fontWeight: prefs.bold ? '700' : '500' }}>
            {b.segments.map((s, j) => {
              if (s.kind === 'text') return <Text key={j} style={s.emph ? { color: palette.emph, fontWeight: '800' } : undefined}>{s.text}</Text>;
              if (s.kind === 'cue') return <Text key={j} style={{ color: palette.cue, fontSize: fs * 0.6, fontWeight: '800' }}>{` ⏸ ${s.label.toUpperCase()} `}</Text>;
              return prefs.showNotes ? <Text key={j} style={{ color: palette.dim, fontStyle: 'italic', fontSize: fs * 0.6 }}>{` (${s.text}) `}</Text> : null;
            })}
          </Text>
        );
      })}
    </ScrollView>
  );
}
