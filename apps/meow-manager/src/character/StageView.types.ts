import type { Opening } from "./motion";
import type { Command, StageReport } from "./scene";
export type StageViewProps = {
  opening: Opening;
  command: Command | null;
  reducedMotion: boolean;
  active: boolean;
  onReport: (report: StageReport) => void;
  onError: (message: string) => void;
  capture?: { serial: number; opening: Opening } | null;
  onCapture?: (url: string | null, failed?: boolean) => void;
};
