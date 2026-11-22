import { useEffect, useRef } from "react";
import { FrameDirector, type Weights } from "./timeline";
import type { FrameStageProps } from "./FrameStage.types";
export function useFrameClock(
  props: FrameStageProps,
  ready: boolean,
  paint: (weights: Weights) => void,
) {
  const director = useRef(new FrameDirector(props.opening));
  const current = useRef({ props, paint });
  current.current = { props, paint };
  useEffect(() => {
    director.current.active = props.active;
  }, [props.active]);
  useEffect(() => {
    director.current.setReduced(props.reduced);
  }, [props.reduced]);
  useEffect(() => {
    if (props.command)
      director.current.perform(props.command.mode, props.command.opening);
  }, [props.command]);
  useEffect(() => {
    if (!ready) return;
    current.current.props.onReady();
    let previous = 0,
      request = 0,
      previousBeat = "";
    function frame(now: number) {
      const d = director.current;
      d.tick(previous ? (now - previous) / 1000 : 0);
      previous = now;
      current.current.paint(d.weights());
      const beat = d.beat();
      if (beat !== previousBeat) {
        current.current.props.onReport(beat);
        previousBeat = beat;
      }
      request = requestAnimationFrame(frame);
    }
    request = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(request);
  }, [ready]);
  return director;
}
