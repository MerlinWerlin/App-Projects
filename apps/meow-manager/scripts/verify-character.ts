import { readFile, writeFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as T from "three";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await readFile("assets/character/manifest.json", "utf8"),
);
for (const [path, expected] of Object.entries(manifest.sourceSHA256 ?? {}))
  if (
    createHash("sha256")
      .update((await readFile(path, "utf8")).replace(/\r\n/g, "\n"))
      .digest("hex") !== expected
  )
    throw new Error(`Stale generated asset: ${path}`);
const bytes = await readFile("assets/character/mochi-motion-proof.glb");
const data = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
) as ArrayBuffer;
const loaded = await new GLTFLoader().parseAsync(data, "");
const clips = loaded.animations.map((c) => c.name);
const required = [
  "Nap_to_ready",
  "Chips_to_ready",
  "Idle",
  "Greeting",
  "Listening",
  "Speaking",
];
if (required.some((name) => !clips.includes(name)))
  throw new Error("Missing exported clips");
const paws: string[] = [];
let meshes = 0,
  skinned = 0;
loaded.scene.traverse((node) => {
  if (/^paw_(fore|hind)_(left|right)$/.test(node.name)) paws.push(node.name);
  if (node instanceof T.Mesh) meshes++;
  if (node instanceof T.SkinnedMesh) skinned++;
});
if (paws.length !== 4 || new Set(paws).size !== 4 || !skinned)
  throw new Error("Rig structure failed");
let frames = 0;
for (const clip of loaded.animations) {
  const mixer = new T.AnimationMixer(loaded.scene);
  mixer.clipAction(clip).play();
  for (let i = 0; i <= 20; i++) {
    mixer.setTime((clip.duration * i) / 20);
    loaded.scene.updateMatrixWorld(true);
    loaded.scene.traverse((node) => {
      if (!node.matrixWorld.elements.every(Number.isFinite))
        throw new Error(`Nonfinite exported ${clip.name}`);
    });
    frames++;
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(loaded.scene);
}
const result = {
  result: "passed",
  bytes: bytes.byteLength,
  clips,
  paws,
  meshes,
  skinnedMeshes: skinned,
  sampledFrames: frames,
  note: "Independently reloads exported GLB and samples every clip. Does not establish visual quality or physical iPhone performance.",
};
await writeFile(
  "assets/character/verification.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
