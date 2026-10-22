import type { ReactNode } from 'react';
import { Chalk, Eye, INK, Limb, Person, SHOE, ease, ik, lerp } from './paper';
import type { PersonProps, Pt } from './paper';
import { clamp01, rng } from '../world';

// Ancient costume and props for the Who stopped long cut. The people are still the
// pilot's bean figures; the old world is dressed on them as layered cut paper: head
// wraps, robes as a trapezoid with a tape seam, a tall hat, a sash. The Samaritan keeps
// the pilot's helper red under a darker travelling cloak.
const r1 = (n: number) => Math.round(n * 10) / 10;

export const INN = { col: '#8a6a48', shade: '#5d4530', iris: '#d3e0a4' };
// Crowd tones: muted paper, never the helper red.
export const CROWD = [
  { col: '#7d8f95', shade: '#56666b' },
  { col: '#b49467', shade: '#7e6540' },
  { col: '#6f7f5a', shade: '#4a5739' },
  { col: '#a98a6e', shade: '#785d45' },
  { col: '#8b8f7b', shade: '#5f6354' },
  { col: '#5f7a6c', shade: '#3f5448' },
  { col: '#c0a46e', shade: '#8b7343' },
  { col: '#7a6c82', shade: '#54485b' },
] as const;

export const TAPE = '#ead9a0';
export const TAPE_EDGE = '#a8925a';

/* ---------- cut paper helpers ---------- */

// A torn paper outline: straight cuts with a small hand jitter, subdivided.
export const torn = (pts: readonly Pt[], seed: number, amp = 5, seg = 46, closed = true): string => {
  const r = rng(seed);
  const out: string[] = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(d / seg));
    if (i === 0) out.push(`M ${r1(a[0])} ${r1(a[1])}`);
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const jit = j === k ? 0 : (r() - 0.5) * 2 * amp;
      const nx = -(b[1] - a[1]) / (d || 1);
      const ny = (b[0] - a[0]) / (d || 1);
      out.push(`L ${r1(a[0] + (b[0] - a[0]) * t + nx * jit)} ${r1(a[1] + (b[1] - a[1]) * t + ny * jit)}`);
    }
  }
  return `${out.join(' ')}${closed ? ' Z' : ''}`;
};

// Smooth path through points (Catmull-Rom as cubic), for roads and soft hills.
export const smooth = (pts: readonly Pt[], closed = false): string => {
  const n = pts.length;
  const P = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
};

// A torn masking tape strip, in the pilot's tape look. Drawn from its centre.
export const TapeStrip = ({ x, y, rot = 0, len = 96, w = 34, k = 1, op = 0.93 }: { x: number; y: number; rot?: number; len?: number; w?: number; k?: number; op?: number }) => (
  <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${rot}) scale(${r1(k * 1000) / 1000})`} opacity={op}>
    <g transform={`scale(${w / 34} ${len / 96})`}>
      <path d="M -17 -48 L -9 -43 L -1 -49 L 8 -43 L 17 -48 L 17 48 L 9 43 L 0 49 L -8 43 L -17 48 Z" fill={TAPE} stroke={TAPE_EDGE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M -9 -34 L -9 34 M 8 -34 L 8 34" stroke="#c9b377" strokeWidth={2} opacity={0.7} />
    </g>
  </g>
);

// Torn paper scraps that fly outward. t runs 0 to 1.
export const Scraps = ({ x, y, t, n = 10, seed = 3, col = '#f3e6c4', spread = 220 }: { x: number; y: number; t: number; n?: number; seed?: number; col?: string; spread?: number }) => {
  if (t <= 0 || t >= 1) return null;
  const r = rng(seed);
  const e = 1 - Math.pow(1 - t, 2.2);
  return (
    <g opacity={1 - Math.pow(t, 3)}>
      {Array.from({ length: n }, (_, i) => {
        const a = r() * Math.PI * 2;
        const d = (0.35 + r() * 0.65) * spread * e;
        const sz = 12 + r() * 18;
        const rot = r() * 360 + t * (r() - 0.5) * 520;
        return (
          <path
            key={i}
            transform={`translate(${r1(x + Math.cos(a) * d)} ${r1(y + Math.sin(a) * d + 90 * t * t)}) rotate(${r1(rot)})`}
            d={`M ${-sz} ${-sz * 0.4} L ${sz * 0.2} ${-sz} L ${sz} ${sz * 0.5} L ${-sz * 0.3} ${sz * 0.7} Z`}
            fill={i % 3 === 0 ? '#cdb98e' : col}
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
};

export const Sparkle = ({ x, y, r, t }: { x: number; y: number; r: number; t: number }) => {
  if (t <= 0 || t >= 1) return null;
  const k = Math.sin(Math.PI * t) * r;
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(t * 40)})`}>
      <path d={`M 0 ${-k} Q 0 0 ${k} 0 Q 0 0 0 ${k} Q 0 0 ${-k} 0 Q 0 0 0 ${-k} Z`} fill="#fffbe8" stroke="#e7b94a" strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
};

// A puff of dust at the hooves, as stacked paper discs.
export const DustPuff = ({ x, y, t, s = 1 }: { x: number; y: number; t: number; s?: number }) => {
  if (t <= 0 || t >= 1) return null;
  return (
    <g opacity={0.8 * (1 - t)} style={{ mixBlendMode: 'multiply' }}>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={r1(x + (i - 1) * 46 * s * (0.5 + t))} cy={r1(y - 30 * s * t - i * 8)} rx={(34 + 36 * t) * s} ry={(22 + 22 * t) * s} fill="#caa56a" stroke={INK} strokeWidth={4} opacity={0.75} />
      ))}
    </g>
  );
};

/* ---------- the camera, with layers that move at their own depth ---------- */

// Camera centre (cx, cy) in world space and zoom k, about the middle of the frame.
export const Cam2 = ({ cx, cy, k, children }: { cx: number; cy: number; k: number; children: ReactNode }) => (
  <g transform={`translate(540 960) scale(${r1(k * 1000) / 1000}) translate(${r1(-cx)} ${r1(-cy)})`}>{children}</g>
);

// A parallax layer: z = 1 tracks the camera exactly; smaller z lies further back and moves less.
export const Deep = ({ cx, cy, k, z, children }: { cx: number; cy: number; k: number; z: number; children: ReactNode }) => (
  <Cam2 cx={540 + (cx - 540) * z} cy={960 + (cy - 960) * z} k={1 + (k - 1) * z}>
    {children}
  </Cam2>
);

/* ---------- costume ---------- */

export type Kind = 'priest' | 'levite' | 'samaritan' | 'lawyer' | 'robber' | 'traveller' | 'innkeeper';

type Dress = { robe: string; fold: string; wrap: string; band: string; hem: number; flare: number; short?: boolean };
const DRESS: Record<Kind, Dress> = {
  priest: { robe: '#3d5546', fold: '#26382d', wrap: '#35493c', band: '#d8b24a', hem: -58, flare: 122 },
  levite: { robe: '#a37c22', fold: '#6f5214', wrap: '#efe2c4', band: '#c99a2e', hem: -58, flare: 116 },
  samaritan: { robe: '#6a1c16', fold: '#450f0b', wrap: '#6a1c16', band: '#e9d9b4', hem: -52, flare: 132 },
  lawyer: { robe: '#625b4e', fold: '#403b32', wrap: '#d9d1bc', band: '#6f6859', hem: -56, flare: 120 },
  robber: { robe: '#575c38', fold: '#3a3e24', wrap: '#3e4226', band: '#2f331d', hem: -128, flare: 104, short: true },
  traveller: { robe: '#cdb98e', fold: '#a8925a', wrap: '#cdb98e', band: '#a8925a', hem: -90, flare: 100, short: true },
  innkeeper: { robe: '#e6d8b4', fold: '#b4a37a', wrap: '#d6c49a', band: '#8b7343', hem: -52, flare: 118 },
};

const zig = (x0: number, x1: number, y: number, n: number, a: number): string =>
  Array.from({ length: n + 1 }, (_, i) => `L ${r1(x0 + ((x1 - x0) * i) / n)} ${r1(y + (i % 2 ? -a : a * 0.8))}`).join(' ');

// A vertical masking-tape seam down the robe.
const Seam = ({ x, y0, y1, rot = 1.5 }: { x: number; y0: number; y1: number; rot?: number }) => (
  <g transform={`rotate(${rot} ${x} ${(y0 + y1) / 2})`}>
    <path d={`M ${x - 12} ${y0} L ${x - 5} ${y0 + 5} L ${x + 3} ${y0 - 1} L ${x + 12} ${y0 + 4} L ${x + 12} ${y1} L ${x + 4} ${y1 - 5} L ${x - 3} ${y1 + 1} L ${x - 12} ${y1 - 4} Z`} fill={TAPE} stroke={TAPE_EDGE} strokeWidth={3} strokeLinejoin="round" opacity={0.92} />
  </g>
);

const Robe = ({ kind }: { kind: Kind }) => {
  const d = DRESS[kind];
  const bottom = d.short ? d.hem : -150;
  const up = `M -52 -340 C -84 -332 -96 -298 -100 -250 L ${-d.flare + 18} ${bottom} L ${d.flare - 18} ${bottom} L 100 -250 C 96 -298 84 -332 52 -340`;
  return (
    <g>
      <path d={`${up} Z`} fill={d.robe} />
      <path d={up} fill="none" stroke={INK} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M -34 -338 L 0 -284 L 34 -338" fill={d.fold} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M -64 -296 Q -58 -240 -72 -176 M 66 -300 Q 60 -240 74 -176" fill="none" stroke={d.fold} strokeWidth={4} opacity={0.55} strokeLinecap="round" />
      {kind === 'samaritan' ? (
        <g>
          <path d="M -24 -330 L 24 -330 L 38 -150 L -38 -150 Z" fill="#a8322a" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -118 -318 C -140 -300 -142 -240 -132 -190 L -100 -250 Z" fill={d.fold} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={30} cy={-318} r={13} fill="#d8b24a" stroke={INK} strokeWidth={5} />
        </g>
      ) : (
        <Seam x={kind === 'lawyer' ? 6 : 0} y0={-326} y1={d.short ? d.hem - 4 : -156} />
      )}
      {kind === 'lawyer' ? (
        <g>
          <path d="M -86 -330 L -52 -342 L -52 -230 L -90 -236 Z M 86 -330 L 52 -342 L 52 -230 L 90 -236 Z" fill="#efe6cc" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -80 -310 L -58 -316 M -82 -276 L -58 -280 M 80 -310 L 58 -316 M 82 -276 L 58 -280" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      ) : null}
      {kind === 'priest' ? (
        <g>
          <path d="M -98 -240 Q 0 -214 98 -240 L 98 -204 Q 0 -178 -98 -204 Z" fill="#e9dcb8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M 40 -214 L 52 -140 L 78 -148 L 66 -220 Z" fill="#e9dcb8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -98 -222 Q 0 -196 98 -222" fill="none" stroke="#d8b24a" strokeWidth={5} />
        </g>
      ) : null}
      {kind === 'robber' ? (
        <g>
          <path d="M -98 -214 Q 0 -190 98 -214 L 98 -192 Q 0 -168 -98 -192 Z" fill="#3a2616" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -90 -330 L 80 -190" stroke="#3a2616" strokeWidth={14} opacity={0.9} strokeLinecap="round" />
        </g>
      ) : null}
      {kind === 'innkeeper' ? (
        <g>
          <path d="M -62 -258 L 62 -258 L 82 -152 L -82 -152 Z" fill="#f1e6c8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -24 -340 L -20 -258 M 24 -340 L 20 -258" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
};

// The part of the robe that hangs below the hip, drawn over the legs.
const Skirt = ({ kind, hip }: { kind: Kind; hip: number }) => {
  const d = DRESS[kind];
  if (d.short) return null;
  const kneel = hip < 130;
  const top = -hip - 18;
  const hem = kneel ? -10 : d.hem;
  const fl = kneel ? d.flare + 26 : d.flare;
  const left = `M -80 ${top} L ${-fl} ${hem}`;
  const body = `${left} ${zig(-fl, fl, hem, 10, 6)} L 80 ${top}`;
  return (
    <g>
      <path d={`${body} Z`} fill={d.robe} />
      <path d={`M -80 ${top} L ${-fl} ${hem} ${zig(-fl, fl, hem, 10, 6)} L 80 ${top}`} fill="none" stroke={INK} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M -34 ${top + 24} Q -40 ${(top + hem) / 2} ${-fl * 0.5} ${hem - 10} M 38 ${top + 24} Q 44 ${(top + hem) / 2} ${fl * 0.5} ${hem - 10}`} fill="none" stroke={d.fold} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
      {kind === 'samaritan' ? null : <Seam x={kind === 'lawyer' ? 6 : 0} y0={top + 14} y1={hem - 8} />}
    </g>
  );
};

type WrapOpts = { col: string; band: string; lift?: number; tail?: boolean; stripes?: boolean };
const WrapCap = ({ col, band, lift = 0, tail = true, stripes = false }: WrapOpts) => (
  <g transform={`translate(0 ${-lift})`}>
    {tail ? <path d="M -90 -514 C -132 -500 -146 -444 -132 -380 C -120 -398 -106 -404 -96 -400 Z" fill={col} stroke={INK} strokeWidth={6} strokeLinejoin="round" /> : null}
    <path d="M -102 -452 C -118 -578 118 -578 102 -452 C 70 -478 -70 -478 -102 -452 Z" fill={col} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d="M -66 -520 Q -24 -538 36 -528 M -80 -494 Q -30 -524 56 -510" fill="none" stroke={band} strokeWidth={4} opacity={0.55} strokeLinecap="round" />
    <path d="M -104 -482 Q 0 -452 104 -482 L 101 -506 Q 0 -478 -101 -506 Z" fill={band} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    {stripes ? <path d="M -72 -520 L -68 -490 M -34 -540 L -32 -490 M 6 -544 L 8 -490 M 46 -534 L 46 -490" stroke={band} strokeWidth={6} strokeLinecap="round" opacity={0.75} /> : null}
  </g>
);

const Brows = ({ b }: { b: readonly [number, number] }) => {
  const one = (sg: number, r: number) => {
    const y = -514 - r * 12;
    const inner: Pt = [sg * 12, y + 8 - r * 6];
    const outer: Pt = [sg * 70, y + (r > 0 ? -10 * r : 12 * -r) + 6];
    const c: Pt = [sg * 40, y - 14 - r * 26];
    return <path d={`M ${inner[0]} ${r1(inner[1])} Q ${c[0]} ${r1(c[1])} ${outer[0]} ${r1(outer[1])}`} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />;
  };
  return (
    <g>
      {one(-1, b[0])}
      {one(1, b[1])}
    </g>
  );
};

const HeadGear = ({ kind, brows }: { kind: Kind; brows?: readonly [number, number] }) => {
  const d = DRESS[kind];
  const gear = (() => {
    if (kind === 'priest')
      return (
        <g>
          <path d="M -98 -468 L -82 -702 Q 0 -732 82 -702 L 98 -468 Q 0 -438 -98 -468 Z" fill={d.wrap} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d="M -48 -690 Q -40 -604 -52 -540 M 38 -694 Q 52 -604 44 -542" fill="none" stroke="#26382d" strokeWidth={4} opacity={0.55} strokeLinecap="round" />
          <path d="M -100 -506 Q 0 -476 100 -506 L 99 -536 Q 0 -506 -99 -536 Z" fill={d.band} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <g transform="translate(-4 -604) rotate(2)">
            <path d="M -9 -42 L -3 -38 L 3 -43 L 9 -38 L 9 42 L 3 38 L -3 43 L -9 38 Z" fill={TAPE} stroke={TAPE_EDGE} strokeWidth={3} strokeLinejoin="round" opacity={0.9} />
          </g>
        </g>
      );
    if (kind === 'levite')
      return (
        <g>
          <path d="M 70 -520 C 120 -520 150 -470 128 -404 C 112 -432 96 -440 80 -444 Z" fill={d.wrap} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <ellipse cx={0} cy={-500} rx={116} ry={56} fill={d.wrap} stroke={INK} strokeWidth={7} />
          <ellipse cx={0} cy={-556} rx={84} ry={46} fill={d.wrap} stroke={INK} strokeWidth={7} />
          <path d="M -104 -504 Q 0 -470 104 -504 M -76 -562 Q 0 -530 76 -562" fill="none" stroke={d.band} strokeWidth={9} strokeLinecap="round" />
          <path d="M -50 -530 Q -10 -552 50 -534" fill="none" stroke={d.band} strokeWidth={4} opacity={0.6} />
        </g>
      );
    if (kind === 'samaritan')
      return (
        <g>
          <WrapCap col={d.wrap} band={d.band} />
          <circle cx={92} cy={-500} r={11} fill="#d8b24a" stroke={INK} strokeWidth={4} />
        </g>
      );
    if (kind === 'lawyer')
      return (
        <g>
          <WrapCap col={d.wrap} band={d.band} lift={34} stripes />
          <path d="M 98 -506 C 122 -490 130 -440 124 -388 L 106 -398 Z" fill={d.wrap} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        </g>
      );
    if (kind === 'robber')
      return (
        <g>
          <WrapCap col={d.wrap} band={d.band} />
          <circle cx={-118} cy={-470} r={22} fill={d.wrap} stroke={INK} strokeWidth={6} />
          <path d="M -98 -428 Q 0 -398 98 -428 L 92 -372 Q 0 -330 -92 -372 Z" fill="#2f331d" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d="M -60 -392 Q 0 -372 60 -392" fill="none" stroke="#575c38" strokeWidth={4} opacity={0.7} />
        </g>
      );
    if (kind === 'traveller')
      return (
        <g>
          <WrapCap col={d.wrap} band={d.band} />
        </g>
      );
    return (
      <g>
        <path d="M -76 -510 C -66 -572 66 -572 76 -510 Q 0 -492 -76 -510 Z" fill={d.wrap} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d="M -76 -514 Q 0 -496 76 -514" fill="none" stroke={d.band} strokeWidth={6} />
      </g>
    );
  })();
  return (
    <g>
      {gear}
      {brows ? <Brows b={brows} /> : null}
    </g>
  );
};

export type AncientProps = Omit<PersonProps, 'costume' | 'hat' | 'tie' | 'col' | 'shade'> & { kind: Kind; col: string; shade: string; brows?: readonly [number, number]; plain?: boolean; backArmFront?: Pt };

// A bean figure dressed for the old world.
export const Ancient = ({ kind, brows, plain, backArmFront, ...p }: AncientProps) => {
  const hip = p.hip ?? 160;
  const dy = 160 - hip;
  const sh: Pt = [-12, -322 + dy];
  const bk = backArmFront ? ik(sh, backArmFront, 66, 66, 1) : null;
  return (
    <Person
      {...p}
      hat="none"
      costume={{
        body: plain ? undefined : <Robe kind={kind} />,
        skirt: (
          <g>
            {plain ? null : <Skirt kind={kind} hip={hip} />}
            {bk ? (
              <g>
                <Limb pts={[sh, bk.mid, bk.end]} w={17} col={p.col} />
                <circle cx={r1(bk.end[0])} cy={r1(bk.end[1])} r={15} fill={p.col} stroke={INK} strokeWidth={6} />
              </g>
            ) : null}
          </g>
        ),
        head: <HeadGear kind={kind} brows={brows} />,
      }}
    />
  );
};

/* ---------- small crowd figures ---------- */

export type MiniProps = {
  id: string;
  x: number;
  y: number;
  s: number;
  col: string;
  shade: string;
  kind?: Kind;
  dir?: 1 | -1;
  look?: Pt;
  lid?: number;
  wide?: number;
  sq?: number;
  turn?: number;
  armUp?: number;
  robe?: string;
  hold?: ReactNode;
};

// A far-away bean person: robe, head wrap, big round eyes. No filter of its own; draw
// a row of them inside one cut-paper group.
export const Mini = ({ id, x, y, s, col, shade, kind = 'traveller', dir = 1, look = [0, 0], lid = 0.4, wide = 0, sq = 0, turn = 0, armUp = 0, robe, hold }: MiniProps) => {
  const d = DRESS[kind];
  const lx: Pt = [look[0] * dir, look[1]];
  const ex = 38;
  const ey = -452;
  const rx = 32 + 6 * wide;
  const ry = 28 + 8 * wide;
  const hand: Pt = [lerp(92, 84, armUp), lerp(-190, -440, armUp)];
  const elbow: Pt = [lerp(104, 120, armUp), lerp(-256, -330, armUp)];
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
      <g transform={`scale(${r1(dir * (1 + sq) * 1000) / 1000} ${r1((1 - sq) * 1000) / 1000})`}>
        <Limb pts={[[-62, -320], [-100, -250], [-96, -190]]} w={17} col={col} />
        <path d={`M -50 -352 C -90 -345 -96 -280 -84 -230 L -112 -34 ${zig(-112, 112, -34, 8, 6)} L 84 -230 C 96 -280 90 -345 50 -352 Z`} fill={robe ?? d.robe} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <path d="M -26 -346 L 0 -296 L 26 -346" fill={d.fold} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <ellipse cx={-34} cy={-22} rx={30} ry={14} fill={SHOE} stroke={INK} strokeWidth={5} />
        <ellipse cx={36} cy={-22} rx={30} ry={14} fill={SHOE} stroke={INK} strokeWidth={5} />
        <g transform={`translate(${r1(turn * 14)} 0) rotate(${r1(turn * -7)} 0 -350)`}>
          <circle cx={0} cy={-440} r={100} fill={col} stroke={INK} strokeWidth={8} />
          <path d="M 60 -520 A 100 100 0 0 1 60 -362 A 120 120 0 0 0 60 -520 Z" fill={shade} opacity={0.5} />
          {kind === 'priest' || kind === 'levite' ? (
            <g>
              <ellipse cx={0} cy={-504} rx={112} ry={52} fill={d.wrap} stroke={INK} strokeWidth={7} />
              <ellipse cx={0} cy={-556} rx={82} ry={42} fill={d.wrap} stroke={INK} strokeWidth={7} />
            </g>
          ) : (
            <g>
              <path d="M -102 -452 C -118 -578 118 -578 102 -452 C 70 -478 -70 -478 -102 -452 Z" fill={shade} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
              <path d="M -104 -482 Q 0 -452 104 -482 L 101 -506 Q 0 -478 -101 -506 Z" fill="#e6d4a4" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
            </g>
          )}
          <Eye id={`${id}-eL`} cx={-ex} cy={ey} rx={rx} ry={ry} lid={lid * (1 - wide)} look={lx} iris="#c4d49a" curve={6} />
          <Eye id={`${id}-eR`} cx={ex} cy={ey} rx={rx} ry={ry} lid={lid * (1 - wide)} look={lx} iris="#c4d49a" curve={6} />
        </g>
        <Limb pts={[[62, -320], elbow, hand]} w={17} col={col} />
        <circle cx={hand[0]} cy={hand[1]} r={15} fill={col} stroke={INK} strokeWidth={6} />
        {hold}
      </g>
    </g>
  );
};

/* ---------- the donkey ---------- */

export type DonkeyProps = { id: string; x: number; y: number; s?: number; dir?: 1 | -1; ph?: number; stride?: number; lift?: number; bob?: number; nod?: number; ear?: number; carry?: ReactNode; lids?: number; look?: Pt };

const DK = '#9b8b76';
const DK_SHADE = '#6b5e4b';
const DK_BELLY = '#dccaa2';

// A bean donkey with long paper ears. Origin at the ground under the middle of the body;
// faces +x (dir flips). Seat of the rider is at local (0, -350).
export const Donkey = ({ id, x, y, s = 1, dir = 1, ph = 0, stride = 0, lift = 0, bob = 0, nod = 0, ear = 0, carry, lids = 0.35, look = [0.5, 0.2] }: DonkeyProps) => {
  const foot = (a: number, hx: number): Pt => [hx + stride * Math.sin(a), -lift * Math.max(0, Math.cos(a))];
  const leg = (hx: number, hy: number, a: number) => {
    const f = foot(a, hx);
    const k = ik([hx, hy], f, 104, 108, -1);
    return { pts: [[hx, hy], k.mid, k.end] as Pt[], end: k.end };
  };
  const fb = leg(-122, -212, ph + Math.PI);
  const ff = leg(124, -212, ph);
  const nb = leg(-98, -206, ph);
  const nf = leg(148, -206, ph + Math.PI);
  const hoof = (p: Pt) => <ellipse cx={r1(p[0] + 6)} cy={r1(p[1] - 6)} rx={24} ry={13} fill="#3a2616" stroke={INK} strokeWidth={5} />;
  return (
    <g transform={`translate(${r1(x)} ${r1(y + bob)}) scale(${s})`}>
      <g filter="url(#cut)">
        <g transform={`scale(${dir} 1)`}>
          <Limb pts={fb.pts} w={28} col={DK_SHADE} />
          {hoof(fb.end)}
          <Limb pts={ff.pts} w={28} col={DK_SHADE} />
          {hoof(ff.end)}
          <path d="M -170 -280 C -218 -262 -232 -214 -226 -156" fill="none" stroke={INK} strokeWidth={26} strokeLinecap="round" />
          <path d="M -170 -280 C -218 -262 -232 -214 -226 -156" fill="none" stroke={DK_SHADE} strokeWidth={14} strokeLinecap="round" />
          <ellipse cx={-226} cy={-146} rx={20} ry={30} fill="#3a2a1c" stroke={INK} strokeWidth={5} />
          <path d="M -178 -262 C -178 -354 178 -354 178 -262 C 178 -176 -178 -176 -178 -262 Z" fill={DK} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
          <path d="M -120 -206 Q 0 -178 126 -206 Q 0 -192 -120 -206 Z" fill={DK_BELLY} opacity={0.9} />
          <path d="M -150 -232 Q -40 -210 150 -232" fill="none" stroke={DK_SHADE} strokeWidth={4} opacity={0.5} />
          <path d="M -100 -340 L 100 -342 L 118 -262 L -118 -260 Z" fill="#4f7a78" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M -90 -320 L 100 -322 M -104 -296 L 108 -298 M -112 -274 L 114 -276" stroke="#efe2c4" strokeWidth={6} opacity={0.85} />
          <path d="M -116 -336 L -98 -340 L -98 -262 L -116 -262 Z" fill="#c99a2e" stroke={INK} strokeWidth={4} />
          <g transform="translate(-52 -222)">
            <path d="M -18 -40 C -34 -18 -34 20 -16 36 L 16 36 C 34 20 34 -18 18 -40 L 12 -54 L -12 -54 Z" fill="#b5703a" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            <path d="M -26 -6 Q 0 8 26 -6" fill="none" stroke="#7e4a24" strokeWidth={4} />
          </g>
          <Limb pts={nb.pts} w={30} col={DK} />
          {hoof(nb.end)}
          <Limb pts={nf.pts} w={30} col={DK} />
          {hoof(nf.end)}
          <Limb pts={[[132, -300], [180, -340], [214, -398]]} w={78} col={DK} />
          <path d="M 120 -336 L 128 -362 L 142 -346 L 154 -376 L 166 -354 L 180 -388 L 190 -362 L 206 -416" fill="none" stroke="#3a2a1c" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          <g transform={`translate(228 -404) rotate(${22 + nod})`}>
            <g transform={`rotate(${-8 + ear * 10} -16 -40)`}>
              <path d="M -18 -36 C -44 -118 -30 -194 -2 -214 C 22 -176 24 -100 14 -42 Z" fill={DK_SHADE} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
            </g>
            <ellipse cx={30} cy={0} rx={88} ry={54} fill={DK} stroke={INK} strokeWidth={8} />
            <ellipse cx={98} cy={14} rx={46} ry={40} fill={DK_BELLY} stroke={INK} strokeWidth={7} />
            <ellipse cx={116} cy={6} rx={8} ry={11} fill="#3a2a1c" />
            <path d="M 70 40 Q 100 54 128 36" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            <g transform={`rotate(${6 + ear * 14} 10 -40)`}>
              <path d="M 6 -44 C -14 -134 8 -212 40 -226 C 62 -184 56 -100 40 -46 Z" fill={DK} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
              <path d="M 14 -62 C 6 -120 20 -172 38 -194 C 46 -160 44 -108 36 -64 Z" fill="#d8b49a" opacity={0.9} />
            </g>
            <Eye id={`${id}-eye`} cx={14} cy={-8} rx={27} ry={25} lid={lids} look={look} iris="#d8e4a6" curve={6} />
          </g>
          {carry}
        </g>
      </g>
    </g>
  );
};

/* ---------- small props, drawn in a person's local hand space ---------- */

export const Scroll = ({ at, rot = -12 }: { at: Pt; rot?: number }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])}) rotate(${rot})`}>
    <rect x={-20} y={-78} width={40} height={156} rx={12} fill="#efe2c4" stroke={INK} strokeWidth={5} />
    <rect x={-28} y={-86} width={56} height={18} rx={8} fill="#8b5e34" stroke={INK} strokeWidth={5} />
    <rect x={-28} y={68} width={56} height={18} rx={8} fill="#8b5e34" stroke={INK} strokeWidth={5} />
    <path d="M -9 -48 L 9 -48 M -9 -26 L 9 -26 M -9 -4 L 9 -4 M -9 18 L 9 18 M -9 40 L 5 40" stroke="#6f5214" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
  </g>
);

export const OilJar = ({ at, rot = 0 }: { at: Pt; rot?: number }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])}) rotate(${rot})`}>
    <path d="M -20 -46 C -48 -28 -48 26 -22 42 L 22 42 C 48 26 48 -28 20 -46 L 14 -64 L -14 -64 Z" fill="#b5703a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d="M -34 -4 Q 0 14 34 -4" fill="none" stroke="#7e4a24" strokeWidth={5} />
    <path d="M -17 -62 L 17 -62 L 15 -74 L -15 -74 Z" fill="#8b5e34" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
  </g>
);

export const Coin = ({ x, y, r = 22, rot = 0 }: { x: number; y: number; r?: number; rot?: number }) => (
  <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${rot})`}>
    <circle r={r} fill="#d6d9dc" stroke={INK} strokeWidth={5} />
    <circle r={r * 0.64} fill="none" stroke="#8d9296" strokeWidth={3.5} />
    <path d={`M ${-r * 0.25} ${r * 0.25} L 0 ${-r * 0.4} L ${r * 0.25} ${r * 0.25}`} fill="none" stroke="#8d9296" strokeWidth={3.5} strokeLinejoin="round" />
  </g>
);

export const Staff = ({ at, rot = 8 }: { at: Pt; rot?: number }) => (
  <g transform={`translate(${r1(at[0])} ${r1(at[1])}) rotate(${rot})`}>
    <path d="M -6 -150 L 6 -150 L 9 140 L -9 140 Z" fill="#6b4a2c" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M -6 -150 Q -6 -178 16 -176" fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
    <path d="M -6 -150 Q -6 -178 16 -176" fill="none" stroke="#6b4a2c" strokeWidth={6} strokeLinecap="round" />
  </g>
);

/* ---------- the page peel ---------- */

// Geometry of a page that peels away. p 0..1. ang is the direction (degrees) the fold
// travels toward: the page peels from the far corner on that side. Returns the polygon
// of the page still lying flat, plus the fold line.
export const peelGeom = (p: number, ang: number, depth = 140) => {
  const rad = (ang * Math.PI) / 180;
  const n: Pt = [Math.cos(rad), Math.sin(rad)];
  const t: Pt = [-n[1], n[0]];
  const proj = [[0, 0], [1080, 0], [1080, 1920], [0, 1920]].map((c) => c[0] * n[0] + c[1] * n[1]);
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  const roll = depth * Math.min(1, p * 7, (1 - p) * 7 + 0.25);
  const c = lerp(hi + roll + 4, lo - roll, ease(p));
  const B: Pt = [n[0] * c, n[1] * c];
  const L = 3600;
  const at = (a: number, b: number): Pt => [B[0] + t[0] * a + n[0] * b, B[1] + t[1] * a + n[1] * b];
  return { n, t, c, roll, B, at, flat: [at(L, 0), at(-L, 0), at(-L, -L), at(L, -L)] as Pt[], rollPoly: [at(L, 0), at(-L, 0), at(-L, roll), at(L, roll)] as Pt[] };
};

export const polyStr = (pts: readonly Pt[]) => pts.map((q) => `${r1(q[0])},${r1(q[1])}`).join(' ');
export const polyCss = (pts: readonly Pt[]) => `polygon(${pts.map((q) => `${r1(q[0])}px ${r1(q[1])}px`).join(',')})`;

export const Peel = ({ p, ang, under, over }: { p: number; ang: number; under: ReactNode; over: ReactNode }) => {
  const g = peelGeom(p, ang);
  const { roll, B, t } = g;
  const A = g.at(0, 0);
  const A2 = g.at(0, roll);
  const sh = g.at(0, roll + 190);
  const tuck = g.at(0, -46);
  const fib = Array.from({ length: 9 }, (_, i) => {
    const a = -540 + i * 140 + ((i * 53) % 40);
    const s0 = g.at(a, roll * 0.12);
    const s1 = g.at(a + 30, roll * 0.9);
    return `M ${r1(s0[0])} ${r1(s0[1])} L ${r1(s1[0])} ${r1(s1[1])}`;
  }).join(' ');
  return (
    <g>
      {under}
      <defs>
        <clipPath id="peelFlat">
          <polygon points={polyStr(g.flat)} />
        </clipPath>
        <linearGradient id="peelRoll" gradientUnits="userSpaceOnUse" x1={A[0]} y1={A[1]} x2={A2[0]} y2={A2[1]}>
          <stop offset="0" stopColor="#7d5a2c" />
          <stop offset="0.22" stopColor="#d9c28f" />
          <stop offset="0.5" stopColor="#fff6dc" />
          <stop offset="0.78" stopColor="#e3cc9a" />
          <stop offset="1" stopColor="#a98550" />
        </linearGradient>
        <linearGradient id="peelShade" gradientUnits="userSpaceOnUse" x1={A2[0]} y1={A2[1]} x2={sh[0]} y2={sh[1]}>
          <stop offset="0" stopColor="#1e0e04" stopOpacity={0.55} />
          <stop offset="1" stopColor="#1e0e04" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="peelTuck" gradientUnits="userSpaceOnUse" x1={A[0]} y1={A[1]} x2={tuck[0]} y2={tuck[1]}>
          <stop offset="0" stopColor="#1e0e04" stopOpacity={0.5} />
          <stop offset="1" stopColor="#1e0e04" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={polyStr([g.at(3600, roll), g.at(-3600, roll), g.at(-3600, roll + 190), g.at(3600, roll + 190)])} fill="url(#peelShade)" />
      <g clipPath="url(#peelFlat)">{over}</g>
      <polygon points={polyStr([g.at(3600, 0), g.at(-3600, 0), g.at(-3600, -46), g.at(3600, -46)])} fill="url(#peelTuck)" />
      {p > 0 && p < 1 ? (
        <g>
          <polygon points={polyStr(g.rollPoly)} fill="url(#peelRoll)" stroke={INK} strokeWidth={4} />
          <path d={fib} stroke="#8a6a3a" strokeWidth={3} opacity={0.35} />
          <path d={`M ${r1(B[0] + t[0] * 3600)} ${r1(B[1] + t[1] * 3600)} L ${r1(B[0] - t[0] * 3600)} ${r1(B[1] - t[1] * 3600)}`} stroke={INK} strokeWidth={5} />
        </g>
      ) : null}
    </g>
  );
};

/* ---------- the paper tear and the freeze burst ---------- */

export const Burst = ({ x, y, r0, r1: rr1, n = 9, a0 = -Math.PI * 0.95, a1 = -Math.PI * 0.05, w = 9, t = 1 }: { x: number; y: number; r0: number; r1: number; n?: number; a0?: number; a1?: number; w?: number; t?: number }) => (
  <Chalk w={w}>
    {Array.from({ length: n }, (_, i) => {
      const a = a0 + (i * (a1 - a0)) / (n - 1);
      const q1 = r0 + (rr1 - r0) * clamp01(t) + (i % 2) * 36;
      return <path key={i} d={`M ${r1(x + Math.cos(a) * r0)} ${r1(y + Math.sin(a) * r0)} L ${r1(x + Math.cos(a) * q1)} ${r1(y + Math.sin(a) * q1)}`} />;
    })}
  </Chalk>
);

