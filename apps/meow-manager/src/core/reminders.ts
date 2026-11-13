import type { Task } from "./model.ts";
export function reminderTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks
    .filter((t) => t.remind && !t.doneAt && t.dueAt && new Date(t.dueAt) > now)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
}
export const notificationId = (task: Task) => `meow:${task.id}`;
