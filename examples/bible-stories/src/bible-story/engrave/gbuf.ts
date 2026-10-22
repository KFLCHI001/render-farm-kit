/*
 * Ported from styles/magic-lantern/gbuf.js in the artstyles repository (the scene painter),
 * rewritten in TypeScript. A scene draws once per frame into a set of canvases; the engrave
 * pass turns them into ink. The figure ray-marcher and the face marks are not ported.
 *   T   tone: grey, 1 = no lines, 0 = full density (the buffers are drawn as density 0..1)
 *   Lt  light: grey, multiplies T (pools of lamplight and fire laid over everything)
 *   Hh  hatch: R = line angle (0..180 deg), G = cross-line angle, B = line class
 *       (0 flat, 1..15 line spacing fine to coarse, 16 = the line phases in F, with R = line weight, G = cross strength)
 *   F   line phases, a sawtooth per line period (see fields.ts), R main lines, G cross lines
 *   C   tint (the plate of colour), rgba
 *   O   outline ink, alpha
 * Scenes are drawn in world units; the painter maps them to the frame with the camera.
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
import type { Field } from './fields';
import { clamp, polyPaths2D } from './math';
import type { Pt } from './math';

export const HC = { none: 0, fine: 3, mid: 5, norm: 8, coarse: 11, field: 16 } as const;

export type Cam = { s: number; tx: number; ty: number };
export type Shape = Path2D | readonly Pt[] | readonly (readonly Pt[])[];
// A density (0 none, 1 solid), or a gradient of densities.
export type Tone = number | { lin: readonly [number, number, number, number]; st: readonly (readonly [number, number])[] } | { rad: readonly [number, number, number, number, number, number]; st: readonly (readonly [number, number])[] };

export type ShapeOpts = {
  dens?: Tone;
  hatch?: readonly [number, number | null, number] | null;
  field?: Field;
  cross?: Field;
  ws?: number;
  cx?: number;
  tint?: string;
  out?: number;
  outA?: number;
  over?: boolean;
  rule?: CanvasFillRule;
};

const NAMES = ['T', 'Lt', 'Hh', 'F', 'C', 'O'] as const;
type Name = (typeof NAMES)[number];

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const grey = (v: number) => {
  const c = Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${c},${c},${c})`;
};
const enc = (a: number) => Math.round(((((a % 180) + 180) % 180) / 180) * 255);

export class GB {
  readonly T: HTMLCanvasElement;
  readonly Lt: HTMLCanvasElement;
  readonly Hh: HTMLCanvasElement;
  readonly F: HTMLCanvasElement;
  readonly C: HTMLCanvasElement;
  readonly O: HTMLCanvasElement;
  cam: Cam = { s: 1, tx: 0, ty: 0 };

  constructor(readonly w: number, readonly h: number) {
    this.T = mk(w, h);
    this.Lt = mk(w, h);
    this.Hh = mk(w, h);
    this.F = mk(w, h);
    this.C = mk(w, h);
    this.O = mk(w, h);
  }

  // Clear every buffer and set the camera. Tone and light start at 1 (no lines, full light).
  begin(cam: Cam) {
    this.cam = cam;
    for (const n of NAMES) {
      const g = this[n].getContext('2d');
      if (!g) throw new Error('no 2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, this.w, this.h);
      if (n === 'T' || n === 'Lt') {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, this.w, this.h);
      } else if (n === 'Hh' || n === 'F') {
        g.fillStyle = '#000';
        g.fillRect(0, 0, this.w, this.h);
      }
    }
  }

  g(n: Name) {
    const g = this[n].getContext('2d');
    if (!g) throw new Error('no 2d');
    g.setTransform(this.cam.s, 0, 0, this.cam.s, this.cam.tx, this.cam.ty);
    return g;
  }

  static hatch(a1 = 0, a2: number | null = null, cls: number = HC.norm) {
    const b = a2 === null ? a1 + 62 : a2;
    return `rgb(${enc(a1)},${enc(b)},${cls})`;
  }

  private toneStyle(g: CanvasRenderingContext2D, t: Tone) {
    if (typeof t === 'number') return grey(1 - t);
    const gr = 'lin' in t ? g.createLinearGradient(...t.lin) : g.createRadialGradient(...t.rad);
    for (const [s, v] of t.st) gr.addColorStop(clamp(s, 0, 1), grey(1 - v));
    return gr;
  }

  path(shape: Shape): Path2D {
    if (shape instanceof Path2D) return shape;
    const list = Array.isArray(shape[0][0]) ? (shape as readonly (readonly Pt[])[]) : [shape as readonly Pt[]];
    return polyPaths2D(list);
  }

  // Fill a shape. An opaque shape (one with dens) hides the lines, tint and outlines of what is behind it; over keeps them.
  shape(shape: Shape, o: ShapeOpts = {}) {
    const p = this.path(shape);
    const rule = o.rule ?? 'nonzero';
    if (o.dens !== undefined) {
      const g = this.g('T');
      g.fillStyle = this.toneStyle(g, o.dens);
      g.fill(p, rule);
    }
    if (o.field) {
      const g = this.g('F');
      const bx = -this.cam.tx / this.cam.s - 120;
      const by = -this.cam.ty / this.cam.s - 120;
      const bw = this.w / this.cam.s + 240;
      const bh = this.h / this.cam.s + 240;
      g.save();
      g.clip(p, rule);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.fillRect(bx, by, bw, bh);
      g.globalCompositeOperation = 'lighter';
      o.field.fill(g, 'r', bx, by, bw, bh);
      if (o.cross) o.cross.fill(g, 'g', bx, by, bw, bh);
      g.restore();
      const h = this.g('Hh');
      h.fillStyle = `rgb(${Math.round(clamp((o.ws ?? 1) - 0.5, 0, 1) * 255)},${Math.round(clamp(o.cx ?? (o.cross ? 1 : 0), 0, 1) * 255)},${HC.field})`;
      h.fill(p, rule);
    } else if (o.hatch !== null && o.dens !== undefined) {
      const g = this.g('Hh');
      const hh = o.hatch ?? [0, null, HC.none];
      g.fillStyle = GB.hatch(hh[0], hh[1], hh[2]);
      g.fill(p, rule);
    }
    if (!o.over && o.dens !== undefined) {
      for (const n of ['O', 'C'] as const) {
        const g = this.g(n);
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.fill(p, rule);
        g.restore();
      }
    }
    if (o.tint) {
      const g = this.g('C');
      g.fillStyle = o.tint;
      g.fill(p, rule);
    }
    if (o.out) this.stroke(p, o.out, o.outA ?? 1);
    return p;
  }

  // Ink lines (width in world units) into the outline buffer.
  stroke(shape: Path2D | readonly Pt[], w: number, a = 1) {
    const g = this.g('O');
    g.save();
    g.strokeStyle = `rgba(0,0,0,${a})`;
    g.lineWidth = w;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (shape instanceof Path2D) g.stroke(shape);
    else {
      g.beginPath();
      g.moveTo(shape[0][0], shape[0][1]);
      for (let i = 1; i < shape.length; i++) g.lineTo(shape[i][0], shape[i][1]);
      g.stroke();
    }
    g.restore();
  }

  // Filled ink polygons (tapered strokes) into the outline buffer.
  ink(polys: readonly (readonly Pt[])[] | Path2D, a = 1) {
    const g = this.g('O');
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.fill(polys instanceof Path2D ? polys : polyPaths2D(polys));
  }

  // A solid mark: full density, no lines. Carved clear in the dusk print, inked in the light print.
  mark(polys: readonly (readonly Pt[])[] | Path2D, o: { tint?: string } = {}) {
    const p = polys instanceof Path2D ? polys : polyPaths2D(polys);
    const t = this.g('T');
    t.fillStyle = '#000';
    t.fill(p);
    const h = this.g('Hh');
    h.fillStyle = GB.hatch(0, null, HC.none);
    h.fill(p);
    if (o.tint) {
      const c = this.g('C');
      c.fillStyle = o.tint;
      c.fill(p);
    }
  }

  // The same mark, in frame coordinates (wind streaks, the roller).
  markScreen(polys: readonly (readonly Pt[])[], o: { tint?: string } = {}) {
    const p = polyPaths2D(polys);
    for (const n of ['T', 'Hh', 'C'] as const) {
      if (n === 'C' && !o.tint) continue;
      const g = this[n].getContext('2d');
      if (!g) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = n === 'T' ? '#000' : n === 'Hh' ? GB.hatch(0, null, HC.none) : (o.tint as string);
      g.fill(p);
    }
  }

  // Multiply a pool of light into Lt: v0 at the centre, v1 at radius r. Below 1 means denser lines.
  pool(x: number, y: number, r: number, v0: number, v1 = 1, sy = 1) {
    const g = this.g('Lt');
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.translate(x, y);
    g.scale(1, sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, grey(v0));
    gr.addColorStop(1, grey(v1));
    g.fillStyle = gr;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  // The same, clipped to a shape.
  poolIn(shape: Shape, x: number, y: number, r: number, v0: number, v1 = 1, sy = 1) {
    const g = this.g('Lt');
    g.save();
    g.clip(this.path(shape));
    this.pool(x, y, r, v0, v1, sy);
    g.restore();
  }

  // Tint wash with a soft radial fall-off (color is a #rrggbb string).
  tintGlow(x: number, y: number, r: number, color: string, a: number, sy = 1) {
    const g = this.g('C');
    g.save();
    g.translate(x, y);
    g.scale(1, sy);
    const n = parseInt(color.slice(1), 16);
    const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  pushClip(shape: Shape) {
    const p = this.path(shape);
    for (const n of NAMES) {
      const g = this.g(n);
      g.save();
      g.clip(p);
    }
  }

  popClip() {
    for (const n of NAMES) this[n].getContext('2d')?.restore();
  }
}
