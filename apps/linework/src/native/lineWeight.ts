// F4 / T82: the remembered template line thickness in AsyncStorage (same key Trace and Lightbox read).
// Errors are swallowed: a failed read is the default weight, a failed write keeps the old choice.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LINE_WEIGHT, LINE_WEIGHT_KEY, parseLineWeight, type LineWeight } from '../core/lineWeight';

export async function loadLineWeight(): Promise<LineWeight> {
  try {
    return parseLineWeight(await AsyncStorage.getItem(LINE_WEIGHT_KEY));
  } catch {
    return DEFAULT_LINE_WEIGHT;
  }
}

export async function saveLineWeight(w: LineWeight): Promise<void> {
  try {
    await AsyncStorage.setItem(LINE_WEIGHT_KEY, w);
  } catch {
    // keep the previous choice
  }
}
