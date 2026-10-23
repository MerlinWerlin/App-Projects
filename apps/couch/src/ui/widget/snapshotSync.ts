/**
 * Keeps the widget snapshot in shared storage up to date (T77), without React so it is unit-tested.
 *
 * Writes only when what the widget would show changes (TV, connection, labels, Plus), then asks the
 * system to redraw. With the unavailable bridge (Expo Go, tests) nothing is written.
 */
import type { WidgetBridge } from '../../core/widget/bridge';
import {
  buildWidgetSnapshot,
  sameWidgetContent,
  serializeWidgetSnapshot,
  type WidgetSnapshot,
  type WidgetSnapshotInput,
} from '../../core/widget/snapshot';

export interface WidgetSnapshotSync {
  /** Builds the snapshot from `input` and writes it when it differs from the last write. Returns true if written. */
  update(input: WidgetSnapshotInput): Promise<boolean>;
  last(): WidgetSnapshot | null;
}

export function createWidgetSnapshotSync(bridge: WidgetBridge): WidgetSnapshotSync {
  let written: WidgetSnapshot | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  return {
    update(input) {
      const run = async (): Promise<boolean> => {
        if (!bridge.available) return false;
        const next = buildWidgetSnapshot(input);
        if (sameWidgetContent(written, next)) return false;
        written = next;
        try {
          await bridge.setSnapshot(serializeWidgetSnapshot(next));
          await bridge.reloadTimelines();
        } catch (e) {
          written = null; // not stored: the next update writes again
          throw e;
        }
        return true;
      };
      // Serialise writes so an older snapshot can never land after a newer one.
      const p = chain.then(run, run);
      chain = p.catch(() => undefined);
      return p.catch(() => false);
    },
    last: () => written,
  };
}
