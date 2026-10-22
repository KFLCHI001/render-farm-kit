/*
 * Ported from styles/linocut/lino.js in the artstyles repository (gouge strokes, carved sky,
 * ground and ray cuts), rewritten in TypeScript.
 *
 * MIT License
 *
 * Copyright (c) 2026 Miranda Dixon-Luinenburg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { lerp, rng, vnoise } from './math';
import type { Pt } from './math';

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const chaikin = (pts: readonly Pt[], iter = 2, closed = true): Pt[] => {
  let p: Pt[] = pts.slice();
  for (let k = 0; k < iter; k++) {
    const out: Pt[] = [];
    const n = p.length;
    const m = closed ? n : n - 1;
    if (!closed) out.push(p[0]);
    for (let i = 0; i < m; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(p[n - 1]);
    p = out;
  }
  return p;
};

const resampleOpen = (pts: readonly Pt[], d: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const k = Math.max(1, Math.round(dist(a, b) / d));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// A band around a centre line whose width follows wfn(0..1 along the line).
export const strokePoly = (pts: readonly Pt[], wfn: (u: number) => number): Pt[] => {
  const n = pts.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
  const tot = cum[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const w = wfn(cum[i] / tot) / 2;
    L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
    R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  return [...L, ...R.reverse()];
};

// A V-cut tapers to a point at both ends.
export const gouge = (w: number, sharp = 0.35) => (u: number) => w * Math.pow(Math.max(0, Math.sin(Math.PI * u)), sharp);

// Short lines need points along them, or the taper has nothing to work with.
const densify = (pts: readonly Pt[], n = 9): Pt[] => {
  if (pts.length >= n) return pts.slice();
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L > 0 ? resampleOpen(pts, Math.max(0.4, L / n)) : pts.slice();
};

export const cutLine = (pts: readonly Pt[], w: number, sharp = 0.35): Pt[] => strokePoly(densify(pts), gouge(w, sharp));

// A line that starts and ends with a blunt tip, for ink marks.
export const inkLine = (pts: readonly Pt[], w: number): Pt[] => strokePoly(densify(pts), (u) => w * Math.min(1, u * 14 + 0.3, (1 - u) * 14 + 0.3));

// A carved night sky: horizontal cuts, closer and wider toward the horizon (lighter there).
export const skyCuts = (x0: number, x1: number, y0: number, hz: number, seed: number, dens = 1): Pt[][] => {
  const out: Pt[][] = [];
  const R = rng(seed);
  for (let y = y0 + 12; y < hz - 2; ) {
    const k = (y - y0) / (hz - y0);
    const sp = lerp(24, 6.4, Math.pow(k, 1.25)) / dens;
    const w = lerp(0.9, 5.2, Math.pow(k, 1.9));
    let x = x0 - 20 + 40 * R();
    while (x < x1) {
      const len = lerp(120, 520, R()) * (1 + k);
      const gap = lerp(40, 8, k) * (0.5 + R());
      const pts: Pt[] = [];
      for (let s = 0; s <= len; s += 12) pts.push([x + s, y + 1.6 * Math.sin((x + s) * 0.006 + y) + vnoise((x + s) * 0.01, y) * 1.2]);
      if (pts.length > 2) out.push(cutLine(pts, w * (0.7 + 0.5 * R()), 0.35));
      x += len + gap;
    }
    y += sp;
  }
  return out;
};

// Radiating cuts for light around a point, inside an angular range.
export const rayCuts = (cx: number, cy: number, r0: number, r1: number, n: number, w: number, seed: number, a0 = 0, a1 = Math.PI * 2, sy = 1): Pt[][] => {
  const out: Pt[][] = [];
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, R());
    const rr0 = r0 * (0.8 + 0.4 * R());
    const rr1 = lerp(r0, r1, 0.4 + 0.6 * R());
    out.push(cutLine([[cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0 * sy], [cx + Math.cos(a) * rr1, cy + Math.sin(a) * rr1 * sy]], w * (0.6 + 0.6 * R()), 0.6));
  }
  return out;
};

// Wavy horizontal cuts across a region; wider where light(x, y) is high.
export const groundCuts = (inside: (x: number, y: number) => boolean, box: readonly [number, number, number, number], seed: number, light: (x: number, y: number) => number = () => 0, o: { sp0?: number; sp1?: number } = {}): Pt[][] => {
  const out: Pt[][] = [];
  const R = rng(seed);
  const [x0, y0, x1, y1] = box;
  for (let y = y0 + 6; y < y1; ) {
    const k = (y - y0) / Math.max(1, y1 - y0);
    const sp = lerp(o.sp0 ?? 7, o.sp1 ?? 15, k);
    let x = x0 - 40 * R();
    while (x < x1) {
      const len = 40 + 180 * R();
      const pts: Pt[] = [];
      for (let s = 0; s <= len; s += 10) {
        const px = x + s;
        const py = y + 2.4 * Math.sin(px * 0.011 + y * 0.3);
        if (inside(px, py)) pts.push([px, py]);
        else if (pts.length) break;
      }
      const mx = x + len / 2;
      const L = light(mx, y);
      const w = (1.1 + 1.6 * R()) * (1 - k * 0.4) + 5.5 * L;
      if (pts.length > 2 && R() < 0.78 + L) out.push(cutLine(pts, w, 0.4));
      x += len + 14 + 40 * R() * (1 - L);
    }
    y += sp;
  }
  return out;
};
