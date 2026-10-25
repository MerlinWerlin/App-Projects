// T146 (fb-1025 A): the widget link check for the Widgets tab. Asks the bridge (through the
// src/native/widgets.ts adapter, so Expo Go and Android never touch native code) whether the app
// and the widget extension share the App Group, and turns the answer into one verdict
// (src/core/widgetLink.ts). Checks when the tab gains focus and WIDGET_LINK_RECHECK_MS after each
// theme pick (the widgets reload in between). Never throws.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WIDGET_LINK_RECHECK_MS, widgetLinkVerdict, type WidgetLinkVerdict } from '../core/widgetLink';
import { widgets } from '../native/widgets';

/** One check: the verdict for the theme the app last applied (null = the stored theme's id). */
export async function checkWidgetLink(expectedThemeId: string | null, now: Date = new Date()): Promise<WidgetLinkVerdict> {
  try {
    return widgetLinkVerdict(await widgets.linkStatus(), expectedThemeId, now);
  } catch {
    return 'unknown';
  }
}

/**
 * The current verdict, or null before the first answer. `pickNonce` goes up on every theme pick;
 * each change schedules one re-check (a newer pick cancels the older timer).
 */
export function useWidgetLink(expectedThemeId: string | null, pickNonce: number): WidgetLinkVerdict | null {
  const [verdict, setVerdict] = useState<WidgetLinkVerdict | null>(null);
  const expected = useRef(expectedThemeId);
  expected.current = expectedThemeId;
  const seq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useCallback(() => {
    const mine = ++seq.current;
    void checkWidgetLink(expected.current).then((v) => {
      // Only the latest check may answer.
      if (mounted.current && mine === seq.current) setVerdict(v);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  useEffect(() => {
    if (pickNonce <= 0) return;
    const id = setTimeout(check, WIDGET_LINK_RECHECK_MS);
    return () => clearTimeout(id);
  }, [pickNonce, check]);

  return verdict;
}
