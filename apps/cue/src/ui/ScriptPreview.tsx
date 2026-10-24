/** Static preview with the prompter's colours, size and alignment (scaled down to fit the editor). */
import { ScrollView, Text, View } from 'react-native';
import type { Prefs } from '../core/prefs';
import type { ParsedScript } from '../core/script';
import { FONT, RADIUS, type PrompterPalette } from '../theme/theme';

export function ScriptPreview({ parsed, palette, prefs }: { parsed: ParsedScript; palette: PrompterPalette; prefs: Prefs }) {
  const fs = Math.max(18, Math.round(prefs.fontSize * 0.6));
  const lh = Math.round(fs * prefs.lineHeight);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg, marginHorizontal: 16, marginTop: 8, borderRadius: RADIUS.card }} contentContainerStyle={{ padding: 22 }}>
      {parsed.blocks.map((b, i) => {
        if (b.kind === 'break') return <View key={i} style={{ borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: palette.dim, marginVertical: 18 }} />;
        if (b.kind === 'heading')
          return (
            <Text key={i} style={{ color: palette.cue, fontFamily: FONT.displaySemi, fontSize: fs * 0.62, marginTop: 10, marginBottom: 4, textAlign: prefs.align }}>
              {b.text}
            </Text>
          );
        return (
          <Text key={i} style={{ color: palette.ink, fontSize: fs, lineHeight: lh, marginBottom: lh * 0.5, textAlign: prefs.align, fontFamily: prefs.bold ? FONT.bodyBold : FONT.body }}>
            {b.segments.map((s, j) => {
              if (s.kind === 'text') return <Text key={j} style={s.emph ? { color: palette.emph, fontFamily: FONT.bodyBold } : undefined}>{s.text}</Text>;
              if (s.kind === 'cue') return <Text key={j} style={{ color: palette.cue, fontSize: fs * 0.6, fontFamily: FONT.bodyBold }}>{`  ‖ ${s.label}  `}</Text>;
              return prefs.showNotes ? <Text key={j} style={{ color: palette.dim, fontStyle: 'italic', fontSize: fs * 0.6 }}>{` (${s.text}) `}</Text> : null;
            })}
          </Text>
        );
      })}
    </ScrollView>
  );
}
