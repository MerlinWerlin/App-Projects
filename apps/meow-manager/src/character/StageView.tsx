import React, { useEffect, useRef } from "react";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as T from "three";
import { createStage, type CharacterStage } from "./scene";
import type { StageViewProps } from "./StageView.types";

export default function StageView(props: StageViewProps) {
  const stage = useRef<CharacterStage | null>(null);
  const frameId = useRef(0);
  const latest = useRef(props);
  latest.current = props;
  const mounted = useRef(true);
  function contextCreated(gl: ExpoWebGLRenderingContext) {
    if (!mounted.current) return;
    try {
      const listeners = new Map<string, Set<EventListener>>();
      const canvas = {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
        style: {},
        addEventListener(type: string, fn: EventListener) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        },
        removeEventListener(type: string, fn: EventListener) {
          listeners.get(type)?.delete(fn);
        },
        getContext: () => gl,
      } as unknown as HTMLCanvasElement;
      const renderer = new T.WebGLRenderer({
        canvas,
        context: gl as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      const instance = createStage(renderer, props.opening, (r) =>
        latest.current.onReport(r),
      );
      stage.current = instance;
      instance.resize(gl.drawingBufferWidth, gl.drawingBufferHeight, 1);
      instance.setReducedMotion(latest.current.reducedMotion);
      if (latest.current.command) instance.command(latest.current.command);
      let bufferWidth = gl.drawingBufferWidth,
        bufferHeight = gl.drawingBufferHeight;
      function draw(time: number) {
        if (!mounted.current) return;
        if (latest.current.active) {
          try {
            if (
              gl.drawingBufferWidth !== bufferWidth ||
              gl.drawingBufferHeight !== bufferHeight
            ) {
              bufferWidth = gl.drawingBufferWidth;
              bufferHeight = gl.drawingBufferHeight;
              instance.resize(bufferWidth, bufferHeight, 1);
            }
            instance.frame(time);
            gl.endFrameEXP();
          } catch {
            latest.current.onError("The 3D view stopped on this device.");
            return;
          }
        }
        frameId.current = requestAnimationFrame(draw);
      }
      frameId.current = requestAnimationFrame(draw);
    } catch {
      props.onError("The 3D view could not start on this device.");
    }
  }
  useEffect(() => {
    if (props.command) stage.current?.command(props.command);
  }, [props.command]);
  useEffect(
    () => stage.current?.setReducedMotion(props.reducedMotion),
    [props.reducedMotion],
  );
  useEffect(() => stage.current?.setActive(props.active), [props.active]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frameId.current);
      stage.current?.dispose();
    };
  }, []);
  return (
    <GLView
      style={{ flex: 1, width: "100%", height: "100%" }}
      onContextCreate={contextCreated}
      onLayout={() => {
        /* GL buffer dimensions are used when its context is created. */
      }}
    />
  );
}
