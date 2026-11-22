import { dateKey, type Busy, type Task } from "./model.ts";
export type Slot = {
  task: Task;
  start: string;
  end: string;
  conflict: boolean;
};
export type DayPlan = {
  slots: Slot[];
  overflow: Task[];
  later: Task[];
  completed: number;
  totalMinutes: number;
};

export function planDay(
  tasks: Task[],
  busy: Busy[],
  now: Date,
  dayEnd = 20,
): DayPlan {
  const today = dateKey(now);
  const end = new Date(now);
  end.setHours(dayEnd, 0, 0, 0);
  const pending = tasks.filter((t) => !t.doneAt);
  const later = pending.filter(
    (t) => t.dueAt && dateKey(new Date(t.dueAt)) > today,
  );
  const eligible = pending.filter((t) => !later.includes(t));
  const occupied = busy
    .map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }))
    .filter(
      (b) =>
        b.end > now.getTime() && b.start < end.getTime() && b.end > b.start,
    );
  const slots: Slot[] = [];
  const overflow: Task[] = [];
  const overlap = (
    start: number,
    finish: number,
    b: { start: number; end: number },
  ) => start < b.end && finish > b.start;
  const fixed = eligible
    .filter(
      (t) => t.fixed && t.dueAt && new Date(t.dueAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  for (const task of fixed) {
    const start = new Date(task.dueAt!).getTime();
    const finish = start + task.minutes * 60_000;
    slots.push({
      task,
      start: new Date(start).toISOString(),
      end: new Date(finish).toISOString(),
      conflict: occupied.some((b) => overlap(start, finish, b)),
    });
    occupied.push({ start, end: finish });
  }
  // Mark both sides of a collision, including two tasks with the same fixed time.
  for (const slot of slots)
    slot.conflict ||= slots.some(
      (other) =>
        other !== slot &&
        overlap(+new Date(slot.start), +new Date(slot.end), {
          start: +new Date(other.start),
          end: +new Date(other.end),
        }),
    );
  const weight = { important: 0, normal: 1, gentle: 2 };
  const flexible = eligible
    .filter((t) => !fixed.includes(t))
    .sort(
      (a, b) =>
        weight[a.priority] - weight[b.priority] ||
        (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const morningDate = new Date(now);
  morningDate.setHours(9, 0, 0, 0);
  const morning = morningDate.getTime();
  let cursor = Math.ceil(Math.max(now.getTime(), morning) / 300_000) * 300_000;
  for (const task of flexible) {
    let start = cursor;
    let finish = start + task.minutes * 60_000;
    for (let tries = 0; tries <= occupied.length; tries++) {
      const collisions = occupied.filter((b) => overlap(start, finish, b));
      if (!collisions.length) break;
      start = Math.max(...collisions.map((b) => b.end)) + 5 * 60_000;
      finish = start + task.minutes * 60_000;
    }
    if (finish > end.getTime()) {
      overflow.push(task);
      continue;
    }
    slots.push({
      task,
      start: new Date(start).toISOString(),
      end: new Date(finish).toISOString(),
      conflict: false,
    });
    occupied.push({ start, end: finish });
    cursor = finish + 5 * 60_000;
  }
  return {
    slots: slots.sort((a, b) => a.start.localeCompare(b.start)),
    overflow,
    later,
    completed: tasks.filter(
      (t) => t.doneAt && dateKey(new Date(t.doneAt)) === today,
    ).length,
    totalMinutes: slots.reduce((n, s) => n + s.task.minutes, 0),
  };
}
