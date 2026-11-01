// Keeps the home-screen widget in step with the game:
// - draws the buddy in the three moods the widget shows and saves them as PNGs (only when the
//   buddy, its stage or form changes),
// - pushes the widget numbers (egg meter, Spark, happiness) whenever the game changes,
// - applies Feed/Pet taps made on the widget when the app comes to the front.
// Renders nothing visible. Does nothing in builds without the widget.
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import type Svg from 'react-native-svg';
import { buddy } from '../core/game';
import type { Mood } from '../core/growth';
import { WIDGET_IMAGES, type WidgetMood, imageKeyFor, parseTaps, widgetState } from '../core/widget';
import { petName, t } from '../i18n';
import { pushWidgetImage, pushWidgetState, takeWidgetTaps, widgetsAvailable } from '../native/widgets';
import { actions, useGame } from '../store/game';
import { PetView } from './PetView';

const MOODS: WidgetMood[] = ['happy', 'joyful', 'sleepy'];
const IMAGE_PX = 360;

type DataUrlSvg = { toDataURL: (cb: (base64: string) => void, options?: { width: number; height: number }) => void };

function snapshot(svg: Svg | null): Promise<string | null> {
  return new Promise((resolve) => {
    const s = svg as unknown as DataUrlSvg | null;
    if (!s || typeof s.toDataURL !== 'function') return resolve(null);
    const timer = setTimeout(() => resolve(null), 3000);
    try {
      s.toDataURL(
        (b64) => {
          clearTimeout(timer);
          resolve(b64 || null);
        },
        { width: IMAGE_PX, height: IMAGE_PX },
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function WidgetSync() {
  const g = useGame();
  const [enabled, setEnabled] = useState(false);
  const [moodIdx, setMoodIdx] = useState<number | null>(null);
  const doneKey = useRef<string | null>(null);
  const svgRef = useRef<Svg>(null);
  const pet = buddy(g);
  const key = imageKeyFor(g);

  useEffect(() => {
    widgetsAvailable().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  // Fold widget taps in on start and whenever the app comes back.
  useEffect(() => {
    if (!enabled) return;
    const pull = () => {
      takeWidgetTaps()
        .then((raw) => {
          const taps = parseTaps(raw);
          if (taps.length > 0) actions.applyWidgetTaps(taps);
        })
        .catch(() => {});
    };
    pull();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') pull();
    });
    return () => sub.remove();
  }, [enabled]);

  // Push the numbers (debounced).
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      const w = widgetState(g, pet ? petName(pet) : '', {
        feed: t('care.feed'),
        pet: t('care.pet'),
        egg: t('home.egg.meter'),
        eggsReady: t('widget.eggsReady'),
        spark: t('home.spark'),
        hatch: t('widget.hatch'),
      });
      pushWidgetState(JSON.stringify(w)).catch(() => {});
    }, 800);
    return () => clearTimeout(id);
  }, [enabled, g, pet]);

  // Re-draw the three mood images when the buddy's look changes.
  useEffect(() => {
    if (!enabled || !pet || doneKey.current === key) return;
    setMoodIdx(0);
  }, [enabled, pet, key]);

  useEffect(() => {
    if (moodIdx === null) return;
    let cancelled = false;
    // Give the hidden view a moment to lay out before exporting.
    const id = setTimeout(async () => {
      const mood = MOODS[moodIdx]!;
      const b64 = await snapshot(svgRef.current);
      if (cancelled) return;
      if (b64) await pushWidgetImage(WIDGET_IMAGES[mood], b64);
      if (moodIdx + 1 < MOODS.length) {
        setMoodIdx(moodIdx + 1);
      } else {
        doneKey.current = key;
        setMoodIdx(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [moodIdx, key]);

  if (!enabled || !pet || moodIdx === null) return null;
  const mood: Mood = MOODS[moodIdx]!;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -2000, top: 0, width: IMAGE_PX, height: IMAGE_PX }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PetView pet={pet} size={IMAGE_PX} mood={mood} svgRef={svgRef} noShadow />
    </View>
  );
}
