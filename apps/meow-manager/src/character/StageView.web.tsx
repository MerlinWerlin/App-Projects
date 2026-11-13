import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import * as T from "three";
import { createStage, type CharacterStage } from "./scene";
import type { StageViewProps } from "./StageView.types";
import { OPENING_DURATION } from "./motion";

export default function StageView(props: StageViewProps) {
  const host = useRef<View>(null);
  const stage = useRef<CharacterStage | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const element = host.current as unknown as HTMLElement;
    if (!element) return;
    let renderer: T.WebGLRenderer;
    let frame = 0;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      props.onError("The 3D view could not start.");
      return;
    }
    const canvas = renderer.domElement;
    canvasRef.current = canvas;
    canvas.setAttribute("aria-label", "Animated 3D kitty");
    canvas.setAttribute("role", "img");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    element.appendChild(canvas);
    const instance = createStage(renderer, props.opening, (r) =>
      latest.current.onReport(r),
    );
    stage.current = instance;
    const resize = () =>
      instance.resize(
        Math.max(1, element.clientWidth),
        Math.max(1, element.clientHeight),
        window.devicePixelRatio || 1,
      );
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    instance.setReducedMotion(latest.current.reducedMotion);
    if (latest.current.command) instance.command(latest.current.command);
    const draw = (time: number) => {
      if (latest.current.active && !document.hidden) {
        try {
          instance.frame(time);
        } catch {
          latest.current.onError("The 3D view stopped.");
          return;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const visibility = () =>
      instance.setActive(!document.hidden && latest.current.active);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      if (captureTimer.current) clearTimeout(captureTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
      instance.dispose();
      canvas.remove();
      canvasRef.current = null;
      stage.current = null;
    };
  }, []);
  useEffect(() => {
    if (props.command) stage.current?.command(props.command);
  }, [props.command]);
  useEffect(
    () => stage.current?.setReducedMotion(props.reducedMotion),
    [props.reducedMotion],
  );
  useEffect(() => stage.current?.setActive(props.active), [props.active]);
  useEffect(() => {
    if (!props.capture || !canvasRef.current || !stage.current) return;
    if (recorder.current?.state === "recording") return;
    try {
      const stream = canvasRef.current.captureStream(30);
      const type = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      if (!type) {
        stream.getTracks().forEach((t) => t.stop());
        props.onCapture?.(null, true);
        return;
      }
      const rec = new MediaRecorder(stream, {
        mimeType: type,
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: BlobPart[] = [];
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        latest.current.onCapture?.(
          URL.createObjectURL(new Blob(chunks, { type: "video/webm" })),
        );
        recorder.current = null;
      };
      rec.onerror = () => latest.current.onCapture?.(null, true);
      stage.current.director.restartOpening(props.capture.opening);
      rec.start();
      captureTimer.current = setTimeout(
        () => {
          if (rec.state === "recording") rec.stop();
        },
        (OPENING_DURATION[props.capture.opening] + 0.85) * 1000,
      );
    } catch {
      props.onCapture?.(null, true);
    }
  }, [props.capture]);
  return <View ref={host} style={{ flex: 1, width: "100%", height: "100%" }} />;
}
