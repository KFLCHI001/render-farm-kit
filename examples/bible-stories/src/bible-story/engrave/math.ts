// Small shared helpers for the engraving pipeline: seeded noise, splines, polygons.

export type Pt = readonly [number, number];

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hash1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Smooth value noise in -1..1.
export const vnoise = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i + seed * 57.3);
  const b = hash1(i + 1 + seed * 57.3);
  return (a + (b - a) * u) * 2 - 1;
};

export const vnoise2 = (x: number, y: number, seed = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash1(a * 1.0 + b * 57.0 + seed * 131.7);
  const top = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
  const bot = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
  return (top + (bot - top) * v) * 2 - 1;
};

export const interp = (pts: readonly Pt[], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts[pts.length - 1][1];
};

// Catmull-Rom through the points.
export const spline = (pts: readonly Pt[], closed: boolean, per = 8): Pt[] => {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
};

export const resample = (pts: readonly Pt[], step: number, closed = false): Pt[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Pt[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1];
    const [bx, by] = src[i];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= seg) {
      out.push([ax + ((bx - ax) * d) / seg, ay + ((by - ay) * d) / seg]);
      d += step;
    }
    carry = seg - (d - step);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
};

// A hand-cut edge: the outline pushed in and out along its normal by a pre-cut noise.
export const wobblePoly = (pts: readonly Pt[], amp: number, seed: number, step = 5, closed = true): Pt[] => {
  const d = resample(pts, step, closed);
  const n = d.length;
  return d.map((p, i) => {
    const a = d[closed ? (i + n - 1) % n : Math.max(0, i - 1)];
    const b = d[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const k = amp * (vnoise(i * 0.37, seed) * 0.7 + vnoise(i * 1.31, seed + 3) * 0.3);
    return [p[0] - (ty / len) * k, p[1] + (tx / len) * k] as Pt;
  });
};

// Signed distance to a closed polygon, positive inside.
export const sdPoly = (pts: readonly Pt[]) => {
  const n = pts.length;
  return (x: number, y: number) => {
    let inside = false;
    let best = 1e9;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      const dx = xj - xi;
      const dy = yj - yi;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / l2));
      const d = Math.hypot(x - (xi + t * dx), y - (yi + t * dy));
      if (d < best) best = d;
    }
    return inside ? best : -best;
  };
};

export const polyPath2D = (pts: readonly Pt[], closed = true) => {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
};

export const polyPaths2D = (list: readonly (readonly Pt[])[]) => {
  const p = new Path2D();
  for (const pts of list) p.addPath(polyPath2D(pts));
  return p;
};
