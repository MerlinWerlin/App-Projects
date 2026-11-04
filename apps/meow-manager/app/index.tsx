import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Cat, RoomDecoration } from "../src/components/Cat";
import { capture, intent, smallSteps } from "../src/core/capture";
import {
  completeTask,
  dateKey,
  id,
  makeTask,
  restoreState,
  snooze,
  type Busy,
  type Task,
} from "../src/core/model";
import { planDay } from "../src/core/planner";
import { t, type Key } from "../src/i18n/strings";
import {
  addToCalendar,
  readCalendar,
  shareText,
  speak,
  syncReminders,
  type Notice,
} from "../src/native/services";
import { color as c } from "../src/theme/tokens";
import { useWorld } from "../src/useWorld";

type Tab = "today" | "chat" | "routines" | "settings";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Draft = { task: Task; date: string; minutes: string };
const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${dateKey(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function parseDate(value: string): string | null | false {
  if (!value.trim()) return null;
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 17), +(m[5] ?? 0));
  return d.getFullYear() === +m[1] &&
    d.getMonth() === +m[2] - 1 &&
    d.getDate() === +m[3] &&
    d.getHours() === +(m[4] ?? 17) &&
    d.getMinutes() === +(m[5] ?? 0)
    ? d.toISOString()
    : false;
}
function Glyph({
  name,
  size = 21,
  tint = c.ink,
}: {
  name: Icon;
  size?: number;
  tint?: string;
}) {
  return <Ionicons name={name} size={size} color={tint} />;
}
function Button({
  label,
  onPress,
  icon,
  soft = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: Icon;
  soft?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        soft && s.softButton,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Glyph name={icon} size={18} />}
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function MeowManager() {
  const { world, setWorld, loaded, loadError, saveError, load, retrySave } =
    useWorld();
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState<Busy[]>([]);
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const [calendarWorking, setCalendarWorking] = useState(false);
  const [demoTasks, setDemoTasks] = useState<Task[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reminderNotice, setReminderNotice] = useState<Notice | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftError, setDraftError] = useState<Key | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ritual, setRitual] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [confirm, setConfirm] = useState<{
    title: Key;
    action: () => void;
  } | null>(null);
  const [catTap, setCatTap] = useState(0);
  const [focus, setFocus] = useState<{
    task: Task;
    end: number;
    remaining: number;
    running: boolean;
  } | null>(null);
  const chatScroll = useRef<ScrollView>(null);
  const p = world.preferences;
  const L = (key: Key, values: Record<string, string | number> = {}) =>
    t(p.language, key, values);
  const day = dateKey(now);
  const calendarReady = calendarDay === day;
  const tasks = demoTasks ?? world.tasks;
  const plan = useMemo(
    () => planDay(tasks, calendarReady ? busy : [], now, p.dayEnd),
    [tasks, busy, calendarReady, now, p.dayEnd],
  );
  const selected = tasks.find((x) => x.id === selectedId);
  const completed = tasks.filter(
    (x) => x.doneAt && dateKey(new Date(x.doneAt)) === day,
  );
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(p.language === "ja" ? "ja-JP" : "en-AU", {
      hour: "numeric",
      minute: "2-digit",
    });
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(p.language === "ja" ? "ja-JP" : "en-AU", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const catLine = catTap
    ? L((["catTap1", "catTap2", "catTap3"] as Key[])[(catTap - 1) % 3])
    : p.personality === "cheeky"
      ? L("catCheeky")
      : plan.completed
        ? L("catDone")
        : tasks.filter((x) => !x.doneAt).length
          ? L("catBusy", { count: tasks.filter((x) => !x.doneAt).length })
          : L("catIntro", { cat: p.catName });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(new Date());
        setCalendarDay(null);
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    void import("expo-notifications")
      .then(async (N) => {
        function open(
          response: import("expo-notifications").NotificationResponse | null,
        ) {
          const taskId = response?.notification.request.content.data?.taskId;
          if (active && typeof taskId === "string") {
            setSelectedId(taskId);
            setTab("today");
          }
        }
        subscription = N.addNotificationResponseReceivedListener(open);
        open(await N.getLastNotificationResponseAsync());
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  useEffect(() => {
    if (loaded) void syncReminders(world.tasks, p).then(setReminderNotice);
  }, [loaded, world.tasks, p.language, p.catName]);
  useEffect(() => {
    if (!focus?.running) return;
    const timer = setInterval(
      () =>
        setFocus((f) =>
          f
            ? {
                ...f,
                remaining: Math.max(0, Math.ceil((f.end - Date.now()) / 1000)),
                running: f.end > Date.now(),
              }
            : null,
        ),
      500,
    );
    return () => clearInterval(timer);
  }, [focus?.running]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  function updateTask(task: Task) {
    if (demoTasks)
      setDemoTasks(
        (old) => old?.map((t) => (t.id === task.id ? task : t)) ?? null,
      );
    else
      setWorld((old) => ({
        ...old,
        tasks: old.tasks.map((t) => (t.id === task.id ? task : t)),
      }));
  }
  function openCapture(text = "") {
    setDemoTasks(null);
    setCaptureText(text);
    setDrafts([]);
    setDraftError(null);
    setEditing(false);
    setCaptureOpen(true);
  }
  function suggest(text: string) {
    setDrafts(
      capture(text, now, p.language).map((task) => ({
        task,
        date: localInput(task.dueAt),
        minutes: String(task.minutes),
      })),
    );
  }
  function editTask(task: Task) {
    setSelectedId(null);
    setEditing(true);
    setDraftError(null);
    setDrafts([
      { task, date: localInput(task.dueAt), minutes: String(task.minutes) },
    ]);
    setCaptureOpen(true);
  }
  function saveDrafts() {
    const saved: Task[] = [];
    for (const draft of drafts) {
      if (!draft.task.title.trim()) {
        setDraftError("noTitle");
        return;
      }
      const dueAt = parseDate(draft.date);
      if (dueAt === false) {
        setDraftError("invalidDate");
        return;
      }
      if (draft.task.remind && dueAt && +new Date(dueAt) <= Date.now()) {
        setDraftError("reminderPast");
        return;
      }
      saved.push({
        ...draft.task,
        title: draft.task.title.trim(),
        minutes: Math.max(5, Math.min(240, Number(draft.minutes) || 25)),
        dueAt,
        fixed: !!dueAt && draft.task.fixed,
        remind: !!dueAt && draft.task.remind,
      });
    }
    if (editing && demoTasks) {
      saved.forEach(updateTask);
    } else
      setWorld((old) => ({
        ...old,
        tasks: editing
          ? old.tasks.map((task) => saved.find((x) => x.id === task.id) ?? task)
          : [...old.tasks, ...saved],
        chat:
          tab === "chat"
            ? [
                ...old.chat,
                { id: id("m"), role: "cat" as const, text: L("savedReply") },
              ].slice(-100)
            : old.chat,
      }));
    if (saved.some((x) => x.remind) && !demoTasks) {
      const next = editing
        ? world.tasks.map((task) => saved.find((x) => x.id === task.id) ?? task)
        : [...world.tasks, ...saved];
      void syncReminders(next, p, true).then((n) => {
        setReminderNotice(n);
        setNotice(n);
      });
    }
    setCaptureOpen(false);
    setDrafts([]);
    setNow(new Date());
  }
  function talk(text: string) {
    if (!text.trim()) return;
    setChatInput("");
    const kind = intent(text);
    const reply =
      kind === "plan"
        ? L(calendarReady ? "planReply" : "planWithoutCalendar")
        : kind === "overwhelmed"
          ? L("overwhelmedReply")
          : kind === "draft"
            ? L("draftReply")
            : L("captureReply");
    setWorld((old) => ({
      ...old,
      chat: [
        ...old.chat,
        {
          id: id("m"),
          role: "user" as const,
          text: text.trim().slice(0, 3000),
        },
        { id: id("m"), role: "cat" as const, text: reply },
      ].slice(-100),
    }));
    if (kind === "capture") {
      openCapture(text);
      suggest(text);
    } else if (kind === "plan") {
      setDemoTasks(null);
      setTab("today");
      setNow(new Date());
    }
  }
  async function connectCalendar() {
    setCalendarWorking(true);
    try {
      const events = await readCalendar();
      setBusy(events);
      setCalendarDay(dateKey(new Date()));
      setNotice({ key: events.length ? "calendarLoaded" : "calendarEmpty" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setNotice({
        key:
          code === "calendarUnsupported" || code === "calendarDenied"
            ? code
            : "calendarFailed",
      });
    } finally {
      setCalendarWorking(false);
    }
  }
  function tryDemo() {
    setDemoTasks([
      makeTask(L("demoTask1"), now, { minutes: 10, priority: "gentle" }),
      makeTask(L("demoTask2"), now, { minutes: 15, priority: "important" }),
      makeTask(L("demoTask3"), now, { minutes: 25 }),
    ]);
  }
  function breakTask(task: Task) {
    updateTask({
      ...task,
      steps: smallSteps(task.title, p.language).map((title) => ({
        id: id("s"),
        title,
        done: false,
      })),
    });
  }
  const nav: { tab: Tab; icon: Icon; label: Key }[] = [
    { tab: "today", icon: "sunny-outline", label: "today" },
    { tab: "chat", icon: "chatbubble-ellipses-outline", label: "chat" },
    { tab: "routines", icon: "leaf-outline", label: "routines" },
    { tab: "settings", icon: "home-outline", label: "settings" },
  ];

  if (!loaded)
    return (
      <SafeAreaView style={s.loading}>
        <Cat size={150} />
        <Text style={s.body}>{L(loadError ? "storageError" : "loading")}</Text>
        {loadError ? (
          <Button label={L("retry")} onPress={() => void load()} />
        ) : (
          <ActivityIndicator color={c.lavenderInk} />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.app} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {wide && (
          <View style={s.sidebar}>
            <View style={s.brandMark}>
              <Glyph name="paw" tint={c.lavenderInk} size={25} />
              <Text style={s.brand}>
                meow{"\n"}manager<Text style={{ color: c.peach }}>.</Text>
              </Text>
            </View>
            <Text style={s.brandCaption}>{L("tagline")}</Text>
            <View style={{ gap: 9, marginTop: 45 }}>
              {nav.map((n) => (
                <Pressable
                  key={n.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === n.tab }}
                  onPress={() => setTab(n.tab)}
                  style={[s.nav, tab === n.tab && s.navSelected]}
                >
                  <Glyph
                    name={n.icon}
                    tint={tab === n.tab ? c.lavenderInk : c.muted}
                  />
                  <Text
                    style={[
                      s.navLabel,
                      tab === n.tab && { color: c.lavenderInk },
                    ]}
                  >
                    {L(n.label)}
                  </Text>
                  {tab === n.tab && <View style={s.navDot} />}
                </Pressable>
              ))}
            </View>
            <View style={s.sidebarBottom}>
              <Cat size={100} />
              <Text style={s.tiny}>{L("footer")}</Text>
            </View>
          </View>
        )}
        <View style={s.main}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            ref={chatScroll}
            contentContainerStyle={[
              s.content,
              wide && { paddingHorizontal: 44 },
              tab === "chat" && { flexGrow: 1 },
            ]}
          >
            <View style={s.topLine}>
              <View style={s.row}>
                <Glyph name="paw-outline" size={15} tint={c.lavenderInk} />
                <Text style={s.eyebrow}>{wide ? L("date") : L("app")}</Text>
              </View>
              <View style={s.row}>
                <View style={s.savedDot} />
                <Text style={s.tiny}>
                  {L(saveError ? "saveError" : "saved")}
                </Text>
                {saveError && (
                  <Button label={L("retry")} onPress={retrySave} soft />
                )}
              </View>
            </View>
            {tab === "today" && (
              <>
                <View
                  style={[s.pageHeader, !wide && { alignItems: "flex-start" }]}
                >
                  <View>
                    <Text style={s.date}>
                      {now.toLocaleDateString(
                        p.language === "ja" ? "ja-JP" : "en-AU",
                        { weekday: "long", month: "long", day: "numeric" },
                      )}
                    </Text>
                    <Text style={[s.title, !wide && { fontSize: 34 }]}>
                      {L(
                        now.getHours() < 12
                          ? "morning"
                          : now.getHours() < 18
                            ? "afternoon"
                            : "evening",
                      )}
                    </Text>
                  </View>
                  {wide && (
                    <Button
                      label={L("addShort")}
                      icon="add"
                      onPress={() => openCapture()}
                    />
                  )}
                </View>
                {demoTasks && (
                  <View style={s.demoBanner}>
                    <Text style={s.eyebrow}>{L("demoLabel")}</Text>
                    <Text style={s.small}>{L("demoHelp")}</Text>
                    <Button
                      label={L("exitDemo")}
                      soft
                      onPress={() => setDemoTasks(null)}
                    />
                  </View>
                )}
                <LinearGradient
                  colors={["#EEE8F4", "#F5EDE4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[s.hero, !wide && { padding: 22 }]}
                >
                  <View
                    style={{
                      flex: 1,
                      zIndex: 1,
                      maxWidth: wide ? "58%" : "100%",
                    }}
                  >
                    <View style={s.catBadge}>
                      <View style={s.liveDot} />
                      <Text style={s.catBadgeText}>{p.catName}</Text>
                      <Glyph
                        name="sparkles-outline"
                        size={13}
                        tint={c.lavenderInk}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={L("speak")}
                      onPress={() => {
                        if (p.sound) void speak(catLine, p.language);
                        else setCatTap((n) => n + 1);
                      }}
                    >
                      <Text style={[s.catQuote, !wide && { fontSize: 23 }]}>
                        {catLine}
                      </Text>
                    </Pressable>
                    <Text
                      style={[s.small, { color: c.lavenderInk, marginTop: 12 }]}
                    >
                      {L("footer")}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.catScene,
                      !wide && {
                        position: "relative",
                        width: "100%",
                        height: 185,
                        marginBottom: -22,
                        marginTop: 0,
                      },
                    ]}
                  >
                    <View style={StyleSheet.absoluteFill}>
                      <RoomDecoration />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={p.catName}
                      onPress={() => setCatTap((n) => n + 1)}
                    >
                      <Cat size={wide ? 220 : 200} happy={!!plan.completed} />
                    </Pressable>
                  </View>
                </LinearGradient>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={L("brain")}
                  onPress={() => openCapture()}
                  style={s.brainCard}
                >
                  <View style={s.circleIcon}>
                    <Glyph
                      name="chatbubble-ellipses-outline"
                      tint={c.lavenderInk}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{L("brain")}</Text>
                    <Text style={s.small}>{L("brainHint")}</Text>
                  </View>
                  <View style={s.roundPlus}>
                    <Glyph name="add" size={22} />
                  </View>
                </Pressable>
                <View
                  style={[
                    s.row,
                    { flexWrap: "wrap", marginBottom: 28, gap: 10 },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setNow(new Date());
                      setNotice({ key: "planNotice" });
                    }}
                    style={s.chip}
                  >
                    <Glyph
                      name="sparkles-outline"
                      size={16}
                      tint={c.lavenderInk}
                    />
                    <Text style={s.chipText}>{L("plan")}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void connectCalendar()}
                    disabled={calendarWorking}
                    style={s.chip}
                  >
                    <Glyph
                      name="calendar-outline"
                      size={16}
                      tint={c.lavenderInk}
                    />
                    <Text style={s.chipText}>
                      {L(
                        calendarWorking
                          ? "loading"
                          : calendarReady
                            ? "calendarRefresh"
                            : "calendarConnect",
                      )}
                    </Text>
                  </Pressable>
                </View>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>{L("timeline")}</Text>
                  <View style={s.progressPill}>
                    <Glyph name="checkmark" size={14} tint={c.greenInk} />
                    <Text style={s.progressText}>
                      {plan.completed} {L("progress")}
                    </Text>
                  </View>
                </View>
                <Text style={[s.small, { marginBottom: 17 }]}>
                  {L("planNotice")}
                </Text>
                {calendarReady && busy.length > 0 && (
                  <View style={s.calendarCard}>
                    {busy.map((event) => (
                      <View
                        key={event.id}
                        style={[s.row, { paddingVertical: 8 }]}
                      >
                        <Glyph
                          name="calendar-outline"
                          size={17}
                          tint={c.lavenderInk}
                        />
                        <Text style={[s.small, { minWidth: 72 }]}>
                          {time(event.start)}
                        </Text>
                        <Text style={[s.label, { flex: 1 }]}>
                          {event.title || L("calendarEvent")}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {plan.slots.map((slot) => (
                  <TaskRow
                    key={slot.task.id}
                    task={slot.task}
                    when={`${time(slot.start)} – ${time(slot.end)}`}
                    conflict={slot.conflict}
                  />
                ))}
                {!tasks.length && (
                  <View style={s.emptyCard}>
                    <View style={s.emptyPaw}>
                      <Glyph
                        name="paw-outline"
                        size={26}
                        tint={c.lavenderInk}
                      />
                    </View>
                    <Text style={s.emptyTitle}>{L("emptyTitle")}</Text>
                    <Text
                      style={[s.body, { textAlign: "center", maxWidth: 340 }]}
                    >
                      {L("emptyBody")}
                    </Text>
                    <View style={{ marginTop: 22 }}>
                      <Button
                        label={L("add")}
                        icon="add"
                        onPress={() => openCapture()}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={tryDemo}
                      style={s.textButton}
                    >
                      <Text style={s.link}>{L("demo")}</Text>
                    </Pressable>
                  </View>
                )}
                {plan.overflow.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={s.sectionTitle}>{L("overflow")}</Text>
                    <Text style={[s.small, { marginVertical: 10 }]}>
                      {L("overflowBody")}
                    </Text>
                    {plan.overflow.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        when={task.dueAt ? dateTime(task.dueAt) : L("noDate")}
                      />
                    ))}
                  </View>
                )}
                {plan.later.length > 0 && (
                  <View style={{ marginTop: 28 }}>
                    <Text style={[s.sectionTitle, { marginBottom: 14 }]}>
                      {L("later")}
                    </Text>
                    {plan.later.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        when={dateTime(task.dueAt!)}
                      />
                    ))}
                  </View>
                )}
                {completed.length > 0 && (
                  <View style={{ marginTop: 28 }}>
                    <Text style={[s.sectionTitle, { marginBottom: 14 }]}>
                      {L("done")}
                    </Text>
                    {completed.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        when={time(task.doneAt!)}
                      />
                    ))}
                  </View>
                )}
                {tasks.length > 0 && (
                  <View style={[s.nextCard, { marginTop: 24 }]}>
                    <Glyph name="flower-outline" size={24} tint={c.greenInk} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.eyebrow, { color: c.greenInk }]}>
                        {L("next")}
                      </Text>
                      <Text style={[s.label, { marginTop: 7 }]}>
                        {plan.slots[0]?.task.title ?? L("nextEmpty")}
                      </Text>
                    </View>
                    {plan.slots[0] && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={L("focus")}
                        onPress={() =>
                          setFocus({
                            task: plan.slots[0].task,
                            end:
                              Date.now() + plan.slots[0].task.minutes * 60_000,
                            remaining: plan.slots[0].task.minutes * 60,
                            running: true,
                          })
                        }
                        style={s.iconButton}
                      >
                        <Glyph name="play-outline" tint={c.greenInk} />
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
            {tab === "chat" && (
              <>
                <Text style={s.title}>{L("chatTitle")}</Text>
                <Text style={[s.body, { marginTop: 12, marginBottom: 20 }]}>
                  {L("chatIntro")}
                </Text>
                <View
                  style={[
                    s.row,
                    { justifyContent: "center", marginBottom: 10 },
                  ]}
                >
                  <Cat size={140} />
                </View>
                {world.chat.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      s.bubble,
                      m.role === "user" ? s.userBubble : s.catBubble,
                    ]}
                  >
                    {m.role === "cat" && (
                      <Text
                        style={[
                          s.eyebrow,
                          { color: c.lavenderInk, marginBottom: 7 },
                        ]}
                      >
                        {p.catName}
                      </Text>
                    )}
                    <Text style={s.chatText}>{m.text}</Text>
                  </View>
                ))}
                {!world.chat.length && (
                  <View style={{ gap: 10, alignItems: "flex-start" }}>
                    {(
                      ["chipPlan", "chipOverwhelm", "chipCapture"] as Key[]
                    ).map((key) => (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        onPress={() => talk(L(key))}
                        style={s.chip}
                      >
                        <Text style={s.chipText}>{L(key)}</Text>
                        <Glyph
                          name="arrow-up-outline"
                          size={15}
                          tint={c.lavenderInk}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
                <Text style={[s.small, { marginTop: 24, marginBottom: 24 }]}>
                  {L("localHelp")}
                </Text>
              </>
            )}
            {tab === "routines" && (
              <>
                <Text style={s.title}>{L("ritualsTitle")}</Text>
                <Text style={[s.body, { marginVertical: 18 }]}>
                  {L("ritualsBody")}
                </Text>
                <View
                  style={[
                    s.row,
                    { justifyContent: "center", marginBottom: 20 },
                  ]}
                >
                  <Cat size={160} happy />
                </View>
                {world.habits.map((h) => {
                  const checked = h.days.includes(day);
                  return (
                    <View key={h.id} style={s.taskRow}>
                      <Pressable
                        hitSlop={12}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={h.title}
                        style={[s.check, checked && s.checked]}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            habits: old.habits.map((x) =>
                              x.id === h.id
                                ? {
                                    ...x,
                                    days: checked
                                      ? x.days.filter((d) => d !== day)
                                      : [...x.days, day].slice(-400),
                                  }
                                : x,
                            ),
                          }))
                        }
                      >
                        {checked && (
                          <Glyph name="checkmark" size={18} tint={c.greenInk} />
                        )}
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>{h.title}</Text>
                        {checked && (
                          <Text style={s.small}>{L("ritualDone")}</Text>
                        )}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={L("ritualRemove")}
                        style={s.iconButton}
                        onPress={() =>
                          setConfirm({
                            title: "ritualRemove",
                            action: () =>
                              setWorld((old) => ({
                                ...old,
                                habits: old.habits.filter((x) => x.id !== h.id),
                              })),
                          })
                        }
                      >
                        <Glyph name="close-outline" tint={c.muted} />
                      </Pressable>
                    </View>
                  );
                })}
                {!world.habits.length && (
                  <Text
                    style={[s.body, { textAlign: "center", marginBottom: 25 }]}
                  >
                    {L("ritualEmpty")}
                  </Text>
                )}
                <View style={s.formCard}>
                  <TextInput
                    accessibilityLabel={L("ritualPlaceholder")}
                    value={ritual}
                    onChangeText={setRitual}
                    placeholder={L("ritualPlaceholder")}
                    placeholderTextColor={c.muted}
                    maxLength={100}
                    style={s.input}
                  />
                  <Button
                    label={L("ritualAdd")}
                    disabled={!ritual.trim()}
                    icon="add"
                    onPress={() => {
                      setWorld((old) => ({
                        ...old,
                        habits: [
                          ...old.habits,
                          { id: id("h"), title: ritual.trim(), days: [] },
                        ],
                      }));
                      setRitual("");
                    }}
                  />
                </View>
              </>
            )}
            {tab === "settings" && (
              <>
                <Text style={s.title}>{L("spaceTitle")}</Text>
                <View style={[s.row, { marginVertical: 24 }]}>
                  <Cat size={125} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.eyebrow}>{L("yourCat")}</Text>
                    <Text style={[s.sectionTitle, { marginTop: 9 }]}>
                      {p.catName}
                    </Text>
                  </View>
                </View>
                <View style={s.formCard}>
                  <Text style={s.label}>{L("catName")}</Text>
                  <TextInput
                    accessibilityLabel={L("catName")}
                    value={p.catName}
                    maxLength={24}
                    style={s.input}
                    onChangeText={(catName) =>
                      setWorld((old) => ({
                        ...old,
                        preferences: { ...old.preferences, catName },
                      }))
                    }
                    onBlur={() => {
                      if (!p.catName.trim())
                        setWorld((old) => ({
                          ...old,
                          preferences: { ...old.preferences, catName: "Mochi" },
                        }));
                    }}
                  />
                  <Text style={s.label}>{L("personality")}</Text>
                  <View style={s.row}>
                    {(["gentle", "cheeky"] as const).map((value) => (
                      <Choice
                        key={value}
                        label={L(
                          value === "gentle" ? "gentleCat" : "cheekyCat",
                        )}
                        selected={p.personality === value}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            preferences: {
                              ...old.preferences,
                              personality: value,
                            },
                          }))
                        }
                      />
                    ))}
                  </View>
                  <Text style={[s.label, { marginTop: 12 }]}>
                    {L("language")}
                  </Text>
                  <View style={s.row}>
                    {(["en", "ja"] as const).map((language) => (
                      <Choice
                        key={language}
                        label={L(language === "en" ? "english" : "japanese")}
                        selected={p.language === language}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            preferences: { ...old.preferences, language },
                          }))
                        }
                      />
                    ))}
                  </View>
                  <View style={[s.row, { marginTop: 14 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{L("sound")}</Text>
                      <Text style={s.small}>{L("soundHelp")}</Text>
                    </View>
                    <Switch
                      accessibilityLabel={L("sound")}
                      value={p.sound}
                      onValueChange={(sound) =>
                        setWorld((old) => ({
                          ...old,
                          preferences: { ...old.preferences, sound },
                        }))
                      }
                      trackColor={{ true: c.lavenderInk }}
                    />
                  </View>
                  <Text style={[s.label, { marginTop: 14 }]}>
                    {L("dayEnds")}
                  </Text>
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {[17, 18, 19, 20, 21, 22, 23].map((hour) => (
                      <Choice
                        key={hour}
                        label={`${hour}:00`}
                        selected={p.dayEnd === hour}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            preferences: { ...old.preferences, dayEnd: hour },
                          }))
                        }
                      />
                    ))}
                  </View>
                </View>
                <View style={s.formCard}>
                  <Text style={s.sectionTitle}>{L("calendar")}</Text>
                  <Text style={s.small}>{L("calendarNote")}</Text>
                  <Button
                    label={L("calendarConnect")}
                    soft
                    icon="calendar-outline"
                    onPress={() => void connectCalendar()}
                  />
                  <Text style={s.sectionTitle}>{L("reminder")}</Text>
                  <Text style={s.small}>{L("reminderHint")}</Text>
                  {reminderNotice && (
                    <Text style={s.small}>
                      {L(reminderNotice.key, {
                        count: reminderNotice.count ?? 0,
                      })}
                    </Text>
                  )}
                  <Button
                    label={L("remindersRefresh")}
                    soft
                    icon="notifications-outline"
                    onPress={() =>
                      void syncReminders(world.tasks, p, true).then((n) => {
                        setReminderNotice(n);
                        setNotice(n);
                      })
                    }
                  />
                </View>
                <View style={s.formCard}>
                  <Button
                    label={L("demo")}
                    soft
                    icon="paw-outline"
                    onPress={() => {
                      tryDemo();
                      setTab("today");
                    }}
                  />
                  <Text style={s.sectionTitle}>{L("backup")}</Text>
                  <Button
                    label={L("export")}
                    soft
                    icon="share-outline"
                    onPress={() =>
                      void shareText(
                        JSON.stringify(world, null, 2),
                        L("exportTitle"),
                      ).catch(() => setNotice({ key: "exportFailed" }))
                    }
                  />
                  <Button
                    label={L("import")}
                    soft
                    icon="download-outline"
                    onPress={() => {
                      setImportText("");
                      setImportOpen(true);
                    }}
                  />
                  <Button
                    label={L("resetChat")}
                    soft
                    icon="chatbubble-outline"
                    onPress={() =>
                      setConfirm({
                        title: "clearChatConfirm",
                        action: () => setWorld((old) => ({ ...old, chat: [] })),
                      })
                    }
                  />
                </View>
                <View style={[s.nextCard, { alignItems: "flex-start" }]}>
                  <Glyph name="lock-closed-outline" tint={c.greenInk} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{L("privacyTitle")}</Text>
                    <Text style={[s.small, { marginTop: 8 }]}>
                      {L("privacyBody")}
                    </Text>
                  </View>
                </View>
                <Text style={[s.tiny, { marginTop: 25, textAlign: "center" }]}>
                  Meow Manager · 0.1.0
                </Text>
              </>
            )}
            <Text style={[s.tiny, { textAlign: "center", marginTop: 38 }]}>
              {L("footer")}
            </Text>
          </ScrollView>
          {tab === "chat" && (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={s.composer}>
                <TextInput
                  accessibilityLabel={L("chatPlaceholder")}
                  placeholder={L("chatPlaceholder")}
                  placeholderTextColor={c.muted}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={() => talk(chatInput)}
                  maxLength={3000}
                  style={[
                    s.input,
                    { flex: 1, borderWidth: 0, marginBottom: 0 },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={L("send")}
                  disabled={!chatInput.trim()}
                  style={s.roundPlus}
                  onPress={() => talk(chatInput)}
                >
                  <Glyph name="arrow-up" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
          {!wide && (
            <SafeAreaView edges={["bottom"]} style={s.mobileNav}>
              <View style={s.row}>
                {nav.map((n) => (
                  <Pressable
                    key={n.tab}
                    accessibilityRole="tab"
                    accessibilityLabel={L(n.label)}
                    accessibilityState={{ selected: tab === n.tab }}
                    onPress={() => setTab(n.tab)}
                    style={[
                      s.mobileTab,
                      tab === n.tab && { backgroundColor: "#F0EBF6" },
                    ]}
                  >
                    <Glyph
                      name={n.icon}
                      tint={tab === n.tab ? c.lavenderInk : c.muted}
                    />
                    <Text
                      style={[
                        s.mobileTabText,
                        { color: tab === n.tab ? c.lavenderInk : c.muted },
                      ]}
                    >
                      {L(n.label)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SafeAreaView>
          )}
        </View>
      </View>
      {notice && (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setNotice(null)}
          style={s.toast}
        >
          <Glyph name="paw-outline" size={18} tint={c.lavenderInk} />
          <Text style={[s.small, { color: c.ink, flex: 1 }]}>
            {L(notice.key, { count: notice.count ?? 0 })}
          </Text>
        </Pressable>
      )}

      <Sheet
        closeLabel={L("close")}
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        title={L(editing ? "edit" : drafts.length ? "review" : "brain")}
      >
        {!drafts.length ? (
          <>
            <Text style={s.body}>{L("brainHelp")}</Text>
            <TextInput
              accessibilityLabel={L("brain")}
              multiline
              autoFocus
              value={captureText}
              onChangeText={setCaptureText}
              placeholder={L("brainHint")}
              placeholderTextColor={c.muted}
              maxLength={4000}
              style={[
                s.input,
                { minHeight: 130, textAlignVertical: "top", marginTop: 20 },
              ]}
            />
            <Button
              label={L("capture")}
              icon="sparkles-outline"
              disabled={!captureText.trim()}
              onPress={() => suggest(captureText)}
            />
          </>
        ) : (
          <>
            {drafts.map((draft, index) => (
              <View key={draft.task.id} style={s.draftCard}>
                <View style={s.row}>
                  <View style={s.numberPill}>
                    <Text style={s.chipText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={L("title")}
                    value={draft.task.title}
                    maxLength={300}
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    onChangeText={(title) =>
                      setDrafts((old) =>
                        old.map((d, i) =>
                          i === index
                            ? { ...d, task: { ...d.task, title } }
                            : d,
                        ),
                      )
                    }
                  />
                  {!editing && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={L("delete")}
                      onPress={() =>
                        setDrafts((old) => old.filter((_, i) => i !== index))
                      }
                      style={s.iconButton}
                    >
                      <Glyph name="close-outline" tint={c.muted} />
                    </Pressable>
                  )}
                </View>
                <Text style={[s.small, { marginTop: 15, marginBottom: 7 }]}>
                  {L("dateLabel")}
                </Text>
                <TextInput
                  accessibilityLabel={L("dateLabel")}
                  value={draft.date}
                  onChangeText={(date) =>
                    setDrafts((old) =>
                      old.map((d, i) =>
                        i === index
                          ? {
                              ...d,
                              date,
                              task: {
                                ...d.task,
                                fixed: /\d{2}:\d{2}/.test(date),
                              },
                            }
                          : d,
                      ),
                    )
                  }
                  placeholder={L("dateHint")}
                  placeholderTextColor={c.muted}
                  style={s.input}
                />
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <Text style={s.small}>{L("minutes")}</Text>
                  <TextInput
                    accessibilityLabel={L("minutes")}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={draft.minutes}
                    onChangeText={(minutes) =>
                      setDrafts((old) =>
                        old.map((d, i) =>
                          i === index ? { ...d, minutes } : d,
                        ),
                      )
                    }
                    style={[s.input, { width: 65, marginBottom: 0 }]}
                  />
                  {(["gentle", "normal", "important"] as const).map(
                    (priority) => (
                      <Choice
                        key={priority}
                        label={L(priority)}
                        selected={draft.task.priority === priority}
                        onPress={() =>
                          setDrafts((old) =>
                            old.map((d, i) =>
                              i === index
                                ? { ...d, task: { ...d.task, priority } }
                                : d,
                            ),
                          )
                        }
                      />
                    ),
                  )}
                </View>
                <View style={[s.row, { marginTop: 15 }]}>
                  <Switch
                    accessibilityLabel={L("fixedTime")}
                    value={draft.task.fixed}
                    disabled={!draft.date.trim()}
                    onValueChange={(fixed) =>
                      setDrafts((old) =>
                        old.map((d, i) =>
                          i === index
                            ? { ...d, task: { ...d.task, fixed } }
                            : d,
                        ),
                      )
                    }
                    trackColor={{ true: c.lavenderInk }}
                  />
                  <Text style={s.small}>{L("fixedTime")}</Text>
                </View>
                <View style={[s.row, { marginTop: 15 }]}>
                  <Switch
                    accessibilityLabel={L("reminder")}
                    value={draft.task.remind}
                    disabled={!draft.date.trim()}
                    onValueChange={(remind) =>
                      setDrafts((old) =>
                        old.map((d, i) =>
                          i === index
                            ? { ...d, task: { ...d.task, remind } }
                            : d,
                        ),
                      )
                    }
                    trackColor={{ true: c.lavenderInk }}
                  />
                  <Text style={s.small}>{L("reminder")}</Text>
                </View>
              </View>
            ))}
            <Text style={[s.small, { marginBottom: 15 }]}>
              {L("reminderHint")}
            </Text>
            {draftError && (
              <Text accessibilityRole="alert" style={s.error}>
                {L(draftError)}
              </Text>
            )}
            <Button
              label={L(editing ? "saveChanges" : "save")}
              icon="checkmark-outline"
              onPress={saveDrafts}
            />
          </>
        )}
      </Sheet>
      <Sheet
        closeLabel={L("close")}
        visible={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ""}
      >
        {selected && (
          <>
            <Text style={s.body}>{L("taskDetails")}</Text>
            <View style={[s.row, { marginVertical: 20, flexWrap: "wrap" }]}>
              <View style={s.chip}>
                <Glyph name="time-outline" size={16} />
                <Text style={s.chipText}>
                  {selected.minutes} {L("min")}
                </Text>
              </View>
              <Text style={s.small}>
                {selected.dueAt ? dateTime(selected.dueAt) : L("noDate")}
              </Text>
            </View>
            <Button
              label={L(selected.doneAt ? "undo" : "complete")}
              icon="checkmark-outline"
              onPress={() => {
                updateTask(completeTask(selected));
                setSelectedId(null);
              }}
            />
            <View style={[s.row, { marginTop: 15, flexWrap: "wrap" }]}>
              <Button
                label={L("edit")}
                soft
                icon="create-outline"
                onPress={() => editTask(selected)}
              />
              <Button
                label={L("breakDown")}
                disabled={selected.steps.length > 0}
                soft
                icon="git-branch-outline"
                onPress={() => breakTask(selected)}
              />
            </View>
            {selected.steps.length > 0 && (
              <View style={{ marginVertical: 20 }}>
                {selected.steps.map((step) => (
                  <Pressable
                    key={step.id}
                    hitSlop={12}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: step.done }}
                    onPress={() =>
                      updateTask({
                        ...selected,
                        steps: selected.steps.map((x) =>
                          x.id === step.id ? { ...x, done: !x.done } : x,
                        ),
                      })
                    }
                    style={[s.row, { minHeight: 54 }]}
                  >
                    <View style={[s.check, step.done && s.checked]}>
                      {step.done && (
                        <Glyph name="checkmark" size={17} tint={c.greenInk} />
                      )}
                    </View>
                    <Text
                      style={[
                        s.body,
                        {
                          flex: 1,
                          textDecorationLine: step.done
                            ? "line-through"
                            : "none",
                        },
                      ]}
                    >
                      {step.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ gap: 12, marginTop: 24 }}>
              <Text style={s.sectionTitle}>{L("help")}</Text>
              <Button
                label={L("focus")}
                soft
                icon="timer-outline"
                onPress={() => {
                  setFocus({
                    task: selected,
                    end: Date.now() + selected.minutes * 60_000,
                    remaining: selected.minutes * 60,
                    running: true,
                  });
                  setSelectedId(null);
                }}
              />
              <Button
                label={L("message")}
                soft
                icon="mail-outline"
                onPress={() => {
                  setDraftMessage(L("draftText", { task: selected.title }));
                  setSelectedId(null);
                }}
              />
              <Button
                label={L("search")}
                soft
                icon="search-outline"
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/search?q=${encodeURIComponent(selected.title)}`,
                  ).catch(() => setNotice({ key: "searchFailed" }))
                }
              />
              <Text style={s.small}>{L("searchNote")}</Text>
              {!demoTasks && (
                <>
                  {!selected.doneAt && (
                    <Button
                      label={L("snooze")}
                      soft
                      icon="notifications-outline"
                      onPress={() => {
                        const task = snooze(selected);
                        updateTask(task);
                        void syncReminders(
                          world.tasks.map((x) => (x.id === task.id ? task : x)),
                          p,
                          true,
                        ).then((n) => {
                          setReminderNotice(n);
                          setNotice(n);
                        });
                        setSelectedId(null);
                      }}
                    />
                  )}
                  <Button
                    label={L("calendarAdd")}
                    soft
                    icon="calendar-outline"
                    onPress={() =>
                      void addToCalendar(
                        selected,
                        plan.slots.find((s) => s.task.id === selected.id)
                          ?.start,
                      ).then((key) => {
                        setNotice({ key });
                        setCalendarDay(null);
                      })
                    }
                  />
                </>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedId(null);
                  setConfirm({
                    title: "deleteConfirm",
                    action: () => {
                      if (demoTasks)
                        setDemoTasks(
                          (old) =>
                            old?.filter((x) => x.id !== selected.id) ?? null,
                        );
                      else
                        setWorld((old) => ({
                          ...old,
                          tasks: old.tasks.filter((x) => x.id !== selected.id),
                        }));
                      setSelectedId(null);
                    },
                  });
                }}
                style={s.textButton}
              >
                <Text style={[s.link, { color: c.red }]}>{L("delete")}</Text>
              </Pressable>
            </View>
          </>
        )}
      </Sheet>
      <Sheet
        closeLabel={L("close")}
        visible={!!draftMessage}
        onClose={() => setDraftMessage(null)}
        title={L("draftTitle")}
      >
        <Text style={s.body}>{L("draftDisclaimer")}</Text>
        <TextInput
          accessibilityLabel={L("message")}
          multiline
          value={draftMessage ?? ""}
          onChangeText={setDraftMessage}
          style={[
            s.input,
            { minHeight: 180, marginTop: 20, textAlignVertical: "top" },
          ]}
        />
        <Button
          label={L("shareDraft")}
          icon="share-outline"
          onPress={() =>
            void shareText(draftMessage ?? "", L("draftTitle")).catch(() =>
              setNotice({ key: "exportFailed" }),
            )
          }
        />
      </Sheet>
      <Sheet
        closeLabel={L("close")}
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        title={L("import")}
      >
        <Text style={s.body}>{L("importConfirm")}</Text>
        <TextInput
          accessibilityLabel={L("importHint")}
          value={importText}
          onChangeText={setImportText}
          multiline
          maxLength={2_000_000}
          placeholder={L("importHint")}
          style={[
            s.input,
            { minHeight: 180, marginTop: 20, textAlignVertical: "top" },
          ]}
        />
        <Button
          label={L("restore")}
          disabled={!importText.trim()}
          onPress={() => {
            try {
              const restored = restoreState(JSON.parse(importText));
              setImportOpen(false);
              setConfirm({
                title: "importConfirm",
                action: () => {
                  setWorld(restored);
                  setImportOpen(false);
                  setNotice({ key: "restored" });
                },
              });
            } catch {
              setNotice({ key: "importFailed" });
            }
          }}
        />
      </Sheet>
      <Sheet
        closeLabel={L("close")}
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={L(confirm?.title ?? "cancel")}
      >
        <View style={[s.row, { justifyContent: "flex-end", marginTop: 20 }]}>
          <Button label={L("cancel")} soft onPress={() => setConfirm(null)} />
          <Button
            label={L("confirmAction")}
            onPress={() => {
              confirm?.action();
              setConfirm(null);
            }}
          />
        </View>
      </Sheet>
      <Sheet
        closeLabel={L("close")}
        visible={!!focus}
        onClose={() => setFocus(null)}
        title={L("focusTitle")}
      >
        {focus && (
          <View style={{ alignItems: "center", gap: 20 }}>
            <Cat size={150} />
            <Text style={[s.body, { textAlign: "center" }]}>
              {focus.task.title}
            </Text>
            <Text style={s.timer}>
              {String(Math.floor(focus.remaining / 60)).padStart(2, "0")}:
              {String(focus.remaining % 60).padStart(2, "0")}
            </Text>
            <Text style={[s.small, { textAlign: "center" }]}>
              {L(focus.remaining === 0 ? "timerDone" : "focusHint")}
            </Text>
            {focus.remaining > 0 && (
              <Button
                label={L(focus.running ? "pause" : "resume")}
                soft
                onPress={() =>
                  setFocus((f) =>
                    f
                      ? {
                          ...f,
                          running: !f.running,
                          end: Date.now() + f.remaining * 1000,
                        }
                      : null,
                  )
                }
              />
            )}
            <Button label={L("focusDone")} onPress={() => setFocus(null)} />
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );

  function Choice({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        style={[s.choice, selected && s.choiceSelected]}
      >
        <Text style={[s.chipText, selected && { color: c.lavenderInk }]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  function TaskRow({
    task,
    when,
    conflict = false,
  }: {
    task: Task;
    when: string;
    conflict?: boolean;
  }) {
    return (
      <View style={[s.taskRow, task.doneAt && { opacity: 0.65 }]}>
        <Pressable
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!task.doneAt }}
          accessibilityLabel={
            L(task.doneAt ? "undo" : "complete") + ": " + task.title
          }
          onPress={() => {
            updateTask(completeTask(task));
            setNow(new Date());
          }}
          style={[s.check, !!task.doneAt && s.checked]}
        >
          {task.doneAt && (
            <Glyph name="checkmark" size={18} tint={c.greenInk} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={task.title}
          onPress={() => setSelectedId(task.id)}
          style={{ flex: 1, minHeight: 55, justifyContent: "center" }}
        >
          <Text
            style={[
              s.label,
              { textDecorationLine: task.doneAt ? "line-through" : "none" },
            ]}
          >
            {task.title}
          </Text>
          <View style={[s.row, { marginTop: 7, flexWrap: "wrap", gap: 7 }]}>
            <Text style={s.small}>{when}</Text>
            <Text style={s.tiny}>·</Text>
            <Text style={s.small}>
              {task.minutes} {L("min")}
            </Text>
            {task.remind && (
              <Glyph name="notifications-outline" size={13} tint={c.muted} />
            )}{" "}
            {conflict && (
              <Text style={[s.small, { color: c.red }]}>{L("conflict")}</Text>
            )}
          </View>
        </Pressable>
        {task.priority === "important" && <View style={s.priorityDot} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L("taskDetails")}
          onPress={() => setSelectedId(task.id)}
          style={s.iconButton}
        >
          <Glyph name="chevron-forward-outline" size={18} tint={c.muted} />
        </Pressable>
      </View>
    );
  }
}

function Sheet({
  visible,
  onClose,
  title,
  children,
  closeLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeLabel: string;
}) {
  const { width } = useWindowDimensions();
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.scrim}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={closeLabel}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            s.sheet,
            { maxWidth: 600, width: width >= 850 ? "90%" : "100%" },
          ]}
        >
          <View style={s.sheetHeader}>
            <Text style={[s.sectionTitle, { flex: 1, fontSize: 24 }]}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={s.iconButton}
            >
              <Glyph name="close-outline" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const serif = Platform.OS === "android" ? "serif" : "Georgia";
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: c.paper },
  shell: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
  },
  main: { flex: 1, minWidth: 0 },
  content: {
    padding: 22,
    paddingTop: 22,
    paddingBottom: 40,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    padding: 35,
    backgroundColor: c.paper,
  },
  sidebar: {
    width: 220,
    padding: 25,
    paddingTop: 45,
    borderRightWidth: 1,
    borderRightColor: c.line,
  },
  brandMark: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  brand: {
    fontFamily: serif,
    fontSize: 30,
    lineHeight: 30,
    color: c.ink,
    letterSpacing: -1,
  },
  brandCaption: { fontSize: 12, lineHeight: 19, color: c.muted, marginTop: 20 },
  sidebarBottom: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 25,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  navSelected: { backgroundColor: "#EEE8F4" },
  navLabel: { color: c.muted, fontSize: 14, fontWeight: "500", flex: 1 },
  navDot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: c.lavenderInk,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 32,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: c.muted,
  },
  savedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#99AB89",
  },
  tiny: { fontSize: 10, lineHeight: 17, color: c.muted },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 25,
  },
  date: { fontSize: 12, color: c.muted, marginBottom: 9 },
  title: {
    fontFamily: serif,
    fontSize: 38,
    letterSpacing: -1,
    color: c.ink,
    lineHeight: 48,
  },
  body: { fontSize: 15, lineHeight: 24, color: c.muted },
  small: { fontSize: 12, lineHeight: 19, color: c.muted },
  label: { fontSize: 15, fontWeight: "600", color: c.ink, lineHeight: 22 },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 23,
    color: c.ink,
    letterSpacing: -0.4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 19,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: c.peach,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  softButton: { backgroundColor: "#F0ECF3" },
  buttonText: { fontSize: 13, color: c.ink, fontWeight: "600" },
  hero: {
    borderRadius: 26,
    padding: 32,
    minHeight: 240,
    overflow: "hidden",
    justifyContent: "center",
    marginBottom: 18,
  },
  catBadge: {
    backgroundColor: "#FFFFFF91",
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 15,
  },
  catBadgeText: { fontSize: 11, fontWeight: "600", color: c.lavenderInk },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#99AB89" },
  catQuote: {
    fontFamily: serif,
    fontSize: 25,
    lineHeight: 34,
    color: c.ink,
    letterSpacing: -0.4,
  },
  catScene: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "43%",
    height: 240,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  brainCard: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 15,
  },
  circleIcon: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: "#F2EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  roundPlus: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.peachLight,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 30,
    backgroundColor: "#F0ECF3",
  },
  chipText: { fontSize: 12, color: c.ink, fontWeight: "500" },
  progressPill: {
    backgroundColor: c.green,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressText: { fontSize: 10, color: c.greenInk, fontWeight: "600" },
  taskRow: {
    backgroundColor: c.white,
    borderRadius: 19,
    padding: 14,
    paddingLeft: 18,
    borderWidth: 1,
    borderColor: c.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
    minHeight: 88,
  },
  check: {
    width: 29,
    height: 29,
    borderWidth: 1.5,
    borderColor: "#DCD6CF",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 29,
  },
  checked: { backgroundColor: c.green, borderColor: c.green },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.peach,
  },
  calendarCard: {
    padding: 15,
    borderRadius: 20,
    backgroundColor: "#EEE8F480",
    marginBottom: 15,
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D9D1DF",
  },
  emptyPaw: {
    width: 60,
    height: 60,
    borderRadius: 23,
    backgroundColor: "#EEE8F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 25,
    color: c.ink,
    marginBottom: 10,
    textAlign: "center",
  },
  textButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  link: { fontSize: 12, fontWeight: "600", color: c.lavenderInk },
  nextCard: {
    padding: 23,
    borderRadius: 23,
    backgroundColor: "#EAF0E4",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  demoBanner: {
    backgroundColor: c.yellow,
    padding: 18,
    borderRadius: 20,
    gap: 10,
    marginBottom: 18,
  },
  mobileNav: {
    backgroundColor: c.paper,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  mobileTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 58,
    borderRadius: 15,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  mobileTabText: { fontSize: 10, fontWeight: "500" },
  bubble: { maxWidth: "90%", padding: 19, borderRadius: 22, marginVertical: 7 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: c.peachLight,
    borderBottomRightRadius: 5,
  },
  catBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#EEE8F4",
    borderBottomLeftRadius: 5,
  },
  chatText: { fontSize: 15, lineHeight: 24, color: c.ink },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.paper,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
  input: {
    backgroundColor: c.white,
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
    color: c.ink,
    marginBottom: 12,
  },
  formCard: {
    padding: 23,
    borderRadius: 24,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    gap: 12,
    marginBottom: 22,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: c.paper,
    justifyContent: "center",
  },
  choiceSelected: { backgroundColor: c.lavender },
  scrim: {
    flex: 1,
    backgroundColor: "#38374570",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: "center",
    padding: Platform.OS === "web" ? 20 : 0,
  },
  sheet: {
    backgroundColor: c.paper,
    borderRadius: 26,
    maxHeight: "91%",
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  draftCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F1EDF5",
    marginBottom: 15,
  },
  numberPill: {
    height: 28,
    width: 28,
    borderRadius: 10,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, color: c.red, marginVertical: 10 },
  toast: {
    position: "absolute",
    bottom: 95,
    alignSelf: "center",
    maxWidth: 520,
    width: "90%",
    backgroundColor: c.white,
    padding: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: c.line,
    boxShadow: "0 5px 25px #38374520",
  },
  timer: {
    fontFamily: serif,
    fontSize: 64,
    color: c.lavenderInk,
    fontVariant: ["tabular-nums"],
  },
});
