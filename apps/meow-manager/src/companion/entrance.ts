import AsyncStorage from "@react-native-async-storage/async-storage";
import { chooseOpening2D, type Opening2D } from "./timeline";
const KEY = "meow-manager.entrances.2d.v1";
let session: Promise<{ opening: Opening2D; persisted: boolean }> | null = null;
export function entrance2DForSession() {
  if (!session)
    session = (async () => {
      try {
        const opening = chooseOpening2D(await AsyncStorage.getItem(KEY));
        await AsyncStorage.setItem(KEY, opening);
        return { opening, persisted: true };
      } catch {
        return { opening: "doze" as Opening2D, persisted: false };
      }
    })();
  return session;
}
