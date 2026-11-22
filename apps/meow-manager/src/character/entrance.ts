import AsyncStorage from "@react-native-async-storage/async-storage";
import { nextOpening, type Opening } from "./motion.ts";
const KEY = "meow-manager.entrances.v1";
let session: Promise<{ opening: Opening; persisted: boolean }> | null = null;
export function entranceForSession() {
  // A JS application launch chooses once. Quick foreground returns resume the director.
  if (!session)
    session = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        let bag: unknown = null;
        try {
          bag = raw ? JSON.parse(raw) : null;
        } catch {
          /* Recover only the scene chooser, never task storage. */
        }
        const choice = nextOpening(bag);
        await AsyncStorage.setItem(KEY, JSON.stringify(choice.bag));
        return { opening: choice.opening, persisted: true };
      } catch {
        return { opening: "nap" as Opening, persisted: false };
      }
    })();
  return session;
}
