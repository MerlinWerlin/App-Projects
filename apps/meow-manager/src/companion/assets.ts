export const faceSources = [
  require("../../assets/companion/frame-0.png"),
  require("../../assets/companion/frame-1.png"),
  require("../../assets/companion/frame-2.png"),
  require("../../assets/companion/frame-3.png"),
  require("../../assets/companion/frame-4.png"),
  require("../../assets/companion/frame-5.png"),
];
export const roomSource = require("../../assets/companion/study.jpg");
export const HEAD_RATIO = 0.55;
export function characterLayout(width: number, height: number) {
  const size = Math.min(width * 1.22, height * 0.64);
  return { size, left: (width - size) / 2, top: height * 0.735 - size * 0.987 };
}
