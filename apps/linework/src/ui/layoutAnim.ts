// LayoutAnimation for list add/remove (docs/POLISH.md: "LinearTransition" → LayoutAnimation).
// Call animateListChange(reduce) right before the state change that adds/removes rows.
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { duration } from '../theme/motion';

let androidReady = false;

function enableAndroid(): void {
  if (androidReady || Platform.OS !== 'android') return;
  androidReady = true;
  // The New Architecture (Fabric) supports LayoutAnimation already and warns on this call, so skip it there.
  const fabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager != null;
  const ui = UIManager as { setLayoutAnimationEnabledExperimental?: (on: boolean) => void };
  if (!fabric && typeof ui.setLayoutAnimationEnabledExperimental === 'function') {
    ui.setLayoutAnimationEnabledExperimental(true);
  }
}

/** Ease-in-out layout animation (duration.base) for the next layout pass; nothing under Reduce Motion. */
export function animateListChange(reduce: boolean): void {
  if (reduce) return;
  enableAndroid();
  LayoutAnimation.configureNext(
    LayoutAnimation.create(duration.base, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
}
