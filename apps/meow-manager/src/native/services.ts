import { Platform, Share } from "react-native";
import { notificationId, reminderTasks } from "../core/reminders.ts";
import {
  startOfDay,
  type Busy,
  type Task,
  type Preferences,
} from "../core/model.ts";
import { t, type Key } from "../i18n/strings.ts";

export type Notice = { key: Key; count?: number };
let notificationQueue: Promise<Notice> = Promise.resolve({ key: "saved" });
export function syncReminders(
  tasks: Task[],
  preferences: Preferences,
  ask = false,
): Promise<Notice> {
  notificationQueue = notificationQueue
    .catch(() => ({ key: "remindersFailed" }) as Notice)
    .then(async () => {
      if (Platform.OS === "web") return { key: "remindersUnsupported" };
      try {
        const N = await import("expo-notifications");
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        if (Platform.OS === "android")
          await N.setNotificationChannelAsync("meow-reminders", {
            name: "Meow Manager",
            importance: N.AndroidImportance.DEFAULT,
          });
        const pending = reminderTasks(tasks);
        let permission = await N.getPermissionsAsync();
        if (
          ask &&
          pending.length &&
          !permission.granted &&
          permission.canAskAgain
        )
          permission = await N.requestPermissionsAsync();
        const scheduled = await N.getAllScheduledNotificationsAsync();
        const desired = new Map(
          pending.slice(0, 48).map((task) => [notificationId(task), task]),
        );
        const present = new Set<string>();
        for (const n of scheduled) {
          if (!n.identifier.startsWith("meow:")) continue;
          const task = desired.get(n.identifier);
          const same =
            task &&
            n.content.data?.dueAt === task.dueAt &&
            n.content.body === task.title &&
            n.content.title ===
              t(preferences.language, "notificationsTitle", {
                cat: preferences.catName,
              });
          if (same && permission.granted) present.add(n.identifier);
          else await N.cancelScheduledNotificationAsync(n.identifier);
        }
        if (!permission.granted)
          return {
            key: pending.length ? "remindersDenied" : "remindersSummary",
            count: 0,
          };
        for (const [identifier, task] of desired) {
          if (present.has(identifier)) continue;
          await N.scheduleNotificationAsync({
            identifier,
            content: {
              title: t(preferences.language, "notificationsTitle", {
                cat: preferences.catName,
              }),
              body: task.title,
              sound: "default",
              data: { taskId: task.id, dueAt: task.dueAt },
            },
            trigger: {
              type: N.SchedulableTriggerInputTypes.DATE,
              date: new Date(task.dueAt!),
              channelId: "meow-reminders",
            },
          });
        }
        return {
          key: pending.length > 48 ? "remindersLimit" : "remindersSummary",
          count: desired.size,
        };
      } catch {
        return { key: "remindersFailed" };
      }
    });
  return notificationQueue;
}

export async function readCalendar(now = new Date()): Promise<Busy[]> {
  if (Platform.OS === "web") throw new Error("calendarUnsupported");
  const C = await import("expo-calendar/legacy");
  let permission = await C.getCalendarPermissionsAsync();
  if (!permission.granted)
    permission = await C.requestCalendarPermissionsAsync();
  if (!permission.granted) throw new Error("calendarDenied");
  const calendars = await C.getCalendarsAsync(C.EntityTypes.EVENT);
  const start = startOfDay(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (!calendars.length) return [];
  const events = await C.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end,
  );
  return events
    .filter(
      (e) =>
        e.availability !== C.Availability.FREE &&
        e.status !== C.EventStatus.CANCELED,
    )
    .map((e) => ({
      id: `${e.id}:${e.startDate}`,
      title: e.title,
      start: new Date(e.startDate).toISOString(),
      end: new Date(e.endDate).toISOString(),
    }));
}
export async function addToCalendar(
  task: Task,
  suggestedStart?: string,
): Promise<Key> {
  if (Platform.OS === "web") return "calendarUnsupported";
  try {
    const C = await import("expo-calendar/legacy");
    const start = new Date(task.dueAt ?? suggestedStart ?? Date.now());
    const result = await C.createEventInCalendarAsync({
      title: task.title,
      startDate: start,
      endDate: new Date(+start + task.minutes * 60_000),
    });
    // Android reports "done" even after cancellation. Never call that a confirmed save.
    return result.action === "saved"
      ? "calendarSaved"
      : result.action === "canceled"
        ? "calendarCanceled"
        : "calendarEditorClosed";
  } catch {
    return "calendarAddFailed";
  }
}
export async function speak(text: string, language: string): Promise<void> {
  try {
    const S = await import("expo-speech");
    await S.stop();
    S.speak(text, {
      language: language === "ja" ? "ja-JP" : "en-AU",
      rate: 0.9,
    });
  } catch {
    /* Speech is an optional enhancement. */
  }
}
export async function shareText(text: string, title: string): Promise<void> {
  if (
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    navigator.clipboard
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }
  await Share.share({ message: text, title });
}
