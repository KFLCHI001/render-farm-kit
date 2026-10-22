// Line-phase fields for the engrave pass (class 16). A surface that needs its lines to curve with
// its form paints a sawtooth into the F buffer: 0 to 255 across each line period, drawn with
// repeating canvas gradients. Linear gives parallel lines (spacing may change along them), arc
// gives concentric lines about a far centre (lines that turn slowly, like a slope), ray gives
// lines that radiate from a point (light, cloak folds). Spacing is in world units. A canvas
// gradient with hundreds of stops silently stops repeating, so a field is laid in bands of at
// most BAND periods, each its own gradient.
export type SpFn = number | ((u: number) => number);
export type Field = { fill: (g: CanvasRenderingContext2D, ch: 'r' | 'g', bx: number, by: number, bw: number, bh: number) => void };

const BAND = 40;

const col = (ch: 'r' | 'g', v: number) => {
  const n = Math.max(0, Math.min(255, Math.round(v)));
  return ch === 'r' ? `rgb(${n},0,0)` : `rgb(0,${n},0)`;
};

const spAt = (sp: SpFn, u: number) => Math.max(1.2, typeof sp === 'number' ? sp : sp(Math.max(0, u)));

// Split [start, len] into bands of whole periods.
const bands = (len: number, sp: SpFn, shift: number): [number, number][] => {
  const out: [number, number][] = [];
  let u = -(((shift % spAt(sp, 0)) + spAt(sp, 0)) % spAt(sp, 0));
  let a = u;
  let n = 0;
  let guard = 0;
  while (u < len && guard++ < 20000) {
    u += spAt(sp, u);
    if (++n === BAND) {
      out.push([a, u]);
      a = u;
      n = 0;
    }
  }
  if (n) out.push([a, u]);
  return out;
};

const stops = (gr: CanvasGradient, ch: 'r' | 'g', a: number, b: number, sp: SpFn) => {
  let u = a;
  while (u < b - 1e-6) {
    const next = Math.min(b, u + spAt(sp, u));
    gr.addColorStop((u - a) / (b - a), col(ch, 0));
    gr.addColorStop((next - a) / (b - a), col(ch, 255));
    if (next < b - 1e-6) gr.addColorStop((next - a) / (b - a), col(ch, 0));
    u = next;
  }
};

// Parallel lines. ang is the line direction in degrees (0 level, 90 upright); the pattern starts at (x, y)
// and runs along the line normal for len.
export const linField = (x: number, y: number, ang: number, sp: SpFn, len: number, shift = 0): Field => ({
  fill: (g, ch) => {
    const a = (ang * Math.PI) / 180;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const R = 5000;
    const op = g.globalCompositeOperation;
    if (ch === 'r') g.globalCompositeOperation = 'source-over';
    const ov = ch === 'r' ? 1.5 : 0;
    for (const [u0, u1] of bands(len, sp, shift)) {
      const p0: [number, number] = [x + nx * u0, y + ny * u0];
      const p1: [number, number] = [x + nx * u1, y + ny * u1];
      const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      stops(gr, ch, u0, u1, sp);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(p0[0] + ny * R, p0[1] - nx * R);
      g.lineTo(p1[0] + nx * ov + ny * R, p1[1] + ny * ov - nx * R);
      g.lineTo(p1[0] + nx * ov - ny * R, p1[1] + ny * ov + nx * R);
      g.lineTo(p0[0] - ny * R, p0[1] + nx * R);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = op;
  },
});

// Concentric lines about (cx, cy), from radius r0 outward for r1 - r0.
export const arcField = (cx: number, cy: number, r0: number, r1: number, sp: SpFn, shift = 0): Field => ({
  fill: (g, ch) => {
    const op = g.globalCompositeOperation;
    if (ch === 'r') g.globalCompositeOperation = 'source-over';
    const ov = ch === 'r' ? 1.5 : 0;
    for (const [u0, u1] of bands(r1 - r0, sp, shift)) {
      const ra = Math.max(0, r0 + u0);
      const rb = r0 + u1;
      const gr = g.createRadialGradient(cx, cy, ra, cx, cy, rb);
      stops(gr, ch, u0 + (ra - (r0 + u0)), u1, sp);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, rb + ov, 0, Math.PI * 2);
      g.arc(cx, cy, ra, 0, Math.PI * 2, true);
      g.fill('evenodd');
    }
    g.globalCompositeOperation = op;
  },
});

// n lines radiating from (cx, cy). a0 is the angle (radians) of the first line.
export const rayField = (cx: number, cy: number, n: number, a0 = 0): Field => ({
  fill: (g, ch, bx, by, bw, bh) => {
    const gr = g.createConicGradient(a0, cx, cy);
    for (let k = 0; k < n; k++) {
      gr.addColorStop(k / n, col(ch, 0));
      gr.addColorStop((k + 1) / n, col(ch, 255));
      if (k < n - 1) gr.addColorStop((k + 1) / n, col(ch, 0));
    }
    g.fillStyle = gr;
    g.fillRect(bx, by, bw, bh);
  },
});
