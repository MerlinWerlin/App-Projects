// T89 calendar file adapter: writes the .ics text (src/core/ics.ts) into the cache folder and hands it to the
// share sheet as text/calendar (UTI com.apple.ical.ics), so iOS offers Calendar ("Add All") alongside Files,
// Mail and Messages. Same Expo Go modules as src/native/tripFile.ts. Never throws to the UI.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ICS_MIME, ICS_UTI } from '../core/ics.ts';

/** 'write': the file couldn't be written; 'unavailable': no share sheet in this build; 'failed': it didn't open. */
export type CalendarShareResult = 'shared' | 'write' | 'unavailable' | 'failed';

export async function shareCalendarFile(fileName: string, text: string, dialogTitle: string): Promise<CalendarShareResult> {
  let uri: string;
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return 'write';
    const folder = `${dir}calendar/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
    uri = `${folder}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    return 'write';
  }
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: ICS_MIME, UTI: ICS_UTI, dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  }
}
