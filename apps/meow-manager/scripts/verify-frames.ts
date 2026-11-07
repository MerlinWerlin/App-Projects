import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const folder = "assets/companion";
const manifest = JSON.parse(await readFile(`${folder}/manifest.json`, "utf8"));
assert.deepEqual(manifest.sourceGrid, [3, 2]);
assert.equal(manifest.cellSize, 512);
const expected = [
  "master-sheet.png",
  "master-sheet-alpha-v2.png",
  "study-source.png",
  "study.jpg",
  ...Array.from({ length: 6 }, (_, i) => `frame-${i}.png`),
];
assert.deepEqual(Object.keys(manifest.sha256).sort(), expected.sort());
for (const name of expected) {
  const bytes = await readFile(`${folder}/${name}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    manifest.sha256[name],
    `Asset changed: ${name}`,
  );
  if (name.startsWith("frame-")) {
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 512);
    assert.equal(bytes.readUInt32BE(20), 512);
    assert.equal(bytes[25], 6, "Frames must retain RGBA transparency");
  }
}
console.log(
  JSON.stringify({
    result: "passed",
    frames: 6,
    cellSize: 512,
    staticBodyFrame: 0,
    facialRegion: 0.55,
    sourceHashes: expected.length,
    note: "Checks asset custody/dimensions, not visual quality or physical iPhone playback.",
  }),
);
