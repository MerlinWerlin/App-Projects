import * as T from "three";
import {
  CharacterDirector,
  type CharacterMode,
  type Opening,
  type ActingBeat,
} from "./motion.ts";
import { applyPose, createKitty, disposeGraph } from "./rig.ts";

export type Command = {
  serial: number;
  mode: CharacterMode;
  opening?: Opening;
};
export type StageReport = {
  beat: ActingBeat;
  mode: CharacterMode;
  opening: Opening;
  elapsed: number;
  fps: number;
  triangles: number;
  calls: number;
};
export type RenderSurface = Pick<
  T.WebGLRenderer,
  | "render"
  | "setSize"
  | "setPixelRatio"
  | "dispose"
  | "info"
  | "shadowMap"
  | "toneMapping"
  | "toneMappingExposure"
  | "outputColorSpace"
  | "setClearColor"
>;
function material(color: string, roughness = 0.8, metalness = 0) {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}
function box(
  parent: T.Object3D,
  position: number[],
  size: number[],
  mat: T.Material,
) {
  const m = new T.Mesh(
    new T.BoxGeometry(...(size as [number, number, number])),
    mat,
  );
  m.position.fromArray(position);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function woodTexture() {
  const data = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const at = (y * 128 + x) * 4;
      const grain =
        Math.sin(x * 0.43 + Math.sin(y * 0.04) * 0.7) * 5 +
        Math.sin(x * 1.8 + y * 0.025) * 2;
      data[at] = 109 + grain;
      data[at + 1] = 76 + grain;
      data[at + 2] = 49 + grain;
      data[at + 3] = 255;
    }
  const texture = new T.DataTexture(data, 128, 128, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.needsUpdate = true;
  return texture;
}
function createRoom(scene: T.Scene) {
  const room = new T.Group();
  room.name = "quiet_office";
  scene.add(room);
  const wood = new T.MeshStandardMaterial({
    color: "#c2a27c",
    map: woodTexture(),
    roughness: 0.65,
  });
  box(room, [0, -0.07, 0], [12, 0.16, 8], wood);
  box(room, [0, 2.4, -2.35], [12, 5.4, 0.15], material("#817c6d"));
  const trim = material("#625745", 0.75);
  for (let x = -5; x < 6; x += 0.78)
    box(room, [x, 2.4, -2.21], [0.028, 5, 0.035], trim);
  box(room, [-1.65, 1.9, -2.1], [1.4, 2.75, 0.08], material("#c7bca3"));
  const sky = new T.MeshBasicMaterial({ color: "#e5e3d0" });
  box(room, [-1.65, 1.92, -2.03], [1.22, 2.56, 0.035], sky);
  for (const x of [-2.27, -1.65, -1.03])
    box(room, [x, 1.92, -1.98], [0.047, 2.64, 0.06], trim);
  for (const y of [0.64, 1.5, 2.35, 3.21])
    box(room, [-1.65, y, -1.98], [1.26, 0.045, 0.06], trim);
  // Distant bookcase and warm desk furniture stay behind the character.
  box(room, [1.8, 1.5, -2.05], [1.4, 2.8, 0.25], material("#584936"));
  for (const y of [0.3, 1.0, 1.7, 2.4]) {
    box(room, [1.8, y, -1.85], [1.45, 0.055, 0.55], trim);
    for (let i = 0; i < 7; i++) {
      const book = box(
        room,
        [1.2 + i * 0.18, y + 0.25, -1.78],
        [0.12, 0.42 + (i % 3) * 0.055, 0.26],
        material(["#6a7355", "#84614c", "#b3a078", "#777b73"][i % 4]),
      );
      book.rotation.z = ((i % 4) - 1.5) * 0.025;
    }
  }
  const pot = new T.Mesh(
    new T.CylinderGeometry(0.15, 0.11, 0.27, 24),
    material("#ae8066"),
  );
  pot.position.set(-1.13, 0.16, -0.6);
  room.add(pot);
  const stem = material("#697653");
  const leaf = material("#748263");
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.4;
    const branch = new T.Mesh(
      new T.CylinderGeometry(0.009, 0.012, 0.55, 6),
      stem,
    );
    branch.position.set(-1.13 + Math.sin(angle) * 0.04, 0.44, -0.6);
    branch.rotation.z = Math.sin(angle) * 0.33;
    room.add(branch);
    const blade = new T.Mesh(new T.SphereGeometry(1, 16, 12), leaf);
    blade.scale.set(0.075, 0.18, 0.025);
    blade.position.set(
      -1.13 + Math.sin(angle) * 0.13,
      0.69 + (i % 2) * 0.13,
      -0.6 + Math.cos(angle) * 0.08,
    );
    blade.rotation.z = -Math.sin(angle) * 0.65;
    room.add(blade);
  }
  const brass = material("#bc9c5a", 0.28, 0.7);
  const lampBase = new T.Mesh(
    new T.CylinderGeometry(0.16, 0.18, 0.04, 32),
    brass,
  );
  lampBase.position.set(0.99, 0.05, -0.7);
  room.add(lampBase);
  box(room, [0.99, 0.39, -0.7], [0.025, 0.67, 0.025], brass);
  const shade = new T.Mesh(new T.ConeGeometry(0.25, 0.22, 32, 1, true), brass);
  shade.position.set(0.99, 0.76, -0.7);
  room.add(shade);
  const lamp = new T.PointLight("#ffe0a0", 0.9, 3, 2);
  lamp.position.set(0.99, 0.66, -0.7);
  scene.add(lamp);
  return { room, wood };
}

export function createStage(
  renderer: RenderSurface,
  opening: Opening,
  report?: (value: StageReport) => void,
) {
  const scene = new T.Scene();
  scene.background = new T.Color("#817c6d");
  scene.fog = new T.Fog("#817c6d", 5, 13);
  const camera = new T.PerspectiveCamera(38, 1, 0.05, 40);
  camera.position.set(0.04, 1.49, 4.2);
  camera.lookAt(0, 1.32, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  scene.add(new T.HemisphereLight("#fff4de", "#8a755c", 1.65));
  const key = new T.DirectionalLight("#fff1db", 2.6);
  key.position.set(-2.7, 4.5, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -1;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.00025;
  scene.add(key);
  const rim = new T.DirectionalLight("#ffddb3", 1.3);
  rim.position.set(1.5, 3, -1.7);
  scene.add(rim);
  const fill = new T.DirectionalLight("#dce5e7", 0.7);
  fill.position.set(2, 2, 3);
  scene.add(fill);
  const room = createRoom(scene);
  const kitty = createKitty();
  scene.add(kitty.root);
  const director = new CharacterDirector(opening);
  let last = 0,
    worldTime = 0,
    disposed = false,
    reportTime = 0,
    frames = 0,
    frameSeconds = 0;
  let lastCommand = -1;
  let reduced = false;
  function frame(timestampMs: number) {
    if (disposed) return;
    const delta = last ? Math.max(0, (timestampMs - last) / 1000) : 0;
    last = timestampMs;
    director.tick(delta);
    if (!reduced) worldTime += Math.min(delta, 0.1);
    const pose = director.pose();
    applyPose(kitty, pose, worldTime);
    // The character looks toward the menu; the camera remains stable for interruptions and recording.
    renderer.render(scene, camera);
    frames++;
    frameSeconds += delta;
    reportTime += delta;
    if (reportTime > 0.25) {
      report?.({
        beat: director.beat(),
        mode: director.mode,
        opening: director.opening,
        elapsed: director.elapsed,
        fps: frameSeconds ? frames / frameSeconds : 0,
        triangles: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
      });
      frames = 0;
      frameSeconds = 0;
      reportTime = 0;
    }
  }
  function command(command: Command) {
    if (command.serial === lastCommand) return;
    lastCommand = command.serial;
    director.setMode(command.mode, command.opening);
  }
  function resize(width: number, height: number, pixelRatio: number) {
    renderer.setPixelRatio(Math.min(2, pixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // A portrait phone keeps the ears and paws in frame; landscape remains a room, not a stretched cat.
    camera.fov = camera.aspect < 0.55 ? 44 : 38;
    camera.updateProjectionMatrix();
  }
  return {
    frame,
    command,
    resize,
    setActive(value: boolean) {
      director.setActive(value);
      last = 0;
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (value) worldTime = 0;
      director.setReducedMotion(value);
    },
    director,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeGraph(scene);
      room.wood.map?.dispose();
      renderer.dispose();
    },
  };
}
export type CharacterStage = ReturnType<typeof createStage>;
