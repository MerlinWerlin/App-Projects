import * as T from "three";
import type { Pose } from "./motion.ts";

type Joint = T.Group;
export type KittyRig = {
  root: T.Group;
  spine: Joint;
  head: Joint;
  ears: Joint[];
  left: Limb;
  right: Limb;
  hindLeft: Limb;
  hindRight: Limb;
  eyes: T.Group[];
  brows: T.Group[];
  closedEyes: T.Object3D[];
  mouth: T.Mesh;
  chin: T.Group;
  tongue: T.Mesh;
  tail: T.Bone[];
  bag: T.Group;
  chip: T.Group;
  cushion: T.Mesh;
  pawNodes: readonly string[];
};
type Limb = { upper: Joint; lower: Joint; paw: Joint };
const sphere = new T.SphereGeometry(1, 40, 32);
const cream = new T.MeshStandardMaterial({ color: "#f4dfc3", roughness: 0.88 });
const caramel = new T.MeshStandardMaterial({
  color: "#ce955e",
  roughness: 0.88,
});
const white = new T.MeshStandardMaterial({ color: "#fff0d9", roughness: 0.86 });
const shirt = new T.MeshStandardMaterial({ color: "#f2e8d6", roughness: 0.92 });
const cloth = new T.MeshStandardMaterial({ color: "#383c38", roughness: 1 });
const lapel = new T.MeshStandardMaterial({ color: "#45473f", roughness: 0.96 });
const sage = new T.MeshStandardMaterial({ color: "#7c8460", roughness: 0.85 });
const brass = new T.MeshStandardMaterial({
  color: "#ba9554",
  roughness: 0.34,
  metalness: 0.7,
});
const pink = new T.MeshStandardMaterial({ color: "#d6a09a", roughness: 0.84 });
const furLine = new T.MeshStandardMaterial({ color: "#9c7960", roughness: 1 });
function group(parent: T.Object3D, name: string, x = 0, y = 0, z = 0): T.Group {
  const node = new T.Group();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}
function ellipsoid(
  parent: T.Object3D,
  name: string,
  position: number[],
  scale: number[],
  material: T.Material,
  geometry = sphere,
): T.Mesh {
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function line(
  parent: T.Object3D,
  points: number[][],
  radius: number,
  material: T.Material,
): T.Mesh {
  const curve = new T.CatmullRomCurve3(
    points.map((p) => new T.Vector3(...(p as [number, number, number]))),
  );
  const mesh = new T.Mesh(
    new T.TubeGeometry(curve, 16, radius, 5, false),
    material,
  );
  parent.add(mesh);
  return mesh;
}
function patch(
  parent: T.Object3D,
  name: string,
  points: number[][],
  depth: number,
  material: T.Material,
  bevel = 0.015,
): T.Mesh {
  const shape = new T.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) shape.lineTo(p[0], p[1]);
  shape.closePath();
  const mesh = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      steps: 1,
    }),
    material,
  );
  mesh.name = name;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function furColor(x: number, y: number, z: number): T.Color {
  let color = new T.Color("#d9a574");
  if (
    z > 0.14 &&
    (y < -0.1 || Math.abs(x) < 0.17 + Math.max(0, -0.2 - y) * 0.7)
  )
    color.set("#f6e7ce");
  if (
    y > 0.28 &&
    y < 0.9 &&
    z > 0.38 &&
    [-0.34, 0, 0.34].some(
      (center) => Math.abs(x - center) < (0.045 * (y - 0.2)) / 0.6,
    )
  )
    color.lerp(new T.Color("#b97e45"), 0.5);
  return color;
}
function headGeometry() {
  const geo = new T.SphereGeometry(1, 64, 48);
  const positions = geo.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const color = furColor(x, y, z);
    colors.push(color.r, color.g, color.b);
    // Broader kitten cheeks and a slightly smaller crown, rather than a perfect sphere.
    positions.setXYZ(i, x * (0.96 + 0.09 * Math.max(0, -y)), y, z);
  }
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
function addHeadFuzz(parent: T.Group) {
  const count = 5400;
  const geometry = new T.ConeGeometry(0.00085, 0.008, 3);
  geometry.translate(0, 0.003, 0);
  const material = new T.MeshStandardMaterial({
    color: "#f6dfbc",
    roughness: 1,
    vertexColors: false,
  });
  const fuzz = new T.InstancedMesh(geometry, material, count);
  fuzz.name = "short_fur";
  const dummy = new T.Object3D();
  const up = new T.Vector3(0, 1, 0);
  let filled = 0;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count * 2 && filled < count; i++) {
    const v = ((i % count) + 0.5) / count;
    const y = 1 - 2 * v;
    const r = Math.sqrt(1 - y * y);
    const angle = i * golden;
    const x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    // Keep eyes, nose and central muzzle unobstructed.
    if (z > 0.58 && y > -0.6 && y < 0.45 && Math.abs(x) < 0.81) continue;
    const normal = new T.Vector3(x / 0.56, y / 0.455, z / 0.42).normalize();
    dummy.position.set(x * 0.562, y * 0.457, z * 0.422);
    dummy.quaternion.setFromUnitVectors(up, normal);
    const variation = 0.7 + ((i * 17) % 31) / 50;
    dummy.scale.setScalar(variation);
    dummy.updateMatrix();
    fuzz.setMatrixAt(filled, dummy.matrix);
    fuzz.setColorAt(filled, furColor(x, y, z));
    filled++;
  }
  fuzz.count = filled;
  fuzz.instanceMatrix.needsUpdate = true;
  parent.add(fuzz);
}
function makeEar(parent: T.Object3D, side: number): T.Group {
  const ear = group(
    parent,
    side < 0 ? "ear_left" : "ear_right",
    side * 0.37,
    0.28,
    -0.015,
  );
  ear.rotation.z = side * -0.18;
  ear.scale.y = 0.74;
  const shape = new T.Shape();
  shape.moveTo(-0.16, -0.03);
  shape.quadraticCurveTo(-0.18, 0.12, -0.12, 0.43);
  shape.quadraticCurveTo(-0.1, 0.49, -0.04, 0.43);
  shape.quadraticCurveTo(0.16, 0.27, 0.17, -0.01);
  shape.quadraticCurveTo(0, -0.1, -0.16, -0.03);
  const outer = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 4,
      curveSegments: 16,
    }),
    caramel,
  );
  outer.castShadow = true;
  ear.add(outer);
  const inside = new T.Mesh(new T.ShapeGeometry(shape, 16), pink);
  inside.scale.set(0.66, 0.75, 1);
  inside.position.set(0, 0.035, 0.116);
  ear.add(inside);
  return ear;
}
function makeForeleg(parent: T.Object3D, side: number): Limb {
  const name = side < 0 ? "left_foreleg" : "right_foreleg";
  const upper = group(parent, name, side * 0.32, 0.69, 0.005);
  ellipsoid(upper, "shirt_sleeve", [0, -0.12, 0], [0.112, 0.19, 0.112], shirt);
  const lower = group(upper, `${name}_elbow`, 0, -0.25, 0);
  ellipsoid(
    lower,
    "sleeve_lower",
    [0, -0.125, 0],
    [0.091, 0.165, 0.092],
    shirt,
  );
  const cuff = new T.Mesh(
    new T.CylinderGeometry(0.097, 0.097, 0.075, 24),
    shirt,
  );
  cuff.position.y = -0.23;
  lower.add(cuff);
  ellipsoid(
    lower,
    "cuff_button",
    [0.088, -0.23, 0.01],
    [0.014, 0.014, 0.014],
    brass,
  );
  const paw = group(
    lower,
    side < 0 ? "paw_fore_left" : "paw_fore_right",
    0,
    -0.315,
    0.015,
  );
  ellipsoid(paw, "paw_fur", [0, -0.015, 0], [0.115, 0.105, 0.09], white);
  for (let i = 0; i < 3; i++)
    ellipsoid(
      paw,
      "toe",
      [(i - 1) * 0.056, -0.067, 0.025],
      [0.04, 0.055, 0.069],
      white,
    );
  // A single palm plus three toe beans, all attached to the same paw joint.
  ellipsoid(paw, "palm_pad", [0, -0.015, 0.084], [0.047, 0.042, 0.009], pink);
  for (let i = 0; i < 3; i++)
    ellipsoid(
      paw,
      "toe_pad",
      [(i - 1) * 0.052, -0.066, 0.083],
      [0.014, 0.02, 0.008],
      pink,
    );
  return { upper, lower, paw };
}
function makeHindLeg(parent: T.Object3D, side: number): Limb {
  const upper = group(
    parent,
    side < 0 ? "left_hindleg" : "right_hindleg",
    side * 0.205,
    0.54,
    -0.015,
  );
  ellipsoid(upper, "haunch", [0, -0.06, 0], [0.17, 0.22, 0.17], caramel);
  const lower = group(upper, "hock", 0, -0.22, 0.005);
  ellipsoid(lower, "shin", [0, -0.07, 0], [0.105, 0.145, 0.11], cream);
  const paw = group(
    lower,
    side < 0 ? "paw_hind_left" : "paw_hind_right",
    0,
    -0.16,
    0.07,
  );
  ellipsoid(paw, "hind_paw_fur", [0, -0.015, 0.045], [0.14, 0.09, 0.19], white);
  for (let i = 0; i < 3; i++)
    ellipsoid(
      paw,
      "hind_toe",
      [(i - 1) * 0.064, -0.025, 0.17],
      [0.045, 0.06, 0.055],
      white,
    );
  return { upper, lower, paw };
}
function makeBag(parent: T.Object3D) {
  const bag = group(parent, "chips_packet", 0, -0.07, 0.09);
  const packet = new T.Mesh(
    new T.BoxGeometry(0.25, 0.34, 0.095, 5, 7, 2),
    new T.MeshStandardMaterial({ color: "#b76542", roughness: 0.88 }),
  );
  const position = packet.geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    position.setXYZ(
      i,
      x * (1 + 0.07 * Math.sin(y * 44)),
      y,
      z + 0.007 * Math.sin(x * 67 + y * 25),
    );
  }
  packet.geometry.computeVertexNormals();
  bag.add(packet);
  const band = new T.Mesh(new T.BoxGeometry(0.255, 0.035, 0.1), sage);
  band.position.y = -0.1;
  bag.add(band);
  const label = ellipsoid(
    bag,
    "plain_chip_medallion",
    [0, 0.015, 0.053],
    [0.065, 0.075, 0.007],
    new T.MeshStandardMaterial({ color: "#eac77f", roughness: 1 }),
  );
  label.rotation.z = -0.3;
  for (let i = 0; i < 6; i++)
    line(
      bag,
      [
        [-0.12 + i * 0.047, 0.155, 0.052],
        [-0.11 + i * 0.045, 0.181, 0.032],
      ],
      0.004,
      sage,
    );
  return bag;
}

export function createKitty(): KittyRig {
  const root = new T.Group();
  root.name = "Mochi_original_motion_rig";
  ellipsoid(root, "lower_fur", [0, 0.61, -0.015], [0.35, 0.32, 0.265], caramel);
  const spine = group(root, "spine", 0, 0.72, 0);
  ellipsoid(spine, "body_fur", [0, 0.33, 0], [0.35, 0.47, 0.27], cream);
  ellipsoid(
    spine,
    "tailored_waistcoat",
    [0, 0.35, 0.005],
    [0.363, 0.455, 0.283],
    cloth,
  );
  patch(
    spine,
    "shirt_front",
    [
      [-0.13, 0.68],
      [0.13, 0.68],
      [0, 0.26],
    ],
    0.017,
    shirt,
  ).position.z = 0.275;
  const collarL = patch(
    spine,
    "collar_left",
    [
      [-0.17, 0.73],
      [-0.01, 0.64],
      [-0.1, 0.47],
      [-0.21, 0.63],
    ],
    0.016,
    shirt,
  );
  collarL.position.z = 0.285;
  const collarR = patch(
    spine,
    "collar_right",
    [
      [0.17, 0.73],
      [0.01, 0.64],
      [0.1, 0.47],
      [0.21, 0.63],
    ],
    0.016,
    shirt,
  );
  collarR.position.z = 0.285;
  const tie = patch(
    spine,
    "sage_tie",
    [
      [-0.027, 0.61],
      [0.028, 0.61],
      [0.048, 0.38],
      [0, 0.32],
      [-0.048, 0.38],
    ],
    0.015,
    sage,
    0.008,
  );
  tie.position.z = 0.315;
  ellipsoid(spine, "tie_knot", [0, 0.625, 0.325], [0.039, 0.037, 0.018], sage);
  const lapelL = patch(
    spine,
    "lapel_left",
    [
      [-0.27, 0.67],
      [-0.12, 0.43],
      [-0.055, 0.31],
      [-0.16, 0.59],
      [-0.13, 0.73],
    ],
    0.014,
    lapel,
  );
  lapelL.position.z = 0.25;
  const lapelR = patch(
    spine,
    "lapel_right",
    [
      [0.27, 0.67],
      [0.12, 0.43],
      [0.055, 0.31],
      [0.16, 0.59],
      [0.13, 0.73],
    ],
    0.014,
    lapel,
  );
  lapelR.position.z = 0.25;
  for (const y of [0.29, 0.18, 0.07])
    ellipsoid(
      spine,
      "brass_button",
      [0, y, 0.294],
      [0.019, 0.019, 0.011],
      brass,
    );
  const pin = new T.Mesh(new T.BoxGeometry(0.11, 0.043, 0.012), brass);
  pin.position.set(0.2, 0.43, 0.267);
  pin.rotation.z = -0.03;
  spine.add(pin);
  for (const side of [-1, 1])
    line(
      spine,
      [
        [side * 0.2, 0.22, 0.257],
        [side * 0.29, 0.2, 0.19],
      ],
      0.007,
      lapel,
    );
  const left = makeForeleg(spine, -1),
    right = makeForeleg(spine, 1);
  const hindLeft = makeHindLeg(root, -1),
    hindRight = makeHindLeg(root, 1);

  const head = group(spine, "neck_and_head", 0, 1.05, 0.025);
  ellipsoid(
    head,
    "head",
    [0, 0, 0],
    [0.56, 0.455, 0.42],
    new T.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.91,
    }),
    headGeometry(),
  );
  addHeadFuzz(head);
  const ears = [makeEar(head, -1), makeEar(head, 1)];
  ellipsoid(
    head,
    "muzzle_left",
    [-0.113, -0.145, 0.362],
    [0.145, 0.091, 0.077],
    white,
  );
  ellipsoid(
    head,
    "muzzle_right",
    [0.113, -0.145, 0.362],
    [0.145, 0.091, 0.077],
    white,
  );
  const eyes: T.Group[] = [],
    brows: T.Group[] = [],
    closedEyes: T.Object3D[] = [];
  for (const side of [-1, 1]) {
    const eye = group(
      head,
      side < 0 ? "eye_left" : "eye_right",
      side * 0.211,
      0.055,
      0.35,
    );
    eye.rotation.y = side * 0.08;
    ellipsoid(
      eye,
      "eye_socket",
      [0, 0, 0],
      [0.128, 0.142, 0.055],
      new T.MeshStandardMaterial({ color: "#654d36", roughness: 0.85 }),
    );
    ellipsoid(
      eye,
      "eye_white",
      [0, -0.002, 0.025],
      [0.118, 0.134, 0.058],
      new T.MeshStandardMaterial({ color: "#efe5cd", roughness: 0.32 }),
    );
    const irisMaterial = new T.MeshStandardMaterial({
      color: "#9d6730",
      roughness: 0.2,
      metalness: 0.12,
    });
    ellipsoid(
      eye,
      "amber_iris",
      [side * -0.007, -0.005, 0.079],
      [0.098, 0.106, 0.024],
      irisMaterial,
    );
    ellipsoid(
      eye,
      "iris_inner",
      [side * -0.007, -0.005, 0.099],
      [0.078, 0.094, 0.014],
      new T.MeshStandardMaterial({ color: "#6d421f", roughness: 0.23 }),
    );
    ellipsoid(
      eye,
      "pupil",
      [side * -0.007, -0.004, 0.111],
      [0.06, 0.073, 0.012],
      new T.MeshStandardMaterial({ color: "#160e0c", roughness: 0.12 }),
    );
    const shine = new T.MeshBasicMaterial({ color: "#fff7e2" });
    ellipsoid(
      eye,
      "catchlight",
      [-0.029, 0.052, 0.128],
      [0.024, 0.033, 0.004],
      shine,
    );
    ellipsoid(
      eye,
      "small_catchlight",
      [0.026, -0.035, 0.126],
      [0.009, 0.012, 0.004],
      shine,
    );
    eyes.push(eye);
    const closed = group(head, "closed_eye", side * 0.211, 0.055, 0.417);
    line(
      closed,
      [
        [-0.11, 0, 0],
        [0, -0.024, 0.015],
        [0.11, 0.015, 0],
      ],
      0.007,
      furLine,
    );
    closed.visible = false;
    closedEyes.push(closed);
    const brow = group(head, "brow", side * 0.215, 0.241, 0.355);
    line(
      brow,
      [
        [-0.085, -0.013, 0],
        [0, 0.022, 0.02],
        [0.085, -0.014, 0],
      ],
      0.011,
      caramel,
    );
    brows.push(brow);
  }
  const nose = patch(
    head,
    "nose",
    [
      [-0.036, -0.132],
      [0.036, -0.132],
      [0, -0.17],
    ],
    0.018,
    pink,
    0.015,
  );
  nose.position.z = 0.435;
  const mouth = ellipsoid(
    head,
    "mouth_inner",
    [0, -0.233, 0.41],
    [0.065, 0.012, 0.019],
    new T.MeshStandardMaterial({ color: "#603a31", roughness: 1 }),
  );
  const tongue = ellipsoid(
    head,
    "tongue",
    [0, -0.25, 0.432],
    [0.041, 0.009, 0.008],
    pink,
  );
  const chin = group(head, "chin", 0, -0.255, 0.34);
  ellipsoid(chin, "white_chin", [0, 0, 0.015], [0.15, 0.062, 0.105], white);
  line(
    head,
    [
      [0, -0.179, 0.477],
      [0, -0.207, 0.48],
      [-0.045, -0.225, 0.46],
      [-0.083, -0.207, 0.44],
    ],
    0.0045,
    furLine,
  );
  line(
    head,
    [
      [0, -0.207, 0.48],
      [0.045, -0.225, 0.46],
      [0.083, -0.207, 0.44],
    ],
    0.0045,
    furLine,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      line(
        head,
        [
          [side * 0.17, -0.14 - i * 0.035, 0.45],
          [side * 0.36, -0.14 - i * 0.045, 0.46],
          [side * 0.58, -0.12 - i * 0.06, 0.43],
        ],
        0.0015,
        new T.MeshStandardMaterial({ color: "#e6d7c4", roughness: 0.7 }),
      );

  const tailRoot = group(root, "tail_base", 0, 0.56, -0.25);
  const tail: T.Bone[] = [];
  let previous: T.Object3D = tailRoot;
  for (let i = 0; i < 11; i++) {
    const bone = new T.Bone();
    bone.name = `tail_${i}`;
    bone.position.y = i ? 0.12 : 0;
    previous.add(bone);
    tail.push(bone);
    previous = bone;
  }
  const tailGeometry = new T.CylinderGeometry(
    0.031,
    0.074,
    1.32,
    12,
    44,
    false,
  );
  tailGeometry.translate(0, 0.66, 0);
  const tailPositions = tailGeometry.getAttribute("position");
  const indices: number[] = [],
    weights: number[] = [],
    tailColors: number[] = [];
  for (let i = 0; i < tailPositions.count; i++) {
    const y = Math.max(0, tailPositions.getY(i));
    const b = Math.min(10, Math.floor(y / 0.12));
    const next = Math.min(10, b + 1);
    const f = Math.min(1, (y - b * 0.12) / 0.12);
    indices.push(b, next, 0, 0);
    weights.push(1 - f, f, 0, 0);
    const color = new T.Color(
      y > 1.08
        ? "#f6e8d2"
        : Math.floor(y * 8) % 3 === 1
          ? "#e7c49a"
          : "#cc955f",
    );
    tailColors.push(color.r, color.g, color.b);
  }
  tailGeometry.setAttribute(
    "skinIndex",
    new T.Uint16BufferAttribute(indices, 4),
  );
  tailGeometry.setAttribute(
    "skinWeight",
    new T.Float32BufferAttribute(weights, 4),
  );
  tailGeometry.setAttribute(
    "color",
    new T.Float32BufferAttribute(tailColors, 3),
  );
  const tailMesh = new T.SkinnedMesh(
    tailGeometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  tailMesh.name = "continuous_tail";
  tailRoot.add(tailMesh);
  root.updateMatrixWorld(true);
  tailMesh.bind(new T.Skeleton(tail));
  tailMesh.castShadow = true;
  const bag = makeBag(left.paw);
  const chip = group(right.paw, "single_chip", 0, -0.06, 0.12);
  const chipMesh = patch(
    chip,
    "chip",
    [
      [-0.047, 0],
      [0.04, 0.018],
      [0.025, 0.085],
      [-0.038, 0.075],
    ],
    0.008,
    new T.MeshStandardMaterial({ color: "#e9bb64", roughness: 0.9 }),
    0.006,
  );
  chipMesh.rotation.x = -0.2;
  const cushion = ellipsoid(
    root,
    "nap_cushion",
    [0, 0.025, -0.03],
    [0.7, 0.1, 0.42],
    new T.MeshStandardMaterial({ color: "#777c64", roughness: 1 }),
  );
  const pawNodes = [
    left.paw.name,
    right.paw.name,
    hindLeft.paw.name,
    hindRight.paw.name,
  ];
  return {
    root,
    spine,
    head,
    ears,
    left,
    right,
    hindLeft,
    hindRight,
    eyes,
    brows,
    closedEyes,
    mouth,
    chin,
    tongue,
    tail,
    bag,
    chip,
    cushion,
    pawNodes,
  };
}

export function applyPose(rig: KittyRig, pose: Pose, clock: number) {
  rig.root.position.set(pose.x, pose.y, pose.z);
  rig.root.rotation.y = pose.yaw;
  rig.root.scale.setScalar(pose.scale);
  rig.spine.rotation.set(pose.lean, 0, pose.roll);
  rig.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
  rig.ears[0].rotation.z = 0.18 + pose.earL;
  rig.ears[1].rotation.z = -0.18 + pose.earR;
  rig.left.upper.rotation.set(pose.armLX, 0, pose.armLZ);
  rig.left.lower.rotation.set(pose.foreLX, 0, pose.foreLZ);
  rig.left.paw.rotation.z = pose.wristL;
  rig.left.paw.rotation.y = pose.bag > 0.05 || pose.armLZ < -1.1 ? 0 : 0.7;
  rig.right.upper.rotation.set(pose.armRX, 0, pose.armRZ);
  rig.right.lower.rotation.set(pose.foreRX, 0, pose.foreRZ);
  rig.right.paw.rotation.z = pose.wristR;
  rig.right.paw.rotation.y = pose.chip > 0.05 ? 0 : -0.7;
  rig.hindLeft.upper.rotation.x = pose.hipL;
  rig.hindRight.upper.rotation.x = pose.hipR;
  rig.hindLeft.lower.rotation.x = pose.kneeL;
  rig.hindRight.lower.rotation.x = pose.kneeR;
  rig.eyes.forEach((eye, i) => {
    eye.scale.y = Math.max(0.015, pose.eyes);
    eye.visible = pose.eyes > 0.08;
    rig.closedEyes[i].visible = pose.eyes < 0.18;
  });
  rig.brows.forEach((brow, i) => {
    brow.position.y = 0.241 + pose.brow * 0.035;
    brow.rotation.z = (i ? -1 : 1) * pose.brow * 0.12;
  });
  rig.mouth.scale.y = 0.012 + pose.jaw * 0.085;
  rig.mouth.position.y = -0.233 - pose.jaw * 0.027;
  rig.chin.position.y = -0.255 - pose.jaw * 0.075;
  rig.tongue.visible = pose.jaw > 0.25;
  rig.tongue.position.y = -0.25 - pose.jaw * 0.045;
  rig.tail.forEach((bone, i) => {
    bone.rotation.set(
      i === 0 ? -1.2 : 0.09 + pose.tail * 0.055,
      i === 0 ? -0.7 : 0,
      i === 0
        ? -0.25
        : -0.12 - pose.tail * 0.14 + Math.sin(clock * 1.2 + i * 0.45) * 0.018,
    );
  });
  rig.bag.visible = pose.bag > 0.03;
  rig.bag.scale.setScalar(Math.max(0.02, pose.bag));
  rig.chip.visible = pose.chip > 0.05;
  rig.chip.scale.setScalar(Math.max(0.02, pose.chip));
  rig.cushion.position.y = 0.025 - pose.y;
  rig.cushion.visible = pose.cushion > 0.05;
  rig.cushion.scale.y = 0.1 * Math.max(0.01, pose.cushion);
}

export function disposeGraph(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  root.traverse((node) => {
    if (node instanceof T.SkinnedMesh) node.skeleton.dispose();
    if (node instanceof T.Mesh) {
      geometries.add(node.geometry);
      for (const m of Array.isArray(node.material)
        ? node.material
        : [node.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
