import type { Beat2D, Mode2D, Opening2D } from "./timeline";
export type Command2D = { serial: number; mode: Mode2D; opening?: Opening2D };
export type FrameStageProps = {
  opening: Opening2D;
  command: Command2D | null;
  active: boolean;
  reduced: boolean;
  onReady: () => void;
  onError: () => void;
  onReport: (beat: Beat2D) => void;
  capture?: number;
  onCapture?: (url: string | null) => void;
};
