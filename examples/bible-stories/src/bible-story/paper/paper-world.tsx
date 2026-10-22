import type { ReactNode } from 'react';
import { INK, bell } from './paper';
import type { Pt } from './paper';
import { Deep, smooth, torn } from './paper-ancient';
import { clamp01, rng } from '../world';

// The old world for the Who stopped long cut: warm parchment, desert hills cut from
// three or four layers of torn card, a twisting road, rocks, palms, an old town square
// and an inn. Every scene stacks background, midground and foreground layers that move
// at their own depth with the camera.
const r1 = (n: number) => Math.round(n * 10) / 10;
const CREAM_EDGE = '#f1e3bf';

/* ---------- the road ---------- */

// The road's centre line, as control points x, y and the figure scale s there.
const RP: readonly (readonly [number, number, number])[] = [
  [-60, 985, 0.4],
  [200, 1040, 0.5],
  [470, 1150, 0.7],
  [720, 1318, 1.0],
  [960, 1430, 1.2],
  [1240, 1500, 1.3],
  [1560, 1520, 1.34],
  [1900, 1530, 1.36],
];
export const ROAD_MAX = RP.length - 1;
const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
// t runs 0 to ROAD_MAX along the road.
export const roadAt = (t: number): { x: number; y: number; s: number } => {
  const i = Math.max(0, Math.min(ROAD_MAX - 1, Math.floor(t)));
  const u = Math.max(0, Math.min(ROAD_MAX, t)) - i;
  const g = (k: number) => RP[Math.max(0, Math.min(ROAD_MAX, k))];
  const q = (c: number) => cr(g(i - 1)[c], g(i)[c], g(i + 1)[c], g(i + 2)[c], u);
  return { x: q(0), y: q(1), s: q(2) };
};
// Half the visible depth of the road, at a place along it.
const halfDepth = (s: number) => 96 * s;

const RoadBand = ({ t0 = 0, t1 = ROAD_MAX }: { t0?: number; t1?: number }) => {
  const n = 40;
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const p = roadAt(t0 + ((t1 - t0) * i) / n);
    top.push([p.x, p.y - halfDepth(p.s)]);
    bot.push([p.x, p.y + halfDepth(p.s)]);
  }
  const inTop = top.map((q, i): Pt => [q[0], q[1] + (bot[i][1] - top[i][1]) * 0.22]);
  const inBot = bot.map((q, i): Pt => [q[0], q[1] - (bot[i][1] - top[i][1]) * 0.18]);
  const outline = `${smooth(top)} ${smooth(bot.slice().reverse()).replace('M', 'L')} Z`;
  const worn = `${smooth(inTop)} ${smooth(inBot.slice().reverse()).replace('M', 'L')} Z`;
  const rut1: Pt[] = top.map((q, i) => [q[0], q[1] + (bot[i][1] - top[i][1]) * 0.42]);
  const rut2: Pt[] = top.map((q, i) => [q[0], q[1] + (bot[i][1] - top[i][1]) * 0.62]);
  const r = rng(77);
  const stones = Array.from({ length: 34 }, (_, i) => {
    const p = roadAt(t0 + (t1 - t0) * r());
    const yy = p.y + (r() - 0.5) * 1.5 * halfDepth(p.s);
    return <ellipse key={i} cx={r1(p.x)} cy={r1(yy)} rx={(7 + r() * 9) * p.s} ry={(4 + r() * 4) * p.s} fill="#c9a46c" stroke={INK} strokeWidth={3} opacity={0.8} />;
  });
  return (
    <g>
      <path d={outline} fill={CREAM_EDGE} transform="translate(0 -8)" />
      <path d={outline} fill="#dcbf86" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      <path d={worn} fill="#ecd7a4" opacity={0.85} />
      <path d={smooth(rut1)} fill="none" stroke="#a98348" strokeWidth={5} opacity={0.55} strokeLinecap="round" strokeDasharray="60 26" />
      <path d={smooth(rut2)} fill="none" stroke="#a98348" strokeWidth={5} opacity={0.55} strokeLinecap="round" strokeDasharray="40 30" />
      {stones}
    </g>
  );
};

/* ---------- torn card hills ---------- */

type HillProps = { id: string; top: readonly Pt[]; fill: string; deep: string; seed: number; bottom?: number; strata?: number; children?: ReactNode };
// A hill cut from torn card: a cream core shows along the torn top edge, then the fill
// shades toward the foot, with a few strata lines and flecks.
export const Hill = ({ id, top, fill, deep, seed, bottom = 2300, strata = 3, children }: HillProps) => {
  const pts: Pt[] = [...top, [top[top.length - 1][0], bottom], [top[0][0], bottom]];
  const d = torn(pts, seed, 5, 70);
  const minY = Math.min(...top.map((p) => p[1]));
  const r = rng(seed + 9);
  const lines = Array.from({ length: strata }, (_, k) => {
    const sh: Pt[] = top.map((p, i): Pt => [p[0], p[1] + 58 * (k + 1) + Math.sin(i * 1.7 + k) * 16]);
    return <path key={k} d={smooth(sh)} fill="none" stroke={deep} strokeWidth={5} opacity={0.3} strokeLinecap="round" strokeDasharray={`${120 + k * 40} 36`} />;
  });
  const flecks = Array.from({ length: 22 }, (_, i) => {
    const xi = r() * (top[top.length - 1][0] - top[0][0]) + top[0][0];
    const yi = minY + 70 + r() * 420;
    return <path key={i} d={`M ${r1(xi)} ${r1(yi)} l ${r1(10 + r() * 16)} ${r1((r() - 0.5) * 5)}`} stroke={deep} strokeWidth={4} opacity={0.35} strokeLinecap="round" />;
  });
  return (
    <g filter="url(#cut)">
      <defs>
        <linearGradient id={`hg-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={minY} x2={0} y2={minY + 520}>
          <stop offset="0" stopColor={fill} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      <path d={d} fill={CREAM_EDGE} transform="translate(0 -10)" />
      <path d={d} fill={`url(#hg-${id})`} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      {lines}
      {flecks}
      {children}
    </g>
  );
};

export const Rock = ({ x, y, w, h, seed, fill = '#8c6a44', light = '#a98558', dark = '#5e4228' }: { x: number; y: number; w: number; h: number; seed: number; fill?: string; light?: string; dark?: string }) => {
  const r = rng(seed);
  const p: Pt[] = [
    [x - w * 0.5, y],
    [x - w * 0.46, y - h * (0.35 + r() * 0.15)],
    [x - w * 0.18, y - h * (0.9 + r() * 0.1)],
    [x + w * 0.14, y - h * (0.8 + r() * 0.2)],
    [x + w * 0.44, y - h * (0.4 + r() * 0.15)],
    [x + w * 0.5, y],
  ];
  return (
    <g>
      <path d={torn(p, seed, 3, 60)} fill={fill} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={torn([p[2], p[3], [p[3][0] + w * 0.12, y - h * 0.4], [x + w * 0.1, y - h * 0.3], [p[2][0] + w * 0.08, y - h * 0.5]], seed + 1, 2, 60)} fill={light} opacity={0.85} />
      <path d={torn([p[0], p[1], [p[1][0] + w * 0.12, y - h * 0.3], [x - w * 0.1, y - h * 0.08]], seed + 2, 2, 60)} fill={dark} opacity={0.6} />
      <path d={`M ${r1(x - w * 0.1)} ${r1(y - h * 0.6)} l ${r1(w * 0.12)} ${r1(h * 0.2)} l ${r1(-w * 0.04)} ${r1(h * 0.3)}`} fill="none" stroke={INK} strokeWidth={4} opacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

export const Palm = ({ x, y, h, lean = 0, seed = 1, fronds = 8 }: { x: number; y: number; h: number; lean?: number; seed?: number; fronds?: number }) => {
  const r = rng(seed);
  const top: Pt = [x + lean, y - h];
  const trunk = `M ${x - h * 0.05} ${y} Q ${x + lean * 0.2} ${y - h * 0.5} ${top[0] - h * 0.025} ${top[1]} L ${top[0] + h * 0.025} ${top[1]} Q ${x + lean * 0.3 + h * 0.02} ${y - h * 0.5} ${x + h * 0.05} ${y} Z`;
  return (
    <g>
      <path d={trunk} fill="#7a5a3a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={Array.from({ length: 6 }, (_, i) => `M ${r1(x + lean * (i / 7) - h * 0.04)} ${r1(y - h * (0.12 + i * 0.13))} l ${r1(h * 0.08)} ${r1(-h * 0.02)}`).join(' ')} stroke={INK} strokeWidth={3} opacity={0.5} />
      {Array.from({ length: fronds }, (_, i) => {
        const a = -Math.PI * (0.05 + (0.9 * i) / (fronds - 1)) + (r() - 0.5) * 0.2;
        const L = h * (0.42 + r() * 0.12);
        const tip: Pt = [top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L * 0.8 + L * 0.35 * Math.max(0, Math.cos(a) * Math.cos(a))];
        const mid: Pt = [top[0] + Math.cos(a) * L * 0.55, top[1] + Math.sin(a) * L * 0.62 - L * 0.1];
        const nx = -Math.sin(a) * h * 0.05;
        const ny = Math.cos(a) * h * 0.05;
        return (
          <path key={i} d={`M ${r1(top[0])} ${r1(top[1])} Q ${r1(mid[0] + nx)} ${r1(mid[1] + ny)} ${r1(tip[0])} ${r1(tip[1])} Q ${r1(mid[0] - nx)} ${r1(mid[1] - ny)} ${r1(top[0])} ${r1(top[1])} Z`} fill={i % 2 ? '#7d8a52' : '#6b7a45'} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        );
      })}
      <circle cx={r1(top[0])} cy={r1(top[1] + h * 0.02)} r={h * 0.04} fill="#5a4026" stroke={INK} strokeWidth={4} />
    </g>
  );
};

export const Tuft = ({ x, y, s = 1, seed = 1 }: { x: number; y: number; s?: number; seed?: number }) => {
  const r = rng(seed);
  return (
    <g stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M ${r1(x + (i - 2.5) * 7 * s)} ${r1(y)} q ${r1((r() - 0.5) * 20 * s)} ${r1(-24 * s)} ${r1((i - 2.5) * 12 * s)} ${r1((-46 - r() * 30) * s)}`} stroke="#7d8a52" strokeWidth={5} />
      ))}
    </g>
  );
};

export const Jar = ({ x, y, s = 1, fill = '#b5703a', seed = 1 }: { x: number; y: number; s?: number; fill?: string; seed?: number }) => (
  <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
    <path d="M -34 -10 C -66 -50 -62 -150 -30 -186 L -22 -214 L 22 -214 L 30 -186 C 62 -150 66 -50 34 -10 Z" fill={fill} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d="M -56 -110 Q 0 -86 56 -110" fill="none" stroke="#7e4a24" strokeWidth={6} />
    <path d="M -40 -150 L -30 -142 M 10 -140 L 22 -148 M -8 -60 L 2 -52" stroke="#7e4a24" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
    <path d="M -30 -216 L 30 -216 L 26 -232 L -26 -232 Z" fill="#8b5e34" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    {seed ? null : null}
  </g>
);

/* ---------- town buildings ---------- */

type BuildingProps = { x: number; base: number; w: number; h: number; col: string; side: string; seed: number; door?: boolean; lit?: number; awning?: string };
export const Building = ({ x, base, w, h, col, side, seed, door = false, lit = 0.3, awning }: BuildingProps) => {
  const r = rng(seed);
  const top = base - h;
  const wins: ReactNode[] = [];
  const cols = Math.max(1, Math.floor(w / 110));
  const rows = Math.max(1, Math.floor((h - 160) / 150));
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const wx = x + ((cx + 0.5) * (w * 0.78)) / cols + w * 0.04;
      const wy = top + 56 + cy * 150;
      const on = r() < lit;
      wins.push(
        <path key={`${cx}-${cy}`} d={`M ${r1(wx - 24)} ${r1(wy + 74)} L ${r1(wx - 24)} ${r1(wy + 22)} Q ${r1(wx)} ${r1(wy - 14)} ${r1(wx + 24)} ${r1(wy + 22)} L ${r1(wx + 24)} ${r1(wy + 74)} Z`} fill={on ? '#f0c878' : '#5a3f26'} stroke={INK} strokeWidth={5} strokeLinejoin="round" />,
      );
    }
  }
  const shape: Pt[] = [[x, base], [x, top + 10], [x + w * 0.3, top], [x + w * 0.62, top + 8], [x + w, top + 2], [x + w, base]];
  return (
    <g>
      <path d={torn(shape, seed, 3, 70)} fill={col} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={torn([[x + w * 0.78, base], [x + w * 0.78, top + 6], [x + w, top + 2], [x + w, base]], seed + 3, 2, 70)} fill={side} opacity={0.9} />
      <path d={`M ${r1(x)} ${r1(top + 34)} L ${r1(x + w)} ${r1(top + 30)}`} stroke={INK} strokeWidth={4} opacity={0.4} />
      {wins}
      {door ? (
        <g>
          <path d={`M ${r1(x + w * 0.32)} ${r1(base)} L ${r1(x + w * 0.32)} ${r1(base - 150)} Q ${r1(x + w * 0.5)} ${r1(base - 214)} ${r1(x + w * 0.68)} ${r1(base - 150)} L ${r1(x + w * 0.68)} ${r1(base)} Z`} fill="#3b281a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        </g>
      ) : null}
      {awning ? (
        <g>
          <path d={`M ${r1(x + 10)} ${r1(base - 210)} L ${r1(x + w - 10)} ${r1(base - 210)} L ${r1(x + w + 14)} ${r1(base - 150)} L ${r1(x - 14)} ${r1(base - 150)} Z`} fill={awning} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          {Array.from({ length: 5 }, (_, i) => (
            <path key={i} d={`M ${r1(x + 10 + ((w - 20) * (i + 0.5)) / 5)} ${r1(base - 208)} L ${r1(x - 14 + ((w + 28) * (i + 0.5)) / 5)} ${r1(base - 152)}`} stroke="#efe2c4" strokeWidth={14} opacity={0.8} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

const Arch = ({ x, base, w, h }: { x: number; base: number; w: number; h: number }) => (
  <g>
    <path d={`M ${x} ${base} L ${x} ${base - h} Q ${x + w / 2} ${base - h - w * 0.62} ${x + w} ${base - h} L ${x + w} ${base} Z`} fill="#3b281a" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d={`M ${x - 26} ${base} L ${x - 26} ${base - h - 6} Q ${x + w / 2} ${base - h - w * 0.78} ${x + w + 26} ${base - h - 6} L ${x + w + 26} ${base} L ${x + w} ${base} L ${x + w} ${base - h} Q ${x + w / 2} ${base - h - w * 0.62} ${x} ${base - h} L ${x} ${base} Z`} fill="#cfa86c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
  </g>
);

// A torn paper sun with rays, behind the far hills.
export const Sun = ({ x, y, r, o = 0.9 }: { x: number; y: number; r: number; o?: number }) => (
  <g opacity={o}>
    {Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return <path key={i} d={`M ${r1(x + Math.cos(a) * (r + 18))} ${r1(y + Math.sin(a) * (r + 18))} L ${r1(x + Math.cos(a) * (r + 64 + (i % 2) * 34))} ${r1(y + Math.sin(a) * (r + 64 + (i % 2) * 34))}`} stroke="#f6dc94" strokeWidth={14} strokeLinecap="round" opacity={0.7} />;
    })}
    <circle cx={x} cy={y} r={r} fill="#f9e9b4" stroke="#d9a840" strokeWidth={6} />
    <circle cx={x} cy={y} r={r * 0.72} fill="#fff3cc" opacity={0.8} />
  </g>
);

export const Crow = ({ x, y, flap, s = 1 }: { x: number; y: number; flap: number; s?: number }) => {
  const w = Math.sin(flap) * 14 * s;
  return <path d={`M ${r1(x - 40 * s)} ${r1(y + w)} Q ${r1(x - 16 * s)} ${r1(y - 18 * s - w)} ${r1(x)} ${r1(y)} Q ${r1(x + 16 * s)} ${r1(y - 18 * s - w)} ${r1(x + 40 * s)} ${r1(y + w)}`} fill="none" stroke={INK} strokeWidth={7 * s} strokeLinecap="round" strokeLinejoin="round" />;
};

/* ---------- Jerusalem, small and high ---------- */

const Jerusalem = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={torn([[-190, 0], [-190, -90], [-160, -90], [-160, -110], [-130, -110], [-130, -90], [-90, -90], [-90, -110], [-60, -110], [-60, -90], [-20, -90], [-20, -110], [10, -110], [10, -90], [60, -90], [60, -110], [90, -110], [90, -90], [150, -90], [150, 0]], 41, 1.5, 40)} fill="#ecd7a4" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d={torn([[-120, -90], [-120, -190], [-86, -190], [-86, -90]], 42, 1.5)} fill="#e3c88f" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d={torn([[40, -90], [40, -150], [100, -150], [100, -90]], 43, 1.5)} fill="#e3c88f" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M -80 -90 L -80 -170 Q -40 -230 0 -170 L 0 -90 Z" fill="#f0dfb2" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M -50 0 L -50 -46 Q -30 -76 -10 -46 L -10 0 Z" fill="#3b281a" stroke={INK} strokeWidth={4} />
    <path d="M -108 -150 l 0 -22 M 70 -128 l 0 -18" stroke={INK} strokeWidth={5} />
  </g>
);

/* ---------- the three backdrops ---------- */

export type CamP = { cx: number; cy: number; k: number };

// A. The wide road: Jerusalem high up, Jericho far below, the road switching back down
// through four torn hills. children(i) draws what stands on the road in layer i.
export const WIDE_ROAD: readonly (readonly Pt[])[] = [
  [[170, 604], [360, 642], [620, 690], [860, 722], [972, 748]],
  [[972, 834], [700, 882], [420, 930], [200, 972], [96, 1000]],
  [[96, 1098], [380, 1150], [640, 1198], [880, 1236], [980, 1262]],
  [[980, 1352], [700, 1392], [420, 1432], [230, 1470], [150, 1500]],
  [[140, 1566], [320, 1602], [500, 1624], [560, 1632]],
];
const WIDE_HALF = [20, 27, 34, 42, 50];
const roadStrip = (c: readonly Pt[], hw: number) => {
  const top = c.map((p): Pt => [p[0], p[1] - hw]);
  const bot = c.map((p): Pt => [p[0], p[1] + hw]).reverse();
  return `${smooth(top)} ${smooth(bot).replace('M', 'L')} Z`;
};
export const WideRoad = ({ cam, layerKids }: { cam: CamP; layerKids?: (i: number) => ReactNode }) => {
  const Z = [0.55, 0.68, 0.8, 0.92, 1.0];
  const hills: { id: string; top: Pt[]; fill: string; deep: string }[] = [
    { id: 'w1', top: [[-300, 566], [-60, 540], [150, 516], [300, 500], [520, 536], [700, 596], [900, 632], [1380, 676]], fill: '#e4cb98', deep: '#d0b078' },
    { id: 'w2', top: [[-300, 836], [-60, 812], [160, 774], [420, 806], [660, 722], [900, 764], [1380, 700]], fill: '#d2ac70', deep: '#b9924f' },
    { id: 'w3', top: [[-300, 1076], [-60, 1050], [200, 1012], [460, 1052], [700, 982], [980, 1024], [1380, 990]], fill: '#be9459', deep: '#a27c43' },
    { id: 'w4', top: [[-300, 1312], [-60, 1292], [220, 1252], [520, 1292], [800, 1232], [1380, 1272]], fill: '#a98047', deep: '#8a6735' },
    { id: 'w5', top: [[-300, 1556], [-60, 1540], [300, 1522], [700, 1538], [1380, 1516]], fill: '#9a8b55', deep: '#7b6e3e' },
  ];
  return (
    <g>
      <Deep {...cam} z={0.3}>
        <Sun x={780} y={430} r={120} o={0.85} />
      </Deep>
      {hills.map((h, i) => (
        <Deep key={h.id} {...cam} z={Z[i]}>
          <Hill id={h.id} top={h.top} fill={h.fill} deep={h.deep} seed={11 + i * 7} strata={2}>
            {i === 0 ? <Jerusalem x={250} y={522} s={1.25} /> : null}
          </Hill>
          <g filter="url(#cut)">
            <path d={roadStrip(WIDE_ROAD[i], WIDE_HALF[i])} fill="#ead49c" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            <path d={smooth(WIDE_ROAD[i])} fill="none" stroke="#c9a46c" strokeWidth={3.5} strokeDasharray="30 22" opacity={0.7} />
            {i === 4 ? (
              <g>
                <path d={torn([[480, 1636], [480, 1590], [520, 1580], [560, 1590], [620, 1584], [660, 1594], [660, 1636]], 91, 2, 30)} fill="#d9bf8b" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
                <path d={torn([[590, 1636], [590, 1560], [650, 1556], [700, 1566], [700, 1636]], 92, 2, 30)} fill="#c9a972" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
                <Palm x={420} y={1636} h={120} lean={14} seed={5} fronds={7} />
                <Palm x={730} y={1640} h={104} lean={-10} seed={6} fronds={7} />
                <Palm x={792} y={1636} h={84} lean={8} seed={7} fronds={6} />
                <Palm x={380} y={1642} h={76} lean={-6} seed={8} fronds={6} />
              </g>
            ) : null}
            {i === 0 ? <path d="M 150 604 L 150 574 Q 170 548 190 574 L 190 604 Z" fill="#3b281a" stroke={INK} strokeWidth={4} /> : null}
          </g>
          {layerKids ? layerKids(i) : null}
        </Deep>
      ))}
      {/* the near rocks that frame the shot */}
      <Deep {...cam} z={1.25}>
        <g filter="url(#cut)">
          <Rock x={-40} y={1960} w={440} h={420} seed={3} fill="#6b4c2e" light="#8a6a44" dark="#40291a" />
          <Rock x={1100} y={1960} w={420} h={340} seed={4} fill="#6b4c2e" light="#8a6a44" dark="#40291a" />
        </g>
      </Deep>
    </g>
  );
};

// B. The close road, where the man is waylaid. Figures stand on roadAt(t).
export const CloseRoad = ({ cam, back, mid, front, flap = 0 }: { cam: CamP; back?: ReactNode; mid?: ReactNode; front?: ReactNode; flap?: number }) => (
  <g>
    <Deep {...cam} z={0.18}>
      <Sun x={760} y={560} r={150} o={0.85} />
      <Crow x={300 + Math.sin(flap * 0.05) * 60} y={470} flap={flap * 0.5} s={1.1} />
      <Crow x={420 + Math.sin(flap * 0.05 + 1) * 60} y={410} flap={flap * 0.5 + 2} s={0.8} />
      <Crow x={1130 - Math.sin(flap * 0.04) * 70} y={500} flap={flap * 0.5 + 4} s={0.9} />
    </Deep>
    <Deep {...cam} z={0.34}>
      <Hill id="c1" top={[[-700, 860], [-300, 800], [0, 760], [200, 800], [420, 700], [640, 790], [860, 720], [1100, 800], [1400, 720], [1700, 790], [2300, 740]]} fill="#e1c690" deep="#c9a66c" seed={21} strata={2} />
    </Deep>
    <Deep {...cam} z={0.52}>
      <Hill id="c2" top={[[-700, 1010], [-300, 960], [-60, 990], [240, 930], [520, 1000], [780, 940], [1040, 1000], [1320, 950], [1700, 1010], [2300, 960]]} fill="#cba46a" deep="#aa8449" seed={22} strata={3}>
        <Palm x={160} y={1000} h={170} lean={20} seed={31} fronds={8} />
        <Palm x={1500} y={1010} h={150} lean={-16} seed={32} fronds={7} />
      </Hill>
    </Deep>
    <Deep {...cam} z={0.74}>
      <Hill id="c3" top={[[-700, 1130], [-300, 1090], [100, 1060], [380, 1110], [640, 1070], [980, 1130], [1320, 1100], [1700, 1140], [2300, 1090]]} fill="#b88d52" deep="#926c3a" seed={23} strata={3} />
    </Deep>
    <Deep {...cam} z={1}>
      {back}
      <Hill id="c4" top={[[-700, 1176], [-300, 1166], [200, 1176], [700, 1166], [1300, 1180], [1900, 1170], [2500, 1176]]} fill="#a87e44" deep="#86622f" seed={24} strata={1} />
      <g filter="url(#cut)">
        <RoadBand />
      </g>
      {mid}
    </Deep>
    <Deep {...cam} z={1}>{front}</Deep>
    <Deep {...cam} z={1.3}>
      <g filter="url(#cut)">
        <Rock x={-140} y={2060} w={560} h={560} seed={51} fill="#5f4328" light="#7f5e3c" dark="#3a2616" />
        <Rock x={1230} y={2060} w={520} h={480} seed={52} fill="#5f4328" light="#7f5e3c" dark="#3a2616" />
        <Tuft x={330} y={1760} s={1.5} seed={4} />
      </g>
    </Deep>
  </g>
);

// C. The old town square: far houses and a gate, a row of stalls with awnings and a palm,
// then packed earth. The crowd and the lawyer stand on the earth at y 1150 to 1700.
export const SQ_GROUND = 1180;
export const Square = ({ cam, crowd, hero, front }: { cam: CamP; crowd?: ReactNode; hero?: ReactNode; front?: ReactNode }) => (
  <g>
    <Deep {...cam} z={0.22}>
      <Sun x={190} y={560} r={96} o={0.7} />
    </Deep>
    <Deep {...cam} z={0.42}>
      <g filter="url(#cut)">
        <Building x={-300} base={1100} w={300} h={470} col="#d6b67a" side="#b8935a" seed={61} lit={0.2} />
        <Building x={-10} base={1100} w={250} h={360} col="#cfa96d" side="#b08a52" seed={62} lit={0.5} />
        <Arch x={290} base={1100} w={220} h={330} />
        <Building x={560} base={1100} w={300} h={520} col="#dcbf86" side="#bd985c" seed={63} lit={0.3} />
        <Building x={870} base={1100} w={260} h={400} col="#d1ad70" side="#b38e55" seed={64} lit={0.45} />
        <Building x={1140} base={1100} w={320} h={470} col="#d9ba7e" side="#bb965a" seed={65} lit={0.25} />
        <Building x={1470} base={1100} w={260} h={380} col="#cfa96d" side="#b08a52" seed={66} lit={0.4} />
      </g>
    </Deep>
    <Deep {...cam} z={0.7}>
      <g filter="url(#cut)">
        <Building x={-200} base={1170} w={300} h={250} col="#c79d5f" side="#a98350" seed={71} door awning="#6f8a8c" lit={0.1} />
        <Palm x={190} y={1176} h={460} lean={26} seed={72} fronds={9} />
        <Building x={640} base={1170} w={330} h={270} col="#c99f62" side="#aa8450" seed={73} door awning="#b0883a" lit={0.1} />
        <Building x={1010} base={1170} w={300} h={230} col="#c39a5d" side="#a67f4c" seed={74} door awning="#6f8a8c" lit={0.1} />
        <Palm x={1320} y={1176} h={380} lean={-22} seed={75} fronds={8} />
      </g>
    </Deep>
    <Deep {...cam} z={1}>
      <g filter="url(#cut)">
        <path d={torn([[-700, 1170], [200, 1164], [700, 1176], [1300, 1166], [2000, 1172], [2000, 1330], [-700, 1330]], 81, 4, 80)} fill="#c9a468" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d={torn([[-700, 1330], [300, 1322], [800, 1334], [1400, 1322], [2000, 1330], [2000, 1560], [-700, 1560]], 82, 4, 80)} fill="#b98d52" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d={torn([[-700, 1560], [300, 1550], [900, 1564], [1500, 1552], [2000, 1560], [2000, 2400], [-700, 2400]], 83, 4, 80)} fill="#a47b42" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M ${-500 + i * 150} 1340 l 90 0 M ${-440 + i * 150} 1500 l 120 0 M ${-480 + i * 170} 1700 l 150 0`} stroke="#7a5a30" strokeWidth={4} opacity={0.45} strokeLinecap="round" />
        ))}
      </g>
      {crowd}
      {hero}
    </Deep>
    <Deep {...cam} z={1.28}>{front}</Deep>
  </g>
);

// D. The inn: morning sun behind a mud brick house, an arched door that can glow, a
// lantern, an awning, a bench. door is 0 to 1 (how far the door has swung open); glow
// lights the doorway.
export const Inn = ({ x, base, door = 0, glow = 0 }: { x: number; base: number; door?: number; glow?: number }) => (
  <g transform={`translate(${x} ${base})`}>
    <g filter="url(#cut)">
      <path d={torn([[-330, 0], [-330, -430], [-300, -450], [-120, -440], [-100, -520], [60, -526], [90, -444], [300, -452], [330, -430], [330, 0]], 101, 3, 70)} fill="#d6b67a" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      <path d={torn([[200, 0], [200, -446], [300, -452], [330, -430], [330, 0]], 102, 2, 70)} fill="#b8935a" opacity={0.9} />
      <path d="M -330 -392 L 330 -396" stroke={INK} strokeWidth={4} opacity={0.35} />
      <path d="M -260 -300 L -260 -352 Q -236 -386 -212 -352 L -212 -300 Z M 212 -300 L 212 -352 Q 236 -386 260 -352 L 260 -300 Z" fill="#5a3f26" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M -40 -300 L -40 -352 Q -16 -384 8 -352 L 8 -300 Z" fill="#f0c878" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M -130 0 L -130 -250 Q 0 -352 130 -250 L 130 0 Z" fill="#3b281a" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      <path d="M -130 0 L -130 -250 Q 0 -352 130 -250 L 130 0 Z" fill="url(#doorGlow)" opacity={glow} />
      {door > 0 ? (
        <g>
          <path d={`M -130 -250 L ${r1(-130 - 118 * door)} ${r1(-236 + 0)} L ${r1(-130 - 118 * door)} ${r1(-6)} L -130 0 Z`} fill="#7a5a3a" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d={`M 130 -250 L ${r1(130 + 118 * door)} -236 L ${r1(130 + 118 * door)} -6 L 130 0 Z`} fill="#7a5a3a" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        </g>
      ) : (
        <path d="M 0 -300 L 0 0 M -130 -150 L 130 -150" stroke="#7a5a3a" strokeWidth={10} />
      )}
      <path d="M -150 -274 L 150 -274 L 188 -204 L -188 -204 Z" fill="#6f8a8c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M ${r1(-132 + i * 53)} -272 L ${r1(-170 + i * 68)} -206`} stroke="#efe2c4" strokeWidth={15} opacity={0.8} />
      ))}
      <path d="M 170 -300 L 170 -250" stroke={INK} strokeWidth={5} />
      <path d="M 154 -250 L 186 -250 L 182 -208 L 158 -208 Z" fill={glow > 0.2 ? '#f6d683' : '#8a7a5a'} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M -300 0 L -300 -62 L -190 -62 L -190 0 M -270 -62 L -270 -90 L -220 -90 L -220 -62" fill="#7a5a3a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    </g>
    {glow > 0.2 ? <ellipse cx={170} cy={-232} rx={150} ry={150} fill="url(#lampGlow)" opacity={glow} /> : null}
  </g>
);

export const InnDefs = () => (
  <defs>
    <radialGradient id="doorGlow" cx="0.5" cy="0.75" r="0.8">
      <stop offset="0" stopColor="#ffe6a0" stopOpacity={1} />
      <stop offset="0.55" stopColor="#f2b550" stopOpacity={0.85} />
      <stop offset="1" stopColor="#c8782a" stopOpacity={0.5} />
    </radialGradient>
  </defs>
);

export { bell, clamp01 };
