import test from "node:test";
import assert from "node:assert/strict";
import { capture, intent, smallSteps } from "./capture.ts";
import {
  completeTask,
  dateKey,
  initialState,
  makeTask,
  restoreState,
  snooze,
} from "./model.ts";
import { planDay } from "./planner.ts";
import { notificationId, reminderTasks } from "./reminders.ts";
import { en, ja, t } from "../i18n/strings.ts";

const morning = () => new Date(2026, 10, 4, 9, 0, 0); // Local device time, deliberately not UTC.
const at = (hour: number, minute = 0) =>
  new Date(2026, 10, 4, hour, minute).toISOString();
test("English brain dump yields separate, editable tasks without scheduling notifications", () => {
  const tasks = capture(
    "Dentist tomorrow at 3pm; buy groceries; finish my assignment for 40 minutes",
    morning(),
    "en",
  );
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].title, "Dentist");
  assert.equal(new Date(tasks[0].dueAt!).getDate(), 5);
  assert.equal(new Date(tasks[0].dueAt!).getHours(), 15);
  assert.equal(tasks[0].fixed, true);
  assert.equal(tasks[1].dueAt, null);
  assert.equal(tasks[2].minutes, 40);
  assert.ok(tasks.every((t) => !t.remind));
});
test("Japanese date/time capture retains local dates and separate thoughts", () => {
  const tasks = capture(
    "明日15時に歯医者；金曜日に買い物；課題を20分",
    morning(),
    "ja",
  );
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].title, "歯医者");
  assert.equal(new Date(tasks[0].dueAt!).getDate(), 5);
  assert.equal(new Date(tasks[0].dueAt!).getHours(), 15);
  assert.equal(new Date(tasks[1].dueAt!).getDay(), 5);
  assert.equal(tasks[2].minutes, 20);
});
test("a date without a time is a flexible deadline", () => {
  const [task] = capture("Finish essay tomorrow", morning(), "en");
  assert.equal(task.fixed, false);
  assert.equal(new Date(task.dueAt!).getHours(), 17);
});
test("bare past times go to tomorrow; explicit past dates remain overdue", () => {
  const now = new Date(2026, 10, 4, 16);
  assert.equal(
    new Date(capture("Walk at 3pm", now, "en")[0].dueAt!).getDate(),
    5,
  );
  assert.equal(
    new Date(capture("Walk today at 3pm", now, "en")[0].dueAt!).getDate(),
    4,
  );
});
test("12am and 12pm are interpreted correctly", () => {
  assert.equal(
    new Date(
      capture("Call tomorrow at 12am", morning(), "en")[0].dueAt!,
    ).getHours(),
    0,
  );
  assert.equal(
    new Date(
      capture("Call tomorrow at 12pm", morning(), "en")[0].dueAt!,
    ).getHours(),
    12,
  );
});
test("invalid calendar dates are kept in the title for review", () => {
  const [task] = capture("Meet on 2026-02-30", morning(), "en");
  assert.equal(task.dueAt, null);
  assert.match(task.title, /2026-02-30/);
});
test("invalid times never silently become a valid appointment", () => {
  const [task] = capture("Call at 25:99", morning(), "en");
  assert.equal(task.dueAt, null);
  assert.match(task.title, /25:99/);
});
test("new year rollover uses local calendar arithmetic", () => {
  const [task] = capture(
    "Call tomorrow at 9am",
    new Date(2026, 11, 31, 22),
    "en",
  );
  assert.equal(dateKey(new Date(task.dueAt!)), "2027-01-01");
});
test("priority and duration are bounded", () => {
  const [task] = capture(
    "Important assignment for 999 minutes",
    morning(),
    "en",
  );
  assert.equal(task.priority, "important");
  assert.equal(task.minutes, 240);
});
test("English and Japanese requests route to appropriate local help", () => {
  assert.equal(intent("Plan my day"), "plan");
  assert.equal(intent("今日の予定を整えて"), "plan");
  assert.equal(intent("It feels like too much"), "overwhelmed");
  assert.equal(intent("やることが多すぎる"), "overwhelmed");
  assert.equal(intent("Draft a message"), "draft");
  assert.equal(intent("Buy milk"), "capture");
});
test("small steps provide task-specific help in both languages", () => {
  assert.match(smallSteps("Book dentist", "en")[2], /booking/);
  assert.match(smallSteps("課題", "ja")[2], /10分/);
});
test("planner fits work around appointments with a breathing gap", () => {
  const task = makeTask("Study", morning(), { minutes: 60 });
  const plan = planDay(
    [task],
    [{ id: "event", title: "Meeting", start: at(9, 30), end: at(10, 30) }],
    morning(),
  );
  assert.equal(plan.slots.length, 1);
  assert.equal(plan.slots[0].start, at(10, 35));
});
test("planner preserves fixed times and flags both sides of a collision", () => {
  const a = makeTask("Call", morning(), {
    fixed: true,
    dueAt: at(10),
    minutes: 30,
  });
  const b = makeTask("Dentist", morning(), {
    fixed: true,
    dueAt: at(10, 15),
    minutes: 30,
  });
  const plan = planDay([a, b], [], morning());
  assert.deepEqual(
    plan.slots.map((s) => s.start),
    [at(10), at(10, 15)],
  );
  assert.ok(plan.slots.every((s) => s.conflict));
});
test("fixed calendar collisions are visible", () => {
  const task = makeTask("Call", morning(), {
    fixed: true,
    dueAt: at(10),
    minutes: 30,
  });
  assert.equal(
    planDay(
      [task],
      [{ id: "b", title: "Busy", start: at(10), end: at(11) }],
      morning(),
    ).slots[0].conflict,
    true,
  );
});
test("future tasks are never silently pulled into today", () => {
  const tomorrow = new Date(morning());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const task = makeTask("Tomorrow", morning(), {
    dueAt: tomorrow.toISOString(),
  });
  const plan = planDay([task], [], morning());
  assert.equal(plan.slots.length, 0);
  assert.equal(plan.later[0].id, task.id);
});
test("overdue work is retained, completed work is excluded, overflow is explicit", () => {
  const task = makeTask("Overdue", morning(), {
    dueAt: new Date(2026, 10, 3, 10).toISOString(),
    fixed: true,
    minutes: 120,
  });
  const done = completeTask(makeTask("Done", morning()), morning());
  const plan = planDay([task, done], [], new Date(2026, 10, 4, 19, 30), 20);
  assert.equal(plan.slots.length, 0);
  assert.equal(plan.overflow[0].id, task.id);
  assert.equal(plan.completed, 1);
});
test("important tasks get first available slots and appointments are unchanged", () => {
  const a = makeTask("Normal", morning());
  const b = makeTask("Important", morning(), { priority: "important" });
  const events = [{ id: "e", title: "Busy", start: at(11), end: at(12) }];
  const before = JSON.stringify(events);
  const plan = planDay([a, b], events, morning());
  assert.equal(plan.slots[0].task.id, b.id);
  assert.equal(JSON.stringify(events), before);
});
test("day end does not produce hidden or overlapping flexible tasks", () => {
  const tasks = Array.from({ length: 30 }, (_, i) =>
    makeTask(String(i), morning(), { minutes: 60 }),
  );
  const plan = planDay(tasks, [], morning(), 17);
  assert.equal(plan.slots.length + plan.overflow.length, 30);
  for (let i = 0; i < plan.slots.length; i++) {
    assert.ok(new Date(plan.slots[i].end).getHours() <= 17);
    if (i) assert.ok(plan.slots[i].start >= plan.slots[i - 1].end);
  }
});
test("completed and past reminders are excluded; future reminders sort chronologically", () => {
  const a = makeTask("Later", morning(), { remind: true, dueAt: at(14) });
  const b = makeTask("Soon", morning(), { remind: true, dueAt: at(10) });
  const past = makeTask("Past", morning(), { remind: true, dueAt: at(8) });
  assert.deepEqual(
    reminderTasks([a, past, completeTask(b, morning()), b], morning()).map(
      (t) => t.title,
    ),
    ["Soon", "Later"],
  );
  assert.equal(notificationId(a), notificationId({ ...a, title: "Edited" }));
});
test("snooze keeps the task identity and shifts its next reminder by 15 minutes", () => {
  const task = makeTask("Call", morning());
  const next = snooze(task, morning());
  assert.equal(next.id, task.id);
  assert.equal(next.dueAt, at(9, 15));
  assert.equal(next.remind, true);
});
test("completion toggles without duplicating a task", () => {
  const task = makeTask("Call", morning());
  assert.equal(
    completeTask(completeTask(task, morning()), morning()).doneAt,
    null,
  );
});
test("backup round trip preserves real work and preferences", () => {
  const state = initialState("ja");
  state.tasks.push(makeTask("課題", morning()));
  state.habits.push({ id: "h", title: "水", days: ["2026-11-04"] });
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
});
test("broken backups and duplicate task identities are rejected before replacement", () => {
  assert.throws(() => restoreState({ version: 99 }));
  const state = initialState();
  const task = makeTask("Call", morning());
  state.tasks = [task, task];
  assert.throws(() => restoreState(state));
  state.tasks = [{ ...task, dueAt: "not-a-date" }];
  assert.throws(() => restoreState(state));
});
test("all product strings have English and Japanese entries and matching placeholders", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.deepEqual(
      (en[key].match(/\{\w+\}/g) ?? []).sort(),
      (ja[key].match(/\{\w+\}/g) ?? []).sort(),
      key,
    );
  }
  assert.equal(t("ja", "catBusy", { count: 3 }).includes("{count}"), false);
});

test("an explicit reminder request proposes a reminder only when a time can be reviewed", () => {
  assert.equal(
    capture("Remind me to call tomorrow at 2pm", morning(), "en")[0].remind,
    true,
  );
  assert.equal(capture("Remind me to call", morning(), "en")[0].remind, false);
});
test("relative reminders work across local midnight in English and Japanese", () => {
  const now = new Date(2026, 10, 4, 23, 50);
  const english = capture("Remind me in 15 minutes to call", now, "en")[0];
  assert.equal(english.title, "call");
  assert.equal(english.remind, true);
  assert.equal(dateKey(new Date(english.dueAt!)), "2026-11-05");
  assert.equal(new Date(english.dueAt!).getMinutes(), 5);
  assert.equal(capture("15分後に電話", now, "ja")[0].dueAt, english.dueAt);
});
