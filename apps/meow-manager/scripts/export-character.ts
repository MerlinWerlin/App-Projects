import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createKitty, applyPose, disposeGraph } from "../src/character/rig.ts";
import {
  actionPose,
  openingPose,
  OPENING_DURATION,
  type Pose,
} from "../src/character/motion.ts";

// GLTFExporter's binary writer needs FileReader; this implementation only reads local Blobs.
class LocalFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob
      .arrayBuffer()
      .then((value) => {
        this.result = value;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
  readAsDataURL(blob: Blob) {
    void blob
      .arrayBuffer()
      .then((value) => {
        this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(value).toString("base64")}`;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
}
(globalThis as unknown as { FileReader: typeof LocalFileReader }).FileReader =
  LocalFileReader;
const rig = createKitty();
const nodes: T.Object3D[] = [];
rig.root.traverse((node) => nodes.push(node));
function clip(name: string, seconds: number, sample: (time: number) => Pose) {
  const times: number[] = [];
  const values = nodes.map(() => ({
    position: [] as number[],
    quaternion: [] as number[],
    scale: [] as number[],
  }));
  const frames = Math.ceil(seconds * 30);
  for (let frame = 0; frame <= frames; frame++) {
    const time = Math.min(seconds, frame / 30);
    times.push(time);
    applyPose(rig, sample(time), time);
    nodes.forEach((node, i) => {
      values[i].position.push(...node.position.toArray());
      values[i].quaternion.push(...node.quaternion.toArray());
      values[i].scale.push(
        ...(node.visible ? node.scale.toArray() : [0, 0, 0]),
      );
    });
  }
  const tracks: T.KeyframeTrack[] = [];
  nodes.forEach((node, index) => {
    for (const property of ["position", "quaternion", "scale"] as const) {
      const data = values[index][property];
      const size = property === "quaternion" ? 4 : 3;
      if (!data.some((value, i) => Math.abs(value - data[i % size]) > 1e-7))
        continue;
      const Track =
        property === "quaternion"
          ? T.QuaternionKeyframeTrack
          : T.VectorKeyframeTrack;
      tracks.push(new Track(`${node.uuid}.${property}`, times, data));
    }
  });
  return new T.AnimationClip(name, seconds, tracks);
}
const clips = [
  clip("Nap_to_ready", OPENING_DURATION.nap, (time) =>
    openingPose("nap", time),
  ),
  clip("Chips_to_ready", OPENING_DURATION.chips, (time) =>
    openingPose("chips", time),
  ),
  clip("Idle", 4.6, (time) => actionPose("idle", time)),
  clip("Greeting", 1.8, (time) => actionPose("wave", time)),
  clip("Listening", 3, (time) => actionPose("listening", time)),
  clip("Speaking", 3, (time) => actionPose("speaking", time)),
];
applyPose(rig, actionPose("idle", 0), 0);
rig.root.traverse((node) => {
  if (!node.visible) node.scale.setScalar(0);
});
rig.root.updateMatrixWorld(true);
const output = resolve("assets/character");
await mkdir(output, { recursive: true });
const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(rig.root, {
  binary: true,
  onlyVisible: false,
  animations: clips,
});
await writeFile(
  resolve(output, "mochi-motion-proof.glb"),
  Buffer.from(binary as ArrayBuffer),
);
const sourceSHA256 = Object.fromEntries(
  await Promise.all(
    [
      "src/character/motion.ts",
      "src/character/rig.ts",
      "scripts/export-character.ts",
    ].map(async (path) => [
      path,
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    ]),
  ),
);
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(
    {
      type: "original procedural 3D motion proof",
      generator: "scripts/export-character.ts",
      sourceSHA256,
      fps: 30,
      paws: rig.pawNodes,
      clips: clips.map((c) => ({
        name: c.name,
        duration: c.duration,
        tracks: c.tracks.length,
      })),
      note: "Motion/timing asset. Fur, skinning around body joints and materials need further art refinement. Physical iPhone performance unverified.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    bytes: (binary as ArrayBuffer).byteLength,
    clips: clips.map((c) => c.name),
    paws: rig.pawNodes.length,
  }),
);
disposeGraph(rig.root);
