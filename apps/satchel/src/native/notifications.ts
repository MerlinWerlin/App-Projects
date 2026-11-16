// Trip reminders, device side (docs/REMINDERS.md). LOCAL notifications only: scheduled on this phone with
// expo-notifications, no push token, nothing sent anywhere. Plans come from src/core/reminders.ts.
// - Permission is asked only when the traveller turns reminders on (Settings or the Itinerary card), never at launch.
// - We only ever cancel our own notifications (ids starting 'satchel-'); a re-sync replaces them in place.
// - Each one carries its custom sound (assets/sounds, bundled by the expo-notifications plugin) and, on iOS, the
//   mascot thumbnail as an attachment. iOS moves an attachment's file into its own store when scheduling, so each
//   notification gets a fresh copy in the cache directory. If attaching fails, it is scheduled without the image.
// - Screenshot builds (EXPO_PUBLIC_SATCHEL_CAPTURE=1) never ask for permission and never schedule anything.
// Every call is guarded: the UI never sees a throw.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isOurReminderId, REMINDER_SOUNDS, type PlannedReminder, type ReminderSound } from '../core/reminders.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';

export const CAPTURE = process.env.EXPO_PUBLIC_SATCHEL_CAPTURE === '1';
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const ACTIVE = SUPPORTED && !CAPTURE;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MASCOT = require('../../assets/mascot/notify.png');
const ATTACH_DIR = 'reminder-attachments/';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

function readStatus(p: Notifications.NotificationPermissionsStatus): ReminderPermission {
  const ios = p.ios?.status;
  // Provisional / ephemeral still deliver quietly to Notification Centre, so they count as allowed.
  if (p.granted || ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'granted';
  return p.status === 'denied' ? 'denied' : 'undetermined';
}

/** The current permission, without asking. */
export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!ACTIVE) return 'undetermined';
  try {
    return readStatus(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** Asks for alerts and sounds (no badge), only when not already decided. Never asks in screenshot builds. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!ACTIVE) return 'undetermined';
  try {
    const now = readStatus(await Notifications.getPermissionsAsync());
    if (now !== 'undetermined') return now;
    return readStatus(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  } catch {
    return 'undetermined';
  }
}

let handlerSet = false;
/** While Satchel is open, a reminder still shows its banner and plays its sound. */
export function installForegroundHandler(): void {
  if (!ACTIVE || handlerSet) return;
  handlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch {
    handlerSet = false;
  }
}

/** Android 8+ plays a custom sound only through a channel that names it: one channel per sound. */
const channelId = (sound: ReminderSound) => `satchel-${sound.replace(/\.wav$/, '')}`;
let channelsReady: Promise<void> | null = null;
function ensureChannels(t: T): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelsReady) {
    channelsReady = Promise.all(
      Object.values(REMINDER_SOUNDS).map((sound) =>
        Notifications.setNotificationChannelAsync(channelId(sound), {
          name: t('reminders.settings.toggle'),
          importance: Notifications.AndroidImportance.HIGH,
          sound,
        }),
      ),
    )
      .then(() => {})
      .catch(() => {
        channelsReady = null;
      });
  }
  return channelsReady;
}

/** The bundled mascot thumbnail as a local file uri, or null. */
let mascotUri: Promise<string | null> | null = null;
function mascotFile(): Promise<string | null> {
  if (!mascotUri) {
    mascotUri = (async () => {
      try {
        // Bundled with the app: in a store build this resolves to the file inside the app, no network.
        const [asset] = await Asset.loadAsync(MASCOT);
        return asset?.localUri ?? null;
      } catch {
        mascotUri = null;
        return null;
      }
    })();
  }
  return mascotUri;
}

/** A fresh copy of the mascot for one notification (iOS takes ownership of the file). Null when it can't be made. */
async function attachmentFor(id: string): Promise<Notifications.NotificationContentAttachmentIos | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const src = await mascotFile();
    const cache = FileSystem.cacheDirectory;
    if (!src || !cache) return null;
    const dir = `${cache}${ATTACH_DIR}`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const to = `${dir}${id}-${Date.now()}.png`;
    await FileSystem.copyAsync({ from: src, to });
    return { identifier: 'satchel-mascot', url: to, type: null, typeHint: 'public.png' };
  } catch {
    return null;
  }
}

async function ourScheduledIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => n.identifier).filter(isOurReminderId);
}

async function cancelOurs(): Promise<void> {
  const ids = await ourScheduledIds();
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** What was last scheduled, so an unchanged plan (the app coming to the front again) doesn't reschedule. */
let lastSignature = '';
const signature = (plan: readonly PlannedReminder[], t: T) =>
  JSON.stringify(plan.map((r) => [r.id, r.at, r.sound, t(r.titleKey as Key, r.titleParams), t(r.bodyKey as Key, r.bodyParams)]));

async function schedule(r: PlannedReminder, t: T): Promise<void> {
  const content: Notifications.NotificationContentInput = {
    title: t(r.titleKey as Key, r.titleParams),
    body: t(r.bodyKey as Key, r.bodyParams),
    sound: r.sound,
    data: { itemId: r.itemId, tripId: r.tripId, url: `/item/${r.itemId}` },
    threadIdentifier: `satchel-trip-${r.tripId}`,
  };
  const trigger: Notifications.DateTriggerInput = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: channelId(r.sound) };
  const attachment = await attachmentFor(r.id);
  if (attachment) {
    try {
      await Notifications.scheduleNotificationAsync({ identifier: r.id, content: { ...content, attachments: [attachment] }, trigger });
      return;
    } catch {
      // fall through: schedule without the picture
    }
  }
  await Notifications.scheduleNotificationAsync({ identifier: r.id, content, trigger });
}

async function doSync(plan: readonly PlannedReminder[], t: T): Promise<void> {
  if ((await getReminderPermission()) !== 'granted') return;
  await ensureChannels(t);
  const sig = signature(plan, t);
  const pending = new Set(await ourScheduledIds());
  // Unchanged and still all pending (none has fired since): nothing to do.
  if (sig === lastSignature && plan.every((r) => pending.has(r.id)) && pending.size === plan.length) return;
  await cancelOurs();
  const cache = FileSystem.cacheDirectory;
  if (cache) await FileSystem.deleteAsync(`${cache}${ATTACH_DIR}`, { idempotent: true }).catch(() => {});
  for (const r of plan) {
    try {
      await schedule(r, t);
    } catch {
      // one bad reminder never stops the rest
    }
  }
  lastSignature = sig;
}

async function doClear(): Promise<void> {
  lastSignature = '';
  await cancelOurs();
}

// Syncs run one after another, never overlapping (a quick toggle on-off-on can't interleave cancels and schedules).
let queue: Promise<void> = Promise.resolve();
const enqueue = (job: () => Promise<void>): Promise<void> => {
  queue = queue.then(job).catch(() => {});
  return queue;
};

/** Replaces our scheduled reminders with `plan` (only when notifications are allowed; never asks). */
export function syncReminders(plan: readonly PlannedReminder[], t: T): Promise<void> {
  if (!ACTIVE) return Promise.resolve();
  return enqueue(() => doSync(plan, t));
}

/** Cancels every reminder Satchel scheduled (reminders turned off). Leaves anything else alone. */
export function clearReminders(): Promise<void> {
  if (!ACTIVE) return Promise.resolve();
  return enqueue(doClear);
}

const itemOf = (r: Notifications.NotificationResponse | null | undefined): string | null => {
  const req = r?.notification?.request;
  if (!req || !isOurReminderId(req.identifier)) return null;
  const id = (req.content.data as { itemId?: unknown } | null)?.itemId;
  return typeof id === 'string' && id ? id : null;
};

const handled = new Set<string>();
const responseKey = (r: Notifications.NotificationResponse) => `${r.notification.request.identifier}@${r.notification.date}`;

/**
 * Calls `open(itemId)` when a Satchel reminder is tapped, including the tap that launched the app. Each tap is
 * handled once. Returns the unsubscribe.
 */
export function subscribeReminderTaps(open: (itemId: string) => void): () => void {
  if (!ACTIVE) return () => {};
  const handle = (r: Notifications.NotificationResponse | null | undefined) => {
    const itemId = itemOf(r);
    if (!r || !itemId) return;
    const key = responseKey(r);
    if (handled.has(key)) return;
    handled.add(key);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // the handled set still stops a second open
    }
    open(itemId);
  };
  try {
    handle(Notifications.getLastNotificationResponse());
  } catch {
    // no launch tap to read
  }
  let sub: { remove: () => void } | null = null;
  try {
    sub = Notifications.addNotificationResponseReceivedListener(handle);
  } catch {
    sub = null;
  }
  return () => sub?.remove();
}
