import type { ReactNode } from 'react';
import { rng } from './world';

// 1930s rubber-hose toolkit, ported from the huashu 33_rubberhose recipe to SVG:
// beat bounce on twos, pie eyes, noodle arms, white gloves, and the film layer.
export const INK = '#141210';
export const PAPER = '#efe7d2';
export const LT = '#d9d0b8';
export const MID = '#a39a84';
export const DK = '#5e574b';
export const WHITE = '#fbf7ec';
export const SKIN = '#f6f0e0';
export const BEAT = 60 / 128;
export const FILM_W = 1080;
export const FILM_H = 1920;

const r1 = (n: number) => Math.round(n * 10) / 10;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Characters and motifs step at 12 fps (on twos); only the film layer runs at 24.
export const stepT = (f: number) => Math.floor((f / 30) * 12) / 12;
export const bnc = (tq: number, ph = 0) => Math.abs(Math.sin(Math.PI * (tq / BEAT + ph)));

// Bounce about a ground point: squash on landing, stretch in the air.
export const boing = (ax: number, ay: number, b: number, amp: number, k = 1) => {
  const sq = (1 - b) * 0.09 * k;
  const st = b * 0.05 * k;
  return `translate(${r1(ax)} ${r1(ay - b * amp)}) scale(${r1((1 + sq - st * 0.6) * 1000) / 1000} ${r1((1 - sq + st) * 1000) / 1000}) translate(${r1(-ax)} ${r1(-ay)})`;
};

// Catmull-Rom through the points, as cubic beziers.
export const smooth = (pts: number[][], closed = true) => {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    d += ` C ${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
};

type ShapeProps = { d: string; fill?: string; w?: number; opacity?: number; stroke?: string; transform?: string };
export const Shape = ({ d, fill = 'none', w = 6, opacity, stroke = INK, transform }: ShapeProps) => (
  <path d={d} fill={fill} stroke={stroke} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" opacity={opacity} transform={transform} />
);

type EllProps = { x: number; y: number; rx: number; ry: number; fill?: string; w?: number; rot?: number };
export const Ell = ({ x, y, rx, ry, fill = WHITE, w = 6, rot = 0 }: EllProps) => (
  <ellipse cx={r1(x)} cy={r1(y)} rx={r1(rx)} ry={r1(ry)} fill={fill} stroke={INK} strokeWidth={w} transform={rot ? `rotate(${rot} ${r1(x)} ${r1(y)})` : undefined} />
);

// Pie-cut eye: white socket, black pupil with a wedge cut out, optional lashes.
export const PieEye = ({ x, y, rx, ry, look = 0, lookY = 0, shut = false, lash = false, w = 4.5, pupil = 1 }: { x: number; y: number; rx: number; ry: number; look?: number; lookY?: number; shut?: boolean; lash?: boolean; w?: number; pupil?: number }) => {
  if (shut) {
    return <path d={`M ${r1(x - rx)} ${r1(y + ry * 0.1)} Q ${r1(x)} ${r1(y + ry * 1.0)} ${r1(x + rx)} ${r1(y + ry * 0.1)}`} fill="none" stroke={INK} strokeWidth={w + 1.5} strokeLinecap="round" />;
  }
  const px = x + look * rx * 0.35;
  const py = y + ry * 0.25 + lookY * ry * 0.35;
  const a1 = -1.45;
  const a2 = -0.85;
  const wedge = `M ${r1(px + rx * 0.05)} ${r1(py - ry * 0.05)} L ${r1(px + Math.cos(a1) * ry)} ${r1(py + Math.sin(a1) * ry)} A ${r1(ry)} ${r1(ry)} 0 0 1 ${r1(px + Math.cos(a2) * ry)} ${r1(py + Math.sin(a2) * ry)} Z`;
  return (
    <g>
      <ellipse cx={r1(x)} cy={r1(y)} rx={r1(rx)} ry={r1(ry)} fill={WHITE} stroke={INK} strokeWidth={w} />
      <ellipse cx={r1(px)} cy={r1(py)} rx={r1(rx * 0.62 * pupil)} ry={r1(ry * 0.7 * pupil)} fill={INK} />
      <path d={wedge} fill={WHITE} />
      <ellipse cx={r1(x)} cy={r1(y)} rx={r1(rx)} ry={r1(ry)} fill="none" stroke={INK} strokeWidth={w} />
      {lash
        ? [0, 1, 2].map((k) => {
            const a = -2.5 + k * 0.45;
            return <path key={k} d={`M ${r1(x + Math.cos(a) * rx)} ${r1(y + Math.sin(a) * ry)} L ${r1(x + Math.cos(a) * (rx + 14))} ${r1(y + Math.sin(a) * (ry + 14))}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />;
          })
        : null}
    </g>
  );
};

// Spiral eye for the knocked-out giant.
export const SpiralEye = ({ x, y, r, rot }: { x: number; y: number; r: number; rot: number }) => {
  let d = '';
  for (let i = 0; i <= 44; i++) {
    const a = (i / 44) * Math.PI * 5 + rot;
    const rr = (i / 44) * r * 0.88;
    d += `${i ? ' L' : 'M'} ${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`;
  }
  return (
    <g>
      <circle cx={r1(x)} cy={r1(y)} r={r1(r)} fill={WHITE} stroke={INK} strokeWidth={5} />
      <path d={d} fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

const hoseCtl = (a: number[], b: number[], bend: number) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  return [(a[0] + b[0]) / 2 - (dy / L) * bend, (a[1] + b[1]) / 2 + (dx / L) * bend];
};

// Noodle limb: one constant-width quadratic bezier with a black outline.
export const Hose = ({ a, b, bend, w, col, ol = 10 }: { a: number[]; b: number[]; bend: number; w: number; col: string; ol?: number }) => {
  const c = hoseCtl(a, b, bend);
  const d = `M ${r1(a[0])} ${r1(a[1])} Q ${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}`;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={INK} strokeWidth={w + ol} />
      <path d={d} stroke={col} strokeWidth={w} />
    </g>
  );
};
export const endAngle = (a: number[], b: number[], bend: number) => {
  const c = hoseCtl(a, b, bend);
  return (Math.atan2(b[1] - c[1], b[0] - c[0]) * 180) / Math.PI;
};

// White four-finger glove, turned-back cuff, three lines on the back of the hand.
export const Glove = ({ x, y, ang, s = 1 }: { x: number; y: number; ang: number; s?: number }) => (
  <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)}) scale(${s})`}>
    <Shape d={smooth([[-30, -14], [-8, -24], [16, -22], [30, -12], [34, 4], [24, 20], [4, 24], [-20, 18], [-32, 4]])} fill={WHITE} w={5} />
    {[[28, -18], [36, -6], [36, 8]].map(([fx, fy], i) => (
      <Ell key={i} x={fx} y={fy} rx={11} ry={8} fill={WHITE} w={5} rot={11} />
    ))}
    <Shape d={smooth([[-30, -20], [-46, -26], [-50, 0], [-46, 26], [-30, 20], [-26, 0]])} fill={WHITE} w={5} />
    {[-6, 2, 10].map((xx) => (
      <path key={xx} d={`M ${xx - 10} ${xx * 0.2 - 2} L ${xx + 2} ${xx * 0.2 - 4}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
    ))}
  </g>
);

// Arm = hose + glove aligned to its end.
export const Arm = ({ a, b, bend, w = 22, col = SKIN, gs = 1 }: { a: number[]; b: number[]; bend: number; w?: number; col?: string; gs?: number }) => {
  const ang = endAngle(a, b, bend);
  const rad = (ang * Math.PI) / 180;
  return (
    <g>
      <Hose a={a} b={b} bend={bend} w={w} col={col} />
      <Glove x={b[0] + Math.cos(rad) * 30 * gs} y={b[1] + Math.sin(rad) * 30 * gs} ang={ang} s={gs} />
    </g>
  );
};

export const Star = ({ x, y, r, rot = 0, fill = WHITE, w = 5 }: { x: number; y: number; r: number; rot?: number; fill?: string; w?: number }) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + rot;
    const rr = i % 2 ? r * 0.42 : r;
    d += `${i ? ' L' : 'M'} ${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`;
  }
  return <path d={`${d} Z`} fill={fill} stroke={INK} strokeWidth={w} strokeLinejoin="round" />;
};

// Radial speed lines around a centre, re-rolled each step.
export const SpeedLines = ({ cx, cy, r0, r1: rOut, n, seed, w = 7, col = INK, opacity = 1 }: { cx: number; cy: number; r0: number; r1: number; n: number; seed: number; w?: number; col?: string; opacity?: number }) => {
  const r = rng(seed);
  return (
    <g stroke={col} strokeWidth={w} strokeLinecap="round" opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.18;
        const a0 = r0 * (0.9 + r() * 0.5);
        const a1 = a0 + (rOut - r0) * (0.4 + r() * 0.6);
        return <line key={i} x1={r1(cx + Math.cos(a) * a0)} y1={r1(cy + Math.sin(a) * a0)} x2={r1(cx + Math.cos(a) * a1)} y2={r1(cy + Math.sin(a) * a1)} />;
      })}
    </g>
  );
};

// Cartoon dust: circles drawn as a black union first, then filled, so the cloud has one outline.
const CLUSTER = [[0, 0, 1], [-0.58, 0.16, 0.64], [0.6, 0.12, 0.7], [0.08, -0.5, 0.6]];
export const Puffs = ({ items, fill = LT, ol = 7 }: { items: { x: number; y: number; r: number }[]; fill?: string; ol?: number }) => (
  <g>
    {items.map((p, i) =>
      p.r > 1 ? (
        <g key={i}>
          {CLUSTER.map(([dx, dy, k], j) => (
            <circle key={`o${j}`} cx={r1(p.x + dx * p.r)} cy={r1(p.y + dy * p.r)} r={r1(p.r * k + ol)} fill={INK} />
          ))}
          {CLUSTER.map(([dx, dy, k], j) => (
            <circle key={`f${j}`} cx={r1(p.x + dx * p.r)} cy={r1(p.y + dy * p.r)} r={r1(p.r * k)} fill={i % 3 === 0 ? WHITE : fill} />
          ))}
          {p.r > 30 ? <path d={`M ${r1(p.x - p.r * 0.5)} ${r1(p.y + p.r * 0.2)} A ${r1(p.r * 0.5)} ${r1(p.r * 0.5)} 0 0 1 ${r1(p.x + p.r * 0.15)} ${r1(p.y - p.r * 0.35)}`} fill="none" stroke={MID} strokeWidth={5} strokeLinecap="round" /> : null}
        </g>
      ) : null,
    )}
  </g>
);

// Sepia newsprint: desaturate, then multiply with #f2e8d2.
export const SepiaDefs = () => (
  <defs>
    <filter id="sepia" x={-100} y={-100} width={FILM_W + 200} height={FILM_H + 200} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="0.2838 0.5571 0.1082 0 0  0.2721 0.5342 0.1037 0 0  0.2464 0.4837 0.0939 0 0  0 0 0 1 0" />
    </filter>
  </defs>
);

const GATE_R = 60;
const gatePath = (() => {
  const g = 6;
  const w = FILM_W - g * 2;
  const h = FILM_H - g * 2;
  const r = GATE_R;
  return `M 0 0 H ${FILM_W} V ${FILM_H} H 0 Z M ${g + r} ${g} H ${g + w - r} A ${r} ${r} 0 0 1 ${g + w} ${g + r} V ${g + h - r} A ${r} ${r} 0 0 1 ${g + w - r} ${g + h} H ${g + r} A ${r} ${r} 0 0 1 ${g} ${g + h - r} V ${g + r} A ${r} ${r} 0 0 1 ${g + r} ${g} Z`;
})();

// Gate weave, in pixels, at 24 fps.
export const weave = (f: number) => {
  const r = rng(Math.floor((f / 30) * 24) * 7919 + 31);
  return [(r() - 0.5) * 3, (r() - 0.5) * 4];
};

// Flicker, scratches, dust, hair, grain, vignette and the rounded gate.
export const Film = ({ f }: { f: number }): ReactNode => {
  const fi = Math.floor((f / 30) * 24);
  const r = rng(fi * 7919 + 101);
  const whiteA = 0.02 + r() * 0.07;
  const blackA = r() * 0.06;
  const si = Math.floor((f / 30) * 6);
  const scratches = Array.from({ length: 3 }, (_, k) => {
    const rs = rng(si * 131 + k * 977 + 5);
    const x = rs() * FILM_W;
    const y1 = rs() * 500;
    const y2 = FILM_H - rs() * 500;
    return { x, y1, y2, a: 0.22 + rs() * 0.3, wh: rs() > 0.55, wd: 1.2 + rs() * 1.6 };
  });
  const specks = Array.from({ length: 14 }, () => ({ x: r() * FILM_W, y: r() * FILM_H, rx: 1.5 + r() * 4, ry: 1.5 + r() * 3.5, a: 0.35 + r() * 0.45, wh: r() > 0.7 }));
  const hair = r() < 0.3 ? { x: r() * FILM_W, y: r() * FILM_H, l: 50 + r() * 100, c: (r() - 0.5) * 70, rot: r() * 180 } : null;
  const gx = (r() - 0.5) * 40;
  const gy = (r() - 0.5) * 40;
  return (
    <>
      <svg width={FILM_W} height={FILM_H} viewBox={`0 0 ${FILM_W} ${FILM_H}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="vig" cx="50%" cy="50%" r="72%">
            <stop offset="0.55" stopColor="#3c2e19" stopOpacity={0} />
            <stop offset="1" stopColor="#3c2e19" stopOpacity={0.52} />
          </radialGradient>
        </defs>
        <rect width={FILM_W} height={FILM_H} fill="url(#vig)" />
        <rect width={FILM_W} height={FILM_H} fill="#fff" opacity={whiteA} />
        <rect width={FILM_W} height={FILM_H} fill="#000" opacity={blackA} />
        {scratches.map((s, i) => (
          <line key={i} x1={s.x} y1={s.y1} x2={s.x + (i - 1) * 3} y2={s.y2} stroke={s.wh ? '#fffbe9' : INK} strokeWidth={s.wd} opacity={s.a} />
        ))}
        {specks.map((p, i) => (
          <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={p.wh ? '#fffbe9' : INK} opacity={p.a} />
        ))}
        {hair ? <path d={`M ${hair.x} ${hair.y} q ${hair.c} ${hair.l / 2} ${hair.c / 2} ${hair.l}`} transform={`rotate(${hair.rot} ${hair.x} ${hair.y})`} fill="none" stroke={INK} strokeWidth={1.6} opacity={0.55} /> : null}
        <path d={gatePath} fill="#0c0a08" fillRule="evenodd" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.55 }}>
        <svg width={FILM_W} height={FILM_H} viewBox={`0 0 ${FILM_W} ${FILM_H}`} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="grain" x={0} y={0} width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={2} seed={fi % 97} />
              <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" />
            </filter>
          </defs>
          <rect x={gx - 30} y={gy - 30} width={FILM_W + 60} height={FILM_H + 60} filter="url(#grain)" />
        </svg>
      </div>
    </>
  );
};
