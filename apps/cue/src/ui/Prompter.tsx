/**
 * The prompter surface, shared by the full-screen prompter and the record overlay.
 *
 * Scrolling runs on the UI thread (Reanimated frame callback) so long scripts never stutter
 * (starter-standard "no lag in long lists"). Speed = pixels-per-second derived from WPM and the
 * laid-out text height, times the user's speed nudge, times the voice gate factor (Voice Pace).
 * Gestures: tap = pause/resume, drag = scrub (pauses), pinch = text size.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Block, ParsedScript } from '../core/script';
import { pixelsPerSecond } from '../core/pace';
import { FONT_MAX, FONT_MIN, type Prefs } from '../core/prefs';
import { FONT, type PrompterPalette } from '../theme/theme';

export interface PrompterHandle {
  /** Jump so word `w` sits on the reading line. */
  jumpToWord(w: number, animated?: boolean): void;
  /** Current word at the reading line. */
  currentWord(): number;
  restart(): void;
}

interface Props {
  parsed: ParsedScript;
  prefs: Prefs;
  palette: PrompterPalette;
  wpm: number;
  /** Speed multiplier from +/- (1 = the script's WPM). */
  speed: number;
  running: boolean;
  /** 0..1 voice gate factor (1 when not in Voice Pace). */
  gate: SharedValue<number>;
  /** Word index to glide to (Voice Follow); null = free scroll. */
  followWord: number | null;
  transparent?: boolean;
  reduceMotion: boolean;
  onTap(): void;
  onScrubStart(): void;
  onFontSize(size: number): void;
  onEnd(): void;
}

interface BlockBox {
  y: number;
  h: number;
  first: number;
  count: number;
}

function blockWordCount(b: Block, next: Block | undefined, total: number): number {
  if (b.kind === 'break') return 0;
  const nextFirst = next && next.kind !== 'break' ? next.firstWord : undefined;
  return Math.max(0, (nextFirst ?? total) - b.firstWord);
}

export const Prompter = forwardRef<PrompterHandle, Props>(function Prompter(p, ref) {
  const { prefs, palette, parsed } = p;
  const [viewport, setViewport] = useState(0);
  const boxes = useRef<(BlockBox | null)[]>([]);
  const offset = useSharedValue(0);
  const maxOffset = useSharedValue(0);
  const pps = useSharedValue(0);
  const running = useSharedValue(false);
  const dragging = useSharedValue(false);
  const ended = useSharedValue(false);
  const contentH = useRef(0);

  const lineY = viewport * prefs.readingLine;

  // Word counts per block for the y <-> word mapping.
  const counts = useMemo(
    () => parsed.blocks.map((b, i) => blockWordCount(b, parsed.blocks.slice(i + 1).find((x) => x.kind !== 'break'), parsed.words.length)),
    [parsed],
  );

  const wordToY = useCallback(
    (w: number) => {
      let best = 0;
      parsed.blocks.forEach((b, i) => {
        const box = boxes.current[i];
        if (!box || b.kind === 'break') return;
        if (w >= box.first) best = box.count > 0 ? box.y + (Math.min(w - box.first, box.count) / box.count) * box.h : box.y;
      });
      return best;
    },
    [parsed],
  );

  const yToWord = useCallback(
    (y: number) => {
      let w = 0;
      parsed.blocks.forEach((b, i) => {
        const box = boxes.current[i];
        if (!box || b.kind === 'break') return;
        if (y >= box.y) w = box.first + (box.h > 0 ? Math.round((Math.min(y - box.y, box.h) / box.h) * box.count) : 0);
      });
      return Math.min(parsed.words.length, w);
    },
    [parsed],
  );

  useImperativeHandle(
    ref,
    () => ({
      jumpToWord(w, animated = true) {
        const y = Math.min(wordToY(w), maxOffset.value);
        ended.value = false;
        offset.value = animated && !p.reduceMotion ? withTiming(y, { duration: 350 }) : y;
      },
      currentWord: () => yToWord(offset.value),
      restart() {
        ended.value = false;
        offset.value = 0;
      },
    }),
    [wordToY, yToWord, offset, maxOffset, ended, p.reduceMotion],
  );

  // Recompute speed whenever layout, WPM or the nudge changes.
  const recomputeSpeed = useCallback(() => {
    pps.value = pixelsPerSecond(contentH.current, parsed.words.length || 1, p.wpm) * p.speed;
  }, [pps, parsed.words.length, p.wpm, p.speed]);
  useEffect(recomputeSpeed, [recomputeSpeed]);

  useEffect(() => {
    running.value = p.running && p.followWord === null;
  }, [p.running, p.followWord, running]);

  // Voice Follow: glide to the matched word.
  useEffect(() => {
    if (p.followWord === null || !p.running) return;
    const y = Math.min(wordToY(p.followWord), maxOffset.value);
    offset.value = p.reduceMotion ? y : withTiming(y, { duration: 450 });
  }, [p.followWord, p.running, wordToY, offset, maxOffset, p.reduceMotion]);

  // Only shared values are captured by the worklet (never the props object, which Reanimated would copy and freeze).
  const gate = p.gate;
  useFrameCallback((f) => {
    if (!running.value || dragging.value || ended.value) return;
    const dt = Math.min(0.1, (f.timeSincePreviousFrame ?? 16) / 1000);
    const next = offset.value + pps.value * gate.value * dt;
    if (next >= maxOffset.value) {
      offset.value = maxOffset.value;
      ended.value = true;
    } else {
      offset.value = next;
    }
  });

  // End detection is polled on the JS side (no worklet->JS calls needed).
  const onEnd = p.onEnd;
  useEffect(() => {
    if (!p.running) return;
    const id = setInterval(() => {
      if (ended.value) onEnd();
    }, 200);
    return () => clearInterval(id);
  }, [p.running, ended, onEnd]);

  const flipY = prefs.mirrorV ? -1 : 1;
  const startOffset = useRef(0);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(8)
    .onStart(() => {
      dragging.value = true;
      startOffset.current = offset.value;
      p.onScrubStart();
    })
    .onUpdate((e) => {
      offset.value = Math.max(0, Math.min(maxOffset.value, startOffset.current - e.translationY * flipY));
    })
    .onEnd(() => {
      dragging.value = false;
      ended.value = offset.value >= maxOffset.value;
    });
  const startFont = useRef(prefs.fontSize);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      startFont.current = prefs.fontSize;
    })
    .onEnd((e) => {
      const next = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, startFont.current * e.scale)));
      if (next !== prefs.fontSize) p.onFontSize(next);
    });
  const tapG = Gesture.Tap().runOnJS(true).maxDuration(300).onEnd(() => p.onTap());
  const gesture = Gesture.Race(pinch, pan, tapG);

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.value }] }));

  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    contentH.current = Math.max(1, h - lineY - viewport * 0.5);
    maxOffset.value = Math.max(0, h - viewport * 0.5 - lineY);
    recomputeSpeed();
  };

  const fs = prefs.fontSize;
  const lh = Math.round(fs * prefs.lineHeight);
  const textBase = {
    fontSize: fs,
    lineHeight: lh,
    color: palette.ink,
    fontFamily: prefs.bold ? FONT.bodyBold : FONT.body,
    textAlign: prefs.align,
  };
  const bandH = lh * 1.9;
  const bandTop = lineY + lh * 0.5 - bandH / 2;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[st.fill, { backgroundColor: p.transparent ? 'transparent' : palette.bg }]}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        accessible
        accessibilityRole="text"
        accessibilityLabel="Teleprompter"
        accessibilityHint="Tap to pause or resume. Drag to scroll. Pinch to resize text."
      >
        <View style={[st.fill, { transform: [{ scaleX: prefs.mirrorH ? -1 : 1 }, { scaleY: flipY }] }]}>
          {/* The reading line: a soft brass glow behind the line you are on (the one bold element of the design). */}
          {prefs.highlightLine && viewport > 0 ? (
            <LinearGradient
              pointerEvents="none"
              colors={[alpha(palette.band, 0), palette.band, alpha(palette.band, 0)]}
              locations={[0, 0.5, 1]}
              style={[st.band, { top: bandTop, height: bandH }]}
            />
          ) : null}
          <Animated.View style={[{ paddingTop: lineY, paddingBottom: viewport * 0.5, paddingHorizontal: prefs.margin + 16 }, contentStyle]} onLayout={onContentLayout}>
            {parsed.blocks.map((b, i) => (
              <View
                key={i}
                onLayout={(e) => {
                  boxes.current[i] = { y: e.nativeEvent.layout.y - lineY, h: e.nativeEvent.layout.height, first: b.kind === 'break' ? 0 : b.firstWord, count: counts[i] ?? 0 };
                }}
              >
                <BlockView block={b} palette={palette} textBase={textBase} showNotes={prefs.showNotes} />
              </View>
            ))}
          </Animated.View>
          {/* Prompter-glass fades: text arrives softly from below and leaves softly above. */}
          {!p.transparent && viewport > 0 ? (
            <>
              <LinearGradient pointerEvents="none" colors={[palette.bg, alpha(palette.bg, 0)]} style={[st.fade, { top: 0, height: Math.max(40, lineY * 0.8) }]} />
              <LinearGradient pointerEvents="none" colors={[alpha(palette.bg, 0), palette.bg]} style={[st.fade, { bottom: 0, height: viewport * 0.22 }]} />
            </>
          ) : null}
          {viewport > 0 ? (
            <>
              <View pointerEvents="none" style={[st.tick, { left: 0, top: lineY + lh * 0.5 - 14, backgroundColor: palette.cue }]} />
              <View pointerEvents="none" style={[st.tick, { right: 0, top: lineY + lh * 0.5 - 14, backgroundColor: palette.cue }]} />
            </>
          ) : null}
        </View>
      </View>
    </GestureDetector>
  );
});

/** '#RRGGBB' or 'rgba(r,g,b,a)' with a new alpha (gradients must fade to the same colour, never through black). */
function alpha(color: string, a: number): string {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
  const hex = color.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function BlockView({
  block,
  palette,
  textBase,
  showNotes,
}: {
  block: Block;
  palette: PrompterPalette;
  textBase: { fontSize: number; lineHeight: number; color: string; fontFamily: string; textAlign: 'left' | 'center' };
  showNotes: boolean;
}) {
  if (block.kind === 'break') {
    return (
      <View style={st.breakRow}>
        <View style={[st.breakDot, { backgroundColor: palette.dim }]} />
        <View style={[st.breakDot, { backgroundColor: palette.dim }]} />
        <View style={[st.breakDot, { backgroundColor: palette.dim }]} />
      </View>
    );
  }
  if (block.kind === 'heading') {
    return (
      <Text style={[textBase, { fontFamily: FONT.displaySemi, fontSize: textBase.fontSize * 0.5, lineHeight: textBase.fontSize * 0.72, color: palette.cue, marginTop: textBase.fontSize * 0.7, marginBottom: textBase.fontSize * 0.15 }]} accessibilityRole="header">
        {block.text}
      </Text>
    );
  }
  return (
    <Text style={[textBase, { marginBottom: textBase.lineHeight * 0.6 }]}>
      {block.segments.map((s, i) => {
        if (s.kind === 'text') return s.emph ? <Text key={i} style={{ color: palette.emph, fontFamily: FONT.bodyBold }}>{s.text}</Text> : <Text key={i}>{s.text}</Text>;
        if (s.kind === 'cue') return <Text key={i} style={{ color: palette.cue, fontSize: textBase.fontSize * 0.55, fontFamily: FONT.bodyBold }}>{`  ‖ ${s.label}  `}</Text>;
        return showNotes ? <Text key={i} style={{ color: palette.dim, fontStyle: 'italic', fontSize: textBase.fontSize * 0.55 }}>{` (${s.text}) `}</Text> : null;
      })}
    </Text>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0 },
  fade: { position: 'absolute', left: 0, right: 0 },
  tick: { position: 'absolute', width: 4, height: 28, borderRadius: 2 },
  breakRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 30 },
  breakDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
});
