import type { ReactNode } from 'react';
import { clamp01, rng } from '../world';
import { NoiseHold, sheet } from '../noise';
import { INK } from '../paper/paper';
import type { Pt } from '../paper/paper';

// Ink on parchment toolkit (lane B, after BibleProject). Sepia line art that draws
// itself on with pathLength stroke dashes, flat washes that bleed in under the lines,
// and a few hand-drawn path helpers. The parchment, vignette, camera and boil seed
// come from the paper toolkit; this file only adds what the ink lane needs.
export { INK };

export const AMBER = '#d98a2b'; // the lamp: light, faith and Daniel
export const INDIGO = '#2b2433'; // night wash, used at low opacity
export const ROSE = '#d9a38f'; // dawn wash
export const SHADE = '#6b5646'; // warm grey-brown wash for shadow
export const PARCH_LT = '#efe0b8'; // lighter parchment: white hair, scroll paper, lines on dark
export const WAX = '#5a2a1c'; // dark red-brown seal wax

const r1 = (n: number) => Math.round(n * 10) / 10;

// A drawing stroke starts fast and settles.
export const draw = (u: number) => 1 - Math.pow(1 - clamp01(u), 2.2);

// Stepped flicker for lamps (changes about 10 times a second).
export const flick = (f: number, seed = 1) => 0.62 + 0.38 * rng(Math.floor(f / 3) * 13 + seed)();

const hashOf = (s: string) => {
  let h = 7;
  for (let i = 0; i < Math.min(s.length, 48); i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h / 997;
};

/* ---------- hand-drawn path helpers (static seeds, so the line never jitters) ---------- */

// A smooth open or closed curve through jittered points.
export const wob = (pts: readonly Pt[], seed: number, amp = 2, closed = false): string => {
  const r = rng(seed);
  const p = pts.map((q): Pt => [q[0] + (r() - 0.5) * 2 * amp, q[1] + (r() - 0.5) * 2 * amp]);
  const n = p.length;
  const at = (i: number) => (closed ? p[((i % n) + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${r1(p[0][0])} ${r1(p[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = at(i - 1);
    const b = at(i);
    const c = at(i + 1);
    const e = at(i + 2);
    d += ` C ${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${r1(c[0])} ${r1(c[1])}`;
  }
  return closed ? `${d} Z` : d;
};

// Straight strokes with a slight bow, for walls, boxes and stairs.
export const poly = (pts: readonly Pt[], seed: number, amp = 1.6, closed = false): string => {
  const r = rng(seed);
  const p = pts.map((q): Pt => [q[0] + (r() - 0.5) * amp, q[1] + (r() - 0.5) * amp]);
  const n = p.length;
  let d = `M ${r1(p[0][0])} ${r1(p[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * amp * 2;
    const my = (a[1] + b[1]) / 2 + (r() - 0.5) * amp * 2;
    d += ` Q ${r1(mx)} ${r1(my)} ${r1(b[0])} ${r1(b[1])}`;
  }
  return closed ? `${d} Z` : d;
};

export const box = (x: number, y: number, w: number, h: number, seed: number, amp = 1.6) =>
  poly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    seed,
    amp,
    true,
  );

export const ell = (cx: number, cy: number, rx: number, ry: number, seed: number, amp = 1.5) =>
  wob(
    Array.from({ length: 8 }, (_, i): Pt => [cx + Math.cos((i / 8) * Math.PI * 2) * rx, cy + Math.sin((i / 8) * Math.PI * 2) * ry]),
    seed,
    amp,
    true,
  );

export const seg = (x1: number, y1: number, x2: number, y2: number, seed: number, amp = 1.4) => poly([[x1, y1], [x2, y2]], seed, amp);

/* ---------- defs ---------- */

export const InkDefs = ({ boil }: { boil: number }) => (
  <defs>
    <NoiseHold names={['inkEdge', 'inkBleed']} />
    {/* the whole drawing wobbles a little, redrawn 8 times a second */}
    <filter id="inkBoil" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920} colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves={2} seed={boil} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={6} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    {/* a wash: soft, turbulent edge; the noise (feTurbulence, seed 9, 0.028) is fixed so it never crawls, and baked in public/noise */}
    <filter id="inkEdge" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feImage href={sheet('inkEdge').href} x={sheet('inkEdge').x} y={sheet('inkEdge').y} width={sheet('inkEdge').w} height={sheet('inkEdge').h} preserveAspectRatio="none" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={16} xChannelSelector="R" yChannelSelector="G" result="d" />
      <feGaussianBlur in="d" stdDeviation={3.2} />
    </filter>
    {/* the ink bleed between scenes: big ragged blobs (noise: feTurbulence, seed 17, 0.012, baked in public/noise) */}
    <filter id="inkBleed" filterUnits="userSpaceOnUse" x={-200} y={-200} width={1480} height={2320} colorInterpolationFilters="sRGB">
      <feImage href={sheet('inkBleed').href} x={sheet('inkBleed').x} y={sheet('inkBleed').y} width={sheet('inkBleed').w} height={sheet('inkBleed').h} preserveAspectRatio="none" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={90} xChannelSelector="R" yChannelSelector="G" result="d" />
      <feGaussianBlur in="d" stdDeviation={6} />
    </filter>
    <filter id="inkSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={14} />
    </filter>
    <radialGradient id="amberGlow">
      <stop offset="0" stopColor={AMBER} stopOpacity={0.85} />
      <stop offset="0.45" stopColor={AMBER} stopOpacity={0.32} />
      <stop offset="1" stopColor={AMBER} stopOpacity={0} />
    </radialGradient>
    <linearGradient id="toneTop" x1={0} y1={0} x2={0} y2={1}>
      <stop offset="0" stopColor={INK} stopOpacity={0.62} />
      <stop offset="0.55" stopColor={INK} stopOpacity={0} />
    </linearGradient>
    <linearGradient id="toneBot" x1={0} y1={0} x2={0} y2={1}>
      <stop offset="0.4" stopColor={INK} stopOpacity={0} />
      <stop offset="1" stopColor={INK} stopOpacity={0.7} />
    </linearGradient>
    <linearGradient id="toneL" x1={0} y1={0} x2={1} y2={0}>
      <stop offset="0" stopColor={INK} stopOpacity={0.6} />
      <stop offset="0.5" stopColor={INK} stopOpacity={0} />
    </linearGradient>
    <linearGradient id="toneR" x1={0} y1={0} x2={1} y2={0}>
      <stop offset="0.5" stopColor={INK} stopOpacity={0} />
      <stop offset="1" stopColor={INK} stopOpacity={0.6} />
    </linearGradient>
    <radialGradient id="closeVig" gradientUnits="userSpaceOnUse" cx={540} cy={1230} r={820}>
      <stop offset="0.25" stopColor={INK} stopOpacity={0} />
      <stop offset="1" stopColor={INK} stopOpacity={0.95} />
    </radialGradient>
  </defs>
);

/* ---------- drawn-on marks ---------- */

type InkProps = {
  d: string;
  f: number;
  at?: number;
  dur?: number;
  w?: number;
  col?: string;
  op?: number;
  wash?: string;
  washOp?: number;
  // Overrides the drawn amount (0 to 1), for un-drawing or a driven reveal.
  p?: number;
  // A crisp wash skips the turbulent edge filter (cheaper; for small shapes).
  crisp?: boolean;
};

// One line. It draws itself in with pathLength 1 and a dash offset; a wash then
// bleeds in under it over about 10 frames.
export const Ink = ({ d, f, at = 0, dur = 20, w = 5, col = INK, op = 1, wash, washOp = 0.3, p, crisp = false }: InkProps) => {
  const u = p ?? draw((f - at) / dur);
  if (u <= 0.002) return null;
  const wu = p === undefined ? clamp01((f - (at + dur * 0.55)) / 10) : clamp01((u - 0.55) / 0.3);
  const wv = r1(w * (0.82 + 0.36 * hashOf(d)));
  return (
    <g>
      {wash && wu > 0 ? <path d={d} fill={wash} stroke="none" opacity={washOp * wu} filter="url(#inkEdge)" /> : null}
      <path
        d={d}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={r1((1 - u) * 1000) / 1000}
        fill="none"
        stroke={col}
        strokeWidth={wv}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={op}
      />
    </g>
  );
};

// A flat wash with no line (a room's shadow, a pool of light).
export const Wash = ({ d, f, at = 0, fill, op = 0.3, over = 10 }: { d: string; f: number; at?: number; fill: string; op?: number; over?: number }) => {
  const u = clamp01((f - at) / over);
  if (u <= 0) return null;
  return <path d={d} fill={fill} stroke="none" opacity={op * u} filter="url(#inkEdge)" />;
};

// A limb or finger as an outlined capsule: an ink stroke with a lighter core.
export const Limb = ({ d, f, at = 0, dur = 18, w = 22, core = PARCH_LT, col = INK, op = 1 }: { d: string; f: number; at?: number; dur?: number; w?: number; core?: string; col?: string; op?: number }) => {
  const u = draw((f - at) / dur);
  if (u <= 0.002) return null;
  const off = r1((1 - u) * 1000) / 1000;
  const common = { d, pathLength: 1, strokeDasharray: 1, strokeDashoffset: off, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, opacity: op };
  return (
    <g>
      <path {...common} stroke={col} strokeWidth={w + 8} />
      <path {...common} stroke={core} strokeWidth={w} />
    </g>
  );
};

// Parallel hatching clipped to a shape, each line drawing on in turn. Heavy hatching
// is how the den and the stone are shaded.
export const Hatch = ({
  id,
  clip,
  area,
  gap = 14,
  ang = 45,
  f,
  at = 0,
  dur = 30,
  w = 3,
  col = INK,
  op = 0.8,
  seed = 1,
  rule,
}: {
  rule?: 'evenodd';
  id: string;
  clip: string;
  area: readonly [number, number, number, number];
  gap?: number;
  ang?: number;
  f: number;
  at?: number;
  dur?: number;
  w?: number;
  col?: string;
  op?: number;
  seed?: number;
}) => {
  if (f < at) return null;
  const [x, y, bw, bh] = area;
  const cx = x + bw / 2;
  const cy = y + bh / 2;
  const L = Math.hypot(bw, bh);
  const a = (ang * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const n = Math.ceil(L / gap);
  const r = rng(seed);
  const lines: ReactNode[] = [];
  for (let i = -n / 2; i < n / 2; i++) {
    const o = i * gap + (r() - 0.5) * gap * 0.35;
    const bx = cx - dy * o;
    const by = cy + dx * o;
    const jx = (r() - 0.5) * 10;
    const d = `M ${r1(bx - (dx * L) / 2 + jx)} ${r1(by - (dy * L) / 2)} L ${r1(bx + (dx * L) / 2 - jx)} ${r1(by + (dy * L) / 2)}`;
    lines.push(<Ink key={i} d={d} f={f} at={at + ((i + n / 2) / n) * dur * 0.6} dur={dur * 0.4} w={w} col={col} op={op * (0.55 + 0.45 * r())} />);
  }
  return (
    <g>
      <clipPath id={id}>
        <path d={clip} clipRule={rule} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{lines}</g>
    </g>
  );
};

// A sharp ink splat: a blot and flung droplets that appear in 3 frames.
export const Splat = ({ x, y, r, f, at, col = INK, seed = 3, op = 0.85 }: { x: number; y: number; r: number; f: number; at: number; col?: string; seed?: number; op?: number }) => {
  const k = f - at;
  if (k < 0) return null;
  const g = clamp01(k / 3);
  const rr = rng(seed);
  const blot = wob(
    Array.from({ length: 9 }, (_, i): Pt => {
      const a = (i / 9) * Math.PI * 2;
      const q = r * g * (0.78 + rr() * 0.5);
      return [x + Math.cos(a) * q, y + Math.sin(a) * q];
    }),
    seed + 1,
    r * 0.05,
    true,
  );
  const drops = Array.from({ length: 12 }, (_, i) => {
    const a = rr() * Math.PI * 2;
    const dist = r * (1.25 + rr() * 1.9) * g;
    return <circle key={i} cx={r1(x + Math.cos(a) * dist)} cy={r1(y + Math.sin(a) * dist)} r={r1(r * (0.05 + rr() * 0.13) * g)} fill={col} />;
  });
  return (
    <g opacity={op}>
      <path d={blot} fill={col} />
      {drops}
    </g>
  );
};

// A soft pool of amber light.
export const Glow = ({ x, y, r, op = 1 }: { x: number; y: number; r: number; op?: number }) => <circle cx={r1(x)} cy={r1(y)} r={r1(r)} fill="url(#amberGlow)" opacity={op} />;

// Slow dust motes drifting up through a shaft of light.
export const Motes = ({ f, x0, x1, y0, y1, n = 14, seed = 5, op = 0.7 }: { f: number; x0: number; x1: number; y0: number; y1: number; n?: number; seed?: number; op?: number }) => {
  const r = rng(seed);
  const H = y1 - y0;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const bx = x0 + (x1 - x0) * r();
        const ph = r();
        const sp = 0.25 + r() * 0.4;
        const sz = 2 + r() * 3.2;
        const y = y1 - ((f * sp + ph * H) % H);
        const fade = Math.sin(((y1 - y) / H) * Math.PI);
        return <circle key={i} cx={r1(bx + Math.sin(f / 38 + i) * 14)} cy={r1(y)} r={r1(sz)} fill={AMBER} opacity={op * fade * 0.8} />;
      })}
    </g>
  );
};

// A decaying camera jolt for sharp events (the stone, the signet).
export const shake = (f: number, at: number, amp: number): Pt => {
  const k = f - at;
  if (k < 0 || k > 12) return [0, 0];
  const e = Math.exp(-k / 3.2);
  return [Math.sin(k * 2.9) * amp * e, Math.cos(k * 3.7) * amp * e * 0.8];
};

/* ---------- drawn figures: hands, a round stone, rope, lions ---------- */

export const bbox = (pts: readonly Pt[]): [number, number, number, number] => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
};

// A finger or thumb: a tapering outline around a bent centre line. Angle 0 points up,
// positive turns clockwise; each joint adds its own bend.
const finger = (x: number, y: number, ang: number, lens: readonly number[], w0: number, bend: number) => {
  const c: Pt[] = [[x, y]];
  const dirs: Pt[] = [];
  let a = ang;
  let cx = x;
  let cy = y;
  lens.forEach((l, i) => {
    a += bend * (i === 0 ? 0.5 : 1);
    const rad = (a * Math.PI) / 180;
    dirs.push([Math.sin(rad), -Math.cos(rad)]);
    cx += Math.sin(rad) * l;
    cy -= Math.cos(rad) * l;
    c.push([cx, cy]);
  });
  const wAt = (i: number) => w0 * (1 - 0.1 * i);
  const nrm = (i: number): Pt => {
    const d = dirs[Math.min(i, dirs.length - 1)];
    return [-d[1], d[0]];
  };
  const left = c.map((p, i): Pt => [p[0] + nrm(i)[0] * wAt(i), p[1] + nrm(i)[1] * wAt(i)]);
  const right = c.map((p, i): Pt => [p[0] - nrm(i)[0] * wAt(i), p[1] - nrm(i)[1] * wAt(i)]);
  const last = dirs[dirs.length - 1];
  const tip: Pt = [c[c.length - 1][0] + last[0] * wAt(c.length - 1) * 0.9, c[c.length - 1][1] + last[1] * wAt(c.length - 1) * 0.9];
  return { outline: [...left, tip, ...right.slice().reverse()] as Pt[], c, dirs, w: wAt };
};

export type HandPose = 'open' | 'press' | 'fist' | 'cup' | 'relax';
type FSpec = { a: number; b: number };
// thumb, index, middle, ring, pinky
const POSES: Record<HandPose, FSpec[]> = {
  open: [{ a: -62, b: 6 }, { a: -14, b: 2 }, { a: -3, b: 2 }, { a: 8, b: 2 }, { a: 20, b: 3 }],
  press: [{ a: -36, b: 20 }, { a: 0, b: 0 }, { a: -2, b: 58 }, { a: 4, b: 60 }, { a: 10, b: 62 }],
  fist: [{ a: -30, b: 28 }, { a: -8, b: 56 }, { a: -2, b: 58 }, { a: 4, b: 60 }, { a: 10, b: 62 }],
  cup: [{ a: -40, b: 16 }, { a: -4, b: 14 }, { a: 0, b: 14 }, { a: 4, b: 14 }, { a: 8, b: 14 }],
  relax: [{ a: -50, b: 8 }, { a: -8, b: 12 }, { a: -2, b: 14 }, { a: 5, b: 16 }, { a: 12, b: 18 }],
};
const BASES: Pt[] = [[-42, -30], [-33, -108], [-11, -114], [11, -110], [33, -100]];
const LENS = [[38, 34], [44, 30, 24], [50, 34, 26], [46, 31, 24], [36, 24, 20]];
const WID = [14, 13, 13.6, 12.6, 11];

// The back of a hand with knuckles, fingers, nails and tendons. The wrist is at the
// origin and the fingers point up; rot turns it. sleeve is the forearm length below.
export const Hand = ({
  x, y, s = 1, rot = 0, mirror = false, pose = 'open', spread = 1, f, at = 0, dur = 22, px = 5, sil = false, sleeve = 0, ring = -1, seed = 1, op = 1, sleeveCol = SHADE,
}: {
  x: number; y: number; s?: number; rot?: number; mirror?: boolean; pose?: HandPose; spread?: number; f: number; at?: number; dur?: number; px?: number; sil?: boolean; sleeve?: number; ring?: number; seed?: number; op?: number; sleeveCol?: string;
}) => {
  if (f < at) return null;
  const w = px / s;
  const skin = sil ? INK : PARCH_LT;
  const sk = sil ? 0.92 : 0.9;
  const spec = POSES[pose];
  const palm = wob([[-34, 0], [-50, -40], [-52, -110], [0, -122], [52, -110], [52, -40], [34, 0]], seed, 0.8, true);
  const shadeHalf = wob([[8, -4], [50, -4], [54, -40], [50, -108], [30, -116], [10, -80]], seed + 9, 0.6, true);
  const fingers = spec.map((q, i) => finger(BASES[i][0], BASES[i][1], q.a * (i === 0 ? 1 : spread), LENS[i], WID[i], q.b));
  const ringBand = (() => {
    if (ring < 0) return null;
    const g = fingers[ring];
    const p: Pt = [(g.c[0][0] + g.c[1][0]) / 2, (g.c[0][1] + g.c[1][1]) / 2];
    const d = g.dirs[0];
    const ww = g.w(0) + 3;
    return { band: seg(p[0] + d[1] * ww, p[1] - d[0] * ww, p[0] - d[1] * ww, p[1] + d[0] * ww, seed + 80, 0.4), gem: poly([[p[0], p[1] - 26], [p[0] + 22, p[1]], [p[0], p[1] + 26], [p[0] - 22, p[1]]], seed + 81, 0.5, true), bez: poly([[p[0], p[1] - 12], [p[0] + 10, p[1]], [p[0], p[1] + 12], [p[0] - 10, p[1]]], seed + 82, 0.3, true) };
  })();
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${mirror ? -s : s} ${s})`} opacity={op}>
      {sleeve > 0 ? <Ink d={poly([[-46, 0], [-52, sleeve * 0.5], [-66, sleeve], [66, sleeve], [52, sleeve * 0.5], [46, 0]], seed + 40, 2, true)} f={f} at={at} dur={dur} w={w} wash={sil ? INK : sleeveCol} washOp={sil ? 0.92 : 0.5} crisp /> : null}
      {sleeve > 0 && !sil ? <Ink d={seg(-50, 34, 50, 34, seed + 41, 1.4)} f={f} at={at + 6} dur={dur} w={w * 0.8} op={0.7} /> : null}
      <Ink d={palm} f={f} at={at + 2} dur={dur} w={w} wash={skin} washOp={1} crisp />
      {fingers.map((g, i) => (
        <Ink key={`o${i}`} d={wob(g.outline, seed + 3 + i, 0.5, true)} f={f} at={at + 6 + i * 2} dur={dur} w={w} wash={skin} washOp={1} crisp />
      ))}
      {sil ? null : <Ink d={shadeHalf} f={f} at={at + 10} dur={12} w={0.1} col={SHADE} wash={SHADE} washOp={0.22} op={0} crisp />}
      {sil
        ? null
        : fingers.map((g, i) => {
            const n = g.c.length - 1;
            const d = g.dirs[g.dirs.length - 1];
            const ncx = g.c[n][0] - d[0] * g.w(n) * 0.3;
            const ncy = g.c[n][1] - d[1] * g.w(n) * 0.3;
            const nang = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
            return (
              <g key={`d${i}`}>
                {g.c.slice(1, -1).map((p, j) => {
                  const dd = g.dirs[j];
                  const nx = -dd[1];
                  const ny = dd[0];
                  const ww = g.w(j + 1) * 0.6;
                  return <Ink key={j} d={seg(p[0] - nx * ww, p[1] - ny * ww, p[0] + nx * ww, p[1] + ny * ww, seed + 20 + i * 3 + j, 0.5)} f={f} at={at + 14 + i * 2} dur={10} w={w * 0.55} op={0.7} />;
                })}
                <ellipse cx={r1(ncx)} cy={r1(ncy)} rx={g.w(n) * 0.85} ry={g.w(n) * 0.6} transform={`rotate(${r1(nang)} ${r1(ncx)} ${r1(ncy)})`} fill={PARCH_LT} stroke={INK} strokeWidth={w * 0.6} opacity={0.9 * draw((f - at - 14) / 10)} />
              </g>
            );
          })}
      {sil ? null : [-33, -11, 11, 33].map((bx, i) => <Ink key={`k${i}`} d={wob([[bx - 14, -100 - (i === 1 ? 6 : 0)], [bx, -108 - (i === 1 ? 6 : 0)], [bx + 14, -100 - (i === 1 ? 6 : 0)]], seed + 60 + i, 0.4)} f={f} at={at + 12} dur={12} w={w * 0.8} op={0.8} />)}
      {sil ? null : [-22, 0, 22].map((bx, i) => <Ink key={`t${i}`} d={seg(bx, -96, bx * 0.6, -14, seed + 70 + i, 0.8)} f={f} at={at + 16} dur={14} w={w * 0.55} op={0.45} />)}
      {ringBand && !sil ? (
        <g>
          <Ink d={ringBand.band} f={f} at={at + 18} dur={8} w={w * 4.4} col={INK} />
          <Ink d={ringBand.band} f={f} at={at + 20} dur={8} w={w * 2.8} col={AMBER} />
          <Ink d={ringBand.gem} f={f} at={at + 22} dur={8} w={w * 1.2} wash={AMBER} washOp={1} crisp />
          <Ink d={ringBand.bez} f={f} at={at + 24} dur={8} w={w * 0.6} op={0.8} />
        </g>
      ) : null}
    </g>
  );
};

// A heavy round stone slab seen at an angle: thick edge, cross-hatched face, a cast
// shadow. dark draws it as a silhouette against light (seen from below).
export const Slab = ({ id, cx, cy, rx, ry, th, f, at = 0, spin = 0, dark = false, seed = 5, shadow = true }: { id: string; cx: number; cy: number; rx: number; ry: number; th: number; f: number; at?: number; spin?: number; dark?: boolean; seed?: number; shadow?: boolean }) => {
  const face = ell(cx, cy, rx, ry, seed, 2);
  const side = `M ${cx - rx} ${cy} L ${cx - rx} ${cy + th} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + th} L ${cx + rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx - rx} ${cy} Z`;
  const line = dark ? PARCH_LT : INK;
  const cres = (k: number, from: number, to: number) => wob([...Array.from({ length: 10 }, (_, i): Pt => { const t = ((from + (i / 9) * (to - from)) * Math.PI) / 180; return [cx + Math.cos(t) * rx * 0.99, cy + Math.sin(t) * ry * 0.99]; }), ...Array.from({ length: 10 }, (_, i): Pt => { const t = ((to - (i / 9) * (to - from)) * Math.PI) / 180; return [cx + Math.cos(t) * rx * k + rx * 0.12 * (1 - k), cy + Math.sin(t) * ry * k - ry * 0.08 * (1 - k)]; })], seed + 5, 1.5, true);
  const crescent = cres(0.62, 90, 250);
  const crescent2 = cres(0.84, 105, 235);
  return (
    <g>
      {shadow ? <ellipse cx={cx + rx * 0.16} cy={cy + th + ry * 0.42} rx={rx * 1.04} ry={ry * 0.5} fill={INK} opacity={0.34} filter="url(#inkSoft)" /> : null}
      <path d={side} fill={dark ? INK : SHADE} opacity={dark ? 0.98 : 0.8} />
      <Hatch id={`${id}s`} clip={side} area={[cx - rx, cy, rx * 2, th + ry]} gap={9} ang={72} f={f} at={at} dur={22} w={2.6} col={line} op={dark ? 0.5 : 0.8} seed={seed + 1} />
      <Ink d={`M ${cx - rx} ${cy} L ${cx - rx} ${cy + th} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + th} L ${cx + rx} ${cy}`} f={f} at={at} dur={20} w={6} col={line} />
      <path d={face} fill={dark ? INK : PARCH_LT} opacity={dark ? 0.98 : 0.96} />
      <Wash d={crescent} f={f} at={at + 4} fill={SHADE} op={dark ? 0.1 : 0.34} over={4} />
      <Hatch id={`${id}a`} clip={crescent} area={[cx - rx, cy - ry, rx * 2, ry * 2]} gap={17} ang={122} f={f} at={at + 4} dur={26} w={3} col={line} op={dark ? 0.45 : 0.6} seed={seed + 2} />
      <Hatch id={`${id}b`} clip={crescent2} area={[cx - rx, cy - ry, rx * 2, ry * 2]} gap={13} ang={36} f={f} at={at + 8} dur={26} w={2.8} col={line} op={dark ? 0.35 : 0.5} seed={seed + 3} />
      <Ink d={ell(cx, cy, rx * 0.86, ry * 0.86, seed + 4, 2)} f={f} at={at + 6} dur={26} w={3} col={line} op={0.4} />
      {[[-0.4, -0.45, 0.5], [0.3, 0.4, 0.42], [0.1, -0.72, 0.28]].map((q, i) => (
        <Ink key={`lc${i}`} d={wob([[cx + rx * q[0], cy + ry * q[1]], [cx + rx * (q[0] + 0.12), cy + ry * (q[1] + 0.1)], [cx + rx * (q[0] + 0.04), cy + ry * (q[1] + 0.2)], [cx + rx * (q[0] + 0.18), cy + ry * (q[1] + 0.3)]], seed + 20 + i, 3)} f={f} at={at + 10 + i * 3} dur={14} w={4} col={line} op={0.7} />
      ))}
      <g transform={`translate(${cx} ${cy}) rotate(${spin}) translate(${-cx} ${-cy})`}>
        {[0, 1, 2].map((i) => {
          const a = (i * 2.1 + 0.4) * 1;
          const pts: Pt[] = [0.97, 0.78, 0.6, 0.42].map((k, j) => [cx + Math.cos(a + (j % 2 ? 0.07 : -0.05)) * rx * k, cy + Math.sin(a + (j % 2 ? 0.07 : -0.05)) * ry * k]);
          return <Ink key={`cr${i}`} d={poly(pts, seed + 30 + i, 4)} f={f} at={at + 12 + i * 3} dur={16} w={5} col={line} op={dark ? 0.6 : 0.85} />;
        })}
      </g>
      <Ink d={face} f={f} at={at} dur={24} w={7} col={line} />
    </g>
  );
};

// A twisted rope through the given points.
export const Rope = ({ pts, w = 12, light = false }: { pts: readonly Pt[]; w?: number; light?: boolean }) => {
  const d = poly(pts, 3, 0.6);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={w + 5} />
      <path d={d} stroke={light ? PARCH_LT : '#b99a64'} strokeWidth={w} />
      <path d={d} stroke={INK} strokeWidth={w * 0.8} strokeDasharray={`${w * 0.5} ${w * 0.9}`} opacity={0.7} />
    </g>
  );
};

// Lions. Facing +x, feet on y 0. rest: lying with the head on the paws. sphinx: head up.
// A jagged mane mass with flowing hair strokes behind a profile head: brow, bridge, nose,
// closed mouth, heavy-lidded calm eyes. Muscle lines on the shoulder and haunch, a tufted tail.
export const Lion = ({ id, x, y, s = 1, dir = 1, pose = 'rest', f, at = 0, seed = 51, glow = false, px = 5 }: { id: string; x: number; y: number; s?: number; dir?: 1 | -1; pose?: 'rest' | 'sphinx'; f: number; at?: number; seed?: number; glow?: boolean; px?: number }) => {
  if (f < at) return null;
  const w = px / s;
  const sf = Math.floor((f * 12) / 30);
  const breath = 1 + 0.016 * Math.sin(sf / 4.2 + seed);
  const tail = Math.sin(sf / 5 + seed) * 26;
  const rest = pose === 'rest';
  const body: Pt[] = rest
    ? [[-372, 0], [-396, -70], [-374, -150], [-304, -206], [-190, -222], [-70, -214], [30, -232], [110, -244], [176, -214], [210, -150], [228, -86], [250, -50], [320, -44], [372, -28], [378, 0]]
    : [[-372, 0], [-396, -70], [-374, -150], [-304, -208], [-190, -228], [-60, -246], [40, -278], [120, -314], [178, -318], [204, -250], [220, -160], [238, -84], [262, -40], [330, -32], [352, -12], [352, 0]];
  const belly: Pt[] = [[-384, -70], [-300, -110], [-100, -92], [100, -108], [212, -100], [246, -50], [372, -34], [378, 0], [-372, 0]];
  const bodyD = wob(body, seed, 2, true);
  const bellyD = wob(belly, seed + 1, 2, true);
  const hc: Pt = rest ? [276, -108] : [226, -382];
  const [hx, hy] = hc;
  const mx = hx - 26;
  const my = hy + 16;
  // the mane: radius by position around the head (front small, back and underside long)
  const Rm = (p: number) => 82 + 104 * Math.pow(Math.sin(Math.PI * p), 0.72) + 30 * p * p;
  const th = (p: number) => ((-70 - 232 * p) * Math.PI) / 180;
  const N = 42;
  const maneMass: Pt[] = [];
  for (let k = 0; k < N; k++) {
    const r = rng(seed * 11 + k);
    const p0 = k / N;
    const p1 = (k + 0.5) / N;
    const rt = Rm(p0) * (1 + (r() - 0.5) * 0.22);
    maneMass.push([mx + Math.cos(th(p0) - 0.04) * rt, my + Math.sin(th(p0) - 0.04) * rt * 0.97 + 8 + 16 * p0]);
    const rn = Rm(p1) * 0.9;
    maneMass.push([mx + Math.cos(th(p1)) * rn, my + Math.sin(th(p1)) * rn * 0.97 + 4 + 6 * p1]);
  }
  maneMass.push([hx + 22, hy + 56], [hx + 30, hy - 42]);
  const maneD = poly(maneMass, seed + 9, 1.4, true);
  const strokes = (n: number, s0: number, lo: number, hi: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = rng(seed * 5 + s0 + i);
      const p = (i + r()) / n;
      const a = th(p);
      const r0 = 62 + r() * 12;
      const L = (Rm(p) - r0) * (lo + (hi - lo) * r());
      const pt = (rr: number, da: number, g: number): Pt => [mx + Math.cos(a - da) * rr, my + Math.sin(a - da) * rr * 0.97 + g];
      out.push(wob([pt(r0, 0, 0), pt(r0 + L * 0.5, 0.2, 8 + 6 * p), pt(r0 + L, 0.46, 18 + 26 * p)], seed + s0 + i, 0.6));
    }
    return out;
  };
  const dark = strokes(34, 100, 0.86, 1.02);
  const light = strokes(20, 300, 0.4, 0.74);
  const tailPts: Pt[] = rest ? [[-384, -30], [-444, -22], [-504, -34 + tail * 0.3], [-548, -58 + tail * 0.7]] : [[-384, -50], [-442, -40], [-496, -80 + tail * 0.5], [-520, -130 + tail]];
  const tuft = tailPts[3];
  const paws: [number, number, number][] = rest ? [[336, -24, 66], [262, -14, 56]] : [[290, -20, 56], [352, -14, 50]];
  const sh = rest ? wob([[50, -226], [112, -196], [170, -134], [190, -80]], seed + 20, 3) : wob([[60, -268], [130, -240], [186, -170], [206, -96]], seed + 20, 3);
  const hip = wob([[-346, -176], [-286, -128], [-300, -62], [-236, -34], [-176, -60], [-182, -140], [-232, -190]], seed + 21, 3);
  const spine = Array.from({ length: 16 }, (_, i) => {
    const px0 = -330 + i * 28;
    const py0 = rest ? -216 + (i > 9 ? -(i - 9) * 4 : 0) : -224 - (i > 8 ? (i - 8) * 8 : 0);
    return `M ${px0} ${py0 + 4} L ${px0 + 8} ${py0 - 8}`;
  }).join(' ');
  const ribs = [[-60, -190, -30, -126], [-14, -196, 14, -122], [32, -196, 52, -126]].map((q, i) => wob([[q[0], q[1]], [(q[0] + q[2]) / 2 + 8, (q[1] + q[3]) / 2], [q[2], q[3]]], seed + 30 + i, 1.6));
  const eyeC: Pt = [68, -46];
  return (
    <g transform={`translate(${x} ${y}) scale(${s * dir} ${s * breath})`}>
      {/* tail, body and its shading */}
      <Ink d={wob(tailPts, seed + 5, 1.5)} f={f} at={at + 12} dur={26} w={w * 1.7} />
      <Ink d={wob(tailPts, seed + 5, 1.5)} f={f} at={at + 14} dur={24} w={w * 0.7} col={PARCH_LT} op={0.5} />
      <Ink d={wob([[tuft[0] + 6, tuft[1] + 6], [tuft[0] - 10, tuft[1] - 30], [tuft[0] - 28, tuft[1] - 8], [tuft[0] - 34, tuft[1] + 22], [tuft[0] - 8, tuft[1] + 34]], seed + 6, 3, true)} f={f} at={at + 30} dur={14} w={w} wash={INK} washOp={0.7} crisp />
      <path d={bodyD} fill={FIG_BASE} />
      <Ink d={bodyD} f={f} at={at} dur={34} w={w * 1.2} wash={AMBER} washOp={0.34} />
      <Wash d={bellyD} f={f} at={at + 10} fill={SHADE} op={0.4} />
      <Hatch id={`${id}u`} clip={bellyD} area={bbox(belly)} gap={10} ang={58} f={f} at={at + 8} dur={34} w={w * 0.55} op={0.7} seed={seed + 2} />
      <Ink d={hip} f={f} at={at + 14} dur={22} w={w * 0.9} wash={AMBER} washOp={0.2} />
      <Ink d={sh} f={f} at={at + 16} dur={22} w={w * 0.9} op={0.85} />
      {ribs.map((d, i) => <Ink key={`rb${i}`} d={d} f={f} at={at + 22 + i * 3} dur={12} w={w * 0.6} op={0.6} />)}
      <Ink d={spine} f={f} at={at + 18} dur={30} w={w * 0.7} op={0.75} />
      <Ink d={ell(-110, -14, 62, 18, seed + 4, 1.4)} f={f} at={at + 18} dur={14} w={w * 0.95} wash={FIG_BASE} washOp={1} crisp />
      {[0, 1, 2, 3].map((i) => <Ink key={`ht${i}`} d={seg(-90 + i * 14, -14, -84 + i * 14, 0, seed + 5 + i, 0.4)} f={f} at={at + 26} dur={6} w={w * 0.6} />)}
      {!rest ? <Ink d={wob([[196, -250], [226, -160], [248, -84], [262, -40]], seed + 7, 2)} f={f} at={at + 20} dur={18} w={w * 0.95} /> : null}
      {!rest ? <Ink d={wob([[254, -230], [286, -150], [308, -76], [322, -34]], seed + 8, 2)} f={f} at={at + 22} dur={18} w={w * 0.95} /> : null}
      {rest ? <Ink d={wob([[150, -170], [200, -110], [270, -66], [340, -50]], seed + 7, 2)} f={f} at={at + 20} dur={18} w={w * 0.9} /> : null}
      {paws.map(([px2, py2, rw], i) => (
        <g key={`pw${i}`}>
          <Ink d={ell(px2, py2, rw, 28, seed + 40 + i, 1.4)} f={f} at={at + 22 + i * 3} dur={16} w={w * 1.1} wash={FIG_BASE} washOp={1} crisp />
          <Ink d={ell(px2, py2, rw, 28, seed + 40 + i, 1.4)} f={f} at={at + 22 + i * 3} dur={16} w={w * 1.1} wash={AMBER} washOp={0.2} crisp />
          {[0, 1, 2, 3].map((k) => <Ink key={k} d={wob([[px2 + rw * (0.28 + k * 0.17), py2 - 4], [px2 + rw * (0.32 + k * 0.17), py2 + 12], [px2 + rw * (0.3 + k * 0.17), py2 + 22]], seed + 50 + k + i * 4, 0.4)} f={f} at={at + 30} dur={6} w={w * 0.65} />)}
        </g>
      ))}
      {/* the mane: a jagged dark mass, then flowing hair strokes, then lighter locks */}
      <path d={maneD} fill="#a47a43" />
      <Ink d={maneD} f={f} at={at + 18} dur={30} w={w * 1.2} wash={AMBER} washOp={0.42} />
      <Wash d={poly([[mx - 120, my + 20], [mx - 40, my + 140], [mx + 60, my + 170], [mx + 80, my + 60], [mx - 40, my - 10]], seed + 10, 4, true)} f={f} at={at + 20} fill={INK} op={0.34} />
      <Ink d={dark.join(' ')} f={f} at={at + 22} dur={26} w={w * 0.85} op={0.8} />
      <Ink d={light.join(' ')} f={f} at={at + 30} dur={22} w={w * 0.7} col={PARCH_LT} op={0.6} />
      <g transform={`translate(${hx} ${hy}) rotate(${rest ? 4 : -4})`}>
        <Ink d={ell(-6, -84, 22, 19, seed + 18, 1.2)} f={f} at={at + 30} dur={12} w={w * 0.95} wash={SHADE} washOp={0.8} crisp />
        <Ink d={ell(-4, -82, 11, 10, seed + 19, 0.8)} f={f} at={at + 34} dur={8} w={w * 0.6} op={0.7} />
        <path d={wob([[-36, -58], [0, -80], [36, -78], [62, -68], [76, -54], [96, -40], [114, -26], [128, -16], [133, -2], [128, 10], [116, 14], [112, 24], [98, 34], [102, 46], [96, 58], [76, 66], [40, 66], [0, 60], [-34, 42], [-44, 0]], seed + 9, 0.8, true)} fill="#dcc08a" />
        <Ink d={wob([[-36, -58], [0, -80], [36, -78], [62, -68], [76, -54], [96, -40], [114, -26], [128, -16], [133, -2], [128, 10], [116, 14], [112, 24], [98, 34], [102, 46], [96, 58], [76, 66], [40, 66], [0, 60], [-34, 42], [-44, 0]], seed + 9, 0.8, true)} f={f} at={at + 26} dur={22} w={w * 1.2} wash={AMBER} washOp={0.28} crisp />
        <Wash d={wob([[84, -34], [116, -20], [132, -8], [126, 10], [112, 22], [98, 34], [72, 40], [66, 6]], seed + 23, 1.2, true)} f={f} at={at + 34} fill={PARCH_LT} op={0.5} />
        <Wash d={wob([[-40, 20], [-10, 40], [30, 58], [60, 62], [30, 30], [-10, 0]], seed + 24, 2, true)} f={f} at={at + 34} fill={SHADE} op={0.4} />
        {/* brow, eye, tear line, nose, mouth, whisker dots */}
        <Ink d={wob([[40, -68], [62, -76], [88, -60]], seed + 14, 0.5)} f={f} at={at + 36} dur={10} w={w * 1.6} />
        <Ink d={wob([[56, -46], [68, -56], [84, -48], [70, -40], [56, -46]], seed + 15, 0.3, true)} f={f} at={at + 36} dur={10} w={w * 0.9} wash={glow ? AMBER : PARCH_LT} washOp={glow ? 1 : 0.7} crisp />
        <Ink d={wob([[52, -50], [68, -62], [88, -50]], seed + 16, 0.4)} f={f} at={at + 38} dur={8} w={w * 1.7} />
        <circle cx={eyeC[0] + 5} cy={eyeC[1] - 2} r={3.4} fill={INK} opacity={0.92 * draw((f - at - 38) / 6)} />
        <Ink d={wob([[80, -38], [90, -22], [98, -4]], seed + 17, 0.5)} f={f} at={at + 40} dur={10} w={w * 0.9} op={0.75} />
        <Ink d={wob([[92, -44], [112, -28], [124, -16]], seed + 22, 0.5)} f={f} at={at + 40} dur={8} w={w * 0.6} op={0.5} />
        <Ink d={wob([[110, -22], [132, -18], [134, -2], [122, 4], [110, -6]], seed + 11, 0.4, true)} f={f} at={at + 38} dur={8} w={w * 0.9} wash={INK} washOp={0.92} crisp />
        <Ink d={wob([[120, 6], [114, 22], [98, 33], [76, 34], [66, 26]], seed + 12, 0.6)} f={f} at={at + 40} dur={12} w={w * 1.25} />
        <Ink d={wob([[102, 42], [92, 48], [78, 48]], seed + 13, 0.5)} f={f} at={at + 42} dur={8} w={w * 0.8} op={0.8} />
        {[[96, 8], [104, 16], [92, 18], [84, 12], [100, 26], [88, 26]].map((q, i) => <circle key={`w${i}`} cx={q[0]} cy={q[1]} r={2} fill={INK} opacity={0.7} />)}
        {[0, 1, 2, 3].map((i) => <Ink key={`ch${i}`} d={wob([[-24 + i * 20, 52 + i * 3], [-34 + i * 20, 74 + i * 2], [-26 + i * 20, 92]], seed + 60 + i, 0.5)} f={f} at={at + 42} dur={8} w={w * 0.7} op={0.8} />)}
        {[[10, -62], [30, -66], [4, -50], [-14, -56]].map((q, i) => <Ink key={`ft${i}`} d={wob([[q[0], q[1]], [q[0] - 24, q[1] + 6], [q[0] - 44, q[1] + 22]], seed + 70 + i, 0.5)} f={f} at={at + 40} dur={8} w={w * 0.8} op={0.8} />)}
        {glow ? <Glow x={eyeC[0] + 4} y={eyeC[1] - 2} r={46} op={0.8} /> : null}
      </g>
    </g>
  );
};

/* ---------- robed people: Daniel from behind, profile men, hats ---------- */

// A tapering tube (a sleeve, a leg, a rope) around a centre line: returns a closed outline.
export const tube = (pts: readonly Pt[], ws: readonly number[]): Pt[] => {
  const n = pts.length;
  const nrm = pts.map((_, i): Pt => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const L = pts.map((p, i): Pt => [p[0] + nrm[i][0] * ws[Math.min(i, ws.length - 1)], p[1] + nrm[i][1] * ws[Math.min(i, ws.length - 1)]]);
  const R = pts.map((p, i): Pt => [p[0] - nrm[i][0] * ws[Math.min(i, ws.length - 1)], p[1] - nrm[i][1] * ws[Math.min(i, ws.length - 1)]]);
  return [...L, ...R.slice().reverse()];
};

const stepW = (f: number) => Math.floor((f * 12) / 30);

export type BackProps = {
  id: string;
  x: number;
  y: number;
  s?: number;
  f: number;
  at?: number;
  pose?: 'stand' | 'kneel';
  sil?: boolean;
  lit?: boolean;
  staff?: boolean;
  lean?: number;
  walk?: number;
  hair?: 'white' | 'dark' | 'wrap';
  // Kneeling only: both arms raised in prayer, with real hands.
  arms?: boolean;
  seed?: number;
  px?: number;
  op?: number;
  wash?: string;
  washOp?: number;
};

// A person seen from behind (Daniel is always drawn this way): a broad old man's back,
// white hair in strands, a heavy mantle with folds, shadow hatched on the right.
// Local units: feet on y 0, standing height about 700, head about 115.
export const Back = ({ id, x, y, s = 1, f, at = 0, pose = 'stand', sil = false, lit = false, staff = false, lean = 0, walk, hair = 'white', arms = false, seed = 11, px = 5, op = 1, wash, washOp }: BackProps) => {
  if (f < at) return null;
  const w = px / s;
  const kneel = pose === 'kneel';
  const tone = sil ? INK : lit ? AMBER : wash ?? SHADE;
  const toneOp = sil ? 0.93 : lit ? 0.5 : washOp ?? 0.3;
  const hy = kneel ? -440 : -642;
  const skin = sil ? INK : '#d8bf8f';
  const robe: Pt[] = kneel
    ? [[-44, -398], [-116, -380], [-140, -340], [-146, -260], [-150, -190], [-190, -110], [-262, -30], [-290, 6], [290, 6], [262, -30], [190, -110], [150, -190], [146, -260], [140, -340], [116, -380], [44, -398]]
    : [[-36, -592], [-112, -574], [-146, -544], [-160, -470], [-164, -380], [-158, -290], [-148, -256], [-140, -210], [-164, -120], [-208, -30], [-226, 0], [226, 0], [208, -30], [164, -120], [140, -210], [148, -256], [158, -290], [164, -380], [160, -470], [146, -544], [112, -574], [36, -592]];
  const yoke: Pt[] = kneel ? [[-142, -340], [-80, -310], [0, -302], [80, -310], [142, -340]] : [[-146, -544], [-90, -500], [0, -490], [90, -500], [156, -542]];
  const folds: Pt[][] = kneel
    ? [[[-80, -352], [-130, -222], [-212, -60]], [[-30, -362], [-50, -200], [-90, -40]], [[30, -362], [56, -200], [100, -40]], [[82, -352], [140, -222], [222, -60]], [[-150, -300], [-206, -180], [-272, -40]], [[150, -300], [212, -180], [286, -40]]]
    : [[[-100, -320], [-130, -200], [-190, -30]], [[-48, -318], [-60, -200], [-90, -20]], [[10, -316], [16, -200], [22, -20]], [[66, -318], [88, -200], [128, -26]], [[118, -324], [154, -200], [206, -34]], [[-100, -490], [-120, -420], [-130, -345]], [[0, -488], [0, -420], [0, -335]], [[100, -490], [122, -420], [132, -345]]];
  const shadow: Pt[] = kneel
    ? [[50, -394], [116, -380], [140, -340], [146, -260], [150, -190], [190, -110], [262, -30], [290, 6], [130, 6], [140, -120], [120, -250], [80, -340]]
    : [[52, -590], [112, -574], [146, -544], [160, -470], [164, -380], [158, -290], [140, -210], [164, -120], [226, 0], [120, 0], [124, -190], [108, -300], [96, -420], [70, -520]];
  const shD = wob(shadow, seed + 7, 2, true);
  const head = wob([[-46, hy - 5], [-42, hy - 40], [-18, hy - 58], [16, hy - 58], [42, hy - 40], [46, hy - 5], [44, hy + 26], [26, hy + 50], [-26, hy + 50], [-44, hy + 26]], seed + 1, 1.2, true);
  const strands = Array.from({ length: 16 }, (_, i) => {
    const x0 = (i - 7.5) * 6.2;
    const r = rng(seed * 3 + i);
    return wob([[x0 * 0.1, hy - 57], [x0 * 0.85 + (r() - 0.5) * 6, hy - 6], [x0 * 1.04 + (r() - 0.5) * 8, hy + 44 + r() * 26]], seed + 20 + i, 1.1);
  });
  const sf = walk === undefined ? 0 : stepW(walk);
  const bob = walk === undefined ? 0 : -6 * Math.abs(Math.sin(sf * 0.9));
  const sway = walk === undefined ? 0 : Math.sin(sf * 0.9) * 1.8;
  const hairCol = hair === 'dark' ? PARCH_LT : INK;
  const headFill = sil ? INK : hair === 'dark' ? INK : hair === 'wrap' ? SHADE : PARCH_LT;
  const stAt = at + 6;
  return (
    <g transform={`translate(${x} ${y + bob * s}) scale(${s}) rotate(${lean + sway})`} opacity={op}>
      <path d={wob(robe, seed, 2, true)} fill={sil ? INK : FIG_BASE} />
      <Ink d={wob(robe, seed, 2, true)} f={f} at={at} dur={34} w={w * 1.2} wash={tone} washOp={toneOp} />
      {sil ? <Ink d={wob(robe, seed, 2, true)} f={f} at={at + 6} dur={34} w={w * 0.55} col={AMBER} op={0.8} /> : null}
      {sil ? null : <Wash d={shD} f={f} at={stAt} fill={INK} op={0.3} over={14} />}
      {sil ? null : <Hatch id={`${id}h`} clip={shD} area={bbox(shadow)} gap={13} ang={62} f={f} at={stAt + 6} dur={30} w={w * 0.5} op={0.62} seed={seed + 3} />}
      <Ink d={wob(yoke, seed + 2, 1.5)} f={f} at={at + 14} dur={22} w={w * 1.0} col={sil ? AMBER : INK} op={sil ? 0.6 : 0.9} />
      {sil || kneel ? null : (
        <g>
          {[-1, 1].map((m) => (
            <g key={m}>
              <Ink d={wob([[m * 118, -482], [m * 130, -380], [m * 134, -258]], seed + 4 + m, 1.4)} f={f} at={at + 16} dur={24} w={w * 0.8} op={0.7} />
              <Ink d={wob([[m * 160, -290], [m * 148, -262], [m * 134, -250]], seed + 14 + m, 0.8)} f={f} at={at + 20} dur={12} w={w * 1.1} op={0.85} />
              <Hand x={m * 140} y={-250} s={0.44} rot={180} mirror={m > 0} pose="relax" f={f} at={at + 24} dur={16} px={w * 0.62} seed={seed + 120 + m} />
            </g>
          ))}
          <Ink d={wob([[-132, -344], [-60, -324], [60, -324], [132, -344]], seed + 8, 1.4)} f={f} at={at + 18} dur={26} w={w * 1.6} col={INK} op={0.9} />
          <Ink d={wob([[-128, -322], [-60, -302], [60, -302], [128, -322]], seed + 9, 1.4)} f={f} at={at + 20} dur={26} w={w * 0.8} op={0.55} />
          <Ink d={ell(0, -318, 16, 12, seed + 10, 1)} f={f} at={at + 24} dur={10} w={w} wash={SHADE} washOp={0.6} crisp />
          <Ink d={wob([[-8, -308], [-26, -250], [-22, -196]], seed + 11, 1.2)} f={f} at={at + 26} dur={14} w={w * 1.1} op={0.8} />
          <Ink d={wob([[8, -308], [34, -240], [40, -186]], seed + 12, 1.2)} f={f} at={at + 26} dur={14} w={w * 1.1} op={0.8} />
          <Ink d={seg(0, -490, 2, -336, seed + 8, 1.4)} f={f} at={at + 20} dur={30} w={w * 0.5} op={0.35} />
        </g>
      )}
      {folds.map((q, i) => (
        <Ink key={i} d={wob(q, seed + 30 + i, 1.8)} f={f} at={at + 18 + i * 3} dur={26} w={w * 0.75} col={sil ? AMBER : INK} op={sil ? 0.35 : 0.7} />
      ))}
      {kneel ? (
        <g>
          <Ink d={poly([[-96, -22], [-52, -34], [-34, 4], [-88, 8]], seed + 70, 1.4, true)} f={f} at={at + 28} dur={12} w={w} wash={skin} washOp={0.95} crisp />
          <Ink d={poly([[96, -22], [52, -34], [34, 4], [88, 8]], seed + 71, 1.4, true)} f={f} at={at + 30} dur={12} w={w} wash={skin} washOp={0.95} crisp />
        </g>
      ) : (
        <g>
          <Ink d={seg(-226, -56, 226, -52, seed + 72, 2)} f={f} at={at + 30} dur={30} w={w * 0.9} op={0.75} col={sil ? AMBER : INK} />
          {Array.from({ length: 11 }, (_, i) => (
            <Ink key={i} d={seg(-210 + i * 42, -52, -210 + i * 42 + 2, -34, seed + 80 + i, 0.6)} f={f} at={at + 40 + i} dur={6} w={w * 0.6} op={0.55} col={sil ? AMBER : INK} />
          ))}
        </g>
      )}
      {kneel && arms ? (
        <g>
          {[-1, 1].map((m) => {
            const ap: Pt[] = [[m * 120, -356], [m * 206, -322], [m * 214, -440]];
            const sl = wob(tube(ap, [38, 32, 24]), seed + 110 + m, 0.8, true);
            return (
              <g key={m}>
                <path d={sl} fill={sil ? INK : FIG_BASE} />
                <Ink d={sl} f={f} at={at + 24} dur={20} w={w * 1.05} wash={tone} washOp={toneOp} crisp />
                {sil ? null : <Ink d={wob([[m * 150, -346], [m * 200, -352], [m * 212, -420]], seed + 112 + m, 1)} f={f} at={at + 32} dur={14} w={w * 0.6} op={0.6} />}
                {sil ? null : <Ink d={seg(m * 188, -440, m * 240, -424, seed + 114 + m, 0.8)} f={f} at={at + 34} dur={8} w={w * 0.9} col={AMBER} />}
                <Hand x={m * 214} y={-436} s={0.5} rot={m * 8} mirror={m < 0} pose="open" spread={1.1} f={f} at={at + 30} dur={16} px={w * 0.62} sil={sil} seed={seed + 130 + m} />
              </g>
            );
          })}
        </g>
      ) : null}
      <Ink d={wob([[-30, hy + 40], [-34, hy + 90], [34, hy + 90], [30, hy + 40]], seed + 96, 1, true)} f={f} at={at + 10} dur={12} w={w} wash={skin} washOp={0.95} crisp />
      <Ink d={head} f={f} at={at + 12} dur={26} w={w * 1.1} wash={headFill} washOp={0.97} crisp />
      {strands.map((d, i) => (
        <Ink key={i} d={d} f={f} at={at + 22 + (i % 6)} dur={14} w={w * 0.5} col={sil ? PARCH_LT : hairCol} op={sil ? 0.4 : 0.6} />
      ))}
      {[-1, 1].map((m) => (
        <Ink key={m} d={wob([[m * 44, hy - 8], [m * 60, hy - 12], [m * 62, hy + 12], [m * 50, hy + 24], [m * 44, hy + 14]], seed + 90 + m, 0.8, true)} f={f} at={at + 26} dur={10} w={w * 0.8} wash={skin} washOp={0.95} crisp />
      ))}
      {staff ? (
        <g>
          <Ink d={seg(262, -452, 270, 6, seed + 100, 1.4)} f={f} at={at + 24} dur={22} w={w * 1.3} />
          <Ink d={wob([[262, -452], [276, -480], [296, -470], [290, -448]], seed + 101, 1)} f={f} at={at + 40} dur={10} w={w} />
        </g>
      ) : null}
    </g>
  );
};

export type HatKind = 'none' | 'tall' | 'crown' | 'cap' | 'turban';
type ArmKind = 'rest' | 'raise' | 'point' | 'out' | 'none';

export type ManProps = {
  id: string;
  x: number;
  y: number;
  s?: number;
  dir?: 1 | -1;
  f: number;
  at?: number;
  seed?: number;
  hat?: HatKind;
  beard?: boolean;
  bow?: number;
  sil?: boolean;
  seated?: boolean;
  run?: number;
  arm?: ArmKind;
  narrow?: number;
  wash?: string;
  washOp?: number;
  trim?: string;
  px?: number;
  op?: number;
  children?: ReactNode;
};

const HEAD: Pt[] = [[-30, -650], [-20, -682], [10, -698], [38, -690], [50, -668], [56, -652], [55, -646], [62, -634], [78, -620], [68, -612], [61, -608], [62, -600], [57, -592], [58, -584], [50, -574], [30, -568], [8, -574], [-8, -588], [-18, -606], [-28, -630]];

// The flat colour under a figure's wash, so the crowd or the set never shows through it.
export const FIG_BASE = '#cfb384';

// A robed person in profile, facing +x: eye, brow, nose, lips and ear in single strokes,
// a beard, a sleeve with a real hand, drapery folds and a hat. Feet on y 0, height about 700.
export const Man = ({ id, x, y, s = 1, dir = 1, f, at = 0, seed = 21, hat = 'none', beard = false, bow = 0, sil = false, seated = false, run, arm = 'rest', narrow = 0, wash = SHADE, washOp = 0.3, trim = AMBER, px = 5, op = 1, children }: ManProps) => {
  if (f < at) return null;
  const w = px / s;
  const dy = seated ? 112 : 0;
  const tone = sil ? INK : wash;
  const tOp = sil ? 0.93 : washOp;
  const rs = run === undefined ? 0 : Math.sin(stepW(run) * 1.05);
  const bob = run === undefined ? 0 : -8 * Math.abs(rs);
  const back: Pt[] = seated
    ? [[-20, -450], [-70, -428], [-84, -330], [-96, -190], [-104, -60], [-110, 0]]
    : [[-20, -562], [-70, -540], [-84, -440], [-96, -300], [-112, -150], [-126, -30], [-130, 0]];
  const front: Pt[] = seated
    ? [[290, 0], [280, -60], [264, -190], [252, -218], [170, -238], [112, -254], [104, -340], [100, -390], [88, -440], [52, -450], [30, -456]]
    : run !== undefined
      ? [[170, -60], [150, -110], [124, -200], [112, -290], [104, -380], [100, -450], [88, -520], [52, -562], [30, -568]]
      : [[150, 0], [138, -40], [122, -150], [112, -260], [104, -360], [100, -450], [88, -520], [52, -562], [30, -568]];
  const hemY = run !== undefined ? -80 : 0;
  const robe: Pt[] = run !== undefined ? [...back.slice(0, 5), [-140, -90], [-190, -70], [-60, hemY], [60, hemY - 8], ...front] : [...back, ...front];
  const robeD = wob(robe, seed, 2, true);
  const shadow: Pt[] = seated
    ? [[-20, -450], [-70, -428], [-84, -330], [-96, -190], [-104, -60], [-110, 0], [-30, 0], [-40, -140], [-34, -270], [-26, -390]]
    : [[-20, -562], [-70, -540], [-84, -440], [-96, -300], [-112, -150], [-130, 0], [-56, 0], [-40, -200], [-30, -380]];
  const shD = wob(shadow, seed + 7, 2, true);
  const folds: Pt[][] = seated
    ? [[[-40, -330], [-54, -190], [-74, -30]], [[-4, -300], [-8, -160], [-20, -30]], [[110, -250], [170, -214], [248, -214]], [[104, -240], [150, -190], [226, -150]], [[150, -200], [190, -120], [262, -40]], [[60, -250], [90, -200], [120, -80]]]
    : [[[-40, -500], [-54, -300], [-74, -40]], [[-10, -470], [-10, -300], [-20, -30]], [[60, -330], [70, -180], [86, -30]], [[100, -300], [110, -150], [120, -20]], [[30, -420], [34, -250], [40, -60]], [[-70, -250], [-90, -140], [-106, -30]]];
  const hip = seated ? -340 : -340;
  const bowY = seated ? -250 : hip + 60;
  // the arm: shoulder, elbow, wrist and the hand's rotation
  const arms: Record<ArmKind, { pts: Pt[]; rot: number } | null> = {
    none: null,
    rest: seated ? { pts: [[10, -424], [58, -330], [172, -240]], rot: 108 } : { pts: [[10, -536], [48, -410], [150, -354]], rot: 112 },
    raise: { pts: [[10, -536 + dy], [60, -430 + dy], [84, -552 + dy]], rot: 14 },
    point: { pts: [[10, -536 + dy], [112, -528 + dy], [216, -520 + dy]], rot: 88 },
    out: { pts: [[10, -536 + dy], [84, -450 + dy], [192, -440 + dy]], rot: 88 },
  };
  const A = arms[arm];
  const eyeLen = 12 * (1 - 0.6 * narrow);
  const legSw = rs * 34;
  const hatY = -690 + dy;
  const hatEl = (() => {
    const tc = sil ? INK : tone;
    if (hat === 'tall')
      return (
        <g>
          <Ink d={poly([[-30, hatY + 6], [48, hatY + 6], [44, hatY - 8], [40, hatY - 104], [-26, hatY - 104], [-32, hatY - 8]], seed + 40, 1.4, true)} f={f} at={at + 20} dur={22} w={w * 1.1} wash={tc} washOp={sil ? 0.93 : 0.5} />
          {sil ? null : <Ink d={seg(-32, hatY - 18, 44, hatY - 18, seed + 41, 0.8)} f={f} at={at + 32} dur={10} w={w * 0.9} />}
          {sil ? null : <Ink d={seg(-28, hatY - 72, 42, hatY - 72, seed + 42, 0.8)} f={f} at={at + 34} dur={10} w={w * 0.6} op={0.6} />}
          {sil ? null : <Ink d={ell(40, hatY - 104, 8, 5, seed + 43, 0.4)} f={f} at={at + 38} dur={8} w={w * 0.7} wash={trim} washOp={0.8} crisp />}
          {sil ? null : Array.from({ length: 4 }, (_, i) => <Ink key={i} d={seg(-18 + i * 20, hatY - 28, -14 + i * 20, hatY - 62, seed + 44 + i, 0.5)} f={f} at={at + 36} dur={8} w={w * 0.45} op={0.5} />)}
        </g>
      );
    if (hat === 'crown')
      return (
        <g>
          <Ink d={poly([[-36, hatY + 8], [-40, hatY - 18], [-30, hatY - 62], [-18, hatY - 30], [-4, hatY - 76], [10, hatY - 30], [24, hatY - 78], [38, hatY - 28], [50, hatY - 60], [56, hatY - 16], [54, hatY + 8]], seed + 40, 1.2, true)} f={f} at={at + 20} dur={26} w={w * 1.1} wash={sil ? INK : trim} washOp={sil ? 0.93 : 0.55} />
          {sil ? null : <Ink d={seg(-38, hatY - 6, 54, hatY - 6, seed + 41, 0.6)} f={f} at={at + 34} dur={10} w={w * 0.9} />}
          {sil ? null : [-30, -4, 24, 50].map((cx, i) => <Ink key={i} d={ell(cx, hatY - (i % 2 ? 66 : 58), 4.5, 4.5, seed + 42 + i, 0.3)} f={f} at={at + 36} dur={8} w={w * 0.7} wash={PARCH_LT} washOp={0.95} crisp />)}
          {sil ? null : [-24, -6, 12, 30, 46].map((cx, i) => <Ink key={`d${i}`} d={poly([[cx, hatY - 2], [cx + 6, hatY - 12], [cx + 12, hatY - 2]], seed + 50 + i, 0.4)} f={f} at={at + 38} dur={8} w={w * 0.5} op={0.7} />)}
          <Ink d={wob([[-36, hatY - 6], [-80, hatY + 10], [-96, hatY + 60]], seed + 56, 1)} f={f} at={at + 30} dur={16} w={w * 1.1} op={0.8} />
        </g>
      );
    if (hat === 'cap' || hat === 'turban') {
      const big = hat === 'turban' ? 1.25 : 1;
      return (
        <g>
          <Ink d={ell(6, hatY - 6 * big, 54 * big, 32 * big, seed + 40, 1.4)} f={f} at={at + 20} dur={22} w={w * 1.1} wash={tc} washOp={sil ? 0.93 : 0.5} />
          {sil ? null : [0, 1, 2].map((i) => <Ink key={i} d={wob([[-40 * big, hatY - 6 + (i - 1) * 12 * big], [0, hatY - 18 * big + (i - 1) * 12 * big], [48 * big, hatY - 8 + (i - 1) * 12 * big]], seed + 41 + i, 0.8)} f={f} at={at + 32 + i * 2} dur={12} w={w * 0.6} op={0.65} />)}
        </g>
      );
    }
    return null;
  })();
  return (
    <g transform={`translate(${x} ${y + bob * s}) scale(${s * dir} ${s}) rotate(${bow} 0 ${bowY})`} opacity={op}>
      {run !== undefined ? (
        <g>
          <Limb d={wob([[-8, -90], [-8 + legSw * 0.7, -44], [-8 + legSw * 1.3, 0]], seed + 60, 1)} f={f} at={at} dur={6} w={26 * 0.9} core={sil ? INK : PARCH_LT} col={INK} />
          <Limb d={wob([[18, -90], [18 - legSw * 0.7, -44], [18 - legSw * 1.3, 0]], seed + 61, 1)} f={f} at={at} dur={6} w={26 * 0.9} core={sil ? INK : PARCH_LT} col={INK} />
        </g>
      ) : null}
      <path d={robeD} fill={sil ? INK : FIG_BASE} />
      <Ink d={robeD} f={f} at={at} dur={34} w={w * 1.2} wash={tone} washOp={tOp} />
      {sil ? <Ink d={robeD} f={f} at={at + 6} dur={34} w={w * 0.5} col={AMBER} op={0.7} /> : null}
      {sil ? null : <Wash d={shD} f={f} at={at + 6} fill={INK} op={0.3} over={14} />}
      {sil ? null : <Hatch id={`${id}h`} clip={shD} area={bbox(shadow)} gap={13} ang={64} f={f} at={at + 8} dur={28} w={w * 0.5} op={0.6} seed={seed + 3} />}
      {sil
        ? null
        : folds.map((q, i) => <Ink key={i} d={wob(q, seed + 30 + i, 1.8)} f={f} at={at + 16 + i * 3} dur={24} w={w * 0.75} op={0.7} />)}
      {sil || run !== undefined ? null : (
        <g>
          <Ink d={wob([[-84, hip + dy * 0.1], [10, hip + 12 + dy * 0.1], [104, hip - 6 + dy * 0.1]], seed + 70, 1.2)} f={f} at={at + 22} dur={18} w={w * 1.1} wash={trim} washOp={0.5} crisp />
          <Ink d={wob([[-84, hip + 16 + dy * 0.1], [10, hip + 28 + dy * 0.1], [104, hip + 8 + dy * 0.1]], seed + 71, 1.2)} f={f} at={at + 24} dur={18} w={w * 0.7} op={0.7} />
          <Ink d={seg(-132, -50, seated ? 288 : 150, -48, seed + 73, 1.8)} f={f} at={at + 30} dur={22} w={w * 0.9} col={INK} op={0.75} />
          <Ink d={wob([[40, -566 + dy], [28, -540 + dy], [38, -500 + dy]], seed + 74, 1)} f={f} at={at + 26} dur={12} w={w * 0.9} op={0.8} />
        </g>
      )}
      {sil || run !== undefined ? null : (
        <g>
          <Ink d={poly([[seated ? 262 : 126, -8], [seated ? 300 : 170, -14], [seated ? 336 : 206, -4], [seated ? 336 : 206, 4], [seated ? 262 : 126, 4]], seed + 75, 0.8, true)} f={f} at={at + 30} dur={10} w={w} wash={FIG_BASE} washOp={1} crisp />
        </g>
      )}
      <path d={wob(HEAD.map((q): Pt => [q[0], q[1] + dy]), seed + 1, 0.7, true)} fill={sil ? INK : '#e4cfa0'} />
      <Ink d={wob(HEAD.map((q): Pt => [q[0], q[1] + dy]), seed + 1, 0.7, true)} f={f} at={at + 12} dur={26} w={w * 1.05} wash={sil ? INK : PARCH_LT} washOp={sil ? 0.95 : 0.5} crisp />
      {sil ? null : (
        <g>
          <Ink d={wob([[-30, -650 + dy], [-20, -682 + dy], [10, -698 + dy], [22, -692 + dy], [8, -668 + dy], [0, -640 + dy], [-6, -610 + dy], [-18, -600 + dy], [-28, -630 + dy]], seed + 2, 0.8, true)} f={f} at={at + 18} dur={14} w={w * 0.6} wash={INK} washOp={0.5} crisp />
          <Ink d={wob([[34, -662 + dy], [46, -670 + dy], [60, -662 + dy]], seed + 3, 0.6)} f={f} at={at + 26} dur={8} w={w * 1.6} />
          <Ink d={wob([[38, -652 + dy], [48, -656 + dy], [56, -650 + dy]], seed + 4, 0.4)} f={f} at={at + 28} dur={8} w={w * 0.8} />
          <Ink d={seg(42, -646 + dy, 42 + eyeLen, -648 + dy, seed + 5, 0.4)} f={f} at={at + 28} dur={8} w={w * 1.4} />
          <circle cx={50} cy={-646 + dy} r={2.6} fill={INK} opacity={0.85 * draw((f - at - 30) / 6)} />
          <Ink d={wob([[-2, -652 + dy], [8, -658 + dy], [12, -640 + dy], [4, -624 + dy], [-4, -632 + dy]], seed + 6, 0.5, true)} f={f} at={at + 30} dur={8} w={w * 0.7} wash={PARCH_LT} washOp={0.6} crisp />
          <Ink d={seg(58, -598 + dy, 66, -602 + dy, seed + 7, 0.3)} f={f} at={at + 30} dur={6} w={w * 1.1} />
          <Ink d={wob([[70, -612 + dy], [66, -608 + dy], [72, -604 + dy]], seed + 8, 0.3)} f={f} at={at + 30} dur={6} w={w * 0.7} op={0.8} />
          <Ink d={wob([[18, -606 + dy], [32, -600 + dy], [40, -586 + dy]], seed + 9, 0.8)} f={f} at={at + 32} dur={10} w={w * 0.5} op={0.4} />
        </g>
      )}
      {beard ? (
        <g>
          <Ink d={wob([[56, -602 + dy], [60, -574 + dy], [50, -540 + dy], [30, -516 + dy], [4, -520 + dy], [-14, -552 + dy], [-12, -584 + dy], [10, -578 + dy], [34, -574 + dy]], seed + 10, 1, true)} f={f} at={at + 26} dur={20} w={w} wash={sil ? INK : SHADE} washOp={sil ? 0.93 : 0.55} crisp />
          {sil ? null : [[44, -568], [28, -548], [10, -556], [36, -532], [14, -536], [-2, -570]].map((q, i) => <Ink key={i} d={wob([[q[0], q[1] + dy], [q[0] + 8, q[1] + 12 + dy], [q[0] - 2, q[1] + 22 + dy]], seed + 11 + i, 0.5)} f={f} at={at + 34 + i} dur={8} w={w * 0.55} op={0.7} />)}
        </g>
      ) : null}
      {hatEl}
      {A ? (
        <g>
          <path d={wob(tube(A.pts, [24, 22, 19]), seed + 80, 0.8, true)} fill={sil ? INK : FIG_BASE} />
          <Ink d={wob(tube(A.pts, [24, 22, 19]), seed + 80, 0.8, true)} f={f} at={at + 18} dur={24} w={w * 1.05} wash={sil ? INK : tone} washOp={sil ? 0.93 : 0.4} crisp />
          {sil ? null : <Ink d={wob(A.pts.slice(0, 2), seed + 81, 1)} f={f} at={at + 28} dur={14} w={w * 0.55} op={0.5} />}
          {sil ? null : <Ink d={seg(A.pts[2][0] - 16, A.pts[2][1] - 10, A.pts[2][0] + 16, A.pts[2][1] + 10, seed + 82, 0.5)} f={f} at={at + 30} dur={8} w={w * 0.9} col={AMBER} />}
        </g>
      ) : null}
      {A ? <Hand x={A.pts[2][0]} y={A.pts[2][1]} s={0.4} rot={A.rot} pose={arm === 'point' ? 'press' : arm === 'out' ? 'open' : arm === 'raise' ? 'cup' : 'relax'} f={f} at={at + 24} dur={16} px={w * 0.7} sil={sil} seed={seed + 90} /> : null}
      {children}
    </g>
  );
};

/* ---------- emblem, columns, brick, scroll, lamp ---------- */

// The king's signet emblem: a crown over crossed staffs inside two rings.
export const Emblem = ({ cx, cy, r, f, at = 0, col = INK, op = 1, w = 4 }: { cx: number; cy: number; r: number; f: number; at?: number; col?: string; op?: number; w?: number }) => {
  const k = r / 100;
  return (
    <g>
      <Ink d={ell(cx, cy, r, r, 61, 0.6)} f={f} at={at} dur={14} w={w} col={col} op={op} />
      <Ink d={ell(cx, cy, r * 0.78, r * 0.78, 62, 0.6)} f={f} at={at + 2} dur={14} w={w * 0.7} col={col} op={op * 0.8} />
      <Ink d={poly([[cx - 40 * k, cy - 10 * k], [cx - 44 * k, cy - 46 * k], [cx - 22 * k, cy - 26 * k], [cx, cy - 56 * k], [cx + 22 * k, cy - 26 * k], [cx + 44 * k, cy - 46 * k], [cx + 40 * k, cy - 10 * k]], 63, 0.5, true)} f={f} at={at + 4} dur={14} w={w * 0.9} col={col} op={op} />
      <Ink d={seg(cx - 44 * k, cy + 2 * k, cx + 44 * k, cy + 2 * k, 64, 0.4)} f={f} at={at + 6} dur={8} w={w * 0.9} col={col} op={op} />
      <Ink d={seg(cx - 36 * k, cy + 12 * k, cx + 36 * k, cy + 56 * k, 65, 0.4)} f={f} at={at + 8} dur={10} w={w * 0.9} col={col} op={op} />
      <Ink d={seg(cx + 36 * k, cy + 12 * k, cx - 36 * k, cy + 56 * k, 66, 0.4)} f={f} at={at + 9} dur={10} w={w * 0.9} col={col} op={op} />
      {[-1, 0, 1].map((m) => (
        <Ink key={m} d={ell(cx + m * 24 * k, cy - 54 * k + Math.abs(m) * 10 * k, 4 * k, 4 * k, 67 + m, 0.2)} f={f} at={at + 10} dur={6} w={w * 0.6} col={col} op={op} />
      ))}
    </g>
  );
};

// A fluted column from y top to y bot: shaft, flutes, shadow side, capital with volutes, base.
export const Column = ({ id, x, top, bot, hw = 34, f, at = 0, seed = 7, px = 5, wash = SHADE, washOp = 0.22 }: { id: string; x: number; top: number; bot: number; hw?: number; f: number; at?: number; seed?: number; px?: number; wash?: string; washOp?: number }) => {
  const shaft: Pt[] = [[x - hw * 0.84, top], [x - hw, bot], [x + hw, bot], [x + hw * 0.84, top]];
  const shD = poly(shaft, seed, 2, true);
  const right = poly([[x + hw * 0.2, top], [x + hw * 0.12, bot], [x + hw, bot], [x + hw * 0.84, top]], seed + 1, 2, true);
  return (
    <g>
      <path d={shD} fill="#b99d70" opacity={0.96} />
      <Ink d={shD} f={f} at={at} dur={34} w={px} wash={wash} washOp={washOp} />
      <Wash d={right} f={f} at={at + 6} fill={INK} op={0.3} over={14} />
      <Hatch id={`${id}h`} clip={right} area={[x, top, hw, bot - top]} gap={14} ang={66} f={f} at={at + 10} dur={26} w={px * 0.5} op={0.55} seed={seed + 2} />
      {[-0.52, -0.18, 0.16, 0.5].map((m, i) => (
        <Ink key={i} d={seg(x + m * hw * 0.84, top + 20, x + m * hw, bot - 14, seed + 10 + i, 1)} f={f} at={at + 14 + i * 2} dur={26} w={px * 0.5} op={0.55} />
      ))}
      <Ink d={box(x - hw * 1.3, top - 26, hw * 2.6, 26, seed + 20, 1.2)} f={f} at={at + 20} dur={16} w={px} wash={wash} washOp={washOp + 0.1} />
      {[-1, 1].map((m) => (
        <Ink key={m} d={wob([[x + m * hw * 0.9, top - 4], [x + m * hw * 1.5, top - 6], [x + m * hw * 1.5, top + 22], [x + m * hw * 1.1, top + 24], [x + m * hw * 1.14, top + 10], [x + m * hw * 1.3, top + 10]], seed + 22 + m, 0.8)} f={f} at={at + 24} dur={14} w={px * 0.75} />
      ))}
      <Ink d={box(x - hw * 1.2, bot - 22, hw * 2.4, 22, seed + 26, 1.2)} f={f} at={at + 22} dur={14} w={px} wash={wash} washOp={washOp + 0.1} />
      <Ink d={box(x - hw * 1.4, bot - 2, hw * 2.8, 16, seed + 27, 1.2)} f={f} at={at + 24} dur={12} w={px} wash={wash} washOp={washOp + 0.14} />
    </g>
  );
};

// Brick courses in a rectangle: horizontal joints and staggered vertical joints in one path.
export const Brick = ({ x0, y0, x1, y1, rowH = 40, colW = 84, f, at = 0, dur = 50, w = 3, op = 0.5, seed = 3, wobble = 1 }: { x0: number; y0: number; x1: number; y1: number; rowH?: number; colW?: number; f: number; at?: number; dur?: number; w?: number; op?: number; seed?: number; wobble?: number }) => {
  const r = rng(seed);
  let d = '';
  const rows = Math.ceil((y1 - y0) / rowH);
  for (let i = 0; i <= rows; i++) {
    const y = Math.min(y1, y0 + i * rowH);
    d += `M ${r1(x0)} ${r1(y + (r() - 0.5) * wobble)} L ${r1(x1)} ${r1(y + (r() - 0.5) * wobble)} `;
    if (i < rows) {
      const yy = Math.min(y1, y + rowH);
      for (let x = x0 + (i % 2) * (colW / 2) + colW / 2; x < x1; x += colW) d += `M ${r1(x + (r() - 0.5) * 4)} ${r1(y)} L ${r1(x + (r() - 0.5) * 4)} ${r1(yy)} `;
    }
  }
  return <Ink d={d} f={f} at={at} dur={dur} w={w} op={op} />;
};

// A flat-lamp: a clay oil lamp with a flame; flick comes from the caller.
export const Lamp = ({ x, y, s = 1, fl, f, at = 0, px = 4 }: { x: number; y: number; s?: number; fl: number; f: number; at?: number; px?: number }) => {
  const w = px / s;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Ink d={wob([[-34, 0], [-30, 16], [0, 26], [30, 16], [38, 0]], 3, 0.8, false)} f={f} at={at} dur={14} w={w * 1.2} wash={SHADE} washOp={0.6} crisp />
      <Ink d={wob([[-34, 0], [-12, -10], [14, -10], [38, 0]], 4, 0.6)} f={f} at={at + 4} dur={10} w={w} />
      <Ink d={wob([[38, 0], [56, -6], [52, 6]], 5, 0.5)} f={f} at={at + 6} dur={8} w={w} />
      <Ink d={wob([[-34, 2], [-54, 6], [-46, 22], [-30, 14]], 6, 0.5)} f={f} at={at + 8} dur={10} w={w * 0.9} />
      <path d={`M 52 -6 Q ${58 + fl * 5} -30 52 -50 Q 40 -28 52 -6 Z`} fill={AMBER} stroke={INK} strokeWidth={w * 0.7} opacity={draw((f - at - 10) / 8)} />
    </g>
  );
};
