import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const folder = "assets/companion";
function ffmpeg(args: string[]) {
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(result.stderr || String(result.error));
}
for (let i = 0; i < 6; i++)
  ffmpeg([
    "-i",
    `${folder}/master-sheet-alpha-v2.png`,
    "-vf",
    `crop=512:512:${(i % 3) * 512}:${Math.floor(i / 3) * 512}`,
    "-frames:v",
    "1",
    `${folder}/frame-${i}.png`,
  ]);
ffmpeg([
  "-i",
  `${folder}/study-source.png`,
  "-q:v",
  "3",
  "-frames:v",
  "1",
  `${folder}/study.jpg`,
]);
const names = [
  "master-sheet.png",
  "master-sheet-alpha-v2.png",
  "study-source.png",
  "study.jpg",
  ...Array.from({ length: 6 }, (_, i) => `frame-${i}.png`),
];
const sha256: Record<string, string> = {};
for (const name of names)
  sha256[name] = createHash("sha256")
    .update(await readFile(`${folder}/${name}`))
    .digest("hex");
await writeFile(
  `${folder}/manifest.json`,
  JSON.stringify(
    {
      type: "original generated 2D facial keyframes",
      sourceGrid: [3, 2],
      cellSize: 512,
      bodySource: 0,
      headRegion: 0.55,
      frames: ["open", "half-blink", "closed", "ear", "glance", "attentive"],
      sha256,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Prepared six exact frame crops, background copy and source manifest.",
);
