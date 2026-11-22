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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useWorld } from "../useWorld";
import FrameStage from "./FrameStage";
import { entrance2DForSession } from "./entrance";
import { frameText } from "./copy";
import type { Beat2D, Mode2D, Opening2D } from "./timeline";
import type { Command2D } from "./FrameStage.types";
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
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={22} color="#5e503d" />
      <Text style={s.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#948571" />
    </Pressable>
  );
}
export default function FrameExperience() {
  const { world, setWorld } = useWorld(),
    language = world.preferences.language;
  const L = (key: Parameters<typeof frameText>[1]) => frameText(language, key);
  const inset = useSafeAreaInsets();
  const [opening, setOpening] = useState<Opening2D | null>(null),
    [persisted, setPersisted] = useState(true);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [stageKey, setStageKey] = useState(0);
  const [beat, setBeat] = useState<Beat2D>("sleep"),
    [sheet, setSheet] = useState<Sheet>(null);
  const [reduced, setReduced] = useState(false),
    [active, setActive] = useState(AppState.currentState === "active"),
    [paused, setPaused] = useState(false);
  const [command, setCommand] = useState<Command2D | null>(null),
    serial = useRef(0),
    speech = useRef(0);
  const [capture, setCapture] = useState(0),
    [recording, setRecording] = useState(false),
    [clip, setClip] = useState<string | null>(null),
    [captureFailed, setCaptureFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    void entrance2DForSession().then((value) => {
      if (mounted) {
        setOpening(value.opening);
        setPersisted(value.persisted);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
      speech.current++;
      void import("expo-speech").then((s) => s.stop()).catch(() => {});
    };
  }, []);
  useEffect(
    () => () => {
      if (clip && Platform.OS === "web") URL.revokeObjectURL(clip);
    },
    [clip],
  );
  function perform(mode: Mode2D, opening?: Opening2D) {
    setPaused(false);
    setCommand({ serial: ++serial.current, mode, opening });
  }
  function stopVoice() {
    speech.current++;
    void import("expo-speech").then((s) => s.stop()).catch(() => {});
  }
  function show(value: Sheet) {
    stopVoice();
    setSheet(value);
    perform(value ? "menu" : "idle");
  }
  function replay(value: Opening2D) {
    stopVoice();
    setSheet(null);
    perform("opening", value);
  }
  async function hear() {
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
        language: language === "ja" ? "ja-JP" : "en-AU",
        rate: 0.88,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      if (token === speech.current) perform("idle");
    }
  }
  function record() {
    stopVoice();
    setSheet(null);
    setReduced(false);
    setPaused(false);
    setCaptureFailed(false);
    setRecording(true);
    setCapture((n) => n + 1);
  }
  function action(mode: Mode2D) {
    stopVoice();
    setSheet(null);
    perform(mode);
  }
  return (
    <View style={s.app}>
      <StatusBar style="light" />
      <View style={s.phone}>
        {opening && !failed && (
          <FrameStage
            key={stageKey}
            opening={opening}
            command={command}
            active={active && !paused}
            reduced={reduced}
            onReady={() => setReady(true)}
            onError={() => {
              setReady(false);
              setFailed(true);
              setRecording(false);
            }}
            onReport={setBeat}
            capture={capture}
            onCapture={(url) => {
              setRecording(false);
              setCaptureFailed(!url);
              if (url) setClip(url);
            }}
          />
        )}
        {!ready && (
          <View style={[StyleSheet.absoluteFill, s.loading]}>
            {failed ? (
              <>
                <Text style={s.loadingText}>{L("error")}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setFailed(false);
                    setStageKey((n) => n + 1);
                  }}
                  style={s.retry}
                >
                  <Text>{L("retry")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color="#f6e6ca" />
                <Text style={s.loadingText}>{L("loading")}</Text>
              </>
            )}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L("tap")}
          disabled={!ready || recording}
          style={StyleSheet.absoluteFill}
          onPress={() => action("greeting")}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["#211d1780", "transparent"]}
          style={s.topShade}
        />
        <View
          pointerEvents="box-none"
          style={[s.header, { paddingTop: inset.top + 20 }]}
        >
          <View>
            <Text style={s.title}>{L("title")}</Text>
            <Text style={s.study}>{L("prototype")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L("settings")}
            disabled={!ready || recording}
            onPress={() => show("studio")}
            style={s.gear}
          >
            <Ionicons name="settings-outline" size={22} color="#fff3de" />
          </Pressable>
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "#21180da6"]}
          style={s.bottomShade}
        />
        <View
          pointerEvents="box-none"
          style={[s.bottom, { paddingBottom: Math.max(inset.bottom, 14) }]}
        >
          <Text accessibilityLiveRegion="polite" style={s.caption}>
            {L(beat)}
          </Text>
          {recording && <Text style={s.recording}>{L("recording")}</Text>}
          <View style={s.dock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("today")}
              disabled={!ready || recording}
              onPress={() => show("today")}
              style={s.dockItem}
            >
              <Ionicons name="calendar-outline" size={23} color="#ffefd9" />
              <Text style={s.dockLabel}>{L("today")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("talk")}
              disabled={!ready || recording}
              onPress={() =>
                action(beat === "listening" ? "idle" : "listening")
              }
              style={s.mic}
            >
              <Ionicons name="mic-outline" size={30} color="#503f2e" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("reminders")}
              disabled={!ready || recording}
              onPress={() => show("reminders")}
              style={s.dockItem}
            >
              <Ionicons
                name="notifications-outline"
                size={23}
                color="#ffefd9"
              />
              <Text style={s.dockLabel}>{L("reminders")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L("more")}
              disabled={!ready || recording}
              onPress={() => show("studio")}
              style={s.dockItem}
            >
              <Ionicons name="menu-outline" size={24} color="#ffefd9" />
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
              style={[s.sheet, { paddingBottom: inset.bottom + 20 }]}
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
                  onPress={() => show(null)}
                  style={s.close}
                >
                  <Ionicons name="close" size={22} color="#50402e" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: 9 }}>
                {sheet === "studio" && (
                  <>
                    <Text style={s.note}>{L("note")}</Text>
                    <Row
                      label={L("doze")}
                      icon="moon-outline"
                      onPress={() => replay("doze")}
                    />
                    <Row
                      label={L("watching")}
                      icon="eye-outline"
                      onPress={() => replay("watching")}
                    />
                    <Row
                      label={L("greet")}
                      icon="heart-outline"
                      onPress={() => action("greeting")}
                    />
                    <Row
                      label={L("listen")}
                      icon="ear-outline"
                      onPress={() => action("listening")}
                    />
                    <Row
                      label={L("voice")}
                      icon="volume-medium-outline"
                      onPress={() => void hear()}
                    />
                    <Text style={s.note}>{L("voiceNote")}</Text>
                    {Platform.OS === "web" && (
                      <Row
                        label={L("record")}
                        icon="videocam-outline"
                        onPress={record}
                      />
                    )}
                    {Platform.OS === "web" &&
                      clip &&
                      React.createElement(
                        "a",
                        {
                          href: clip,
                          download: "meow-2d-preview.webm",
                          style: {
                            padding: 14,
                            color: "#68543b",
                            fontSize: 15,
                          },
                        },
                        L("save"),
                      )}
                    {captureFailed && <Text style={s.note}>{L("failed")}</Text>}
                    <View style={s.switch}>
                      <Text style={s.note}>{L("reduced")}</Text>
                      <Switch
                        accessibilityLabel={L("reduced")}
                        value={reduced}
                        onValueChange={setReduced}
                        trackColor={{ true: "#889276" }}
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
                    <View style={s.languages}>
                      {(["en", "ja"] as const).map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          aria-checked={language === value}
                          onPress={() =>
                            setWorld((old) => ({
                              ...old,
                              preferences: {
                                ...old.preferences,
                                language: value,
                              },
                            }))
                          }
                        >
                          <Text style={s.note}>
                            {value === "en" ? "English" : "日本語"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {!persisted && <Text style={s.note}>{L("storage")}</Text>}
                  </>
                )}
                {sheet === "today" &&
                  (world.tasks.some((t) => !t.doneAt) ? (
                    world.tasks
                      .filter((t) => !t.doneAt)
                      .slice(0, 8)
                      .map((task) => (
                        <View key={task.id} style={s.task}>
                          <Ionicons
                            name="ellipse-outline"
                            size={20}
                            color="#8b7c65"
                          />
                          <Text style={[s.note, { flex: 1 }]}>
                            {task.title}
                          </Text>
                        </View>
                      ))
                  ) : (
                    <Text style={s.note}>{L("empty")}</Text>
                  ))}
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
    backgroundColor: "#514c36",
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backgroundColor: "#514c36",
  },
  loadingText: {
    fontFamily: serif,
    fontSize: 20,
    color: "#fff0d8",
    textAlign: "center",
    padding: 24,
  },
  retry: { padding: 16, borderRadius: 16, backgroundColor: "#f8e5c8" },
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: serif,
    fontSize: 25,
    color: "#fff6e6",
    textShadowColor: "#20160f80",
    textShadowRadius: 8,
  },
  study: { fontSize: 8, letterSpacing: 2, color: "#f4e6ce", marginTop: 7 },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 23,
    backgroundColor: "#211b142e",
    alignItems: "center",
    justifyContent: "center",
  },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 170 },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 230,
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
    fontSize: 24,
    lineHeight: 32,
    color: "#fff1d9",
    textAlign: "center",
    textShadowColor: "#21170ec9",
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 2 },
    paddingHorizontal: 10,
  },
  recording: { fontSize: 10, textAlign: "center", color: "#fff0d5" },
  dock: {
    minHeight: 82,
    padding: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 8,
    backgroundColor: "#a27c526b",
    borderWidth: 1,
    borderColor: "#f6dfb75c",
    borderRadius: 26,
  },
  dockItem: {
    minWidth: 55,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  dockLabel: { fontSize: 10, color: "#fff1d8" },
  mic: {
    height: 64,
    width: 64,
    borderRadius: 34,
    backgroundColor: "#f5e5c8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -11,
  },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "#19140c20" },
  sheet: {
    maxHeight: "58%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#f3eadc",
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#b7aa95",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: { fontFamily: serif, fontSize: 27, color: "#473724" },
  close: { padding: 8, minWidth: 40, minHeight: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#fffbf28f",
  },
  rowText: { flex: 1, color: "#574936", fontSize: 15 },
  note: { fontSize: 14, lineHeight: 22, color: "#776953" },
  switch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  languages: { flexDirection: "row", gap: 24, paddingVertical: 15 },
  task: {
    flexDirection: "row",
    gap: 13,
    paddingVertical: 12,
    alignItems: "center",
  },
});
