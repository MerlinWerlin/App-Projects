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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Block, ParsedScript } from '../core/script';
import { pixelsPerSecond } from '../core/pace';
import { FONT_MAX, FONT_MIN, type Prefs } from '../core/prefs';
import type { PrompterPalette } from '../theme/theme';

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
  const textBase = {
    fontSize: fs,
    lineHeight: Math.round(fs * prefs.lineHeight),
    color: palette.ink,
    fontWeight: prefs.bold ? ('700' as const) : ('500' as const),
    textAlign: prefs.align,
  };

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
          {prefs.highlightLine && viewport > 0 ? (
            <View pointerEvents="none" style={[st.band, { top: lineY - fs * 0.15, height: textBase.lineHeight * 1.1, backgroundColor: palette.band }]} />
          ) : null}
          {viewport > 0 ? (
            <View pointerEvents="none" style={[st.marker, { top: lineY + textBase.lineHeight * 0.2, borderLeftColor: palette.cue }]} />
          ) : null}
          <Animated.View style={[{ paddingTop: lineY, paddingBottom: viewport * 0.5, paddingHorizontal: prefs.margin + 14 }, contentStyle]} onLayout={onContentLayout}>
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
        </View>
      </View>
    </GestureDetector>
  );
});

function BlockView({
  block,
  palette,
  textBase,
  showNotes,
}: {
  block: Block;
  palette: PrompterPalette;
  textBase: { fontSize: number; lineHeight: number; color: string; fontWeight: '700' | '500'; textAlign: 'left' | 'center' };
  showNotes: boolean;
}) {
  if (block.kind === 'break') {
    return <View style={[st.break, { borderTopColor: palette.dim }]} />;
  }
  if (block.kind === 'heading') {
    return (
      <Text style={[textBase, { fontSize: textBase.fontSize * 0.55, lineHeight: textBase.fontSize * 0.8, color: palette.dim, fontWeight: '800', letterSpacing: 1, marginTop: textBase.fontSize * 0.6 }]} accessibilityRole="header">
        {block.text.toUpperCase()}
      </Text>
    );
  }
  return (
    <Text style={[textBase, { marginBottom: textBase.lineHeight * 0.6 }]}>
      {block.segments.map((s, i) => {
        if (s.kind === 'text') return s.emph ? <Text key={i} style={{ color: palette.emph, fontWeight: '800' }}>{s.text}</Text> : <Text key={i}>{s.text}</Text>;
        if (s.kind === 'cue') return <Text key={i} style={{ color: palette.cue, fontSize: textBase.fontSize * 0.6, fontWeight: '800' }}>{` ⏸ ${s.label.toUpperCase()} `}</Text>;
        return showNotes ? <Text key={i} style={{ color: palette.dim, fontStyle: 'italic', fontSize: textBase.fontSize * 0.6 }}>{` (${s.text}) `}</Text> : null;
      })}
    </Text>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0 },
  marker: { position: 'absolute', left: 4, width: 0, height: 0, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 12, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  break: { borderTopWidth: 2, borderStyle: 'dashed', marginVertical: 28, opacity: 0.6 },
});
