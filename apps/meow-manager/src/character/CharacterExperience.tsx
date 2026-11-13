import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useWorld } from "../useWorld";
import { characterText } from "./copy";
import { entranceForSession } from "./entrance";
import StageView from "./StageView";
import type { CharacterMode, Opening } from "./motion";
import type { Command, StageReport } from "./scene";

type Sheet = "today" | "reminders" | "studio" | null;
type Icon = React.ComponentProps<typeof Ionicons>["name"];
function Row({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.rowButton, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={23} color="#67553f" />
      <Text style={s.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#9d8e7a" />
    </Pressable>
  );
}
export default function CharacterExperience() {
  const { world, setWorld } = useWorld();
  const p = world.preferences;
  const L = (key: Parameters<typeof characterText>[1]) =>
    characterText(p.language, key);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [opening, setOpening] = useState<Opening | null>(null);
  const [persisted, setPersisted] = useState(true);
  const [command, setCommand] = useState<Command | null>(null);
  const serial = useRef(0);
  const [report, setReport] = useState<StageReport | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reduced, setReduced] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  const [stageKey, setStageKey] = useState(0);
  const speech = useRef(0);
  const [capture, setCapture] = useState<{
    serial: number;
    opening: Opening;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  useEffect(
    () => () => {
      if (clip && Platform.OS === "web") URL.revokeObjectURL(clip);
    },
    [clip],
  );
  useEffect(() => {
    let current = true;
    void entranceForSession().then((value) => {
      if (current) {
        setOpening(value.opening);
        setPersisted(value.persisted);
      }
    });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => {
      motion.remove();
      app.remove();
      speech.current++;
      void import("expo-speech").then((s) => s.stop()).catch(() => {});
    };
  }, []);
  function perform(mode: CharacterMode, opening?: Opening) {
    setPaused(false);
    setCommand({ serial: ++serial.current, mode, opening });
  }
  function stopSpeech() {
    speech.current++;
    void import("expo-speech").then((s) => s.stop()).catch(() => {});
  }
  function show(sheet: Sheet) {
    stopSpeech();
    setSheet(sheet);
    perform(sheet ? "menu" : "idle");
  }
  async function hearMochi() {
    const token = ++speech.current;
    setSheet(null);
    perform("speaking");
    try {
      const S = await import("expo-speech");
      await S.stop();
      if (token !== speech.current) return;
      const finish = () => {
        if (token === speech.current) perform("idle");
      };
      S.speak(L("speaking"), {
        language: p.language === "ja" ? "ja-JP" : "en-AU",
        rate: 0.9,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      if (token === speech.current) perform("idle");
    }
  }
  function replay(opening: Opening) {
    stopSpeech();
    setSheet(null);
    perform("opening", opening);
  }
  function record(opening: Opening) {
    stopSpeech();
    setSheet(null);
    setReduced(false);
    setPaused(false);
    setCaptureFailed(false);
    setRecording(true);
    setCapture({ serial: ++serial.current, opening });
  }
  const beat = report?.beat ?? (opening === "nap" ? "sleep" : "nibble");
  const dark = "#392c23";
  return (
    <View style={s.app}>
      <StatusBar style="light" />
      <View style={[s.phone, width > 550 && s.desktopPhone]}>
        {opening && !error ? (
          <View style={StyleSheet.absoluteFill}>
            <StageView
              key={stageKey}
              opening={opening}
              command={command}
              reducedMotion={reduced}
              active={active && !paused}
              onReport={setReport}
              onError={() => setError(true)}
              capture={capture}
              onCapture={(url, failed) => {
                setRecording(false);
                setCaptureFailed(!!failed);
                if (url) setClip(url);
              }}
            />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, s.loading]}>
            {error ? (
              <>
                <Text style={s.loadingText}>{L("renderError")}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.retry}
                  onPress={() => {
                    setError(false);
                    setStageKey((x) => x + 1);
                  }}
                >
                  <Text>{L("retry")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color="#f4e6d0" />
                <Text style={s.loadingText}>{L("loading")}</Text>
              </>
            )}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L("tapCat")}
          onPress={() => {
            stopSpeech();
            perform("wave");
          }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["#1e191775", "transparent"]}
          style={s.topShade}
        />
        <View
          pointerEvents="box-none"
          style={[s.header, { paddingTop: insets.top + 19 }]}
        >
          <View>
            <Text style={s.title}>{L("title")}</Text>
            <Text style={s.preview}>{L("prototype")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L("settings")}
            style={s.gear}
            onPress={() => show("studio")}
          >
            <Ionicons name="settings-outline" size={23} color="#fff6e8" />
          </Pressable>
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "#24180d8f"]}
          style={s.bottomShade}
        />
        <View
          pointerEvents="box-none"
          style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 13) }]}
        >
          <Text accessibilityLiveRegion="polite" style={s.caption}>
            {L(beat)}
          </Text>
          {recording && <Text style={s.dockLabel}>{L("recording")}</Text>}
          <View style={s.dock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("today")}
              onPress={() => show("today")}
              style={s.dockItem}
            >
              <Ionicons name="calendar-outline" size={24} color="#fff1dd" />
              <Text style={s.dockLabel}>{L("today")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("talk")}
              onPress={() => {
                stopSpeech();
                perform(report?.mode === "listening" ? "idle" : "listening");
              }}
              style={s.microphone}
            >
              <Ionicons name="mic-outline" size={32} color={dark} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("reminders")}
              onPress={() => show("reminders")}
              style={s.dockItem}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#fff1dd"
              />
              <Text style={s.dockLabel}>{L("reminders")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("more")}
              onPress={() => show("studio")}
              style={s.dockItem}
            >
              <Ionicons name="menu-outline" size={25} color="#fff1dd" />
              <Text style={s.dockLabel}>{L("more")}</Text>
            </Pressable>
          </View>
        </View>
        <Modal
          visible={!!sheet}
          transparent
          animationType="slide"
          onRequestClose={() => show(null)}
        >
          <View style={s.scrim}>
            <Pressable
              accessibilityLabel={L("close")}
              style={StyleSheet.absoluteFill}
              onPress={() => show(null)}
            />
            <View
              style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}
              accessibilityViewIsModal
              aria-modal={true}
            >
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>
                  {L(sheet === "studio" ? "studio" : (sheet ?? "today"))}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={L("close")}
                  style={s.close}
                  onPress={() => show(null)}
                >
                  <Ionicons name="close" size={22} color={dark} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: 10 }}>
                {sheet === "studio" && (
                  <>
                    <Text style={s.note}>{L("motionNote")}</Text>
                    <Row
                      label={L("nap")}
                      icon="moon-outline"
                      onPress={() => replay("nap")}
                    />
                    <Row
                      label={L("chips")}
                      icon="fast-food-outline"
                      onPress={() => replay("chips")}
                    />
                    <Row
                      label={L("hello")}
                      icon="hand-left-outline"
                      onPress={() => {
                        setSheet(null);
                        perform("wave");
                      }}
                    />
                    <Row
                      label={L("listen")}
                      icon="ear-outline"
                      onPress={() => {
                        setSheet(null);
                        perform("listening");
                      }}
                    />
                    <Row
                      label={L("voice")}
                      icon="volume-medium-outline"
                      onPress={() => void hearMochi()}
                    />
                    {Platform.OS === "web" && !recording && (
                      <>
                        <Row
                          label={L("recordNap")}
                          icon="videocam-outline"
                          onPress={() => record("nap")}
                        />
                        <Row
                          label={L("recordChips")}
                          icon="videocam-outline"
                          onPress={() => record("chips")}
                        />
                      </>
                    )}
                    {Platform.OS === "web" &&
                      clip &&
                      React.createElement(
                        "a",
                        {
                          href: clip,
                          download: `meow-${capture?.opening ?? "animation"}.webm`,
                          style: {
                            color: "#67553f",
                            padding: 16,
                            fontSize: 15,
                          },
                        },
                        L("saveClip"),
                      )}
                    {captureFailed && (
                      <Text style={s.note}>{L("captureFailed")}</Text>
                    )}
                    <View style={s.switchRow}>
                      <Text style={s.note}>{L("reduced")}</Text>
                      <Switch
                        value={reduced}
                        onValueChange={setReduced}
                        accessibilityLabel={L("reduced")}
                        trackColor={{ true: "#8b9274" }}
                      />
                    </View>
                    <Row
                      label={L(paused ? "resume" : "pause")}
                      icon={paused ? "play-outline" : "pause-outline"}
                      onPress={() => {
                        setPaused((x) => !x);
                        setSheet(null);
                      }}
                    />
                    <View style={s.language}>
                      <Pressable
                        accessibilityRole="radio"
                        aria-checked={p.language === "en"}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            preferences: { ...old.preferences, language: "en" },
                          }))
                        }
                      >
                        <Text style={s.note}>{L("english")}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="radio"
                        aria-checked={p.language === "ja"}
                        onPress={() =>
                          setWorld((old) => ({
                            ...old,
                            preferences: { ...old.preferences, language: "ja" },
                          }))
                        }
                      >
                        <Text style={s.note}>{L("japanese")}</Text>
                      </Pressable>
                    </View>
                    {report && (
                      <Text style={s.metrics}>
                        {Math.round(report.fps)} fps ·{" "}
                        {Math.round(report.triangles / 1000)}k triangles ·{" "}
                        {report.calls} draws ·{" "}
                        {Platform.OS === "web" ? "browser" : "device"}{" "}
                        observation
                      </Text>
                    )}
                    {!persisted && <Text style={s.note}>{L("storage")}</Text>}
                  </>
                )}
                {sheet === "today" && (
                  <>
                    {world.tasks.filter((t) => !t.doneAt).length ? (
                      world.tasks
                        .filter((t) => !t.doneAt)
                        .slice(0, 8)
                        .map((task) => (
                          <View style={s.task} key={task.id}>
                            <Ionicons
                              name="ellipse-outline"
                              size={20}
                              color="#8a7861"
                            />
                            <Text style={[s.note, { flex: 1, color: dark }]}>
                              {task.title}
                            </Text>
                          </View>
                        ))
                    ) : (
                      <Text style={s.note}>{L("noTasks")}</Text>
                    )}
                  </>
                )}
                {sheet === "reminders" && (
                  <Text style={s.note}>{L("remindersNote")}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}
const serif = Platform.OS === "android" ? "serif" : "Georgia";
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#d8caba" },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: "#817c6d",
  },
  desktopPhone: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#b3a08b",
  },
  loading: { alignItems: "center", justifyContent: "center", gap: 20 },
  loadingText: {
    color: "#fff1dd",
    fontFamily: serif,
    fontSize: 20,
    textAlign: "center",
  },
  retry: { padding: 16, borderRadius: 18, backgroundColor: "#f8e5c8" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: serif,
    fontSize: 24,
    color: "#fff7e9",
    textShadowColor: "#20160f80",
    textShadowRadius: 8,
  },
  preview: { fontSize: 8, letterSpacing: 2, color: "#f1e4cc", marginTop: 6 },
  gear: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "#1e19172a",
  },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 170 },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 23,
  },
  caption: {
    fontFamily: serif,
    fontSize: 25,
    lineHeight: 33,
    color: "#fff2dc",
    textAlign: "center",
    textShadowColor: "#2a1b12c9",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
    paddingHorizontal: 10,
  },
  dock: {
    minHeight: 84,
    padding: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 8,
    backgroundColor: "#a47e576f",
    borderWidth: 1,
    borderColor: "#f6dfb761",
    borderRadius: 26,
  },
  dockItem: {
    minWidth: 55,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  dockLabel: { fontSize: 10, color: "#fff2dd" },
  microphone: {
    height: 66,
    width: 66,
    borderRadius: 34,
    backgroundColor: "#f7e8cc",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -11,
  },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "#19140c18" },
  sheet: {
    maxHeight: "57%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#f2e9db",
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: "#fff5e6",
  },
  handle: {
    height: 4,
    width: 42,
    backgroundColor: "#baaa95",
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 13,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontFamily: serif, fontSize: 27, color: "#423325" },
  close: {
    height: 44,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  rowButton: {
    backgroundColor: "#fbf4e8",
    borderRadius: 18,
    minHeight: 60,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rowText: { fontSize: 15, color: "#4e3e2b", flex: 1 },
  note: { fontSize: 13, lineHeight: 21, color: "#8a7963" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  language: { flexDirection: "row", gap: 24, padding: 14 },
  metrics: {
    fontSize: 10,
    color: "#9b8b76",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 8,
  },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e3d8c6",
  },
});
