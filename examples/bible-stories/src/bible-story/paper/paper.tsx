import type { ReactNode } from 'react';
import { loadFont as loadGochi } from '@remotion/google-fonts/GochiHand';
import { clamp01, rng } from '../world';
import { NoiseHold, sheet } from '../noise';

// Paper parable toolkit for the Who stopped short. Flat cut-paper people on mottled
// parchment, heavy-lidded eyes, chalk on wood. The look is ported from the
// reference lane (flat paper, thick dark outline, soft inner shade, soft drop
// shadow, chalk that boils at 8 fps). The characters are our own bean people.
export type Pt = readonly [number, number];

export const INK = '#2a1a10';
export const CHALK = '#f4efe0';
export const WOOD = '#5b4129';
export const WOOD_DK = '#3b281a';
export const SHOE = '#3a2616';

export const gochi = loadGochi('normal', { weights: ['400'], subsets: ['latin'] });

const r1 = (n: number) => Math.round(n * 10) / 10;
export const ease = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerpPt = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
export const bell = (x: number, c: number, w: number) => Math.exp(-Math.pow((x - c) / w, 2));
export const back = (t: number) => {
  const u = clamp01(t);
  return 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
};

// Characters step on twos (12 fps). Returns the stepped frame number.
export const stepF = (f: number) => Math.floor((f * 12) / 30) * (30 / 12);
// Chalk redraws 8 times a second.
export const boilSeed = (f: number) => Math.floor((f * 8) / 30) * 7 + 3;

/* ---------- local space helpers ---------- */

// World point to a person's local space (inverse of translate, scale s, rotate, flip).
export const toLocal = (px: number, py: number, s: number, dir: number, rot: number, wx: number, wy: number): Pt => {
  const dx = (wx - px) / s;
  const dy = (wy - py) / s;
  const a = (-rot * Math.PI) / 180;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return [rx * dir, ry];
};
export const fromLocal = (px: number, py: number, s: number, dir: number, rot: number, p: Pt): Pt => {
  const a = (rot * Math.PI) / 180;
  const x = p[0] * dir;
  const y = p[1];
  return [px + s * (x * Math.cos(a) - y * Math.sin(a)), py + s * (x * Math.sin(a) + y * Math.cos(a))];
};

export const ik = (a: Pt, t: Pt, l1: number, l2: number, bend: number): { mid: Pt; end: Pt } => {
  let dx = t[0] - a[0];
  let dy = t[1] - a[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const maxd = l1 + l2 - 0.5;
  if (d > maxd) {
    dx *= maxd / d;
    dy *= maxd / d;
    d = maxd;
  }
  const mind = Math.abs(l1 - l2) + 1;
  if (d < mind) {
    dx *= mind / d;
    dy *= mind / d;
    d = mind;
  }
  const aa = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ang = Math.atan2(dy, dx) + bend * aa;
  return { mid: [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1], end: [a[0] + dx, a[1] + dy] };
};

/* ---------- filters and ground ---------- */

export const PaperDefs = ({ boil, whip = 0 }: { boil: number; whip?: number }) => (
  <defs>
    <NoiseHold names={['cut']} />
    {/* cut paper: a ragged edge, then a soft offset shadow. The edge noise (feTurbulence, seed 4, 0.03) is baked in public/noise. */}
    <filter id="cut" x="-25%" y="-25%" width="160%" height="160%" colorInterpolationFilters="sRGB">
      <feImage href={sheet('cut').href} x={sheet('cut').x} y={sheet('cut').y} width={sheet('cut').w} height={sheet('cut').h} preserveAspectRatio="none" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" result="edge" />
      <feGaussianBlur in="edge" stdDeviation={6} result="blur" />
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.55 0" result="tint" />
      <feOffset in="tint" dx={8} dy={10} result="shadow" />
      <feMerge>
        <feMergeNode in="shadow" />
        <feMergeNode in="edge" />
      </feMerge>
    </filter>
    {/* chalk: wobbling strokes with a gritty, eroded grain; the seed steps at 8 fps */}
    <filter id="chalk" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={boil} result="w" />
      <feDisplacementMap in="SourceGraphic" in2="w" scale={5} xChannelSelector="R" yChannelSelector="G" result="d" />
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={boil + 11} result="g" />
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  4 0 0 0 -1.05" result="gm" />
      <feComposite in="d" in2="gm" operator="in" />
    </filter>
    <filter id="whip" x="-40%" y="-5%" width="180%" height="110%">
      <feGaussianBlur stdDeviation={`${whip} 0`} />
    </filter>
    <radialGradient id="parchBase" gradientUnits="userSpaceOnUse" cx={540} cy={820} r={1250}>
      <stop offset="0" stopColor="#dbb87c" />
      <stop offset="0.5" stopColor="#c9a46a" />
      <stop offset="1" stopColor="#8a6234" />
    </radialGradient>
    <radialGradient id="burn" gradientUnits="userSpaceOnUse" cx={540} cy={940} r={1280}>
      <stop offset="0.42" stopColor="#1e0e04" stopOpacity={0} />
      <stop offset="0.82" stopColor="#1e0e04" stopOpacity={0.55} />
      <stop offset="1" stopColor="#1e0e04" stopOpacity={0.88} />
    </radialGradient>
    <radialGradient id="phoneGlow">
      <stop offset="0" stopColor="#eef8e2" stopOpacity={0.8} />
      <stop offset="0.5" stopColor="#e2f0d2" stopOpacity={0.32} />
      <stop offset="1" stopColor="#e2f0d2" stopOpacity={0} />
    </radialGradient>
    <radialGradient id="lampGlow">
      <stop offset="0" stopColor="#ffe9a8" stopOpacity={0.9} />
      <stop offset="0.45" stopColor="#f7c970" stopOpacity={0.35} />
      <stop offset="1" stopColor="#f7c970" stopOpacity={0} />
    </radialGradient>
  </defs>
);

// Mottled parchment: layered stains (baked turbulence, public/noise) that drift slowly, a burnt
// vignette that lifts and a warm wash for the ending.
export const Parchment = ({ f, warm = 0, drift = 0.25 }: { f: number; warm?: number; drift?: number }) => {
  const big = sheet('stainBig');
  const mid = sheet('stainMid');
  const fibre = sheet('fibre');
  const dx = Math.sin(f / 46) * 80 + f * drift;
  const dy = Math.cos(f / 58) * 60;
  return (
    <g>
      <NoiseHold names={['stainBig', 'stainMid', 'fibre']} />
      <rect x={0} y={0} width={1080} height={1920} fill="url(#parchBase)" />
      <g transform={`translate(${r1(dx - 60)} ${r1(dy - 60)})`}>
        <image href={big.href} x={big.x} y={big.y} width={big.w} height={big.h} preserveAspectRatio="none" style={{ mixBlendMode: 'multiply' }} />
        <image href={mid.href} x={mid.x} y={mid.y} width={mid.w} height={mid.h} preserveAspectRatio="none" style={{ mixBlendMode: 'multiply' }} opacity={0.7} />
      </g>
      <image href={fibre.href} x={fibre.x} y={fibre.y} width={fibre.w} height={fibre.h} preserveAspectRatio="none" style={{ mixBlendMode: 'multiply' }} opacity={0.35} />
      {warm > 0 ? <rect x={0} y={0} width={1080} height={1920} fill="#ffc470" style={{ mixBlendMode: 'soft-light' }} opacity={warm * 0.85} /> : null}
      {warm > 0 ? <rect x={0} y={0} width={1080} height={1920} fill="#f2b45a" style={{ mixBlendMode: 'multiply' }} opacity={warm * 0.22} /> : null}
    </g>
  );
};

// The burnt vignette and a warm wash, over the whole picture.
export const Burn = ({ vig = 1, warm = 0 }: { vig?: number; warm?: number }) => (
  <g>
    {warm > 0 ? <rect x={0} y={0} width={1080} height={1920} fill="#ffc470" style={{ mixBlendMode: 'soft-light' }} opacity={warm * 0.55} /> : null}
    <rect x={0} y={0} width={1080} height={1920} fill="url(#burn)" opacity={vig} />
  </g>
);

export const GroundShadow = ({ x, y, w, o = 0.28 }: { x: number; y: number; w: number; o?: number }) => (
  <ellipse cx={r1(x)} cy={r1(y)} rx={r1(w)} ry={r1(w * 0.1)} fill="#2a1408" opacity={o} style={{ mixBlendMode: 'multiply' }} />
);

// Camera: zoom about a fixed screen point, plus a pan.
export const Cam = ({ fx, fy, k, tx = 0, ty = 0, children }: { fx: number; fy: number; k: number; tx?: number; ty?: number; children: ReactNode }) => (
  <g transform={`translate(${r1(fx + tx)} ${r1(fy + ty)}) scale(${r1(k * 1000) / 1000}) translate(${-fx} ${-fy})`}>{children}</g>
);

/* ---------- chalk ---------- */

export const Chalk = ({ children, w = 7, op = 0.95 }: { children: ReactNode; w?: number; op?: number }) => (
  <g filter="url(#chalk)" fill="none" stroke={CHALK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={op}>
    {children}
  </g>
);

export const ChalkText = ({ x, y, size, rot = 0, children, anchor = 'middle' }: { x: number; y: number; size: number; rot?: number; children: string; anchor?: 'start' | 'middle' | 'end' }) => (
  <g filter="url(#chalk)" transform={`translate(${x} ${y}) rotate(${rot})`}>
    <text x={0} y={0} textAnchor={anchor} fontFamily={gochi.fontFamily} fontSize={size} fill={CHALK} letterSpacing={size * 0.04}>
      {children}
    </text>
  </g>
);

// A chalk smiley, in the spirit of the reference signpost doodle.
export const ChalkSmile = ({ x, y, r, sad = false }: { x: number; y: number; r: number; sad?: boolean }) => (
  <Chalk w={6}>
    <circle cx={x} cy={y} r={r} />
    <path d={`M ${x - r * 0.4} ${y - r * 0.2} l 0 ${r * 0.1} M ${x + r * 0.4} ${y - r * 0.2} l 0 ${r * 0.1}`} />
    <path d={sad ? `M ${x - r * 0.45} ${y + r * 0.55} Q ${x} ${y + r * 0.2} ${x + r * 0.45} ${y + r * 0.55}` : `M ${x - r * 0.45} ${y + r * 0.25} Q ${x} ${y + r * 0.7} ${x + r * 0.45} ${y + r * 0.25}`} />
  </Chalk>
);

export const ChalkArrow = ({ x, y, len, dir = 1 }: { x: number; y: number; len: number; dir?: 1 | -1 }) => (
  <Chalk w={7}>
    <path d={`M ${x} ${y} L ${x + dir * len} ${y}`} />
    <path d={`M ${x + dir * (len - 28)} ${y - 24} L ${x + dir * len} ${y} L ${x + dir * (len - 28)} ${y + 24}`} />
  </Chalk>
);

/* ---------- wood props ---------- */

const grain = (w: number, h: number, seed: number) => {
  const r = rng(seed);
  return Array.from({ length: 4 }, (_, i) => {
    const y = -h / 2 + ((i + 0.6) * h) / 4.2;
    const a = r() * 8 - 4;
    const b = r() * 8 - 4;
    return `M ${-w / 2 + 14} ${r1(y + a)} Q ${r1(-w * 0.1)} ${r1(y + b)} ${r1(w / 2 - 14)} ${r1(y - a)}`;
  });
};

// A wooden plank, optionally pointed like a direction sign, with chalk as children.
export const Plank = ({ x, y, w, h, rot = 0, point = 0, seed = 1, children }: { x: number; y: number; w: number; h: number; rot?: number; point?: -1 | 0 | 1; seed?: number; children?: ReactNode }) => {
  const t = h * 0.5;
  const d =
    point === 0
      ? `M ${-w / 2} ${-h / 2} L ${w / 2 - 8} ${-h / 2 - 3} L ${w / 2} ${h / 2} L ${-w / 2 + 6} ${h / 2 + 3} Z`
      : point > 0
        ? `M ${-w / 2} ${-h / 2} L ${w / 2 - t} ${-h / 2 - 3} L ${w / 2 + 26} 0 L ${w / 2 - t} ${h / 2 + 3} L ${-w / 2 + 6} ${h / 2} Z`
        : `M ${w / 2} ${-h / 2} L ${-w / 2 + t} ${-h / 2 - 3} L ${-w / 2 - 26} 0 L ${-w / 2 + t} ${h / 2 + 3} L ${w / 2 - 6} ${h / 2} Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={d} fill={WOOD} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      {grain(w, h, seed).map((g, i) => (
        <path key={i} d={g} fill="none" stroke={WOOD_DK} strokeWidth={3} opacity={0.55} strokeLinecap="round" />
      ))}
      <circle cx={point < 0 ? w / 2 - 18 : -w / 2 + 18} cy={0} r={5} fill={INK} />
      {children}
    </g>
  );
};

export const Post = ({ x, top, ground, w = 40 }: { x: number; top: number; ground: number; w?: number }) => (
  <g>
    <path d={`M ${x - w / 2} ${top} L ${x + w / 2 - 2} ${top + 3} L ${x + w / 2} ${ground} L ${x - w / 2 + 3} ${ground} Z`} fill="#4a3320" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d={`M ${x - 6} ${top + 20} L ${x - 4} ${ground - 10} M ${x + 8} ${top + 40} L ${x + 9} ${ground - 20}`} stroke={WOOD_DK} strokeWidth={3} opacity={0.6} />
  </g>
);

/* ---------- people ---------- */

export type PersonProps = {
  id: string;
  x: number;
  y: number;
  s?: number;
  dir?: 1 | -1;
  rot?: number;
  sq?: number;
  col: string;
  shade: string;
  iris?: string;
  ph?: number;
  stride?: number;
  lift?: number;
  swing?: number;
  hip?: number;
  bend?: number;
  legF?: Pt;
  legB?: Pt;
  armF?: Pt;
  armB?: Pt;
  headTilt?: number;
  lids?: readonly [number, number];
  lidCurve?: number;
  look?: Pt;
  mouth?: 'none' | 'line' | 'smile' | 'o';
  brow?: number;
  hat?: 'cap' | 'beanie' | 'none';
  tie?: boolean;
  tear?: boolean;
  tapes?: readonly number[];
  hands?: (h: { f: Pt; b: Pt }) => ReactNode;
  // Optional cut-paper costume layers (see paper-ancient). body sits on the torso, skirt over the legs, head over the skull and under the eyes.
  costume?: { body?: ReactNode; skirt?: ReactNode; head?: ReactNode };
};

const BODY = 'M -50 -352 C -90 -345 -96 -280 -84 -230 C -76 -190 -72 -170 -52 -158 L 52 -158 C 72 -170 76 -190 84 -230 C 96 -280 90 -345 50 -352 Z';
// The two ragged tear edges across the torso (local space), top edge then bottom edge.
const TEAR_TOP: Pt[] = [[-112, -272], [-84, -258], [-58, -276], [-30, -254], [0, -272], [28, -252], [58, -270], [86, -250], [112, -266]];
const TEAR_BOT: Pt[] = [[-112, -240], [-86, -226], [-60, -244], [-34, -222], [-4, -238], [26, -220], [56, -240], [86, -222], [112, -236]];
const line = (pts: readonly Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
const TAPE_X = [-64, -32, 0, 32, 64];
const TAPE_ROT = [-9, 7, -5, 10, -7];

export const Eye = ({ id, cx, cy, rx, ry, lid, look, iris, curve }: { id: string; cx: number; cy: number; rx: number; ry: number; lid: number; look: Pt; iris: string; curve: number }) => {
  const yl = cy - ry + 2 * ry * lid;
  if (lid > 0.94) {
    return (
      <g fill="none" stroke={INK} strokeLinecap="round">
        <path d={`M ${cx - rx} ${cy + 4} Q ${cx} ${cy + ry * 0.75} ${cx + rx} ${cy + 4}`} strokeWidth={8} />
        <path d={`M ${cx - rx * 0.7} ${cy + ry * 0.8} Q ${cx} ${cy + ry * 1.1} ${cx + rx * 0.7} ${cy + ry * 0.8}`} strokeWidth={3.5} opacity={0.6} />
      </g>
    );
  }
  const ix = cx + look[0] * (rx - 14);
  const iy = cy + look[1] * (ry - 12);
  return (
    <g>
      <clipPath id={id}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fbf6ea" />
      <g clipPath={`url(#${id})`}>
        <circle cx={r1(ix)} cy={r1(iy)} r={15} fill={iris} />
        <circle cx={r1(ix)} cy={r1(iy)} r={7.5} fill={INK} />
        <circle cx={r1(ix - 4)} cy={r1(iy - 5)} r={3} fill="#fff" />
        {lid > 0.002 ? <path d={`M ${cx - rx - 8} ${cy - ry - 12} L ${cx + rx + 8} ${cy - ry - 12} L ${cx + rx + 8} ${r1(yl)} Q ${cx} ${r1(yl + curve)} ${cx - rx - 8} ${r1(yl)} Z`} fill={INK} /> : null}
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth={5} />
      <path d={`M ${cx - rx * 0.8} ${cy + ry + 10} Q ${cx} ${cy + ry + 22} ${cx + rx * 0.8} ${cy + ry + 10}`} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" opacity={0.65} />
    </g>
  );
};

export const Limb = ({ pts, w, col }: { pts: readonly Pt[]; w: number; col: string }) => {
  const d = line(pts);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={w + 14} />
      <path d={d} stroke={col} strokeWidth={w} />
    </g>
  );
};

export const Foot = ({ p }: { p: Pt }) => <ellipse cx={r1(p[0] + 14)} cy={r1(p[1] - 6)} rx={32} ry={16} fill={SHOE} stroke={INK} strokeWidth={5} />;

export const Person = (p: PersonProps) => {
  const { id, x, y, s = 1, dir = 1, rot = 0, sq = 0, col, shade, iris = '#c4d49a', ph = 0, stride = 0, lift = 0, swing = 38, hip = 160, bend = 0, headTilt = 0 } = p;
  const lids = p.lids ?? [0.5, 0.5];
  const look = p.look ?? [0, 0];
  const lx: Pt = [look[0] * dir, look[1]];
  const dy = 160 - hip;
  const sh = (bend * Math.PI) / 180;
  const hipP: Pt = [0, -hip];
  const rotU = (q: Pt): Pt => {
    const ox = q[0] - hipP[0];
    const oy = q[1] - hipP[1];
    return [hipP[0] + ox * Math.cos(sh) - oy * Math.sin(sh), hipP[1] + ox * Math.sin(sh) + oy * Math.cos(sh)];
  };
  const foot = (a: number, hx: number): Pt => [hx + stride * Math.sin(a), -lift * Math.max(0, Math.cos(a))];
  const hipB: Pt = [-14, -hip];
  const hipF: Pt = [14, -hip];
  const footB = p.legB ?? foot(ph + Math.PI, hipB[0]);
  const footF = p.legF ?? foot(ph, hipF[0]);
  const lB = ik(hipB, footB, 88, 92, -1);
  const lF = ik(hipF, footF, 88, 92, -1);
  const shB = rotU([-12, -322 + dy]);
  const shF = rotU([12, -322 + dy]);
  const aB = p.armB ?? [shB[0] + swing * Math.sin(ph), shB[1] + 122 - 5 * Math.abs(Math.cos(ph))];
  const aF = p.armF ?? [shF[0] + swing * Math.sin(ph + Math.PI), shF[1] + 122 - 5 * Math.abs(Math.cos(ph))];
  const rB = ik(shB, aB, 66, 66, 1);
  const rF = ik(shF, aF, 66, 66, 1);
  const hat = p.hat ?? 'none';
  const ex = 38;
  const ey = -452;
  const fx = lx[0] * 10;
  const fy = lx[1] * 4;
  const mouth = p.mouth ?? 'none';
  const brow = p.brow ?? 0;
  const curve = p.lidCurve ?? 7;
  const tapes = p.tapes ?? [];
  const browPath = (sg: number) => {
    const inner = ex * 0.2;
    const innerY = ey - 52 + 10 * brow;
    const outerY = ey - 52 - 5 * brow;
    return `M ${fx + sg * inner} ${innerY + fy} Q ${fx + sg * ex} ${(innerY + outerY) / 2 - 8 + fy} ${fx + sg * (ex + 30)} ${outerY + fy}`;
  };
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
      <g filter="url(#cut)">
        <g transform={`rotate(${r1(rot)}) scale(${r1(dir * (1 + sq) * 1000) / 1000} ${r1((1 - sq) * 1000) / 1000})`}>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0.15">
              <stop offset="0" stopColor={col} />
              <stop offset="0.55" stopColor={col} />
              <stop offset="1" stopColor={shade} />
            </linearGradient>
            <clipPath id={`${id}-b`}>
              <path d={BODY} />
            </clipPath>
            <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={-200} y={-500} width={400} height={600}>
              <rect x={-200} y={-500} width={400} height={600} fill="#fff" />
              <path d={`${line(TEAR_TOP)} ${TEAR_BOT.slice().reverse().map((q) => `L ${q[0]} ${q[1]}`).join(' ')} Z`} fill="#000" />
            </mask>
          </defs>
          <Limb pts={[shB, rB.mid, rB.end]} w={17} col={col} />
          <circle cx={r1(rB.end[0])} cy={r1(rB.end[1])} r={15} fill={col} stroke={INK} strokeWidth={6} />
          <Limb pts={[hipB, lB.mid, lB.end]} w={20} col={col} />
          <Foot p={lB.end} />
          <g transform={`translate(0 ${dy})`}>
            <g transform={`rotate(${bend} 0 ${-hip - dy})`}>
              <path d={BODY} fill={`url(#${id}-g)`} stroke={INK} strokeWidth={7} strokeLinejoin="round" mask={p.tear ? `url(#${id}-m)` : undefined} />
              {p.tear ? (
                <g clipPath={`url(#${id}-b)`}>
                  <path d={line(TEAR_TOP.map((q): Pt => [q[0], q[1] - 6]))} fill="none" stroke="#fff6dc" strokeWidth={4} opacity={0.8} />
                  <path d={line(TEAR_BOT.map((q): Pt => [q[0], q[1] + 6]))} fill="none" stroke="#fff6dc" strokeWidth={4} opacity={0.8} />
                  <path d={line(TEAR_TOP)} fill="none" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
                  <path d={line(TEAR_BOT)} fill="none" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
                </g>
              ) : null}
              {p.tie ? <path d="M -10 -346 L 10 -346 L 7 -262 L 0 -240 L -7 -262 Z" fill="#6b2e1c" stroke={INK} strokeWidth={5} strokeLinejoin="round" /> : null}
              {p.costume?.body}
              {tapes.map((a, i) =>
                a > 0 ? (
                  <g key={i} transform={`translate(${TAPE_X[i]} -247) rotate(${TAPE_ROT[i]}) scale(${r1(back(a) * 1000) / 1000})`}>
                    <path d="M -17 -48 L -9 -43 L -1 -49 L 8 -43 L 17 -48 L 17 48 L 9 43 L 0 49 L -8 43 L -17 48 Z" fill="#ead9a0" stroke="#a8925a" strokeWidth={3} strokeLinejoin="round" opacity={0.93} />
                    <path d="M -9 -34 L -9 34 M 8 -34 L 8 34" stroke="#c9b377" strokeWidth={2} opacity={0.7} />
                  </g>
                ) : null,
              )}
              <g transform={`rotate(${headTilt} 0 -350)`}>
                <circle cx={0} cy={-440} r={100} fill={`url(#${id}-g)`} stroke={INK} strokeWidth={7} />
                {hat === 'cap' ? (
                  <g>
                    <path d="M -98 -462 C -96 -548 96 -548 98 -462 C 60 -478 -60 -478 -98 -462 Z" fill="#4a3020" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
                    <path d="M 38 -470 L 132 -458 L 126 -440 L 36 -452 Z" fill="#3a2414" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
                  </g>
                ) : null}
                {hat === 'beanie' ? (
                  <g>
                    <path d="M -100 -452 C -112 -566 112 -566 100 -452 Z" fill={shade} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
                    <path d="M -102 -470 Q 0 -440 102 -470 L 100 -446 Q 0 -418 -100 -446 Z" fill="#6f8a77" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
                  </g>
                ) : null}
                {p.costume?.head}
                <Eye id={`${id}-eL`} cx={fx - ex} cy={ey + fy} rx={32} ry={28} lid={lids[0]} look={lx} iris={iris} curve={curve} />
                <Eye id={`${id}-eR`} cx={fx + ex} cy={ey + fy} rx={32} ry={28} lid={lids[1]} look={lx} iris={iris} curve={curve} />
                {brow !== 0 ? (
                  <g fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round">
                    <path d={browPath(-1)} />
                    <path d={browPath(1)} />
                  </g>
                ) : null}
                {mouth === 'line' ? <path d={`M ${fx - 24} ${-380 + fy} Q ${fx} ${-374 + fy} ${fx + 24} ${-382 + fy}`} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" /> : null}
                {mouth === 'smile' ? <path d={`M ${fx - 26} ${-388 + fy} Q ${fx} ${-366 + fy} ${fx + 26} ${-388 + fy}`} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" /> : null}
                {mouth === 'o' ? <ellipse cx={fx} cy={-380 + fy} rx={10} ry={13} fill={INK} /> : null}
              </g>
            </g>
          </g>
          <Limb pts={[hipF, lF.mid, lF.end]} w={20} col={col} />
          <Foot p={lF.end} />
          {p.costume?.skirt}
          <Limb pts={[shF, rF.mid, rF.end]} w={17} col={col} />
          <circle cx={r1(rF.end[0])} cy={r1(rF.end[1])} r={15} fill={col} stroke={INK} strokeWidth={6} />
          {p.hands ? p.hands({ f: rF.end, b: rB.end }) : null}
        </g>
      </g>
    </g>
  );
};

// Two trouser legs seen from a low camera, the body above the frame. Used for the
// feet that stride across the opening shot.
export const TrouserLegs = ({ x, y, s, ph, stride, lift, col, dir = 1 }: { x: number; y: number; s: number; ph: number; stride: number; lift: number; col: string; dir?: 1 | -1 }) => {
  const hip = 150;
  const mk = (a: number, hx: number) => {
    const hp: Pt = [hx, -hip];
    const ft: Pt = [hx + stride * Math.sin(a), -lift * Math.max(0, Math.cos(a))];
    const k = ik(hp, ft, 88, 92, -1);
    const up: Pt = [hp[0] + (hp[0] - k.mid[0]) * 14, hp[1] + (hp[1] - k.mid[1]) * 14];
    return { pts: [k.end, k.mid, hp, up] as Pt[], foot: k.end };
  };
  const b = mk(ph + Math.PI, -16);
  const f = mk(ph, 16);
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
      <g filter="url(#cut)">
        <g transform={`scale(${dir} 1)`}>
          <Limb pts={b.pts} w={30} col={col} />
          <Foot p={b.foot} />
          <Limb pts={f.pts} w={30} col={col} />
          <Foot p={f.foot} />
        </g>
      </g>
    </g>
  );
};

// Small hand props, drawn in a person's local space at a hand position.
export const Phone = ({ at }: { at: Pt }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])})`}>
    <circle cx={0} cy={-22} r={150} fill="url(#phoneGlow)" />
    <g transform="rotate(-8)">
      <rect x={-19} y={-44} width={38} height={64} rx={7} fill="#241a14" stroke={INK} strokeWidth={4} />
      <rect x={-14} y={-38} width={28} height={50} rx={4} fill="#eaf5de" />
    </g>
    <circle cx={0} cy={0} r={14} fill="none" />
  </g>
);

export const Cup = ({ at, steam }: { at: Pt; steam: number }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])})`}>
    <path d="M -22 -62 L 22 -62 L 17 4 L -17 4 Z" fill="#f4ecd8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M -20 -40 L 20 -40 L 18 -12 L -18 -12 Z" fill="#7a4a26" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d="M -25 -68 L 25 -68 L 24 -58 L -24 -58 Z" fill="#d9c9a4" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <g transform={`translate(0 ${-80 - steam})`}>
      <Chalk w={5} op={0.8}>
        <path d={`M -9 0 q -10 -14 0 -26 q 10 -12 0 -26`} />
        <path d={`M 10 -4 q -10 -12 0 -24`} />
      </Chalk>
    </g>
  </g>
);

export const Watch = ({ at }: { at: Pt }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])})`}>
    <circle cx={-2} cy={-8} r={13} fill="#f4ecd8" stroke={INK} strokeWidth={5} />
    <path d="M -2 -8 L -2 -15 M -2 -8 L 4 -6" stroke={INK} strokeWidth={3} strokeLinecap="round" />
  </g>
);
