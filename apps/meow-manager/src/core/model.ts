export type Language = "en" | "ja";
export type Priority = "gentle" | "normal" | "important";
export type Step = { id: string; title: string; done: boolean };
export type Task = {
  id: string;
  title: string;
  minutes: number;
  priority: Priority;
  dueAt: string | null;
  fixed: boolean;
  remind: boolean;
  doneAt: string | null;
  createdAt: string;
  steps: Step[];
};
export type Habit = { id: string; title: string; days: string[] };
export type Chat = { id: string; role: "cat" | "user"; text: string };
export type Preferences = {
  language: Language;
  catName: string;
  personality: "gentle" | "cheeky";
  sound: boolean;
  dayEnd: number;
};
export type State = {
  version: 1;
  tasks: Task[];
  habits: Habit[];
  chat: Chat[];
  preferences: Preferences;
};
export type Busy = { id: string; title: string; start: string; end: string };

let sequence = 0;
export function id(prefix = "t"): string {
  return `${prefix}_${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function initialState(language: Language = "en"): State {
  return {
    version: 1,
    tasks: [],
    habits: [],
    chat: [],
    preferences: {
      language,
      catName: "Mochi",
      personality: "gentle",
      sound: false,
      dayEnd: 20,
    },
  };
}
export function makeTask(
  title: string,
  now = new Date(),
  patch: Partial<Task> = {},
): Task {
  return {
    id: id(),
    title: title.trim().slice(0, 300),
    minutes: 25,
    priority: "normal",
    dueAt: null,
    fixed: false,
    remind: false,
    doneAt: null,
    createdAt: now.toISOString(),
    steps: [],
    ...patch,
  };
}
const validDate = (s: unknown): s is string =>
  typeof s === "string" && Number.isFinite(new Date(s).getTime());
export function restoreState(raw: unknown): State {
  if (!raw || typeof raw !== "object" || (raw as State).version !== 1)
    throw new Error("unsupported_backup");
  const s = raw as State;
  if (
    !Array.isArray(s.tasks) ||
    !Array.isArray(s.habits) ||
    !s.preferences ||
    !Array.isArray(s.chat)
  )
    throw new Error("invalid_backup");
  if (s.tasks.length > 5000 || s.habits.length > 200 || s.chat.length > 200)
    throw new Error("invalid_backup");
  const seen = new Set<string>();
  const tasks = s.tasks.map((t) => {
    if (
      !t ||
      typeof t.id !== "string" ||
      seen.has(t.id) ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      !validDate(t.createdAt) ||
      (t.dueAt !== null && !validDate(t.dueAt)) ||
      (t.doneAt !== null && !validDate(t.doneAt)) ||
      !Array.isArray(t.steps)
    )
      throw new Error("invalid_task");
    seen.add(t.id);
    return {
      ...t,
      title: t.title.slice(0, 300),
      minutes: Math.max(5, Math.min(240, Number(t.minutes) || 25)),
      priority: ["gentle", "normal", "important"].includes(t.priority)
        ? t.priority
        : "normal",
      fixed: !!t.fixed,
      remind: !!t.remind,
      steps: t.steps
        .filter(
          (x) => x && typeof x.id === "string" && typeof x.title === "string",
        )
        .slice(0, 30)
        .map((x) => ({
          id: x.id,
          title: x.title.slice(0, 300),
          done: !!x.done,
        })),
    } as Task;
  });
  const p = s.preferences;
  return {
    version: 1,
    tasks,
    habits: s.habits
      .filter(
        (h) =>
          h &&
          typeof h.id === "string" &&
          typeof h.title === "string" &&
          Array.isArray(h.days),
      )
      .map((h) => ({
        id: h.id,
        title: h.title.slice(0, 100),
        days: h.days
          .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .slice(-400),
      })),
    chat: s.chat
      .filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          ["user", "cat"].includes(m.role) &&
          typeof m.text === "string",
      )
      .slice(-100),
    preferences: {
      language: p.language === "ja" ? "ja" : "en",
      catName:
        typeof p.catName === "string"
          ? p.catName.trim().slice(0, 24) || "Mochi"
          : "Mochi",
      personality: p.personality === "cheeky" ? "cheeky" : "gentle",
      sound: !!p.sound,
      dayEnd:
        Number.isInteger(p.dayEnd) && p.dayEnd >= 17 && p.dayEnd <= 23
          ? p.dayEnd
          : 20,
    },
  };
}
export function completeTask(task: Task, now = new Date()): Task {
  return { ...task, doneAt: task.doneAt ? null : now.toISOString() };
}
export function snooze(task: Task, now = new Date()): Task {
  return {
    ...task,
    dueAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    remind: true,
    fixed: true,
  };
}
