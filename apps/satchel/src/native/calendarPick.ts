// T170 calendar file picker: lets the traveller choose an .ics file in Files and returns its text, read on the phone
// (src/core/itinerary.ts turns it into plans). The file is only read; nothing is copied into Satchel or sent anywhere.
// Never throws to the UI.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MAX_IMPORT_CHARS } from '../core/itinerary.ts';

export type CalendarPick = { ok: true; name: string; text: string } | { ok: false; reason: 'cancelled' | 'failed' };

export async function pickCalendarFile(): Promise<CalendarPick> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/calendar', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    const text = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.UTF8 });
    FileSystem.deleteAsync(a.uri, { idempotent: true }).catch(() => {});
    return { ok: true, name: a.name || 'calendar.ics', text: text.slice(0, MAX_IMPORT_CHARS) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
