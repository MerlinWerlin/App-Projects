// Tiny drawing helpers used to author the bundled template line art as SVG path data.
// Everything here emits ABSOLUTE commands only (M L C Q A Z) so paths are easy to validate and transform.

export type P = readonly [number, number];

/** Format a coordinate: one decimal, no trailing ".0", no "-0". */
export function f(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

/** Polyline / polygon through points. */
export function poly(points: readonly P[], closed = true): string {
  const [first, ...rest] = points;
  let d = `M ${f(first[0])} ${f(first[1])}`;
  for (const [x, y] of rest) d += ` L ${f(x)} ${f(y)}`;
  return closed ? `${d} Z` : d;
}

export function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} ` +
    `A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`
  );
}

export function circle(cx: number, cy: number, r: number): string {
  return ellipse(cx, cy, r, r);
}

/** Rounded rectangle. */
export function rrect(x: number, y: number, w: number, h: number, r: number): string {
  const a = `A ${f(r)} ${f(r)} 0 0 1`;
  return (
    `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} ${a} ${f(x + w)} ${f(y + r)} ` +
    `L ${f(x + w)} ${f(y + h - r)} ${a} ${f(x + w - r)} ${f(y + h)} ` +
    `L ${f(x + r)} ${f(y + h)} ${a} ${f(x)} ${f(y + h - r)} ` +
    `L ${f(x)} ${f(y + r)} ${a} ${f(x + r)} ${f(y)} Z`
  );
}

/**
 * Spiral made of half-circle arcs with growing radius (step, 2·step, 3·step, …).
 * Centres alternate between (cx + step, cy) and (cx, cy); outer radius = halfTurns · step.
 */
export function spiral(cx: number, cy: number, step: number, halfTurns: number): string {
  let x = cx;
  let d = `M ${f(cx)} ${f(cy)}`;
  for (let k = 1; k <= halfTurns; k++) {
    const r = k * step;
    x = k % 2 === 1 ? x + 2 * r : x - 2 * r;
    d += ` A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(cy)}`;
  }
  return d;
}

/** Point at distance r and angle deg (0° = up, clockwise) from (cx, cy). */
export function polar(cx: number, cy: number, r: number, deg: number): P {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Regular polygon (or star when inner radius given) centred on (cx, cy), first vertex straight up. */
export function ngon(cx: number, cy: number, r: number, sides: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < sides; i++) pts.push(polar(cx, cy, r, rot + (360 * i) / sides));
  return poly(pts);
}

export function star(cx: number, cy: number, outer: number, inner: number, points: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < points * 2; i++) {
    pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / points));
  }
  return poly(pts);
}

/**
 * Almond petal / leaf from base (bx, by) pointing at angle deg (0° = up) with length len and half-width w.
 * `round` 0..1 moves the widest point toward the tip.
 */
export function petal(bx: number, by: number, deg: number, len: number, w: number, round = 0.5): string {
  const a = (deg * Math.PI) / 180;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const px = -uy; // perpendicular
  const py = ux;
  const at = (t: number, s: number): string => `${f(bx + ux * len * t + px * s)} ${f(by + uy * len * t + py * s)}`;
  const t1 = 0.15 + 0.3 * round;
  const t2 = 0.55 + 0.35 * round;
  return (
    `M ${at(0, 0)} C ${at(t1, w * 1.3)} ${at(t2, w * 1.3)} ${at(1, 0)} ` +
    `C ${at(t2, -w * 1.3)} ${at(t1, -w * 1.3)} ${at(0, 0)} Z`
  );
}

/** Leaf = petal + a midrib line. */
export function leaf(bx: number, by: number, deg: number, len: number, w: number): string {
  const tip = polar(bx, by, len * 0.85, deg);
  return `${petal(bx, by, deg, len, w, 0.35)} M ${f(bx)} ${f(by)} L ${f(tip[0])} ${f(tip[1])}`;
}

/** Evaluate a cubic Bézier at t. */
export function bez(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

// ---- path transforms -------------------------------------------------------------------------

const ARGS: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };

type Similarity = { map: (x: number, y: number) => P; scale: number; rotate: number; flip: boolean };

/** Apply a similarity transform (rotate/scale/translate/mirror) to an absolute-command path. */
export function mapPath(d: string, t: Similarity): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/[A-Za-z]/.test(tok)) {
      if (!(tok in ARGS)) throw new Error(`mapPath: unsupported command ${tok}`);
      cmd = tok;
      out.push(cmd);
      i++;
      if (cmd === 'Z') continue;
    }
    const n = ARGS[cmd];
    const v = tokens.slice(i, i + n).map(Number);
    i += n;
    if (cmd === 'A') {
      const [x, y] = t.map(v[5], v[6]);
      const phi = t.flip ? -v[2] + t.rotate : v[2] + t.rotate;
      const sweep = t.flip ? 1 - v[4] : v[4];
      out.push(f(v[0] * t.scale), f(v[1] * t.scale), f(phi), String(v[3]), String(sweep), f(x), f(y));
    } else {
      for (let k = 0; k < n; k += 2) {
        const [x, y] = t.map(v[k], v[k + 1]);
        out.push(f(x), f(y));
      }
    }
  }
  return out.join(' ');
}

export function shift(d: string, dx: number, dy: number): string {
  return mapPath(d, { map: (x, y) => [x + dx, y + dy], scale: 1, rotate: 0, flip: false });
}

/** Rotate clockwise (screen coordinates) by deg about (cx, cy). */
export function rotate(d: string, deg: number, cx: number, cy: number): string {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return mapPath(d, {
    map: (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c],
    scale: 1,
    rotate: deg,
    flip: false,
  });
}

/** Mirror across the vertical line x = axis. */
export function mirrorX(d: string, axis: number): string {
  return mapPath(d, { map: (x, y) => [2 * axis - x, y], scale: 1, rotate: 0, flip: true });
}

/** Repeat a motif n times around (cx, cy) and join into one path. */
export function ring(d: string, n: number, cx: number, cy: number, offset = 0): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(rotate(d, offset + (360 * i) / n, cx, cy));
  return parts.join(' ');
}
