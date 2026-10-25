// First-launch language line: storage + hook (rules in src/core/languageHint.ts). Decided once per JS
// session; the flag is written as soon as the line is decided, so a later launch never shows it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { LANGUAGE_HINT_KEY, decideLanguageHint } from '../core/languageHint';
import { LOCALE_KEY } from '../i18n';

let visible = false;
let deciding: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

function decide(): Promise<boolean> {
  if (!deciding) {
    deciding = (async () => {
      try {
        const [stored, chosen] = await Promise.all([AsyncStorage.getItem(LANGUAGE_HINT_KEY), AsyncStorage.getItem(LOCALE_KEY)]);
        const d = decideLanguageHint(stored, chosen);
        if (d.write) await AsyncStorage.setItem(LANGUAGE_HINT_KEY, d.write);
        visible = d.show;
      } catch {
        // Storage unavailable: skip the line rather than risk showing it every launch.
        visible = false;
      }
      return visible;
    })();
  }
  return deciding;
}

/** Hide the line for the rest of this session (it is already marked as shown in storage). */
export function dismissLanguageHint(): void {
  visible = false;
  for (const fn of listeners) fn(false);
}

/** Whether the first-launch language line shows now. */
export function useLanguageHint(): boolean {
  const [show, setShow] = useState(visible);
  useEffect(() => {
    let alive = true;
    listeners.add(setShow);
    decide().then((v) => {
      if (alive) setShow(v);
    });
    return () => {
      alive = false;
      listeners.delete(setShow);
    };
  }, []);
  return show;
}
