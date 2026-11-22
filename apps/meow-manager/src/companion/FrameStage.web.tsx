import React, { useCallback, useEffect, useRef, useState } from "react";
import { characterLayout, faceSources, HEAD_RATIO, roomSource } from "./assets";
import { FrameDirector, layerOpacities, type Weights } from "./timeline";
import { useFrameClock } from "./useFrameClock";
import type { FrameStageProps } from "./FrameStage.types";
export default function FrameStage(props: FrameStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<HTMLImageElement[]>([]);
  const [ready, setReady] = useState(false);
  const latest = useRef(props);
  latest.current = props;
  const paint = useCallback((weights: Weights) => {
    const surface = canvas.current,
      art = images.current;
    if (!surface || art.length !== 7) return;
    const w = surface.clientWidth,
      h = surface.clientHeight,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (
      surface.width !== Math.round(w * dpr) ||
      surface.height !== Math.round(h * dpr)
    ) {
      surface.width = Math.round(w * dpr);
      surface.height = Math.round(h * dpr);
    }
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    const room = art[6],
      scale = Math.max(w / room.naturalWidth, h / room.naturalHeight);
    ctx.drawImage(
      room,
      (w - room.naturalWidth * scale) / 2,
      (h - room.naturalHeight * scale) / 2,
      room.naturalWidth * scale,
      room.naturalHeight * scale,
    );
    const c = characterLayout(w, h),
      split = c.top + c.size * HEAD_RATIO;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, split, w, h - split);
    ctx.clip();
    ctx.drawImage(art[0], c.left, c.top, c.size, c.size);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, split);
    ctx.clip();
    layerOpacities(weights).forEach((alpha, i) => {
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(art[i], c.left, c.top, c.size, c.size);
      }
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }, []);
  const director = useFrameClock(props, ready, paint);
  useEffect(() => {
    let mounted = true;
    Promise.all(
      [...faceSources, roomSource].map(
        (source) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
          const uri = typeof source === "string" ? source : source?.uri;
          if (typeof uri !== "string") {
            reject(new Error("Missing web artwork URI"));
            return;
          }
          img.src = uri;
          }),
      ),
    )
      .then((value) => {
        if (mounted) {
          images.current = value;
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) latest.current.onError();
      });
    return () => {
      mounted = false;
      images.current = [];
    };
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      director.current.active =
        latest.current.active && document.visibilityState !== "hidden";
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [props.active]);
  useEffect(() => {
    if (!ready || !props.capture || !canvas.current) return;
    let mounted = true;
    if (!canvas.current.captureStream || typeof MediaRecorder === "undefined") {
      latest.current.onCapture?.(null);
      return;
    }
    const stream = canvas.current.captureStream(30),
      parts: Blob[] = [];
    const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: type });
    recorder.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (mounted)
        latest.current.onCapture?.(
          parts.length ? URL.createObjectURL(new Blob(parts, { type })) : null,
        );
    };
    recorder.onerror = () => {
      if (mounted) latest.current.onCapture?.(null);
    };
    director.current = new FrameDirector("doze");
    paint(director.current.weights());
    recorder.start();
    const timer = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, 7200);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    };
  }, [props.capture, ready]);
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Animated 2D kitty"
      style={{
        display: "block",
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
