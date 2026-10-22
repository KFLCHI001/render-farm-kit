import type { ComponentProps, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat';
import { loadFont as loadMulish } from '@remotion/google-fonts/Mulish';
import { garamond, garamondItalic } from './brand';
import { Burn, Cam, PaperDefs, Parchment, bell, boilSeed, ease, lerp, stepF } from './bible-story/paper/paper';
import type { Pt } from './bible-story/paper/paper';
import { clamp01, rng } from './bible-story/world';
import { AMBER, Back, Brick, Column, Emblem, Glow, Hand, Hatch, INDIGO, INK, Ink, InkDefs, Lamp, Limb, Lion, Man, Motes, PARCH_LT, ROSE, Rope, SHADE, Slab, Splat, WAX, Wash, bbox, box, draw, ell, flick, poly, seg, shake, wob } from './bible-story/ink/ink';
import type { HatKind } from './bible-story/ink/ink';
import captions from './bible-story/ink/daniel-shorts-captions.json';

// Bible story short, "As he did before" (a retelling of Daniel 6). Lane B: sepia ink
// line art on mottled parchment, drawn on stroke by stroke (after BibleProject).
// 178 s at 30 fps, 1080x1920. Daniel is only ever seen from behind, as a silhouette
// or as hands; the angel is a shaft of light. People step on twos (12 fps), lines
// boil at 8 fps, the camera is smooth. Audio is muxed after the render.
//
// Beats: 0 den sealed and the signet | 1 rewind to Jerusalem and Babylon | 2 Darius and
// the 120 governors | 3 the officials hunt | 4 the whisper | 5 the decree | 6 Daniel opens
// the window | 7 dusk, the watchers, hands raised | 8 the king and the setting sun | 9 the
// den, the stone, two seals | 10 the king's sleepless night | 11 dawn, the run | 12 the
// shaft of light in the den | 13 Daniel drawn up | 14 the empty window | end card.
// appCut drops the narration captions and the end card; Scripture cards stay in both cuts.
export type AsHeDidBeforeProps = { durationSeconds: number; appCut?: boolean };
export const defaultAsHeDidBeforeProps: AsHeDidBeforeProps = { durationSeconds: 178, appCut: false };

const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const mulish = loadMulish('normal', { weights: ['600', '700', '800'], subsets: ['latin'] });
const caveat = loadCaveat('normal', { weights: ['700'], subsets: ['latin'] });

// Scene starts (frames) and every spoken word come from the aligned captions file.
const S = captions.beats.map((b) => fr(b.new_s));
const LINES = captions.lines;
const wordF = (line: number, word: number, edge: 's' | 'e' = 's') => fr(LINES[line].words[word][edge]);
const lineEnd = (line: number) => fr(LINES[line].words[LINES[line].words.length - 1].e);
const T = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
const END_CARD = fr(173.6);
const TITLE_AT = fr(5.6);

// WEBCE text for the Scripture that is on screen only. Keep the curly apostrophe.
const SCRIPTURE = {
  s2: 'an excellent spirit was in him',
  s3: 'they could find no occasion or fault, because he was faithful.',
  s4: 'We won’t find any occasion against this Daniel, unless we find it against him concerning the law of his God.',
  s5: 'whoever asks a petition of any god or man for thirty days, except of you, O king, he shall be cast into the den of lions.',
  s8: 'he labored until the going down of the sun to rescue him.',
  s10: 'No musical instruments were brought before him; and his sleep fled from him.',
};

/* ---------- small helpers ---------- */

type InkP = Omit<ComponentProps<typeof Ink>, 'f'> & { k?: string | number };
const mk =
  (lf: number) =>
  ({ k, ...p }: InkP) => <Ink key={k} f={lf} {...p} />;

type SA = { lf: number; dur: number };

const Veil = ({ fill, op, lf, a, b }: { fill: string; op: number; lf: number; a: number; b: number }) => <rect x={-60} y={-60} width={1200} height={2040} fill={fill} opacity={op * T(lf, a, b)} />;

const wrapText = (t: string, max: number) => {
  const out: string[] = [];
  let cur = '';
  for (const w of t.split(' ')) {
    if (cur && `${cur} ${w}`.length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
};

/* ---------- layers and shared set pieces ---------- */

const r0 = (n: number) => Math.round(n * 10) / 10;

// A parallax layer: slides with the scene's progress u, more for nearer layers (z).
const Par = ({ z, u, dx = -34, dy = 0, children }: { z: number; u: number; dx?: number; dy?: number; children: ReactNode }) => <g transform={`translate(${r0(dx * u * z)} ${r0(dy * u * z)})`}>{children}</g>;

// A tone overlay: ink darkening from the top, the bottom or a side, for real light and dark.
const Tone = ({ kind, op = 1, lf, a = 0, b = 20 }: { kind: 'Top' | 'Bot' | 'L' | 'R'; op?: number; lf: number; a?: number; b?: number }) => (
  <rect x={-80} y={-80} width={1240} height={2080} fill={`url(#tone${kind})`} opacity={op * T(lf, a, b)} />
);

// Rock or earth strokes along the bottom of a scene: a hatched ground band.
const Ground = ({ id, y, lf, at = 0, h = 500, seed = 5, gap = 16, op = 0.5 }: { id: string; y: number; lf: number; at?: number; h?: number; seed?: number; gap?: number; op?: number }) => {
  const I = mk(lf);
  const d = poly([[-80, y], [300, y + 6], [700, y - 4], [1160, y + 4], [1160, y + h], [-80, y + h]], seed, 3, true);
  return (
    <g>
      <Wash d={d} f={lf} at={at} fill={SHADE} op={0.3} over={20} />
      <Hatch id={id} clip={d} area={[-80, y, 1240, h]} gap={gap} ang={8} f={lf} at={at + 4} dur={40} w={2.6} op={op} seed={seed + 1} />
      {I({ d: poly([[-80, y], [300, y + 6], [700, y - 4], [1160, y + 4]], seed + 2, 2.4), at, dur: 40, w: 6 })}
    </g>
  );
};

const SEAL_BLOB = wob(
  Array.from({ length: 11 }, (_, i): Pt => {
    const a = (i / 11) * Math.PI * 2;
    const q = 232 * (0.88 + 0.2 * rng(40 + i)());
    return [540 + Math.cos(a) * q, 1030 + Math.sin(a) * q * 0.94];
  }),
  41,
  3,
  true,
);

// The wax seal and its signet emblem. p overrides the drawn amount (used to un-draw it).
const Seal = ({ f, at = 0, p, r = 1 }: { f: number; at?: number; p?: number; r?: number }) => {
  const I = mk(f);
  return (
    <g transform={`translate(540 1030) scale(${r}) translate(-540 -1030)`}>
      {I({ d: SEAL_BLOB, at, dur: 16, w: 6, wash: WAX, washOp: 0.96, p })}
      {p === undefined || p > 0.4 ? <Emblem cx={540} cy={1030} r={150} f={f} at={at + 4} col={PARCH_LT} op={p === undefined ? 0.6 : 0.6 * p} w={5} /> : null}
    </g>
  );
};


/* ---------- scenes ---------- */

// 0: the den sealed. A heavy stone rolls across the mouth of the den; then a real hand
// presses the king's signet into the wax.
const Scene0 = ({ lf }: SA) => {
  const I = mk(lf);
  if (lf < 86) {
    const roll = Math.pow(T(lf, 26, 72), 1.7);
    const scx = lerp(1580, 540, roll);
    const spin = -((1580 - scx) / 430) * 57.3;
    const [jx, jy] = shake(lf, 72, 24);
    const hole = ell(540, 880, 380, 350, 201, 3);
    const rim = Array.from({ length: 20 }, (_, i) => {
      const a0 = (i / 20) * Math.PI * 2;
      const a1 = ((i + 1) / 20) * Math.PI * 2;
      const k = 1.16 + 0.1 * rng(500 + i)();
      const k2 = 1.16 + 0.1 * rng(520 + i)();
      return poly([[540 + Math.cos(a0) * 380, 880 + Math.sin(a0) * 350], [540 + Math.cos(a0) * 380 * k, 880 + Math.sin(a0) * 350 * k], [540 + Math.cos(a1) * 380 * k2, 880 + Math.sin(a1) * 350 * k2], [540 + Math.cos(a1) * 380, 880 + Math.sin(a1) * 350]], 540 + i, 1.4, true);
    });
    const wallL = poly([[-80, -80], [200, -80], [150, 700], [190, 1500], [-80, 1500]], 21, 4, true);
    const wallR = poly([[1160, -80], [880, -80], [930, 700], [890, 1500], [1160, 1500]], 22, 4, true);
    return (
      <Cam fx={540} fy={900} k={lerp(1, 1.08, T(lf, 0, 72))} tx={jx} ty={jy}>
        <Wash d="M -80 -80 H 1160 V 1500 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={24} />
        <Brick x0={-80} y0={-80} x1={1160} y1={1500} rowH={150} colW={260} f={lf} at={2} dur={50} w={3.6} op={0.42} seed={12} wobble={5} />
        <Hatch id="s0wl" clip={wallL} area={[-80, -80, 280, 1580]} gap={18} ang={66} f={lf} at={6} dur={50} w={2.8} op={0.6} seed={3} />
        <Hatch id="s0wr" clip={wallR} area={[880, -80, 280, 1580]} gap={18} ang={114} f={lf} at={10} dur={50} w={2.8} op={0.6} seed={4} />
        <path d={hole} fill={INK} opacity={0.96} />
        <ellipse cx={540} cy={900} rx={250} ry={230} fill={AMBER} opacity={0.14 * (1 - roll)} />
        <Glow x={540} y={900} r={420} op={0.4 * (1 - roll)} />
        {[0, 1, 2, 3].map((i) => I({ k: `ib${i}`, d: wob([[200 + i * 30, 640 + i * 90], [250 + i * 50, 520 + i * 100], [340 + i * 40, 500 + i * 90]], 560 + i, 2), at: 8 + i * 3, dur: 26, w: 3.6, col: PARCH_LT, op: 0.28 }))}
        {I({ d: hole, at: 0, dur: 30, w: 10 })}
        {rim.map((d, i) => I({ k: `rm${i}`, d, at: 6 + i * 1.5, dur: 18, w: 4.6, wash: SHADE, washOp: 0.2 + 0.12 * (i % 3), crisp: true }))}
        <Ground id="s0g" y={1400} lf={lf} at={4} h={520} seed={9} />
        <ellipse cx={scx + 40} cy={1410} rx={480} ry={40} fill={INK} opacity={0.4} filter="url(#inkSoft)" />
        {lf >= 20 ? <Slab id="s0s" cx={scx} cy={880} rx={470} ry={430} th={80} f={lf} at={-100} spin={spin} seed={5} shadow={false} /> : null}
        {lf >= 30
          ? Array.from({ length: 7 }, (_, i) => (
              <circle key={i} cx={r0(scx + 420 + i * 36 + (lf - 30) * 0.8)} cy={r0(1396 - i * 12 - (lf - 30) * 0.35)} r={r0(22 + i * 8)} fill={SHADE} opacity={0.3 * (1 - i / 8) * (1 - T(lf, 72, 86))} />
            ))
          : null}
        {lf >= 72 ? <ellipse cx={540} cy={1404} rx={470 + (lf - 72) * 34} ry={40 + (lf - 72) * 3} fill="none" stroke={SHADE} strokeWidth={9} opacity={0.5 * (1 - T(lf, 72, 86))} /> : null}
        <Tone kind="Top" lf={lf} op={0.8} />
        <Tone kind="Bot" lf={lf} op={0.55} />
      </Cam>
    );
  }
  const b = lf - 86;
  const press = 22;
  const off = b < press ? 1 - Math.pow(T(b, 0, press), 2.2) : ease(T(b, 38, 80));
  const [jx, jy] = shake(b, press, 20);
  const wax = lerp(0.3, 1, ease(T(b, 0, 14))) * (1 + 0.05 * Math.exp(-Math.max(0, b - press) / 4) * (b >= press ? 1 : 0));
  return (
    <Cam fx={540} fy={1030} k={lerp(1, 1.08, T(b, 0, 143))} tx={jx} ty={jy}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={86} fill={SHADE} op={0.3} over={12} />
      <Brick x0={-80} y0={-80} x1={1160} y1={2000} rowH={190} colW={330} f={lf} at={86} dur={40} w={4} op={0.46} seed={31} wobble={6} />
      <Glow x={540} y={1030} r={680} op={0.6 * flick(lf, 2)} />
      <Rope pts={[[-80, 960], [200, 1034], [440, 1076]]} w={30} />
      <Rope pts={[[640, 1080], [880, 1036], [1160, 1110]]} w={30} />
      <g transform={`translate(540 1030) scale(${wax}) translate(-540 -1030)`}>
        <path d={SEAL_BLOB} fill={WAX} opacity={0.97} />
        {I({ d: SEAL_BLOB, at: 86, dur: 14, w: 7 })}
        {I({ d: wob([[372, 880], [408, 826], [480, 792]], 321, 2), at: 90, dur: 14, w: 7, col: PARCH_LT, op: 0.35 })}
        {I({ d: wob([[486, 1230], [488, 1290], [470, 1330], [450, 1292], [458, 1240]], 322, 1.4), at: 92, dur: 16, w: 5, wash: WAX, washOp: 0.95 })}
        {I({ d: wob([[640, 1236], [646, 1300], [622, 1336], [606, 1296], [616, 1242]], 323, 1.4), at: 94, dur: 16, w: 5, wash: WAX, washOp: 0.95 })}
      </g>
      {b >= press ? <Ink d={ell(540, 1030, 160, 158, 324, 2)} f={lf} at={86 + press} dur={8} w={4} wash={INK} washOp={0.3} crisp /> : null}
      {b >= press ? <Emblem cx={540} cy={1030} r={150} f={lf} at={86 + press} col={PARCH_LT} op={0.72} w={7} /> : null}
      {b >= press ? <Splat x={540} y={1030} r={70} f={lf} at={86 + press} seed={7} /> : null}
      <Hand x={792 + off * 700} y={833 - off * 980} s={2.4} rot={225} pose="relax" ring={3} sleeve={340} f={lf} at={86} dur={14} px={7} seed={300} sleeveCol={SHADE} />
      <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.85} />
    </Cam>
  );
};


// Battlements along a wall top: a notched polyline from x0 to x1.
const cren = (x0: number, x1: number, top: number, step = 30, h = 16): Pt[] => {
  const out: Pt[] = [];
  for (let x = x0; x < x1; x += step) out.push([x, top], [x, top - h], [Math.min(x1, x + step / 2), top - h], [Math.min(x1, x + step / 2), top]);
  out.push([x1, top]);
  return out;
};

// A cloud: a flat base and a bumpy top.
const cloud = (cx: number, cy: number, w: number, seed: number) => {
  const top: Pt[] = Array.from({ length: 9 }, (_, i): Pt => [cx - w / 2 + (w * i) / 8, cy - (14 + 26 * Math.abs(Math.sin(i * 1.9 + seed))) * Math.sin((Math.PI * i) / 8)]);
  return wob([...top, [cx + w * 0.3, cy + 14], [cx, cy + 18], [cx - w * 0.3, cy + 14]], seed, 3, true);
};

// A glazed-brick relief: a striding animal in a few lines (Ishtar Gate style).
const Relief = ({ x, y, k = 1, f, at, seed = 3, flip = false }: { x: number; y: number; k?: number; f: number; at: number; seed?: number; flip?: boolean }) => {
  const I = mk(f);
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -k : k} ${k})`}>
      {I({ d: poly([[0, 0], [58, -4], [64, -26], [88, -32], [96, -20], [92, -4], [100, 0], [96, 22], [88, 22], [90, 6], [70, 8], [62, 26], [54, 26], [56, 6], [28, 8], [20, 26], [12, 26], [14, 6], [4, 10]], seed, 0.8, true), at, dur: 20, w: 3 / k, wash: AMBER, washOp: 0.34, crisp: true })}
      {I({ d: wob([[0, 0], [-16, -10], [-22, -26]], seed + 1, 0.6), at: at + 6, dur: 8, w: 2.6 / k })}
      {I({ d: poly([[88, -32], [92, -46], [84, -40]], seed + 2, 0.4), at: at + 8, dur: 6, w: 2.6 / k })}
      {I({ d: seg(8, -34, 8, 4, seed + 3, 0.4), at: at + 10, dur: 6, w: 2 / k, op: 0.6 })}
    </g>
  );
};

// Jerusalem on its hill: a battlemented wall, towers, houses and the temple, in washes.
const Jerusalem = ({ lf, at }: { lf: number; at: number }) => {
  const I = mk(lf);
  const hill = wob([[-120, 1300], [60, 1180], [220, 1110], [420, 1060], [540, 1040], [700, 1060], [880, 1110], [1040, 1180], [1200, 1300]], 71, 4);
  const houses: [number, number, number, number][] = [[170, 1020, 70, 70], [250, 990, 64, 100], [326, 1016, 84, 74], [430, 1000, 66, 92], [650, 1000, 68, 92], [726, 1022, 84, 70], [820, 986, 66, 104], [896, 1014, 70, 76]];
  return (
    <g>
      <Wash d={`${hill} L 1200 1330 L -120 1330 Z`} f={lf} at={at} fill={SHADE} op={0.34} over={30} />
      {I({ d: hill, at, dur: 50, w: 6 })}
      {houses.map(([x, y, w, h], i) => (
        <g key={i}>
          {I({ k: `h${i}`, d: box(x, y, w, h, 80 + i, 1.4), at: at + 16 + i * 4, dur: 20, w: 4, wash: PARCH_LT, washOp: 0.6, crisp: true })}
          {I({ k: `r${i}`, d: seg(x - 4, y, x + w + 4, y, 90 + i, 1), at: at + 22 + i * 4, dur: 10, w: 5 })}
          {I({ k: `d${i}`, d: poly([[x + w / 2 - 8, y + h], [x + w / 2 - 8, y + h - 24], [x + w / 2, y + h - 32], [x + w / 2 + 8, y + h - 24], [x + w / 2 + 8, y + h]], 100 + i, 0.8), at: at + 30 + i * 4, dur: 10, w: 3, wash: INK, washOp: 0.7, crisp: true })}
        </g>
      ))}
      {/* the temple on the crest: steps, columns and a pediment, warmed with amber */}
      <Wash d="M 400 900 L 680 900 L 680 1040 L 400 1040 Z" f={lf} at={at + 50} fill={AMBER} op={0.22} over={30} />
      {I({ d: poly([[390, 1040], [390, 1022], [690, 1022], [690, 1040]], 110, 1.4, true), at: at + 30, dur: 24, w: 5, wash: SHADE, washOp: 0.3 })}
      {I({ d: poly([[404, 1022], [404, 1004], [676, 1004], [676, 1022]], 111, 1.4, true), at: at + 34, dur: 22, w: 5, wash: SHADE, washOp: 0.28 })}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `tc${i}`, d: box(420 + i * 40, 904, 18, 100, 120 + i, 1), at: at + 40 + i * 4, dur: 16, w: 3.6, wash: PARCH_LT, washOp: 0.7, crisp: true }))}
      {I({ d: poly([[396, 904], [684, 904], [540, 810]], 130, 1.4, true), at: at + 66, dur: 28, w: 6, wash: SHADE, washOp: 0.3 })}
      {I({ d: poly([[430, 892], [650, 892], [540, 834]], 131, 1, true), at: at + 80, dur: 20, w: 3, op: 0.6 })}
      {I({ d: seg(540, 810, 540, 770, 132, 1), at: at + 90, dur: 8, w: 5 })}
      {/* the wall in front with a gate and two towers */}
      <Wash d="M 110 1110 L 980 1110 L 980 1260 L 110 1260 Z" f={lf} at={at + 20} fill={SHADE} op={0.3} over={24} />
      {I({ d: poly([[110, 1260], [110, 1114], ...cren(110, 980, 1114), [980, 1260]], 140, 1.6), at: at + 24, dur: 60, w: 5.4 })}
      <Brick x0={112} y0={1120} x1={978} y1={1258} rowH={23} colW={46} f={lf} at={at + 40} dur={46} w={2} op={0.4} seed={9} />
      {[150, 940].map((x, i) => (
        <g key={i}>
          {I({ k: `tw${i}`, d: poly([[x - 56, 1262], [x - 56, 1010], ...cren(x - 56, x + 56, 1010, 28, 18), [x + 56, 1262]], 150 + i, 1.6), at: at + 36 + i * 8, dur: 40, w: 5.4, wash: SHADE, washOp: 0.32 })}
          {I({ k: `ts${i}`, d: seg(x, 1090, x, 1130, 160 + i, 1), at: at + 60, dur: 8, w: 6, col: INK })}
        </g>
      ))}
      {I({ d: poly([[490, 1262], [490, 1186], [540, 1150], [590, 1186], [590, 1262]], 170, 1.4), at: at + 56, dur: 30, w: 5.4, wash: INK, washOp: 0.72 })}
      <Hatch id="jrh" clip={poly([[600, 1114], [980, 1114], [980, 1260], [600, 1260]], 172, 2, true)} area={[600, 1114, 380, 146]} gap={13} ang={62} f={lf} at={at + 70} dur={36} w={2.4} op={0.5} seed={4} />
      {/* olive trees on the slopes */}
      {[[40, 1230, 1], [1050, 1220, 1.1], [-60, 1280, 1.3], [1170, 1290, 1.2]].map(([x, y, k], i) => (
        <g key={i}>
          {I({ k: `ot${i}`, d: wob([[x, y], [x + 4 * k, y - 40 * k], [x - 4 * k, y - 66 * k]], 180 + i, 2), at: at + 80 + i * 6, dur: 14, w: 5 })}
          {I({ k: `oc${i}`, d: ell(x, y - 90 * k, 52 * k, 34 * k, 190 + i, 4), at: at + 86 + i * 6, dur: 20, w: 4, wash: INK, washOp: 0.34 })}
        </g>
      ))}
      {[0, 1, 2].map((i) => I({ k: `sm${i}`, d: wob([[326 + i * 250, 984], [316 + i * 250, 940], [338 + i * 250, 900], [326 + i * 250, 850]], 200 + i, 3), at: at + 96 + i * 8, dur: 30, w: 3, op: 0.4 }))}
    </g>
  );
};

// Babylon: a massive brick wall, two towers with animal reliefs, an arched gate.
const Babylon = ({ lf, at }: { lf: number; at: number }) => {
  const I = mk(lf);
  const gate = 'M 360 1340 L 360 1060 Q 360 880 540 880 Q 720 880 720 1060 L 720 1340 Z';
  return (
    <g>
      <Wash d="M -480 840 L 1560 840 L 1560 1360 L -480 1360 Z" f={lf} at={at} fill={SHADE} op={0.32} over={30} />
      {I({ d: poly([[-480, 1340], [-480, 846], ...cren(-480, 1560, 846, 40, 24), [1560, 1340]], 300, 2), at, dur: 70, w: 6 })}
      <Brick x0={-478} y0={856} x1={1558} y1={1338} rowH={34} colW={70} f={lf} at={at + 10} dur={70} w={2.4} op={0.4} seed={6} />
      {[-40, 960].map((x, i) => (
        <g key={i}>
          <Wash d={`M ${x - 130} 620 L ${x + 130} 620 L ${x + 130} 1340 L ${x - 130} 1340 Z`} f={lf} at={at + 20 + i * 8} fill={SHADE} op={0.22} over={24} />
          {I({ k: `bt${i}`, d: poly([[x - 130, 1340], [x - 130, 640], ...cren(x - 130, x + 130, 640, 44, 28), [x + 130, 1340]], 310 + i, 2), at: at + 20 + i * 8, dur: 60, w: 6, wash: SHADE, washOp: 0.12 })}
          <Brick x0={x - 128} y0={650} x1={x + 128} y1={1338} rowH={34} colW={64} f={lf} at={at + 40} dur={50} w={2.2} op={0.45} seed={20 + i} />
          {[720, 880, 1040, 1200].map((y, j) => (
            <Relief key={j} x={i === 1 ? x + 75 : x - 75} y={y + 40} k={1.5} f={lf} at={at + 70 + j * 10} seed={330 + i * 9 + j} flip={i === 1} />
          ))}
        </g>
      ))}
      {/* the gate: an arch band of glazed brick, a dark passage, animals either side */}
      <Wash d={gate} f={lf} at={at + 50} fill={INK} op={0.82} over={20} />
      {I({ d: gate, at: at + 40, dur: 44, w: 8 })}
      {I({ d: 'M 330 1340 L 330 1060 Q 330 850 540 850 Q 750 850 750 1060 L 750 1340', at: at + 46, dur: 44, w: 5 })}
      {I({ d: 'M 300 1340 L 300 1060 Q 300 820 540 820 Q 780 820 780 1060 L 780 1340', at: at + 52, dur: 44, w: 3.4, op: 0.7 })}
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI + (i / 10) * Math.PI;
        return I({ k: `kb${i}`, d: seg(540 + Math.cos(a) * 192, 1060 + Math.sin(a) * 200, 540 + Math.cos(a) * 224, 1060 + Math.sin(a) * 232, 350 + i, 0.6), at: at + 60 + i * 2, dur: 8, w: 3, op: 0.7 });
      })}
      <Relief x={410} y={1180} k={1.1} f={lf} at={at + 90} seed={360} />
      <Relief x={640} y={1180} k={1.1} f={lf} at={at + 96} seed={366} flip />
      {I({ d: seg(360, 1340, 720, 1340, 370, 2), at: at + 60, dur: 20, w: 6 })}
    </g>
  );
};

// 1: rewind. The seal un-draws, Jerusalem draws, the captives are led away to Babylon.
const Scene1 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const unw = 1 - draw(lf / 34);
  const jOut = ease(T(lf, 120, 250));
  const sj = lerp(1.22, 0.6, jOut);
  const sb = lerp(0.42, 1, ease(T(lf, 190, 390)));
  const cap = [
    { x: 500, y: 1366, s: 0.4, hair: 'dark' as const, seed: 801 },
    { x: 610, y: 1430, s: 0.47, hair: 'wrap' as const, seed: 802 },
    { x: 400, y: 1512, s: 0.58, hair: 'dark' as const, seed: 803 },
    { x: 740, y: 1630, s: 0.74, hair: 'dark' as const, seed: 804 },
    { x: 360, y: 1810, s: 1.0, hair: 'white' as const, seed: 805 },
  ];
  const road = poly([[440, 1262], [640, 1262], [1010, 1960], [70, 1960]], 21, 4, true);
  const u = T(lf, 0, dur);
  return (
    <Cam fx={540} fy={1500} k={1 + 0.04 * T(lf, 0, dur) + 0.22 * ease(T(lf, 300, 398))}>
      {unw > 0.01 ? <Seal f={lf} at={0} p={unw} /> : null}
      <Par z={0.3} u={u} dx={-60}>
        <Wash d="M -120 400 H 1200 V 1300 H -120 Z" f={lf} at={20} fill={AMBER} op={0.14} over={40} />
        <Glow x={820} y={700} r={520} op={0.8 * (1 - T(lf, 220, 300))} />
        {I({ d: ell(820, 700, 84, 84, 43, 2), at: 20, dur: 30, w: 5, wash: AMBER, washOp: 0.7 })}
        {[[160, 520, 320], [640, 380, 380], [320, 760, 280], [880, 600, 300]].map(([cx, cy, cw], i) => I({ k: `cl${i}`, d: cloud(cx, cy, cw, 44 + i), at: 14 + i * 6, dur: 40, w: 3.4, wash: PARCH_LT, washOp: 0.34 }))}
        {[[300, 660], [360, 620], [440, 690]].map(([bx, by], i) => I({ k: `bd${i}`, d: wob([[bx - 22, by], [bx - 8, by - 12], [bx, by], [bx + 8, by - 12], [bx + 22, by]], 48 + i, 1), at: 60 + i * 5, dur: 10, w: 3.4 }))}
        {I({ d: wob([[-120, 1250], [200, 1180], [420, 1236]], 41, 3), at: 24, dur: 60, w: 3.4, op: 0.4 })}
        {I({ d: wob([[640, 1236], [900, 1170], [1200, 1230]], 42, 3), at: 28, dur: 60, w: 3.4, op: 0.4 })}
      </Par>
      <Par z={0.6} u={u} dx={-90}>
        <g opacity={1 - T(lf, 200, 270)} transform={`translate(540 1262) scale(${sj}) translate(-540 -1262)`}>
          <Jerusalem lf={lf} at={26} />
        </g>
        {lf > 190 ? (
          <g transform={`translate(540 1340) scale(${sb}) translate(-540 -1340)`} opacity={T(lf, 190, 214)}>
            <Babylon lf={lf} at={190} />
          </g>
        ) : null}
      </Par>
      {/* the road, hatched earth either side */}
      <Wash d={road} f={lf} at={30} fill={PARCH_LT} op={0.5} over={30} />
      <Ground id="s1g" y={1262} lf={lf} at={24} h={700} seed={12} gap={20} op={0.42} />
      {I({ d: wob([[470, 1270], [400, 1500], [300, 1960]], 51, 4), at: 40, dur: 40, w: 3.4, op: 0.55 })}
      {I({ d: wob([[610, 1270], [690, 1500], [830, 1960]], 52, 4), at: 44, dur: 40, w: 3.4, op: 0.55 })}
      {I({ d: poly([[440, 1262], [70, 1960]], 53, 3), at: 30, dur: 40, w: 5 })}
      {I({ d: poly([[640, 1262], [1010, 1960]], 54, 3), at: 32, dur: 40, w: 5 })}
      {/* the captives: led away, seen from behind, roped at the shoulder */}
      {lf > 70
        ? cap.map((c, i) => <Back key={i} id={`s1b${i}`} x={c.x} y={c.y} s={c.s} f={lf} at={70 + (4 - i) * 6} hair={c.hair} walk={lf} lean={3} lit={i === 4} seed={c.seed} px={4.4} op={1 - T(lf, 300, 340) * (i < 4 ? 1 : 0)} wash={i % 2 ? SHADE : '#7a6048'} />)
        : null}
      {lf > 100 ? I({ d: poly(cap.map((c): Pt => [c.x + (c.x > 540 ? -c.s * 40 : c.s * 40), c.y - c.s * 520]), 61, 1.2), at: 100, dur: 24, w: 3, op: 0.7 }) : null}
      {lf > 140 ? <Glow x={360} y={1500} r={460} op={0.55 * (1 - T(lf, 300, 340))} /> : null}
      <Tone kind="Top" lf={lf} op={0.6} />
      <Tone kind="Bot" lf={lf} op={0.35} />
    </Cam>
  );
};


// The hall's perspective floor: lines running to a vanishing point and receding bands.
const FloorLines = ({ lf, at, y0, vy = 900, y1 = 1960, seed = 3 }: { lf: number; at: number; y0: number; vy?: number; y1?: number; seed?: number }) => {
  const I = mk(lf);
  let d = '';
  for (let xb = -1500; xb <= 2600; xb += 230) {
    const t = (y0 - vy) / (y1 - vy);
    d += `M ${r0(540 + (xb - 540) * t)} ${y0} L ${xb} ${y1} `;
  }
  let yy = y0;
  let step = 34;
  while (yy < y1) {
    d += `M -200 ${r0(yy)} L 1280 ${r0(yy)} `;
    yy += step;
    step *= 1.28;
  }
  return I({ d, at, dur: 50, w: 2.6, op: 0.4 });
};

// A crowd of governors in rows: robes, heads and a few hats, packed so the hall reads full.
const Crowd = ({ lf, at, rows = 6, cols = 20, y0 = 1330, ys = 62, seed = 100, wash = SHADE }: { lf: number; at: number; rows?: number; cols?: number; y0?: number; ys?: number; seed?: number; wash?: string }) => {
  const I = mk(lf);
  const out: ReactNode[] = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rr = rng(seed + r * 50 + c);
      const x = 24 + c * (1100 / cols) + (r % 2) * 27 + (rr() - 0.5) * 14;
      const y = y0 + r * ys;
      const h = 70 + r * 10 + rr() * 6;
      const w = h * 0.3;
      const a = at + n * 0.85;
      n++;
      out.push(
        <g key={`${r}-${c}`}>
          {I({ k: 'b', d: poly([[x - w, y], [x - w * 0.7, y - h * 0.6], [x + w * 0.7, y - h * 0.6], [x + w, y]], seed + n, 1, true), at: a, dur: 9, w: 2.6, wash: r % 2 ? wash : '#7a6048', washOp: 0.34 + r * 0.05, crisp: true })}
          {I({ k: 'h', d: ell(x, y - h * 0.76, h * 0.13, h * 0.15, seed + 300 + n, 0.6), at: a + 2, dur: 7, w: 2.4, wash: PARCH_LT, washOp: 0.85, crisp: true })}
          {c % 3 === 0 ? I({ k: 't', d: poly([[x - h * 0.1, y - h * 0.86], [x + h * 0.1, y - h * 0.86], [x + h * 0.09, y - h * 1.04], [x - h * 0.09, y - h * 1.04]], seed + 600 + n, 0.6, true), at: a + 3, dur: 6, w: 2.4, wash: INK, washOp: 0.55, crisp: true }) : null}
          {c % 3 === 1 ? I({ k: 'c', d: ell(x, y - h * 0.9, h * 0.15, h * 0.09, seed + 900 + n, 0.5), at: a + 3, dur: 6, w: 2.4, wash: wash, washOp: 0.6, crisp: true }) : null}
        </g>,
      );
    }
  }
  return <g>{out}</g>;
};

// 2: Darius on his throne, 120 governors, three presidents; Daniel stands in the light.
const Scene2 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const fl = flick(lf, 6);
  return (
    <Cam fx={540} fy={1300} k={lerp(1, 1.14, ease(T(lf, 20, dur)))} tx={lerp(0, -12, u)}>
      <Wash d="M -80 -80 H 1160 V 1300 H -80 Z" f={lf} at={0} fill={SHADE} op={0.22} over={30} />
      {/* the far wall: a tall arch window and tapestry bands */}
      <Par z={0.3} u={u} dx={-30}>
        {I({ d: 'M 330 1030 L 330 560 Q 330 380 540 380 Q 750 380 750 560 L 750 1030', at: 4, dur: 50, w: 5, wash: AMBER, washOp: 0.22 })}
        {I({ d: 'M 370 1030 L 370 570 Q 370 424 540 424 Q 710 424 710 570 L 710 1030', at: 10, dur: 44, w: 3, op: 0.55 })}
        <Brick x0={-80} y0={200} x1={1160} y1={1040} rowH={64} colW={150} f={lf} at={6} dur={60} w={2.4} op={0.26} seed={11} wobble={3} />
      </Par>
      {/* back columns and front columns */}
      <Par z={0.6} u={u} dx={-46}>
        <Column id="s2c1" x={250} top={300} bot={1200} hw={34} f={lf} at={0} seed={21} />
        <Column id="s2c2" x={830} top={300} bot={1200} hw={34} f={lf} at={6} seed={22} />
      </Par>
      <Par z={1} u={u} dx={-70}>
        <Column id="s2c3" x={70} top={150} bot={1330} hw={58} f={lf} at={8} seed={23} />
        <Column id="s2c4" x={1010} top={150} bot={1330} hw={58} f={lf} at={14} seed={24} />
      </Par>
      {/* the canopy: a pelmet with a scalloped edge and two swags, trimmed in amber */}
      {I({ d: poly([[-20, 150], [1100, 150], [1100, 330], ...Array.from({ length: 12 }, (_, i): Pt => [1100 - i * 100 - 50, 330 + (i % 2 ? 0 : 56)]), [-20, 330]], 31, 2.4, true), at: 20, dur: 50, w: 6, wash: SHADE, washOp: 0.4 })}
      {Array.from({ length: 12 }, (_, i) => I({ k: `pf${i}`, d: wob([[1100 - i * 100 - 50, 330 + (i % 2 ? 0 : 56)], [1100 - i * 100 - 50, 200]], 40 + i, 2), at: 40 + i * 2, dur: 14, w: 3, op: 0.5 }))}
      {I({ d: seg(-20, 160, 1100, 160, 32, 2), at: 30, dur: 40, w: 8, col: AMBER, op: 0.9 })}
      {/* the dais, three steps, and the throne with its high back */}
      <Wash d="M 150 1330 L 930 1330 L 930 1180 L 150 1180 Z" f={lf} at={30} fill={AMBER} op={0.2} over={40} />
      {I({ d: poly([[110, 1330], [970, 1330], [940, 1280], [140, 1280]], 33, 1.6, true), at: 34, dur: 30, w: 5, wash: SHADE, washOp: 0.3 })}
      {I({ d: poly([[170, 1280], [910, 1280], [880, 1230], [200, 1230]], 34, 1.6, true), at: 38, dur: 30, w: 5, wash: SHADE, washOp: 0.34 })}
      {I({ d: poly([[250, 1230], [830, 1230], [800, 1186], [280, 1186]], 35, 1.6, true), at: 42, dur: 30, w: 5, wash: SHADE, washOp: 0.38 })}
      {I({ d: poly([[680, 1186], [680, 600], [724, 560], [790, 600], [790, 1186]], 36, 1.8, true), at: 40, dur: 44, w: 6, wash: SHADE, washOp: 0.44 })}
      {I({ d: poly([[700, 650], [770, 650]], 37, 1), at: 60, dur: 12, w: 4, col: AMBER })}
      {I({ d: ell(740, 720, 30, 44, 38, 1.4), at: 62, dur: 16, w: 4, wash: AMBER, washOp: 0.5 })}
      {I({ d: poly([[360, 1186], [360, 1096], [690, 1096], [690, 1186]], 39, 1.6, true), at: 44, dur: 30, w: 6, wash: SHADE, washOp: 0.46 })}
      {I({ d: poly([[336, 1096], [336, 1070], [700, 1070], [700, 1096]], 41, 1.4, true), at: 50, dur: 20, w: 5, wash: AMBER, washOp: 0.4 })}
      <Man id="s2d" x={548} y={1186} s={1.1} dir={-1} f={lf} at={44} hat="crown" beard seated arm="rest" seed={365} px={5.4} wash="#8a6a4e" washOp={0.4} />
      {/* the hall floor with its lines, and the crowd of governors */}
      <Wash d="M -80 1330 H 1160 V 2000 H -80 Z" f={lf} at={20} fill={PARCH_LT} op={0.34} over={30} />
      <FloorLines lf={lf} at={22} y0={1330} vy={880} />
      <Crowd lf={lf} at={78} y0={1380} ys={60} seed={100} />
      <Glow x={540} y={1180} r={560 * fl} op={0.38} />
      {/* the three presidents, with Daniel between them */}
      <Man id="s2p1" x={170} y={1930} s={0.98} dir={1} f={lf} at={196} hat="tall" narrow={0.5} arm="rest" seed={370} px={5.4} wash="#5e4a3c" washOp={0.45} />
      <Man id="s2p2" x={910} y={1930} s={0.98} dir={-1} f={lf} at={206} hat="tall" narrow={0.5} arm="rest" seed={372} px={5.4} wash="#5e4a3c" washOp={0.45} />
      <Back id="s2da" x={540} y={1960} s={1.0} f={lf} at={216} lit seed={374} px={5.6} />
      <Glow x={540} y={1500} r={420} op={0.7 * T(lf, 230, 270)} />
      <Tone kind="Top" lf={lf} op={0.7} />
      <Tone kind="Bot" lf={lf} op={0.3} />
      <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.5} />
    </Cam>
  );
};


// Shelves of pigeonholes with scroll ends: the archive wall.
const Shelves = ({ lf, at, x0, y0, x1, y1, rows, cols, seed = 3, w = 4 }: { lf: number; at: number; x0: number; y0: number; x1: number; y1: number; rows: number; cols: number; seed?: number; w?: number }) => {
  const I = mk(lf);
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  let grid = '';
  for (let r = 0; r <= rows; r++) grid += `M ${x0} ${r0(y0 + r * rh)} L ${x1} ${r0(y0 + r * rh)} `;
  for (let c = 0; c <= cols; c++) grid += `M ${r0(x0 + c * cw)} ${y0} L ${r0(x0 + c * cw)} ${y1} `;
  const rr = rng(seed);
  let ends = '';
  let n = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (rr() < 0.22) continue;
      const k = 1 + Math.floor(rr() * 3);
      for (let j = 0; j < k; j++) {
        const cx = x0 + c * cw + cw * (0.24 + 0.26 * j + (rr() - 0.5) * 0.06);
        const cy = y0 + r * rh + rh * 0.66 + (rr() - 0.5) * 12;
        ends += `${ell(cx, cy, cw * 0.115, cw * 0.115, seed + 40 + n++, 0.5)} `;
      }
    }
  return (
    <g>
      <Wash d={box(x0, y0, x1 - x0, y1 - y0, seed + 1, 2)} f={lf} at={at} fill={INK} op={0.46} over={20} />
      {I({ d: grid, at, dur: 56, w: w * 1.5, op: 1 })}
      {I({ d: ends, at: at + 24, dur: 36, w: w * 0.7, wash: PARCH_LT, washOp: 0.85, crisp: true })}
    </g>
  );
};

// A rolled scroll lying along x: a cylinder with shaded underside, a spiral cap at each end and a tie.
const Roll = ({ x0, x1, y, r, f, at = 0, seed = 5, w = 4, tie = true }: { x0: number; x1: number; y: number; r: number; f: number; at?: number; seed?: number; w?: number; tie?: boolean }) => {
  const I = mk(f);
  return (
    <g>
      {I({ d: poly([[x0, y - r], [x1, y - r], [x1, y + r], [x0, y + r]], seed, 1.2, true), at, dur: 18, w, wash: PARCH_LT, washOp: 0.97, crisp: true })}
      <Wash d={poly([[x0, y + r * 0.25], [x1, y + r * 0.25], [x1, y + r], [x0, y + r]], seed + 1, 1)} f={f} at={at + 6} fill={SHADE} op={0.45} over={8} />
      {I({ d: seg(x0 + 6, y - r * 0.45, x1 - 6, y - r * 0.45, seed + 2, 0.8), at: at + 8, dur: 14, w: w * 0.45, op: 0.5 })}
      {[x0, x1].map((x, i) => (
        <g key={i}>
          {I({ k: `a${i}`, d: ell(x, y, r * 0.42, r, seed + 3 + i, 0.8), at: at + 4, dur: 14, w, wash: i ? SHADE : PARCH_LT, washOp: 0.9, crisp: true })}
          {I({ k: `b${i}`, d: ell(x, y, r * 0.24, r * 0.58, seed + 5 + i, 0.5), at: at + 10, dur: 10, w: w * 0.55, op: 0.7 })}
          {I({ k: `c${i}`, d: ell(x, y, r * 0.09, r * 0.2, seed + 7 + i, 0.3), at: at + 14, dur: 8, w: w * 0.5, op: 0.7 })}
        </g>
      ))}
      {tie ? I({ d: poly([[x0 + (x1 - x0) * 0.5, y - r - 2], [x0 + (x1 - x0) * 0.5 + 4, y + r + 2]], seed + 9, 0.4), at: at + 14, dur: 8, w: w * 1.6, col: WAX }) : null}
    </g>
  );
};

// The long desk in perspective: top plane, front panels in shadow, legs.
const Desk = ({ lf, at, y }: { lf: number; at: number; y: number }) => {
  const I = mk(lf);
  const top = poly([[-80, y], [1160, y], [1230, y + 74], [-150, y + 74]], 61, 2, true);
  const front = poly([[-150, y + 74], [1230, y + 74], [1230, 2000], [-150, 2000]], 62, 2, true);
  return (
    <g>
      <path d={front} fill={FIG_BASE_DARK} opacity={0.96} />
      <Wash d={front} f={lf} at={at} fill={INK} op={0.55} over={20} />
      <Hatch id="s3df" clip={front} area={[-150, y + 74, 1380, 1930 - y]} gap={15} ang={84} f={lf} at={at + 4} dur={40} w={2.6} op={0.55} seed={5} />
      {[0, 1, 2].map((i) => I({ k: `pn${i}`, d: box(-70 + i * 440, y + 130, 400, 300, 63 + i, 2), at: at + 12 + i * 4, dur: 30, w: 4, op: 0.7 }))}
      <path d={top} fill="#a98a5e" opacity={0.97} />
      <Wash d={top} f={lf} at={at} fill={AMBER} op={0.22} over={20} />
      {I({ d: top, at, dur: 40, w: 6 })}
      {[0, 1, 2, 3, 4, 5].map((i) => I({ k: `gr${i}`, d: wob([[-60 + i * 200, y + 18 + (i % 3) * 14], [200 + i * 200, y + 14 + (i % 2) * 14]], 70 + i, 1.5), at: at + 10, dur: 24, w: 2.2, op: 0.35 }))}
    </g>
  );
};
const FIG_BASE_DARK = '#7a6048';

// 3: the officials hunt through ledgers and scrolls under a swinging lamp.
const Scene3 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const narrow = T(lf, 90, 140);
  const sw = 0.2 * Math.sin(lf / 40);
  const lx = 540 + 700 * Math.sin(sw);
  const ly = 60 + 700 * Math.cos(sw);
  const fl = flick(lf, 4);
  const flip = Math.cos(((stepF(lf) % 40) / 40) * Math.PI);
  const unroll = draw(T(lf, 60, 150));
  const DY = 1420;
  return (
    <Cam fx={540} fy={1350} k={lerp(1, 1.1, u)} tx={lerp(14, -22, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={20} />
      <Veil fill={INDIGO} op={0.42} lf={lf} a={0} b={30} />
      {/* the archive wall: pigeonholes full of scrolls, and the arch of the room */}
      <Par z={0.3} u={u} dx={-30}>
        <Brick x0={-80} y0={-80} x1={1160} y1={1500} rowH={120} colW={210} f={lf} at={2} dur={60} w={3} op={0.28} seed={13} wobble={4} />
        <Shelves lf={lf} at={4} x0={20} y0={400} x1={1060} y1={1240} rows={4} cols={7} seed={7} />
      </Par>
      {/* the lamp on its chain, swinging */}
      {[-46, 0, 52].map((o, i) => (
        <path key={i} d={`M 540 -60 L ${r0(lx + o * 0.9)} ${r0(ly - 8)}`} stroke={INK} strokeWidth={i === 1 ? 5 : 3.4} opacity={0.9 * T(lf, 4, 14)} />
      ))}
      <Glow x={lx + 50} y={ly - 24} r={760} op={0.8 * fl * T(lf, 6, 30)} />
      {lf > 4 ? <Lamp x={lx} y={ly} s={1.5} fl={fl} f={lf} at={4} px={4.6} /> : null}
      {/* the clerk behind the desk */}
      <Man id="s3m" x={560} y={1500} s={0.88} dir={1} f={lf} at={26} hat="tall" narrow={narrow} arm="rest" seed={391} px={5.2} wash="#5e4a3c" washOp={0.4} />
      <Par z={0.9} u={u} dx={-26}>
        <Desk lf={lf} at={30} y={DY} />
        {/* the ledger: two pages, one turning */}
        {I({ d: poly([[300, DY + 2], [536, DY - 18], [536, DY + 170], [268, DY + 196]], 400, 1.6, true), at: 40, dur: 26, w: 5, wash: PARCH_LT, washOp: 0.96, crisp: true })}
        {I({ d: poly([[544, DY - 18], [790, DY + 2], [822, DY + 196], [544, DY + 170]], 401, 1.6, true), at: 44, dur: 26, w: 5, wash: PARCH_LT, washOp: 0.96, crisp: true })}
        {I({ d: poly([[268, DY + 196], [270, DY + 214], [538, DY + 190], [544, DY + 170]], 402, 1.2, true), at: 52, dur: 14, w: 4, wash: SHADE, washOp: 0.7, crisp: true })}
        {I({ d: poly([[822, DY + 196], [820, DY + 214], [546, DY + 190], [544, DY + 170]], 403, 1.2, true), at: 52, dur: 14, w: 4, wash: SHADE, washOp: 0.7, crisp: true })}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `ll${i}`, d: wob([[318 + i * 2, DY + 24 + i * 22], [500, DY + 8 + i * 22]], 410 + i, 1.2), at: 70 + i * 4, dur: 14, w: 3, op: 0.55 }))}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `lr${i}`, d: wob([[576, DY + 8 + i * 22], [770 - i * 2, DY + 26 + i * 22]], 420 + i, 1.2), at: 74 + i * 4, dur: 14, w: 3, op: 0.55 }))}
        {lf > 60 ? (
          <g transform={`translate(540 0) scale(${r0(flip)} 1) translate(-540 0)`}>
            <path d={`M 544 ${DY - 18} L 790 ${DY + 2} L 822 ${DY + 196} L 544 ${DY + 170} Z`} fill={PARCH_LT} stroke={INK} strokeWidth={5} strokeLinejoin="round" opacity={0.97} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M 576 ${DY + 8 + i * 24} L ${770 - i * 2} ${DY + 26 + i * 24}`} stroke={INK} strokeWidth={3} opacity={0.5} />
            ))}
          </g>
        ) : null}
        {/* a pile of rolled scrolls and an unrolling scroll */}
        <Roll x0={910} x1={1130} y={DY + 24} r={22} f={lf} at={50} seed={430} />
        <Roll x0={930} x1={1120} y={DY - 18} r={20} f={lf} at={54} seed={440} />
        <Roll x0={950} x1={1100} y={DY - 56} r={18} f={lf} at={58} seed={450} />
        <Roll x0={-30} x1={170} y={DY + 30} r={21} f={lf} at={56} seed={460} />
        <path d={`M 90 ${DY + 56} L 250 ${DY + 56} L ${250 + 40 * unroll} ${DY + 56 + 90 * unroll} L ${90 - 10 * unroll} ${DY + 56 + 90 * unroll} Z`} fill={PARCH_LT} stroke={INK} strokeWidth={4} opacity={0.92 * T(lf, 60, 70)} />
        {/* an inkwell */}
        {I({ d: poly([[826, DY - 20], [880, DY - 20], [888, DY + 14], [818, DY + 14]], 470, 1.2, true), at: 62, dur: 14, w: 4, wash: INK, washOp: 0.8, crisp: true })}
      </Par>
      {/* the two officials in front, leaning in */}
      <Man id="s3a" x={150} y={1940} s={1.12} dir={1} f={lf} at={8} hat="tall" narrow={narrow} arm="out" bow={4} seed={392} px={5.4} wash="#5e4a3c" washOp={0.45} />
      <Man id="s3b" x={940} y={1940} s={1.12} dir={-1} f={lf} at={20} hat="tall" narrow={narrow} arm="point" bow={-3} seed={393} px={5.4} wash="#5e4a3c" washOp={0.45} />
      <Tone kind="Top" lf={lf} op={0.7} />
      <Tone kind="Bot" lf={lf} op={0.35} />
      <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.45} />
    </Cam>
  );
};


// A wall sconce: bracket, bowl and a flame with its glow.
const Sconce = ({ x, y, s = 1, lf, at = 0, fl }: { x: number; y: number; s?: number; lf: number; at?: number; fl: number }) => {
  const I = mk(lf);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Glow x={0} y={-40} r={420} op={0.85 * fl * T(lf, at, at + 20)} />
      {I({ d: poly([[-30, 0], [30, 0], [22, 46], [-22, 46]], 301, 1, true), at, dur: 16, w: 5 / s, wash: SHADE, washOp: 0.7, crisp: true })}
      {I({ d: wob([[0, 46], [0, 90], [-26, 120]], 302, 1), at: at + 6, dur: 12, w: 6 / s })}
      {I({ d: wob([[0, 90], [26, 120]], 303, 1), at: at + 8, dur: 10, w: 6 / s })}
      <path d={`M 0 0 Q ${14 + fl * 6} -34 0 -78 Q -16 -36 0 0 Z`} fill={AMBER} stroke={INK} strokeWidth={4 / s} opacity={T(lf, at + 8, at + 18)} />
    </g>
  );
};

// 4: two officials whisper, one hand cupped to a mouth. Huge profile heads, the ink closing in.
const Scene4 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const fl = flick(lf, 9);
  const arcs = [0, 1, 2].map((i) => wob([[588 - i * 40, 1232 + i * 12], [566 - i * 40, 1278 + i * 14], [590 - i * 40, 1326 + i * 12]], 440 + i, 1.5));
  return (
    <Cam fx={540} fy={1240} k={lerp(1.0, 1.14, u)} tx={lerp(0, -18, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.34} over={20} />
      <Par z={0.3} u={u} dx={-26}>
        <Brick x0={-80} y0={-80} x1={1160} y1={2000} rowH={140} colW={230} f={lf} at={2} dur={50} w={3.4} op={0.36} seed={17} wobble={5} />
        {I({ d: 'M 400 1500 L 400 760 Q 400 520 540 520 Q 680 520 680 760 L 680 1500', at: 8, dur: 50, w: 6, wash: INK, washOp: 0.5 })}
        <Sconce x={540} y={1000} s={1.2} lf={lf} at={14} fl={fl} />
      </Par>
      <Man id="s4a" x={190} y={3330} s={3.4} dir={1} f={lf} at={4} hat="tall" narrow={0.55} bow={5} seed={420} px={5.8} wash="#5e4a3c" washOp={0.45} arm="none" />
      <Man id="s4b" x={890} y={3330} s={3.4} dir={-1} f={lf} at={12} hat="cap" beard narrow={0.45} bow={-3} seed={430} px={5.8} wash="#5e4a3c" washOp={0.45} arm="none" />
      {/* the whisperer's hand, cupped to his mouth, and the sound crossing the gap */}
      <Hand x={745} y={1615} s={1.4} rot={-14} pose="cup" sleeve={250} f={lf} at={30} dur={22} px={7} seed={441} ring={3} sleeveCol="#5e4a3c" />
      {arcs.map((d, i) => I({ k: i, d, at: 60 + i * 12, dur: 14, w: 4, op: 0.75 }))}
      <Glow x={540} y={1180} r={520} op={0.42 * fl * T(lf, 10, 40)} />
      <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.3 + 0.6 * T(lf, 10, 150)} />
      {I({ d: wob([[-80, 1000], [140, 1100], [60, 1480], [-80, 1600]], 450, 4, true), at: 30, dur: 40, w: 2, wash: INK, washOp: 0.6 })}
      {I({ d: wob([[1160, 900], [940, 1040], [1020, 1500], [1160, 1580]], 451, 4, true), at: 44, dur: 40, w: 2, wash: INK, washOp: 0.6 })}
      <Tone kind="Top" lf={lf} op={0.5} />
      <Tone kind="Bot" lf={lf} op={0.4} />
    </Cam>
  );
};


// A tall candlestick with a flame, for the writing table.
const Candle = ({ x, y, h = 260, lf, at = 0, fl }: { x: number; y: number; h?: number; lf: number; at?: number; fl: number }) => {
  const I = mk(lf);
  return (
    <g>
      <Glow x={x} y={y - h - 20} r={460} op={0.8 * fl * T(lf, at, at + 20)} />
      {I({ d: poly([[x - 40, y], [x + 40, y], [x + 16, y - 36], [x - 16, y - 36]], 800, 1, true), at, dur: 16, w: 5, wash: SHADE, washOp: 0.7, crisp: true })}
      {I({ d: poly([[x - 12, y - 36], [x + 12, y - 36], [x + 10, y - h], [x - 10, y - h]], 801, 1, true), at: at + 6, dur: 14, w: 4.4, wash: PARCH_LT, washOp: 0.95, crisp: true })}
      {I({ d: poly([[x - 22, y - h], [x + 22, y - h], [x + 14, y - h + 14], [x - 14, y - h + 14]], 802, 0.8, true), at: at + 10, dur: 10, w: 4, wash: SHADE, washOp: 0.7, crisp: true })}
      <path d={`M ${x} ${y - h} Q ${x + 12 + fl * 6} ${y - h - 36} ${x} ${y - h - 70} Q ${x - 14} ${y - h - 34} ${x} ${y - h} Z`} fill={AMBER} stroke={INK} strokeWidth={3.4} opacity={T(lf, at + 10, at + 20)} />
    </g>
  );
};

// 5: the decree writes itself on a large scroll with rolled ends; the king's hand brings the signet down.
const Scene5 = ({ lf }: SA) => {
  const I = mk(lf);
  const fl = flick(lf, 5);
  const lines = wrapText(SCRIPTURE.s5, 28);
  const total = SCRIPTURE.s5.length;
  const topY = lf < 500 ? lerp(1700, 740, draw(T(lf, 0, 60))) : lerp(740, 1660, ease(T(lf, 500, 556)));
  const ty = -300 * ease(T(lf, 520, 580));
  const off = lf < 462 ? 1 - Math.pow(T(lf, 438, 462), 2.6) : ease(T(lf, 468, 500));
  const [jx, jy] = shake(lf, 462, 18);
  const L = 100;
  const R = 980;
  const SY = 1500;
  const FS = 62;
  let cum = 0;
  const reveal = lines.map((ln) => {
    const a = 110 + (cum / total) * 330;
    cum += ln.length + 1;
    return { ln, a, b: 110 + (cum / total) * 330 };
  });
  const head: { v: { x: number; y: number } | null } = { v: null };
  const sealBlob = wob(Array.from({ length: 11 }, (_, i): Pt => [540 + Math.cos((i / 11) * 6.283) * 112 * (0.9 + 0.2 * rng(60 + i)()), SY + Math.sin((i / 11) * 6.283) * 108 * (0.9 + 0.2 * rng(70 + i)())]), 61, 2.4, true);
  return (
    <Cam fx={540} fy={1240} k={lerp(1, 1.06, T(lf, 0, 587))} tx={jx} ty={jy + ty}>
      {/* the writing table: dark planks, a candle and a pile of rolls */}
      <Wash d="M -80 -80 H 1160 V 2100 H -80 Z" f={lf} at={0} fill={INDIGO} op={0.5} over={20} />
      <Wash d="M -80 -80 H 1160 V 2100 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={20} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => I({ k: `pl${i}`, d: wob([[-80, 40 + i * 270], [360, 56 + i * 270], [800, 30 + i * 270], [1160, 50 + i * 270]], 810 + i, 3), at: 2, dur: 40, w: 4, op: 0.4 }))}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `gn${i}`, d: wob([[80 + (i % 3) * 330, 200 + i * 240], [240 + (i % 3) * 330, 190 + i * 240], [400 + (i % 3) * 330, 210 + i * 240]], 830 + i, 2), at: 10, dur: 30, w: 2.4, op: 0.28 }))}
      <Candle x={70} y={900} h={300} lf={lf} at={6} fl={fl} />
      <Roll x0={820} x1={1100} y={1790} r={34} f={lf} at={20} seed={840} w={5} />
      <Roll x0={850} x1={1110} y={1728} r={30} f={lf} at={24} seed={850} w={5} />
      <Roll x0={-40} x1={200} y={1800} r={30} f={lf} at={22} seed={860} w={5} />
      {/* the scroll: paper, margins, fibres and stains */}
      <clipPath id="scrollClip">
        <rect x={L - 20} y={topY} width={R - L + 40} height={1760 - topY + 6} />
      </clipPath>
      <rect x={L + 20} y={topY} width={R - L - 40} height={1700 - topY} fill={PARCH_LT} opacity={0.98} />
      <g clipPath="url(#scrollClip)">
        <rect x={L + 20} y={topY} width={70} height={1700} fill={SHADE} opacity={0.22} filter="url(#inkSoft)" />
        <rect x={R - 90} y={topY} width={70} height={1700} fill={SHADE} opacity={0.26} filter="url(#inkSoft)" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => I({ k: `fb${i}`, d: wob([[L + 60 + i * 110, topY + 80], [L + 70 + i * 108, 1200], [L + 55 + i * 112, 1560]], 870 + i, 6), at: 12, dur: 40, w: 2, op: 0.12 }))}
        {[[200, 1180, 56], [840, 1020, 44], [760, 1420, 50]].map((q, i) => <ellipse key={i} cx={q[0]} cy={q[1]} rx={q[2]} ry={q[2] * 0.7} fill={SHADE} opacity={0.12} filter="url(#inkSoft)" />)}
        {[0, 1, 2, 3, 4].map((i) => I({ k: `o${i}`, d: poly([[500 + i * 22, 930], [520 + i * 22, 912], [540 + i * 22, 930], [520 + i * 22, 948]], 510 + i, 1, true), at: 70 + i * 6, dur: 12, w: 4, col: SHADE }))}
        {reveal.map((r, i) => {
          const y = 950 + i * 92;
          const w = 740 * T(lf, r.a, r.b);
          if (w > 0 && w < 736) head.v = { x: 190 + r.ln.length * 0.375 * FS * T(lf, r.a, r.b), y };
          return (
            <g key={i}>
              <clipPath id={`dl${i}`}>
                <rect x={180} y={y - 70} width={w} height={102} />
              </clipPath>
              <text x={190} y={y} clipPath={`url(#dl${i})`} fontFamily={garamondItalic.fontFamily} fontStyle="italic" fontSize={FS} fill={INK}>
                {r.ln}
              </text>
            </g>
          );
        })}
        {lf >= 462 ? (
          <g>
            <path d={sealBlob} fill={WAX} opacity={0.97} />
            {I({ d: sealBlob, at: 462, dur: 8, w: 5 })}
            {I({ d: wob([[470, SY - 70], [500, SY - 96], [550, SY - 100]], 521, 2), at: 464, dur: 10, w: 6, col: PARCH_LT, op: 0.32 })}
            <Emblem cx={540} cy={SY} r={74} f={lf} at={464} col={PARCH_LT} op={0.62} w={4.4} />
            <Splat x={540} y={SY} r={60} f={lf} at={462} seed={12} col={WAX} />
            <Splat x={540} y={SY} r={30} f={lf} at={462} seed={13} />
          </g>
        ) : null}
      </g>
      {/* the quill, writing */}
      {head.v && lf < 450 ? (
        <g>
          <path d={`M ${head.v.x} ${head.v.y - 6} L ${head.v.x + 80} ${head.v.y - 170}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${head.v.x + 80} ${head.v.y - 170} Q ${head.v.x + 190} ${head.v.y - 300} ${head.v.x + 170} ${head.v.y - 400} Q ${head.v.x + 90} ${head.v.y - 300} ${head.v.x + 80} ${head.v.y - 170} Z`} fill={PARCH_LT} stroke={INK} strokeWidth={4} opacity={0.96} />
          <path d={`M ${head.v.x + 90} ${head.v.y - 190} L ${head.v.x + 166} ${head.v.y - 380}`} stroke={INK} strokeWidth={2.6} opacity={0.6} />
        </g>
      ) : null}
      {/* the rolled ends, top and bottom, rolling as it unrolls */}
      <Roll x0={L - 10} x1={R + 10} y={topY} r={36} f={lf} at={0} seed={540} w={6} tie={false} />
      <Roll x0={L - 10} x1={R + 10} y={1700} r={36} f={lf} at={6} seed={560} w={6} tie={false} />
      {/* the king's hand brings the signet ring down */}
      {lf >= 430 && lf < 506 ? <Hand x={792 + off * 700} y={SY - 197 - off * 980} s={2.4} rot={225} pose="relax" ring={3} sleeve={340} f={lf} at={430} dur={10} px={7} seed={300} sleeveCol={SHADE} /> : null}
      {lf >= 556 ? (
        <g>
          {I({ d: wob([[470, SY - 30], [500, SY + 66], [540, SY + 90]], 550, 1.5), at: 556, dur: 12, w: 7, col: WAX })}
          {I({ d: wob([[610, SY - 30], [580, SY + 66], [540, SY + 90]], 551, 1.5), at: 560, dur: 12, w: 7, col: WAX })}
          {I({ d: wob([[540, SY + 90], [506, SY + 150], [476, SY + 130]], 552, 1.5), at: 566, dur: 10, w: 7, col: WAX })}
          {I({ d: wob([[540, SY + 90], [574, SY + 150], [604, SY + 130]], 553, 1.5), at: 568, dur: 10, w: 7, col: WAX })}
        </g>
      ) : null}
      <Tone kind="Top" lf={lf} op={0.4} />
      <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.4} />
    </Cam>
  );
};


const JER: Pt[] = [[480, 1345], [500, 1330], [520, 1332], [540, 1300], [548, 1300], [552, 1325], [580, 1318], [600, 1290], [612, 1262], [620, 1262], [628, 1290], [650, 1300], [665, 1255], [680, 1255], [686, 1300], [720, 1312], [760, 1325], [800, 1340]];

// Jerusalem far away: a skyline with a dome and towers, drawn on by p.
const Sky = ({ lf, p, op = 1, w = 3.4 }: { lf: number; p: number; op?: number; w?: number }) => {
  const I = mk(lf);
  if (p <= 0) return null;
  return (
    <g>
      {I({ d: poly([...JER, [800, 1380], [480, 1380]], 190, 1.2, true), at: 0, dur: 1, w, p, op: op * 0.85, wash: INK, washOp: 0.5 * op })}
      {I({ d: seg(540, 1300, 540, 1280, 191, 0.4), at: 0, dur: 1, w: w * 0.8, p, op })}
      {I({ d: ell(620, 1262, 22, 14, 192, 0.5), at: 0, dur: 1, w: w * 0.8, p, op, wash: AMBER, washOp: 0.5 })}
    </g>
  );
};

// A diamond lattice clipped to a shape: two sets of hatching crossing.
const Lattice = ({ id, clip, area, gap = 46, f, at = 0, w = 4, op = 0.7 }: { id: string; clip: string; area: readonly [number, number, number, number]; gap?: number; f: number; at?: number; w?: number; op?: number }) => (
  <g>
    <Hatch id={`${id}a`} clip={clip} area={area} gap={gap} ang={45} f={f} at={at} dur={20} w={w} op={op} seed={3} />
    <Hatch id={`${id}b`} clip={clip} area={area} gap={gap} ang={135} f={f} at={at + 2} dur={20} w={w} op={op} seed={4} />
  </g>
);

// The upper room: a lattice window with shutters, a lit niche, a rug, a stair on the left.
// shut closes the shutters (0 shut, 1 open), light floods in, jer draws Jerusalem in the arch.
const UpperRoom = ({ lf, shut, light, jer }: { lf: number; shut: number; light: number; jer: number }) => {
  const I = mk(lf);
  const fl = flick(lf, 6);
  const sOp = lerp(1, 0.16, ease(shut));
  const arch = 'M 470 1390 L 470 1090 Q 470 920 640 920 Q 810 920 810 1090 L 810 1390 Z';
  const leafL = 'M 470 1390 L 470 1090 Q 470 920 640 920 L 640 1390 Z';
  const leafR = 'M 810 1390 L 810 1090 Q 810 920 640 920 L 640 1390 Z';
  const pool = 'M 470 1500 L 810 1500 L 1020 1930 L 250 1930 Z';
  const stairPts: Pt[] = [[30, 1800]];
  for (let i = 0; i < 8; i++) {
    const [x, y] = stairPts[stairPts.length - 1];
    stairPts.push([x, y - 36], [x + 50, y - 36]);
  }
  const mass = poly([[-80, 1990], [-80, 1800], ...stairPts, [430, 1512], [460, 1990]], 171, 1.6, true);
  const rug = poly([[390, 1560], [910, 1560], [1090, 1890], [200, 1890]], 91, 2, true);
  const rugIn = poly([[440, 1584], [860, 1584], [1000, 1850], [286, 1850]], 92, 1.6, true);
  return (
    <g>
      {/* the far wall: plaster, brick, shadow */}
      <Wash d="M -80 340 H 1160 V 1510 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={20} />
      <Brick x0={-80} y0={340} x1={1160} y1={1510} rowH={92} colW={170} f={lf} at={2} dur={60} w={2.6} op={0.24} seed={41} wobble={3} />
      {/* the window: stone reveal, lattice shutters, light */}
      {I({ d: 'M 436 1400 L 436 1090 Q 436 886 640 886 Q 844 886 844 1090 L 844 1400', at: 6, dur: 40, w: 8, wash: SHADE, washOp: 0.32 })}
      <Wash d={arch} f={lf} at={20} fill={AMBER} op={0.6 * light} over={30} />
      <Glow x={640} y={1180} r={560} op={0.8 * light} />
      <Sky lf={lf} p={jer} op={0.8} />
      {I({ d: arch, at: 10, dur: 50, w: 7, wash: SHADE, washOp: 0.1 })}
      {I({ d: box(420, 1388, 440, 28, 171), at: 30, dur: 30, w: 5, wash: SHADE, washOp: 0.4 })}
      <g transform={`translate(470 0) scale(${r0(sOp)} 1) translate(-470 0)`}>
        <Wash d={leafL} f={lf} at={0} fill={SHADE} op={0.55} over={14} />
        <Lattice id="rmLl" clip={leafL} area={[470, 920, 170, 470]} f={lf} at={4} w={3.6} op={0.8} />
        {I({ d: leafL, at: 0, dur: 24, w: 6 })}
      </g>
      <g transform={`translate(810 0) scale(${r0(sOp)} 1) translate(-810 0)`}>
        <Wash d={leafR} f={lf} at={0} fill={SHADE} op={0.55} over={14} />
        <Lattice id="rmLr" clip={leafR} area={[640, 920, 170, 470]} f={lf} at={6} w={3.6} op={0.8} />
        {I({ d: leafR, at: 2, dur: 24, w: 6 })}
      </g>
      {/* the lit niche with a lamp */}
      {I({ d: 'M 180 1330 L 180 1130 Q 180 1040 255 1040 Q 330 1040 330 1130 L 330 1330 Z', at: 12, dur: 30, w: 6, wash: INK, washOp: 0.62 })}
      <Glow x={262} y={1250} r={320} op={0.7 * fl * T(lf, 14, 40)} />
      {I({ d: box(160, 1328, 190, 24, 172), at: 24, dur: 16, w: 5, wash: SHADE, washOp: 0.5 })}
      {lf > 18 ? <Lamp x={246} y={1326} s={0.62} fl={fl} f={lf} at={18} px={4} /> : null}
      {/* the floor: boards, a light pool with the lattice shadow, the rug */}
      <Wash d="M -80 1500 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={PARCH_LT} op={0.24} over={20} />
      {I({ d: seg(-80, 1500, 1160, 1500, 161, 2), at: 6, dur: 50, w: 6 })}
      {[460, 600, 740, 880, 1020, 1160, 320, 180].map((x, i) => I({ k: `fb${i}`, d: seg(x - (x - 640) * 0.02, 1500, x + (x - 640) * 0.9, 1960, 162 + i, 2), at: 14 + i * 3, dur: 30, w: 3, op: 0.42 }))}
      <Wash d={rug} f={lf} at={20} fill={WAX} op={0.4} over={20} />
      {I({ d: rug, at: 20, dur: 40, w: 6 })}
      <Wash d={rugIn} f={lf} at={26} fill={AMBER} op={0.22} over={20} />
      {I({ d: rugIn, at: 26, dur: 36, w: 4, op: 0.8 })}
      {[[1618, 30, 22], [1696, 46, 30], [1780, 64, 40]].map(([y, rx, ry], i) => I({ k: `rd${i}`, d: poly([[650, y - ry], [650 + rx, y], [650, y + ry], [650 - rx, y]], 95 + i, 1, true), at: 40 + i * 4, dur: 14, w: 3.6, wash: AMBER, washOp: 0.4, crisp: true }))}
      {Array.from({ length: 14 }, (_, i) => I({ k: `fr${i}`, d: seg(210 + i * 68, 1893, 206 + i * 68, 1918, 110 + i, 0.4), at: 50 + i, dur: 6, w: 3, op: 0.7 }))}
      <Wash d={pool} f={lf} at={0} fill={AMBER} op={0.4 * light} over={30} />
      <g opacity={light}>
        <Lattice id="rmP" clip={pool} area={[250, 1500, 770, 430]} gap={74} f={lf} at={0} w={6} op={0.4} />
      </g>
      {/* the stair, a mass of stone with a rail */}
      <Wash d={mass} f={lf} at={14} fill={SHADE} op={0.42} over={20} />
      <Hatch id="rmSt" clip={mass} area={[-80, 1500, 540, 490]} gap={15} ang={64} f={lf} at={20} dur={50} w={2.8} op={0.6} seed={9} />
      {I({ d: poly(stairPts, 172, 1.4), at: 20, dur: 70, w: 6 })}
      {I({ d: seg(40, 1640, 436, 1370, 173), at: 50, dur: 40, w: 6 })}
      {[100, 190, 280, 370].map((x, i) => I({ k: `p${i}`, d: seg(x, 1640 - (x - 40) * 0.68, x, 1730 - (x - 40) * 0.68, 175 + i, 1), at: 60 + i * 6, dur: 12, w: 5 }))}
    </g>
  );
};

// The close-up of two hands pushing the lattice shutters open, seen from inside the room.
const WindowClose = ({ lf, open }: { lf: number; open: number }) => {
  const I = mk(lf);
  const a = open - 26;
  const sh = ease(T(lf, open - 4, open + 36));
  const sOp = lerp(1, 0.16, sh);
  const leafL = 'M -30 1620 L -30 820 Q -30 380 530 380 L 530 1620 Z';
  const leafR = 'M 1110 1620 L 1110 820 Q 1110 380 550 380 L 550 1620 Z';
  const innerL = -30 + 560 * sOp;
  const innerR = 1110 - 560 * sOp;
  const fade = T(lf, a, a + 6) * (1 - T(lf, open + 38, open + 48));
  if (fade <= 0) return null;
  const fl = flick(lf, 12);
  return (
    <g opacity={fade}>
      <Cam fx={540} fy={1100} k={lerp(1, 1.1, T(lf, a, open + 48))}>
        <rect x={-120} y={-120} width={1320} height={2160} fill={INK} />
        {/* the sky and the city behind the shutters */}
        <rect x={-30} y={380} width={1140} height={1260} fill={AMBER} opacity={0.5 * sh} />
        <Glow x={540} y={1050} r={820} op={0.95 * sh * fl} />
        <g transform="translate(-1828 -3340) scale(3.7)" opacity={sh}>
          <Sky lf={lf} p={1} op={0.9} w={1.6} />
        </g>
        {/* the stone reveal around the window */}
        <Wash d="M -120 300 H 1200 V 1700 H -120 Z M 1110 1620 L 1110 820 Q 1110 380 540 380 Q -30 380 -30 820 L -30 1620 Z" f={lf} at={a} fill={SHADE} op={0.5} over={4} />
        {I({ d: 'M -30 1620 L -30 820 Q -30 380 540 380 Q 1110 380 1110 820 L 1110 1620', at: a, dur: 10, w: 12 })}
        {/* the leaves, hinged at the sides */}
        <g transform={`translate(-30 0) scale(${r0(sOp)} 1) translate(30 0)`}>
          <Wash d={leafL} f={lf} at={a} fill={SHADE} op={0.62} over={4} />
          <Lattice id="wcL" clip={leafL} area={[-30, 380, 560, 1240]} gap={110} f={lf} at={a} w={7} op={0.8} />
          {I({ d: leafL, at: a, dur: 10, w: 11 })}
          {I({ d: seg(500, 420, 500, 1600, 301, 1), at: a, dur: 10, w: 12, col: SHADE })}
        </g>
        <g transform={`translate(1110 0) scale(${r0(sOp)} 1) translate(-1110 0)`}>
          <Wash d={leafR} f={lf} at={a} fill={SHADE} op={0.62} over={4} />
          <Lattice id="wcR" clip={leafR} area={[550, 380, 560, 1240]} gap={110} f={lf} at={a} w={7} op={0.8} />
          {I({ d: leafR, at: a, dur: 10, w: 11 })}
          {I({ d: seg(580, 420, 580, 1600, 302, 1), at: a, dur: 10, w: 12, col: SHADE })}
        </g>
        {/* the hands, backs toward us, pressing the leaves open */}
        <Hand x={Math.max(130, innerL - 150)} y={1790} s={2.3} rot={10} mirror pose="open" spread={0.9} sleeve={420} f={lf} at={a + 2} dur={12} px={8} seed={310} sleeveCol="#5e4a3c" />
        <Hand x={Math.min(950, innerR + 150)} y={1790} s={2.3} rot={-10} pose="open" spread={0.9} sleeve={420} f={lf} at={a + 4} dur={12} px={8} seed={320} sleeveCol="#5e4a3c" ring={3} />
        <Tone kind="Top" lf={lf} op={0.5} a={a} b={a + 8} />
        <rect x={-120} y={-120} width={1320} height={2160} fill="url(#closeVig)" opacity={0.55} />
      </Cam>
    </g>
  );
};

// 6: Daniel climbs, opens the window, light pours in, he kneels toward Jerusalem.
const Scene6 = ({ lf, dur }: SA) => {
  const t0 = wordF(6, 9) - S[6];
  const t1 = wordF(6, 12, 'e') - S[6];
  const open = wordF(6, 15) - S[6];
  const climb = ease(T(lf, t0, t1));
  const steps = Math.floor(climb * 8) / 8;
  const cx = climb > 0 && climb < 1 ? lerp(110, 430, steps) : 110;
  const cy = lerp(1800, 1512, steps);
  const walkT = ease(T(lf, t1, open - 14));
  const walkX = lerp(430, 640, walkT);
  const walkY = lerp(1512, 1612, walkT);
  const ws = lerp(0.62, 0.86, walkT);
  const kneel = lf >= open + 40;
  const zoom = ease(T(lf, open + 40, dur));
  const moving = lf >= t0 && (lf < t1 || walkT < 0.98);
  return (
    <g>
      <Cam fx={640} fy={1400} k={lerp(1, 1.1, T(lf, 0, open + 40)) + 0.28 * zoom} tx={lerp(0, -22, T(lf, 0, dur))}>
        <UpperRoom lf={lf} shut={T(lf, open, open + 34)} light={T(lf, open + 6, open + 70)} jer={T(lf, open + 50, open + 140)} />
        <Motes f={lf} x0={420} x1={900} y0={1000} y1={1840} n={22} seed={21} op={0.85 * T(lf, open + 30, open + 80)} />
        {lf >= 14 && lf < t0 ? <Back id="s6a" x={110} y={1800} s={0.62} f={lf} at={14} staff lean={4} seed={600} wash="#5e4a3c" washOp={0.4} /> : null}
        {lf >= t0 && !kneel ? <Back id="s6b" x={lf < t1 ? cx : walkX} y={lf < t1 ? cy : walkY} s={lf < t1 ? 0.62 : ws} f={lf} at={14} staff walk={moving ? lf : undefined} lean={lf < t1 ? 6 : 2} seed={600} wash="#5e4a3c" washOp={0.4} /> : null}
        {kneel ? <Back id="s6k" x={640} y={1620} s={0.88} f={lf} at={open + 40} pose="kneel" arms seed={610} px={5} wash="#4a3a30" washOp={0.55} /> : null}
        <Tone kind="Top" lf={lf} op={0.55} />
        <Tone kind="Bot" lf={lf} op={0.25} />
      </Cam>
      <WindowClose lf={lf} open={open} />
    </g>
  );
};


// 7: dusk. The window glows over the watching silhouettes; then his raised hands, close.
const Scene7 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const cut = T(lf, 314, 328);
  const fl = flick(lf, 3);
  const handsAt = 300;
  const win = 'M 400 1140 L 400 900 Q 400 750 540 750 Q 680 750 680 900 L 680 1140 Z';
  const wallL = poly([[-80, 280], [170, 420], [170, 1760], [-80, 2000]], 701, 3, true);
  const wallR = poly([[1160, 280], [910, 420], [910, 1760], [1160, 2000]], 702, 3, true);
  const stars = Array.from({ length: 14 }, (_, i) => [90 + rng(710 + i)() * 900, 60 + rng(730 + i)() * 380, 3 + rng(750 + i)() * 4]);
  return (
    <g>
      {cut < 1 ? (
        <g opacity={1 - cut}>
          <Cam fx={540} fy={1250} k={lerp(1, 1.12, u)} tx={lerp(8, -14, u)}>
            <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={20} />
            <Veil fill={INDIGO} op={0.58} lf={lf} a={0} b={24} />
            {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={PARCH_LT} opacity={(0.5 + 0.4 * Math.sin(lf / 9 + i)) * T(lf, 10 + i * 3, 40 + i * 3)} />)}
            {/* far rooftops */}
            <Par z={0.25} u={u} dx={-30}>
              {I({ d: poly([[-80, 700], [100, 700], [100, 640], [260, 640], [260, 700], [420, 700], [420, 610], [560, 610], [560, 700], [760, 700], [760, 650], [900, 650], [900, 700], [1160, 700]], 703, 2), at: 4, dur: 50, w: 5, wash: INDIGO, washOp: 0.5 })}
            </Par>
            {/* the house: plaster wall, parapet, door, the glowing window */}
            <Par z={0.6} u={u} dx={-26}>
              <Wash d="M 60 520 H 1020 V 1620 H 60 Z" f={lf} at={4} fill={SHADE} op={0.46} over={20} />
              <Brick x0={60} y0={560} x1={1020} y1={1620} rowH={96} colW={176} f={lf} at={8} dur={60} w={2.8} op={0.34} seed={43} wobble={3} />
              {I({ d: poly([[40, 560], [1040, 560], [1040, 520], [980, 520], [980, 490], [900, 490], [900, 520], [700, 520], [700, 490], [620, 490], [620, 520], [460, 520], [460, 490], [380, 490], [380, 520], [180, 520], [180, 490], [100, 490], [100, 520], [40, 520]], 704, 1.8, true), at: 6, dur: 50, w: 6, wash: SHADE, washOp: 0.4 })}
              {I({ d: poly([[420, 1620], [420, 1370], [440, 1300], [540, 1270], [640, 1300], [660, 1370], [660, 1620]], 705, 1.6), at: 40, dur: 30, w: 6, wash: INK, washOp: 0.62 })}
              {[470, 520, 570, 620].map((x, i) => I({ k: `dp${i}`, d: seg(x, 1290 + (i % 2) * 6, x, 1620, 706 + i, 1), at: 54 + i * 3, dur: 14, w: 3, op: 0.5 }))}
              <Wash d="M 410 1140 L 670 1140 L 940 1860 L 140 1860 Z" f={lf} at={60} fill={AMBER} op={0.34} over={40} />
              <Glow x={540} y={1000} r={640} op={0.95 * T(lf, 50, 100) * fl} />
              <Wash d={win} f={lf} at={50} fill={AMBER} op={0.9} over={40} />
              {I({ d: win, at: 40, dur: 40, w: 8 })}
              {I({ d: 'M 380 1160 L 380 890 Q 380 730 540 730 Q 700 730 700 890 L 700 1160', at: 36, dur: 40, w: 6, op: 0.7 })}
              {I({ d: box(372, 1138, 336, 26, 707), at: 44, dur: 24, w: 6, wash: SHADE, washOp: 0.55 })}
              {/* the open shutters hang on the outer wall */}
              {I({ d: poly([[400, 900], [362, 880], [362, 1130], [400, 1140]], 708, 1.2, true), at: 56, dur: 16, w: 5, wash: INK, washOp: 0.8, crisp: true })}
              {I({ d: poly([[680, 900], [718, 880], [718, 1130], [680, 1140]], 709, 1.2, true), at: 58, dur: 16, w: 5, wash: INK, washOp: 0.8, crisp: true })}
              {lf >= 90 ? <Back id="s7k" x={540} y={1136} s={0.4} f={lf} at={90} pose="kneel" sil seed={650} px={4.4} /> : null}
            </Par>
            {/* the street, the alley walls */}
            <Ground id="s7g" y={1620} lf={lf} at={10} h={420} seed={15} gap={18} op={0.4} />
            <Wash d="M 140 1620 L 940 1620 L 1080 2000 L 0 2000 Z" f={lf} at={60} fill={AMBER} op={0.2} over={40} />
            <Wash d={wallL} f={lf} at={0} fill={INK} op={0.5} over={14} />
            <Wash d={wallR} f={lf} at={0} fill={INK} op={0.5} over={14} />
            <Hatch id="s7wl" clip={wallL} area={[-80, 280, 250, 1720]} gap={16} ang={64} f={lf} at={6} dur={60} w={2.8} op={0.6} seed={5} />
            <Hatch id="s7wr" clip={wallR} area={[910, 280, 250, 1720]} gap={16} ang={116} f={lf} at={10} dur={60} w={2.8} op={0.6} seed={6} />
            {I({ d: wallL, at: 2, dur: 50, w: 7 })}
            {I({ d: wallR, at: 6, dur: 50, w: 7 })}
            {/* the watchers: silhouettes in the street */}
            {[
              [120, 1, 'tall', 90, 'point'],
              [320, 1, 'cap', 110, 'raise'],
              [780, -1, 'tall', 124, 'raise'],
              [960, -1, 'cap', 138, 'point'],
            ].map(([x, dir, hat, at, arm], i) => (
              <Man key={i} id={`s7w${i}`} x={x as number} y={1990} s={1.0} dir={dir as 1 | -1} f={lf} at={at as number} hat={hat as HatKind} sil arm={arm as 'raise' | 'point'} bow={-4 + Math.sin(stepF(lf) / 14 + i) * 2} seed={660 + i * 5} px={5} />
            ))}
            <Tone kind="Top" lf={lf} op={0.45} />
            <Tone kind="Bot" lf={lf} op={0.4} />
          </Cam>
        </g>
      ) : null}
      {cut > 0 ? (
        <g opacity={cut}>
          <Cam fx={540} fy={1200} k={lerp(1, 1.08, T(lf, 314, dur))}>
            <rect x={-120} y={-120} width={1320} height={2160} fill={INK} />
            <rect x={-120} y={-120} width={1320} height={2160} fill={INDIGO} opacity={0.5} />
            <Glow x={540} y={860} r={900} op={0.95 * fl} />
            {/* the window behind, a bright arch with a lattice */}
            <g transform="translate(540 700) scale(1.5) translate(-540 -930)">
              <Wash d={win} f={lf} at={316} fill={AMBER} op={0.95} over={10} />
              <Lattice id="s7wl2" clip={win} area={[400, 750, 280, 390]} gap={52} f={lf} at={318} w={5} op={0.55} />
              {I({ d: win, at: 316, dur: 18, w: 7 })}
            </g>
            {/* the two hands, raised */}
            <Hand x={330} y={1760} s={2.7} rot={-8} mirror pose="open" spread={1.15} sleeve={480} f={lf} at={handsAt} dur={26} px={8} seed={710} sleeveCol="#5e4a3c" />
            <Hand x={750} y={1760} s={2.7} rot={8} pose="open" spread={1.15} sleeve={480} f={lf} at={handsAt + 4} dur={26} px={8} seed={720} sleeveCol="#5e4a3c" ring={3} />
            <rect x={-120} y={-120} width={1320} height={2160} fill="url(#closeVig)" opacity={0.6} />
          </Cam>
        </g>
      ) : null}
    </g>
  );
};


// 8: the king with his head in his hands; the sun crosses the colonnade and sets.
const Scene8 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 20, 330);
  const gu = T(lf, 0, dur);
  const sunX = lerp(60, 1020, u);
  const sunY = 1300 - 360 * Math.sin(u * Math.PI);
  const dusk = T(lf, 230, 330);
  const cols = [100, 360, 620, 880];
  const FY = 1500;
  const hills = poly([[-80, 1360], [160, 1310], [420, 1350], [700, 1290], [940, 1340], [1160, 1300], [1160, 1520], [-80, 1520]], 705, 3, true);
  return (
    <Cam fx={600} fy={1400} k={lerp(1, 1.1, gu)} tx={lerp(10, -16, gu)}>
      {/* the sky seen between the columns, the sun and the hills */}
      <Par z={0.25} u={gu} dx={-24}>
        <Wash d="M -80 700 H 1160 V 1500 H -80 Z" f={lf} at={0} fill={AMBER} op={0.22 * (1 - dusk)} over={30} />
        <Wash d="M -80 700 H 1160 V 1500 H -80 Z" f={lf} at={0} fill={INDIGO} op={0.5 * dusk} over={30} />
        <g transform={`translate(${r0(sunX)} ${r0(sunY)})`}>
          <Glow x={0} y={0} r={420} op={0.95 * (1 - 0.55 * dusk)} />
          {I({ d: ell(0, 0, 84, 84, 701), at: 20, dur: 14, w: 7, wash: AMBER, washOp: 0.92 })}
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2 + lf / 170;
            const l0 = 108;
            const l1 = i % 2 ? 140 : 164;
            return <path key={i} d={`M ${r0(Math.cos(a) * l0)} ${r0(Math.sin(a) * l0)} L ${r0(Math.cos(a) * l1)} ${r0(Math.sin(a) * l1)}`} stroke={INK} strokeWidth={6} strokeLinecap="round" opacity={0.7} />;
          })}
        </g>
        <path d={hills} fill={SHADE} opacity={0.88} />
        {I({ d: hills, at: 6, dur: 50, w: 6, wash: INK, washOp: 0.4 })}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `hh${i}`, d: wob([[40 + i * 160, 1360 + (i % 3) * 22], [90 + i * 160, 1400 + (i % 2) * 20], [140 + i * 160, 1380]], 710 + i, 3), at: 20 + i * 3, dur: 14, w: 3, op: 0.5 }))}
        {/* the architrave and the far wall of the colonnade */}
        {I({ d: box(-80, 600, 1240, 110, 721, 2), at: 4, dur: 40, w: 6, wash: SHADE, washOp: 0.45 })}
        <Brick x0={-80} y0={608} x1={1160} y1={702} rowH={47} colW={110} f={lf} at={10} dur={40} w={2.4} op={0.3} seed={51} wobble={2} />
        {I({ d: seg(-80, 714, 1160, 714, 722, 2), at: 10, dur: 40, w: 8 })}
      </Par>
      {/* the columns and their swept shadows */}
      <Par z={0.7} u={gu} dx={-40}>
        {cols.map((x, i) => (
          <g key={x}>
            <path d={`M ${x - 44} ${FY + 4} L ${x + 44} ${FY + 4} L ${r0(x + 44 + (sunX - x) * -0.9 + 90)} 1940 L ${r0(x - 44 + (sunX - x) * -0.9 - 90)} 1940 Z`} fill={INK} opacity={0.22 * T(lf, 30, 60)} />
            <Column id={`s8c${i}`} x={x} top={730} bot={FY} hw={44} f={lf} at={4 + i * 8} seed={720 + i} px={5.4} />
          </g>
        ))}
      </Par>
      {/* the floor: tiles in perspective, the sun's light moving across it */}
      <Wash d={`M -80 ${FY} H 1160 V 2000 H -80 Z`} f={lf} at={0} fill={PARCH_LT} op={0.26} over={20} />
      {I({ d: seg(-80, FY, 1160, FY, 730, 2), at: 10, dur: 50, w: 6 })}
      {[-300, -60, 180, 420, 660, 900, 1140, 1380].map((x, i) => I({ k: `fl${i}`, d: seg(540 + (x - 540) * 0.25, FY, x, 1960, 740 + i, 2), at: 14 + i * 3, dur: 36, w: 3, op: 0.4 }))}
      {[1560, 1640, 1740, 1860].map((y, i) => I({ k: `fh${i}`, d: seg(-80, y, 1160, y, 750 + i, 2), at: 20 + i * 4, dur: 36, w: 3, op: 0.4 }))}
      <Wash d={`M ${r0(sunX - 250)} ${FY} L ${r0(sunX - 110)} ${FY} L ${r0(sunX - 330)} 1960 L ${r0(sunX - 640)} 1960 Z`} f={lf} at={20} fill={AMBER} op={0.34 * (1 - dusk)} over={30} />
      {/* the dais and the king, head in his hands */}
      <Par z={1} u={gu} dx={-56}>
        {I({ d: poly([[470, 1700], [1160, 1700], [1160, 1790], [440, 1790]], 731, 2, true), at: 40, dur: 30, w: 6, wash: SHADE, washOp: 0.46 })}
        {I({ d: poly([[520, 1700], [520, 1450], [660, 1420], [1160, 1420], [1160, 1700]], 732, 2, true), at: 46, dur: 36, w: 7, wash: SHADE, washOp: 0.4 })}
        <Man id="s8k" x={850} y={1700} s={1.5} dir={-1} f={lf} at={60} hat="crown" beard seated bow={14} arm="none" seed={740} px={5.6} wash="#6e5440" washOp={0.4} />
        <Hand x={716} y={1262} s={1.5} rot={-30} pose="cup" sleeve={230} f={lf} at={100} dur={22} px={7} seed={742} ring={3} sleeveCol="#6e5440" />
        <Hand x={790} y={1300} s={1.5} rot={-22} mirror pose="relax" sleeve={230} f={lf} at={108} dur={22} px={7} seed={744} sleeveCol="#6e5440" />
      </Par>
      {/* the law books heaped in the foreground */}
      <Par z={1.5} u={gu} dx={-70}>
        {[0, 1, 2, 3].map((i) => <Roll key={`r${i}`} x0={-120 + (i % 2) * 40} x1={300 + (i % 2) * 60 - i * 12} y={1884 - i * 66} r={32} f={lf} at={40 + i * 6} seed={760 + i * 7} w={5.4} />)}
        <Roll x0={-20} x1={430} y={1952} r={32} f={lf} at={36} seed={790} w={5.4} />
        <Roll x0={310} x1={560} y={1930} r={28} f={lf} at={44} seed={791} w={5.4} />
      </Par>
      <Veil fill={INDIGO} op={0.5} lf={lf} a={230} b={334} />
      <Tone kind="Top" lf={lf} op={0.4} />
      <Tone kind="Bot" lf={lf} op={0.3} />
    </Cam>
  );
};


// A pair of lion eyes in the dark: two amber lamps with slit pupils.
const Eyes = ({ x, y, f, at, r = 1 }: { x: number; y: number; f: number; at: number; r?: number }) => {
  if (f < at) return null;
  const k = draw((f - at) / 12) * (0.75 + 0.25 * flick(f, Math.round(x)));
  return (
    <g opacity={k}>
      <Glow x={x} y={y} r={74 * r} op={0.5} />
      {[-1, 1].map((m) => (
        <g key={m}>
          <ellipse cx={x + m * 20 * r} cy={y} rx={12 * r} ry={7.5 * r} fill={AMBER} stroke={INK} strokeWidth={3} />
          <ellipse cx={x + m * 20 * r} cy={y} rx={2.6 * r} ry={6.4 * r} fill={INK} />
        </g>
      ))}
    </g>
  );
};

// 9: Daniel is lowered into the den; lions come out of the dark; then the stone and two seals.
const Scene9 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const gu = T(lf, 0, dur);
  const fl = flick(lf, 7);
  const down = ease(T(lf, 24, 210));
  const dy = lerp(1010, 1640, down);
  const mouth = T(lf, 240, 252);
  const dark = T(lf, 10, 90);
  const LM = poly([[-80, 1000], [300, 1000], [282, 1120], [310, 1320], [276, 1520], [300, 1760], [270, 1960], [-80, 1960]], 71, 3, true);
  const RM = poly([[1160, 1000], [780, 1000], [798, 1120], [770, 1320], [804, 1520], [780, 1760], [810, 1960], [1160, 1960]], 72, 3, true);
  const [jx, jy] = shake(lf, 290, 14);
  const [jx2, jy2] = shake(lf, 316, 16);
  const stoneX = lerp(1700, 540, Math.pow(T(lf, 252, 290), 1.8));
  const spin = -((1700 - stoneX) / 420) * 57.3;
  const press = (at: number) => 1 - Math.pow(T(lf, at - 24, at), 2.2);
  const lift = (at: number) => ease(T(lf, at + 8, at + 44));
  return (
    <g>
      {mouth < 1 ? (
        <g opacity={1 - mouth}>
          <Cam fx={540} fy={1300} k={lerp(1, 1.1, T(lf, 0, 252))}>
            <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.3} over={20} />
            <Veil fill={INDIGO} op={0.5} lf={lf} a={0} b={30} />
            <defs>
              <linearGradient id="den9" x1={0} y1={0} x2={0} y2={1}>
                <stop offset={0} stopColor={INK} stopOpacity={0} />
                <stop offset={1} stopColor={INK} stopOpacity={0.9} />
              </linearGradient>
            </defs>
            {/* the pit: the dark, the far wall, the floor of straw */}
            <rect x={270} y={1000} width={540} height={980} fill={INK} opacity={0.72} />
            <Par z={0.25} u={gu} dx={-20}>
              {I({ d: wob([[280, 1100], [540, 1070], [800, 1110]], 73, 6), at: 8, dur: 40, w: 4, op: 0.3 })}
              {I({ d: wob([[290, 1400], [540, 1380], [790, 1410]], 74, 6), at: 12, dur: 40, w: 4, op: 0.3 })}
            </Par>
            {I({ d: LM, at: 0, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
            {I({ d: RM, at: 6, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
            <Hatch id="s9hl" clip={LM} area={[-80, 1000, 380, 960]} gap={15} ang={58} f={lf} at={4} dur={70} w={3} op={0.7} seed={3} />
            <Hatch id="s9hr" clip={RM} area={[780, 1000, 380, 960]} gap={15} ang={122} f={lf} at={10} dur={70} w={3} op={0.7} seed={4} />
            {[[120, 1150, 90, 60], [150, 1500, 100, 70], [980, 1220, 90, 66], [940, 1640, 110, 72]].map((q, i) => I({ k: `bd${i}`, d: ell(q[0], q[1], q[2], q[3], 80 + i, 4), at: 14 + i * 4, dur: 26, w: 4, wash: INK, washOp: 0.35 }))}
            {/* the opening above: ground, hoist, torch, the king and a guard */}
            <Wash d="M -80 900 H 1160 V 1000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.34} over={20} />
            {I({ d: seg(-80, 1000, 280, 1000, 75, 2), at: 10, dur: 40, w: 8 })}
            {I({ d: seg(800, 1000, 1160, 1000, 76, 2), at: 10, dur: 40, w: 8 })}
            {I({ d: seg(380, 1000, 540, 730, 800), at: 10, dur: 22, w: 14 })}
            {I({ d: seg(700, 1000, 540, 730, 801), at: 14, dur: 22, w: 14 })}
            {I({ d: seg(430, 900, 650, 900, 802), at: 22, dur: 16, w: 10 })}
            {I({ d: ell(540, 730, 26, 26, 803), at: 28, dur: 10, w: 7, wash: SHADE, washOp: 0.7 })}
            {I({ d: wob([[540, 704], [880, 780], [950, 930]], 804, 2), at: 34, dur: 22, w: 8, op: 0.9 })}
            {I({ d: seg(1040, 1000, 1040, 640, 805), at: 6, dur: 26, w: 12 })}
            <Glow x={1040} y={620} r={520} op={0.85 * fl * T(lf, 16, 40)} />
            <path d={`M 1040 640 Q ${1058 + fl * 8} 590 1040 540 Q 1018 592 1040 640 Z`} fill={AMBER} stroke={INK} strokeWidth={4} opacity={T(lf, 20, 34)} />
            <Wash d="M 400 1000 L 680 1000 L 800 1960 L 270 1960 Z" f={lf} at={30} fill={AMBER} op={0.18} over={40} />
            {/* the lowered man on the rope */}
            {I({ d: seg(540, 740, 540, dy - 346, 806, 1), at: 24, dur: 16, w: 8, col: INK, op: 0.95 })}
            <Back id="s9d" x={540} y={dy} s={0.56} f={lf} at={18} lean={Math.sin(lf / 17) * 2} seed={830} px={5} wash="#6e5440" washOp={0.36} />
            <Man id="s9g" x={940} y={1000} s={0.9} dir={-1} f={lf} at={20} hat="cap" bow={-10} arm="rest" seed={810} px={5.2} wash="#5e4a3c" washOp={0.42} />
            <Man id="s9k" x={130} y={1000} s={1.0} dir={1} f={lf} at={34} hat="crown" beard bow={22} arm="out" seed={820} px={5.2} wash="#5e4a3c" washOp={0.42} />
            {/* eyes in the far dark, then the two lions rising out of it */}
            {[[380, 1070, 70, 0.5], [700, 1090, 84, 0.55]].map(([x, y, at, r], i) => <Eyes key={i} x={x} y={y} f={lf} at={at} r={r} />)}
            <Lion id="s9l1" x={50} y={1990} s={1.25} dir={1} pose="sphinx" f={lf} at={84} seed={1010} glow px={5} />
            <Lion id="s9l2" x={1030} y={2000} s={1.25} dir={-1} pose="sphinx" f={lf} at={104} seed={1020} glow px={5} />
            <rect x={-80} y={1640} width={1240} height={380} fill="url(#den9)" opacity={0.88 * dark} />
            <Tone kind="Top" lf={lf} op={0.4} />
            <rect x={-80} y={-80} width={1240} height={2080} fill="url(#closeVig)" opacity={0.4} />
          </Cam>
        </g>
      ) : null}
      {mouth > 0 ? (
        <g opacity={mouth}>
          <Cam fx={540} fy={1100} k={lerp(1.0, 1.08, T(lf, 244, dur))} tx={jx + jx2} ty={jy + jy2}>
            <rect x={-120} y={-120} width={1320} height={2160} fill={INDIGO} opacity={0.4} />
            <Wash d="M -120 -120 H 1200 V 2100 H -120 Z" f={lf} at={0} fill={SHADE} op={0.4} over={4} />
            {/* the hillside, the dark mouth of the den and its rim of stones */}
            <Wash d="M -120 700 H 1200 V 2100 H -120 Z" f={lf} at={0} fill={SHADE} op={0.3} over={4} />
            <Hatch id="s9hill" clip="M -120 560 L 1200 560 L 1200 2100 L -120 2100 Z" area={[-120, 560, 1320, 1540]} gap={22} ang={8} f={lf} at={240} dur={30} w={2.6} op={0.35} seed={11} />
            <path d={ell(540, 1130, 430, 250, 901, 3)} fill={INK} opacity={0.97} />
            <Glow x={540} y={1130} r={520} op={0.3 * (1 - T(lf, 276, 292))} />
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const k = 1.1 + 0.08 * rng(910 + i)();
              const cx = 540 + Math.cos(a) * 436 * k;
              const cy = 1130 + Math.sin(a) * 256 * k;
              return (
                <g key={`rim${i}`}>
                  {I({ k: 'a', d: wob(Array.from({ length: 8 }, (_, j): Pt => [cx + Math.cos((j / 8) * 6.283) * (50 + 12 * rng(930 + i * 9 + j)()), cy + Math.sin((j / 8) * 6.283) * (34 + 8 * rng(960 + i * 9 + j)())]), 920 + i, 2, true), at: 242 + i, dur: 14, w: 5, wash: '#a98a5e', washOp: 0.9, crisp: true })}
                  {I({ k: 'b', d: seg(cx - 20, cy + 6, cx + 24, cy - 10, 950 + i, 1), at: 252 + i, dur: 8, w: 3, op: 0.5 })}
                  {I({ k: 'c', d: seg(cx - 6, cy + 18, cx + 30, cy + 8, 970 + i, 1), at: 254 + i, dur: 8, w: 3, op: 0.5 })}
                </g>
              );
            })}
            {I({ d: ell(540, 1130, 430, 250, 901, 3), at: 240, dur: 16, w: 10 })}
            {/* the slab rolls over the mouth */}
            <ellipse cx={stoneX + 60} cy={1380} rx={450} ry={60} fill={INK} opacity={0.4} filter="url(#inkSoft)" />
            {lf >= 252 ? <Slab id="s9s" cx={stoneX} cy={1090} rx={450} ry={270} th={86} f={lf} at={-100} spin={spin} seed={7} shadow={false} /> : null}
            {lf >= 290 ? (
              <g>
                <Rope pts={[[120, 1010], [330, 1090], [540, 1130], [750, 1090], [960, 1010]]} w={20} />
                <Rope pts={[[330, 1090], [250, 1230], [120, 1300]]} w={14} />
                <Rope pts={[[750, 1090], [830, 1230], [960, 1300]]} w={14} />
              </g>
            ) : null}
            {lf >= 292 ? (
              <g>
                <ellipse cx={330} cy={1094} rx={92} ry={64} fill={WAX} stroke={INK} strokeWidth={6} />
                <Emblem cx={330} cy={1094} r={50} f={lf} at={294} col={PARCH_LT} op={0.62} w={4} />
                <Splat x={330} y={1094} r={44} f={lf} at={292} seed={21} col={WAX} />
              </g>
            ) : null}
            {lf >= 316 ? (
              <g>
                <ellipse cx={750} cy={1094} rx={92} ry={64} fill={WAX} stroke={INK} strokeWidth={6} />
                <Emblem cx={750} cy={1094} r={50} f={lf} at={318} col={PARCH_LT} op={0.62} w={4} />
                <Splat x={750} y={1094} r={44} f={lf} at={316} seed={22} col={WAX} />
              </g>
            ) : null}
            {/* hands with signet rings come down on the wax */}
            {lf >= 268 && lf < 340 ? (
              <Hand x={330 + 190 + press(292) * 420 + lift(292) * 420} y={1094 - 130 - press(292) * 620 - lift(292) * 620} s={1.5} rot={225} pose="relax" ring={3} sleeve={300} f={lf} at={268} dur={10} px={6.5} seed={300} sleeveCol="#5e4a3c" />
            ) : null}
            {lf >= 292 && lf < 366 ? (
              <Hand x={750 - 190 - press(316) * 420 - lift(316) * 420} y={1094 - 130 - press(316) * 620 - lift(316) * 620} s={1.5} rot={-225} mirror pose="relax" ring={3} sleeve={300} f={lf} at={292} dur={10} px={6.5} seed={310} sleeveCol="#6e5440" />
            ) : null}
            {[[60, 2100, 1, 'cap'], [1020, 2100, -1, 'tall']].map(([x, y, d, h], i) => (
              <Man key={i} id={`s9f${i}`} x={x as number} y={y as number} s={1.45} dir={d as 1 | -1} f={lf} at={246 + i * 4} hat={h as HatKind} sil arm="none" seed={1100 + i} px={5} />
            ))}
            <Tone kind="Top" lf={lf} op={0.35} />
            <rect x={-120} y={-120} width={1320} height={2160} fill="url(#closeVig)" opacity={0.5} />
          </Cam>
        </g>
      ) : null}
    </g>
  );
};


// 10: the palace at night. A table with bread and a cup, silent instruments, one lamp, a king awake.
const Scene10 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const fl = flick(lf, 5);
  const win = 'M 330 1080 L 330 720 Q 330 470 540 470 Q 750 470 750 720 L 750 1080 Z';
  const stars = Array.from({ length: 12 }, (_, i) => [370 + rng(1210 + i)() * 340, 520 + rng(1230 + i)() * 500, 3 + rng(1250 + i)() * 3]);
  const FY = 1520;
  return (
    <Cam fx={540} fy={1500} k={lerp(1, 1.1, u)} tx={lerp(10, -18, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.34} over={20} />
      <Veil fill={INDIGO} op={0.62} lf={lf} a={0} b={26} />
      {/* the far wall: brick, an arched window on the night sky, columns */}
      <Par z={0.3} u={u} dx={-24}>
        <Brick x0={-80} y0={240} x1={1160} y1={FY} rowH={90} colW={170} f={lf} at={2} dur={60} w={2.6} op={0.28} seed={61} wobble={3} />
        <Wash d={win} f={lf} at={6} fill={INDIGO} op={0.95} over={20} />
        {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={PARCH_LT} opacity={(0.55 + 0.4 * Math.sin(lf / 8 + i)) * T(lf, 20 + i * 3, 50 + i * 3)} />)}
        {I({ d: win, at: 4, dur: 44, w: 8 })}
        {I({ d: 'M 300 1100 L 300 720 Q 300 440 540 440 Q 780 440 780 720 L 780 1100', at: 10, dur: 44, w: 5, op: 0.6 })}
        {I({ d: box(300, 1078, 480, 30, 1201), at: 24, dur: 24, w: 5, wash: SHADE, washOp: 0.5 })}
        <Column id="s10cl" x={110} top={300} bot={FY} hw={56} f={lf} at={6} seed={1210} px={5.4} />
        <Column id="s10cr" x={970} top={300} bot={FY} hw={56} f={lf} at={12} seed={1220} px={5.4} />
      </Par>
      {/* the floor: tiles in perspective */}
      <Wash d={`M -80 ${FY} H 1160 V 2000 H -80 Z`} f={lf} at={0} fill={PARCH_LT} op={0.18} over={20} />
      {I({ d: seg(-80, FY, 1160, FY, 1202, 2), at: 8, dur: 50, w: 6 })}
      {[-300, -40, 220, 480, 740, 1000, 1260, 1520].map((x, i) => I({ k: `fl${i}`, d: seg(540 + (x - 540) * 0.25, FY, x, 1960, 1210 + i, 2), at: 14 + i * 3, dur: 36, w: 3, op: 0.4 }))}
      {[1580, 1670, 1780].map((y, i) => I({ k: `fh${i}`, d: seg(-80, y, 1160, y, 1220 + i, 2), at: 20 + i * 4, dur: 36, w: 3, op: 0.4 }))}
      {/* the throne and the king, awake */}
      <Par z={0.9} u={u} dx={-30}>
        {I({ d: poly([[560, FY + 20], [560, 1060], [600, 1010], [800, 1010], [840, 1060], [840, FY + 20]], 1230, 2, true), at: 20, dur: 40, w: 7, wash: SHADE, washOp: 0.46 })}
        {[600, 800].map((x, i) => I({ k: `fi${i}`, d: poly([[x - 14, 1016], [x, 960], [x + 14, 1016]], 1240 + i, 1, true), at: 52 + i * 4, dur: 10, w: 5, wash: AMBER, washOp: 0.5 }))}
        <Man id="s10k" x={700} y={FY + 90} s={1.45} dir={-1} f={lf} at={64} hat="crown" beard seated bow={8} arm="rest" seed={1250} px={5.6} wash="#6e5440" washOp={0.4} />
      </Par>
      {/* the long table in front: bread, a cup, the lamp */}
      <Par z={1.5} u={u} dx={-56}>
        <Wash d="M -100 1800 Q 430 1700 960 1800 Q 430 1900 -100 1800 Z" f={lf} at={24} fill={SHADE} op={0.5} over={20} />
        {I({ d: ell(430, 1790, 540, 74, 1260), at: 20, dur: 40, w: 7, wash: PARCH_LT, washOp: 0.34 })}
        {I({ d: 'M -108 1800 Q 430 1920 968 1800 L 968 1880 Q 430 2000 -108 1880 Z', at: 30, dur: 40, w: 7, wash: SHADE, washOp: 0.62 })}
        {[-30, 140, 320, 520, 700].map((x, i) => I({ k: `tf${i}`, d: seg(x, 1856 + Math.abs(x - 430) * 0.04, x - 12, 1950, 1270 + i, 2), at: 44 + i * 3, dur: 12, w: 3, op: 0.5 }))}
        {/* two loaves and a flat bread */}
        {I({ d: ell(250, 1748, 86, 38, 1280), at: 52, dur: 22, w: 6, wash: AMBER, washOp: 0.5 })}
        {[196, 230, 264, 298].map((x, i) => I({ k: `bs${i}`, d: seg(x, 1730, x + 10, 1760, 1281 + i, 0.8), at: 70 + i * 3, dur: 8, w: 3.4 }))}
        {I({ d: ell(398, 1760, 74, 32, 1290), at: 58, dur: 22, w: 6, wash: AMBER, washOp: 0.44 })}
        {[360, 392, 424].map((x, i) => I({ k: `bt${i}`, d: seg(x, 1744, x + 8, 1770, 1291 + i, 0.8), at: 76 + i * 3, dur: 8, w: 3.4 }))}
        {I({ d: ell(310, 1792, 120, 26, 1295), at: 50, dur: 18, w: 5, wash: PARCH_LT, washOp: 0.6 })}
        {/* the cup, a goblet of gold */}
        {I({ d: poly([[536, 1660], [624, 1660], [614, 1730], [590, 1752], [570, 1752], [546, 1730]], 1300, 1.2, true), at: 62, dur: 22, w: 6, wash: AMBER, washOp: 0.7 })}
        {I({ d: seg(580, 1752, 580, 1782, 1301, 0.6), at: 80, dur: 8, w: 8 })}
        {I({ d: ell(580, 1788, 40, 10, 1302, 0.6), at: 84, dur: 8, w: 6, wash: AMBER, washOp: 0.7 })}
        {I({ d: seg(540, 1676, 620, 1676, 1303, 0.6), at: 88, dur: 8, w: 3.4, op: 0.6 })}
        <Lamp x={780} y={1770} s={1.1} fl={fl} f={lf} at={36} px={5} />
      </Par>
      {/* a lyre and a harp, leaning unplayed in the foreground */}
      <Par z={1.9} u={u} dx={-70}>
        <g transform="rotate(-5 150 1960)">
          {I({ d: ell(150, 1830, 124, 150, 1310), at: 40, dur: 40, w: 7, wash: AMBER, washOp: 0.34 })}
          {I({ d: wob([[60, 1760], [24, 1500], [34, 1240], [96, 1050]], 1311, 2), at: 50, dur: 40, w: 9 })}
          {I({ d: wob([[240, 1760], [276, 1500], [266, 1240], [204, 1050]], 1312, 2), at: 54, dur: 40, w: 9 })}
          {I({ d: seg(86, 1064, 214, 1064, 1313, 1), at: 70, dur: 16, w: 12 })}
          {[0, 1, 2, 3, 4, 5].map((i) => I({ k: `ls${i}`, d: seg(100 + i * 20, 1074, 98 + i * 20, 1790, 1320 + i, 0.5), at: 80 + i * 4, dur: 18, w: 2.6, op: 0.75 }))}
          {I({ d: ell(150, 1830, 40, 50, 1330), at: 90, dur: 12, w: 4, wash: INK, washOp: 0.5 })}
        </g>
        <g transform="rotate(4 960 1960)">
          {I({ d: wob([[1000, 1960], [1004, 1100]], 1340, 2), at: 44, dur: 40, w: 16 })}
          {I({ d: wob([[1004, 1100], [930, 1090], [850, 1150], [800, 1260]], 1341, 2), at: 54, dur: 36, w: 12 })}
          {I({ d: wob([[800, 1260], [840, 1560], [940, 1900]], 1342, 2), at: 62, dur: 40, w: 12 })}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => I({ k: `hs${i}`, d: seg(1004 - i * 30 + 4, 1100 + i * 20, 940 - i * 18, 1900 - i * 30, 1350 + i, 0.5), at: 90 + i * 4, dur: 16, w: 2.6, op: 0.75 }))}
        </g>
      </Par>
      <Glow x={780} y={1700} r={720 * fl} op={0.85 * T(lf, 40, 70)} />
      <Tone kind="Top" lf={lf} op={0.4} />
      <Tone kind="Bot" lf={lf} op={0.3} />
    </Cam>
  );
};


// 11: dawn in the rose wash. The king runs, the stone is dragged aside, he calls down.
const Scene11 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const runX = lerp(-200, 470, ease(T(lf, 20, 150)));
  const running = lf >= 20 && lf < 150;
  const drag = ease(T(lf, 150, 200));
  const stoneX = lerp(720, 1090, drag);
  const call = T(lf, 205, 235);
  const GY = 1720;
  const sunY = lerp(1500, 1180, ease(u));
  const hill = poly([[-80, 1560], [200, 1480], [460, 1540], [760, 1420], [1160, 1470], [1160, GY], [-80, GY]], 1401, 3, true);
  const mound = poly([[420, GY], [560, 1560], [720, 1440], [900, 1410], [1160, 1440], [1160, GY]], 1402, 3, true);
  return (
    <Cam fx={600} fy={1500} k={lerp(1, 1.1, u)} tx={lerp(10, -22, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={ROSE} op={0.34} over={20} />
      <Veil fill={ROSE} op={0.32} lf={lf} a={0} b={30} />
      <Par z={0.2} u={u} dx={-20}>
        <Glow x={150} y={sunY} r={620} op={0.85} />
        {I({ d: ell(150, sunY, 96, 96, 1400), at: 4, dur: 30, w: 7, wash: AMBER, washOp: 0.8 })}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2 + lf / 190;
          return <path key={i} d={`M ${r0(150 + Math.cos(a) * 126)} ${r0(sunY + Math.sin(a) * 126)} L ${r0(150 + Math.cos(a) * (i % 2 ? 158 : 190))} ${r0(sunY + Math.sin(a) * (i % 2 ? 158 : 190))}`} stroke={INK} strokeWidth={6} strokeLinecap="round" opacity={0.6} />;
        })}
        <path d={hill} fill={SHADE} opacity={0.82} />
        {I({ d: hill, at: 6, dur: 50, w: 6, wash: INK, washOp: 0.3 })}
      </Par>
      <Par z={0.6} u={u} dx={-30}>
        <path d={mound} fill="#8a6b4a" opacity={0.95} />
        {I({ d: mound, at: 14, dur: 50, w: 7, wash: SHADE, washOp: 0.4 })}
        <Hatch id="s11m" clip={mound} area={[420, 1410, 740, 320]} gap={14} ang={60} f={lf} at={20} dur={60} w={2.8} op={0.5} seed={2} />
        {/* the dark mouth of the den, and its stone dragged aside with a scrape of dust */}
        {I({ d: ell(720, 1590, 190, 82, 1410), at: 40, dur: 30, w: 7, wash: INK, washOp: 0.95 })}
        <ellipse cx={stoneX + 40} cy={1700} rx={200} ry={26} fill={INK} opacity={0.28} filter="url(#inkSoft)" />
        {lf >= 40 ? <Slab id="s11s" cx={stoneX} cy={1560} rx={210} ry={150} th={64} f={lf} at={-60} spin={-drag * 80} seed={9} shadow={false} /> : null}
        {lf >= 150 && lf < 215 ? (
          <g opacity={1 - T(lf, 190, 215)}>
            {Array.from({ length: 6 }, (_, i) => (
              <circle key={i} cx={stoneX - 190 + i * 24} cy={1690 - ((lf - 150) % 24) * 1.4 - i * 6} r={12 + i * 4} fill={SHADE} opacity={0.3} />
            ))}
          </g>
        ) : null}
      </Par>
      <Ground id="s11g" y={GY} lf={lf} at={10} h={300} seed={21} gap={18} op={0.4} />
      {I({ d: seg(-80, GY, 1160, GY, 1403, 2), at: 6, dur: 60, w: 7 })}
      {/* the guard drags the stone on a rope */}
      {lf >= 130 ? <Man id="s11g1" x={1010} y={1790} s={0.9} dir={-1} f={lf} at={130} hat="cap" sil arm="out" bow={10} seed={1420} px={5} /> : null}
      {lf >= 140 ? <Rope pts={[[stoneX + 120, 1640], [stoneX + 220, 1560], [980, 1330]]} w={10} /> : null}
      {/* the king, running, then calling */}
      {lf >= 20 ? (
        <Man id="s11k" x={lf < 150 ? runX : 470} y={GY + 90} s={1.5} dir={1} f={lf} at={20} hat="crown" beard seed={1430} px={5.6} wash="#7a5c44" washOp={0.4} run={running ? lf : undefined} bow={lf >= 205 ? 16 : running ? 6 : 0} arm={lf >= 205 ? 'raise' : 'rest'} />
      ) : null}
      {call > 0
        ? [0, 1, 2].map((i) => {
            const k = clamp01(call * 1.4 - i * 0.22);
            return <path key={i} d={wob([[690 + i * 34, 700 + i * 54], [740 + i * 38, 790 + i * 54], [704 + i * 34, 880 + i * 54]], 1440 + i, 1.5)} fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" opacity={0.7 * k * (1 - 0.3 * i)} />;
          })
        : null}
      <Tone kind="Top" lf={lf} op={0.3} />
      <Tone kind="Bot" lf={lf} op={0.3} />
    </Cam>
  );
};


// 12: inside the den. A shaft of light falls on Daniel; three lions are calm, one at his feet, close.
const Scene12 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const shaft = 'M 330 -60 L 750 -60 L 960 1900 L 120 1900 Z';
  const LW = wob([[-80, -60], [260, -60], [210, 600], [170, 1200], [230, 1500], [-80, 1500]], 1500, 4, true);
  const RW = wob([[1160, -60], [820, -60], [870, 600], [910, 1200], [850, 1500], [1160, 1500]], 1501, 4, true);
  const FY = 1450;
  return (
    <Cam fx={540} fy={1500} k={lerp(1, 1.1, u)} tx={lerp(-8, 10, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={SHADE} op={0.36} over={20} />
      <Veil fill={INDIGO} op={0.56} lf={lf} a={0} b={20} />
      {/* the walls of the pit and the straw floor */}
      <Par z={0.4} u={u} dx={-20}>
        {I({ d: LW, at: 0, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
        {I({ d: RW, at: 4, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
        <Hatch id="s12hl" clip={LW} area={[-80, -60, 340, 1560]} gap={15} ang={60} f={lf} at={2} dur={60} w={3} op={0.7} seed={5} />
        <Hatch id="s12hr" clip={RW} area={[820, -60, 340, 1560]} gap={15} ang={120} f={lf} at={6} dur={60} w={3} op={0.7} seed={6} />
        {[[60, 600, 90, 60], [100, 1000, 100, 66], [1010, 760, 90, 66], [980, 1160, 100, 70]].map((q, i) => I({ k: `bd${i}`, d: ell(q[0], q[1], q[2], q[3], 1510 + i, 4), at: 12 + i * 4, dur: 26, w: 4, wash: INK, washOp: 0.35 }))}
      </Par>
      <Wash d={`M -80 ${FY} H 1160 V 2000 H -80 Z`} f={lf} at={4} fill={AMBER} op={0.2} over={30} />
      <Ground id="s12g" y={FY} lf={lf} at={8} h={480} seed={33} gap={16} op={0.45} />
      {I({ d: seg(-80, FY, 1160, FY, 1502, 2), at: 10, dur: 50, w: 6 })}
      {/* the shaft of light with dust in it, and a pool on the floor */}
      <Wash d={shaft} f={lf} at={30} fill={AMBER} op={0.34} over={50} />
      <Wash d="M 120 1700 Q 540 1560 960 1700 Q 540 1860 120 1700 Z" f={lf} at={50} fill={AMBER} op={0.5} over={40} />
      <Glow x={540} y={1300} r={640} op={0.55 * T(lf, 40, 90)} />
      <Motes f={lf} x0={300} x1={780} y0={200} y1={1700} n={26} seed={31} op={0.85 * T(lf, 50, 90)} />
      {/* two lions sit behind, tails and breath slow */}
      <Par z={0.8} u={u} dx={-30}>
        <Lion id="s12lb" x={60} y={1480} s={0.84} dir={1} pose="sphinx" f={lf} at={36} seed={1010} px={5} />
        <Lion id="s12lc" x={1030} y={1500} s={0.84} dir={-1} pose="sphinx" f={lf} at={46} seed={1020} px={5} />
      </Par>
      {/* Daniel, lit, from behind, standing among them */}
      <Back id="s12d" x={540} y={1500} s={0.82} f={lf} at={64} lit seed={1040} px={5} />
      {/* the third lion lies close to us, its head on its paws */}
      <Par z={1.5} u={u} dx={-56}>
        <Lion id="s12la" x={320} y={1900} s={1.4} dir={1} pose="rest" f={lf} at={28} seed={1030} px={5.4} />
      </Par>
      <Tone kind="Top" lf={lf} op={0.36} />
      <Tone kind="Bot" lf={lf} op={0.3} />
    </Cam>
  );
};


// 13: Daniel is drawn up out of the den into full morning light.
const Scene13 = ({ lf, dur }: SA) => {
  const I = mk(lf);
  const u = T(lf, 0, dur);
  const up = ease(T(lf, 20, 175));
  const dy = lerp(1840, 1090, up);
  const light = T(lf, 0, 120);
  const LM = poly([[-80, 1000], [280, 1000], [264, 1200], [290, 1500], [262, 1780], [286, 2000], [-80, 2000]], 1601, 3, true);
  const RM = poly([[1160, 1000], [800, 1000], [816, 1200], [790, 1500], [818, 1780], [794, 2000], [1160, 2000]], 1602, 3, true);
  return (
    <Cam fx={540} fy={1300} k={lerp(1, 1.1, u)}>
      <Wash d="M -80 -80 H 1160 V 2000 H -80 Z" f={lf} at={0} fill={ROSE} op={0.3} over={20} />
      <Veil fill={ROSE} op={0.3} lf={lf} a={0} b={30} />
      {/* the morning sky above the opening */}
      <Wash d="M -80 -80 H 1160 V 1000 H -80 Z" f={lf} at={0} fill={AMBER} op={0.34 * light} over={50} />
      <Glow x={540} y={760} r={900} op={0.9 * light} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = -Math.PI / 2 + (i - 4) * 0.2;
        return <path key={i} d={`M ${r0(540 + Math.cos(a) * 160)} ${r0(760 + Math.sin(a) * 160)} L ${r0(540 + Math.cos(a) * 900)} ${r0(760 + Math.sin(a) * 900)}`} stroke={AMBER} strokeWidth={14} opacity={0.14 * light} strokeLinecap="round" />;
      })}
      {/* the pit seen from the side: the dark, both walls, the ground at the rim */}
      <rect x={280} y={1000} width={520} height={1000} fill={INK} opacity={0.6 * (1 - 0.5 * light)} />
      <Wash d="M 300 1000 L 780 1000 L 840 2000 L 240 2000 Z" f={lf} at={4} fill={AMBER} op={0.28 * light} over={60} />
      {I({ d: LM, at: 0, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
      {I({ d: RM, at: 6, dur: 50, w: 8, wash: SHADE, washOp: 0.34 })}
      <Hatch id="s13hl" clip={LM} area={[-80, 1000, 380, 1000]} gap={15} ang={58} f={lf} at={4} dur={70} w={3} op={0.7} seed={3} />
      <Hatch id="s13hr" clip={RM} area={[780, 1000, 380, 1000]} gap={15} ang={122} f={lf} at={10} dur={70} w={3} op={0.7} seed={4} />
      {I({ d: seg(-80, 1000, 280, 1000, 1603, 2), at: 8, dur: 40, w: 8 })}
      {I({ d: seg(800, 1000, 1160, 1000, 1604, 2), at: 8, dur: 40, w: 8 })}
      {/* the hoist and the rope that brings him up */}
      {I({ d: seg(380, 1000, 540, 700, 1610), at: 6, dur: 22, w: 14 })}
      {I({ d: seg(700, 1000, 540, 700, 1611), at: 10, dur: 22, w: 14 })}
      {I({ d: seg(430, 890, 650, 890, 1612), at: 18, dur: 16, w: 10 })}
      {I({ d: ell(540, 700, 24, 24, 1613), at: 24, dur: 10, w: 7, wash: SHADE, washOp: 0.7 })}
      {I({ d: wob([[540, 724], [540, dy - 360]], 1614, 1), at: 20, dur: 24, w: 8, col: INK, op: 0.95 })}
      <Back id="s13d" x={540} y={dy} s={0.78} f={lf} at={12} lit lean={Math.sin(lf / 20) * 2} seed={1630} px={5} />
      {/* the hauling ropes and the men who pull */}
      {I({ d: wob([[540, 700], [300, 760], [190, 960]], 1620, 2), at: 18, dur: 24, w: 8, op: 0.9 })}
      {I({ d: wob([[540, 700], [780, 760], [890, 960]], 1621, 2), at: 22, dur: 24, w: 8, op: 0.9 })}
      <Man id="s13a" x={150} y={1010} s={0.85} dir={1} f={lf} at={14} hat="cap" sil arm="out" bow={-10} seed={1640} px={5} />
      <Man id="s13b" x={930} y={1010} s={0.85} dir={-1} f={lf} at={20} hat="cap" sil arm="out" bow={-10} seed={1650} px={5} />
      {/* the lions below, calm, in the lengthening light */}
      <Par z={1.2} u={u} dx={-30}>
        <Lion id="s13l1" x={110} y={2010} s={0.8} dir={1} pose="sphinx" f={lf} at={30} seed={1660} px={5} />
        <Lion id="s13l2" x={970} y={2010} s={0.8} dir={-1} pose="sphinx" f={lf} at={40} seed={1670} px={5} />
      </Par>
      <Motes f={lf} x0={380} x1={700} y0={1000} y1={1900} n={16} seed={41} op={0.7 * light} />
      <Tone kind="Bot" lf={lf} op={0.34} />
    </Cam>
  );
};


// 14: the window again, empty, morning light on the floor and a folded mantle on the rug.
const Scene14 = ({ lf, dur }: SA) => {
  const u = T(lf, 0, dur);
  const I = mk(lf);
  const light = 0.55 + 0.45 * T(lf, 60, dur);
  const mantle = poly([[540, 1670], [640, 1640], [790, 1650], [840, 1690], [820, 1730], [660, 1750], [560, 1730]], 1701, 2, true);
  return (
    <Cam fx={640} fy={1300} k={lerp(1.22, 1.38, u)} tx={lerp(0, -16, u)}>
      <UpperRoom lf={lf} shut={1} light={light} jer={0.9} />
      {/* the mantle he left, folded where he knelt */}
      <ellipse cx={690} cy={1752} rx={190} ry={22} fill={INK} opacity={0.22} filter="url(#inkSoft)" />
      <path d={mantle} fill="#a67c50" opacity={T(lf, 40, 70)} />
      {I({ d: mantle, at: 40, dur: 30, w: 6, wash: AMBER, washOp: 0.22 })}
      {[[600, 1664, 612, 1742], [660, 1650, 670, 1746], [730, 1648, 736, 1742], [790, 1658, 786, 1730]].map((q, i) => I({ k: `mf${i}`, d: seg(q[0], q[1], q[2], q[3], 1710 + i, 1.4), at: 62 + i * 4, dur: 12, w: 3.4, op: 0.6 }))}
      {I({ d: wob([[552, 1700], [680, 1690], [826, 1704]], 1720, 2), at: 76, dur: 14, w: 3, col: PARCH_LT, op: 0.55 })}
      {Array.from({ length: 9 }, (_, i) => I({ k: `mfr${i}`, d: seg(556 + i * 8, 1730 + i * 0.4, 554 + i * 8, 1750, 1730 + i, 0.4), at: 84 + i, dur: 6, w: 2.6, op: 0.6 }))}
      <Motes f={lf} x0={500} x1={820} y0={1100} y1={1780} n={20} seed={51} op={0.8} />
    </Cam>
  );
};

const SCENES: ((a: SA) => ReactNode)[] = [Scene0, Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9, Scene10, Scene11, Scene12, Scene13, Scene14];
const sceneDur = (i: number, total: number) => (i + 1 < S.length ? S[i + 1] - S[i] : total - S[i]);

const BLEED = 12;
const blobs = (i: number) => {
  const r = rng(900 + i * 17);
  return Array.from({ length: 12 }, (_, k) => ({ x: 180 + (k % 3) * 360 + (r() - 0.5) * 140, y: 240 + Math.floor(k / 3) * 480 + (r() - 0.5) * 140, R: 440 + r() * 120, d: r() * 0.25 }));
};

/* ---------- text layers ---------- */

type Chunk = { words: { w: string; s: number; e: number }[]; s: number; e: number };
const CHUNKS: Chunk[] = LINES.filter((l) => l.kind === 'narration').flatMap((l) => {
  const out: Chunk[] = [];
  for (let i = 0; i < l.words.length; i += 3) {
    const ws = l.words.slice(i, i + 3);
    out.push({ words: ws, s: ws[0].s, e: ws[ws.length - 1].e });
  }
  return out.map((c, i) => ({ ...c, e: i + 1 < out.length ? out[i + 1].s : c.e + 0.25 }));
});

const ring = (r: number) =>
  `${Array.from({ length: 16 }, (_, i) => `${(Math.cos((i / 16) * Math.PI * 2) * r).toFixed(1)}px ${(Math.sin((i / 16) * Math.PI * 2) * r).toFixed(1)}px 0 ${INK}`).join(',')},0 ${(r + 3).toFixed(1)}px 0 ${INK}`;

// Karaoke: bold outlined words, three at a time, the spoken word lit amber.
const Karaoke = ({ f }: { f: number }) => {
  const t = f / FPS;
  const c = CHUNKS.find((q) => t >= q.s - 0.04 && t < q.e);
  if (!c) return null;
  const chars = c.words.map((w) => w.w).join(' ').length;
  const size = Math.max(64, Math.min(78, 900 / (chars * 0.58)));
  const pop = 0.94 + 0.06 * T(t, c.s - 0.04, c.s + 0.1);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1470, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(32, 18, 10, 0.5)', borderRadius: 30, padding: '16px 40px', maxWidth: 1000, transform: `scale(${pop})`, textAlign: 'center' }}>
        <span style={{ fontFamily: mulish.fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          {c.words.map((w, i) => {
            const next = c.words[i + 1];
            const lit = t >= w.s && t < (next ? next.s : c.e);
            return (
              <span key={i} style={{ color: lit ? AMBER : '#fff4d8', textShadow: ring(Math.max(4, size * 0.055)) }}>
                {w.w}
                {i < c.words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
};

type Card = { text: string; cite: string; from: number; to: number; words?: { w: string; s: number }[] };
const readAloud = (line: number, scene: number): Card => {
  const l = LINES[line];
  return {
    text: l.words.map((w) => w.w).join(' '),
    cite: `${l.ref}`,
    from: Math.max(S[scene] + 8, fr(l.words[0].s) - 10),
    to: S[scene + 1],
    words: l.words.map((w) => ({ w: w.w, s: w.s })),
  };
};
const onScreen = (text: string, cite: string, scene: number, afterLine: number): Card => ({ text, cite, from: lineEnd(afterLine), to: S[scene + 1] });
const CARDS: Card[] = [
  onScreen(SCRIPTURE.s2, 'Daniel 6:3', 2, 2),
  onScreen(SCRIPTURE.s3, 'Daniel 6:4', 3, 3),
  onScreen(SCRIPTURE.s4, 'Daniel 6:5', 4, 4),
  readAloud(7, 6),
  onScreen(SCRIPTURE.s8, 'Daniel 6:14', 8, 9),
  readAloud(10, 9),
  onScreen(SCRIPTURE.s10, 'Daniel 6:18', 10, 12),
  readAloud(13, 11),
  readAloud(14, 12),
  readAloud(15, 13),
];

const CARD_W = 900;
const CARD_PAD = 66;
const ScriptureCard = ({ card, f }: { card: Card; f: number }) => {
  if (f < card.from || f > card.to + 8) return null;
  const chars = card.text.length;
  let size = 66;
  while (size > 44 && Math.ceil((chars * size * 0.45) / (CARD_W - CARD_PAD * 2)) * size * 1.3 + 150 > 640) size -= 2;
  const lines = Math.ceil((chars * size * 0.45) / (CARD_W - CARD_PAD * 2));
  const h = Math.max(260, Math.round(lines * size * 1.3 + 170));
  const fadeIn = T(f, card.from, card.from + 10);
  const fadeOut = 1 - T(f, card.to, card.to + 8);
  const border = box(14, 14, CARD_W - 28, h - 28, 4000 + chars, 3);
  const inner = box(26, 26, CARD_W - 52, h - 52, 4100 + chars, 2);
  const u = draw((f - card.from) / 20);
  const t = f / FPS;
  const body = card.words
    ? card.words.map((w, i) => (
        <span key={i} style={{ color: t >= w.s ? AMBER : 'rgba(42,26,16,0.6)', textShadow: t >= w.s ? '0 0 1.5px rgba(42,26,16,0.75), 0 1px 0 rgba(42,26,16,0.4)' : 'none' }}>
          {w.w}
          {i < card.words!.length - 1 ? ' ' : ''}
        </span>
      ))
    : card.text;
  return (
    <div style={{ position: 'absolute', left: (1080 - CARD_W) / 2, top: 260, width: CARD_W, height: h, opacity: fadeIn * fadeOut }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(160deg, #f1e4bf, #e3cf9f)', boxShadow: '0 16px 44px rgba(42,26,16,0.4)' }} />
      <svg width={CARD_W} height={h} style={{ position: 'absolute', inset: 0 }}>
        <path d={border} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={inner} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, padding: `0 ${CARD_PAD}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: garamondItalic.fontFamily, fontStyle: 'italic', fontWeight: 500, fontSize: size, lineHeight: 1.3, color: INK }}>{body}</div>
        <div style={{ marginTop: 22, fontFamily: garamond.fontFamily, fontWeight: 600, fontSize: 36, letterSpacing: '0.16em', fontVariantCaps: 'all-small-caps', color: SHADE }}>{card.cite}</div>
      </div>
    </div>
  );
};

const Title = ({ f }: { f: number }) => {
  if (f < TITLE_AT || f > S[1]) return null;
  const u = draw((f - TITLE_AT) / 38);
  const out = 1 - T(f, S[1] - BLEED, S[1]);
  const sub = T(f, TITLE_AT + 30, TITLE_AT + 46);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, opacity: out }}>
      <defs>
        <mask id="titleMask" maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <path d={wob([[50, 470], [300, 440], [560, 480], [800, 440], [1030, 470]], 77, 6)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} fill="none" stroke="#fff" strokeWidth={230} strokeLinecap="butt" />
        </mask>
      </defs>
      <g mask="url(#titleMask)">
        <text x={540} y={500} textAnchor="middle" fontFamily={caveat.fontFamily} fontWeight={700} fontSize={168} fill={INK} stroke={INK} strokeWidth={2}>
          As he did before
        </text>
      </g>
      <text x={540} y={590} textAnchor="middle" fontFamily={mulish.fontFamily} fontWeight={600} fontSize={40} letterSpacing={3} fill={INK} opacity={sub}>
        A retelling of Daniel 6
      </text>
    </svg>
  );
};

const ReflectionLabel = ({ f }: { f: number }) => {
  const o = T(f, S[14], S[14] + 14) * (1 - T(f, END_CARD, END_CARD + 10));
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 38, letterSpacing: '0.18em', color: INK, opacity: 0.88 * o }}>
      A Come Aside reflection
    </div>
  );
};

const EndCard = ({ f }: { f: number }) => {
  if (f < END_CARD) return null;
  const o = T(f, END_CARD, END_CARD + 14);
  const u = draw((f - END_CARD - 4) / 30);
  return (
    <AbsoluteFill style={{ background: `rgba(42, 26, 16, ${0.72 * o})` }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0 }}>
        <defs>
          <mask id="endMask" maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
            <path d={wob([[80, 860], [540, 840], [1000, 860]], 78, 5)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} fill="none" stroke="#fff" strokeWidth={230} />
          </mask>
        </defs>
        <g mask="url(#endMask)">
          <text x={540} y={900} textAnchor="middle" fontFamily={caveat.fontFamily} fontWeight={700} fontSize={200} fill={PARCH_LT}>
            Daniel 6
          </text>
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 190, right: 190, top: 960, textAlign: 'center', fontFamily: mulish.fontFamily, fontWeight: 600, fontSize: 36, lineHeight: 1.4, color: PARCH_LT, opacity: T(f, END_CARD + 20, END_CARD + 36) }}>
        Scripture from the World English Bible, Catholic Edition.
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the composition ---------- */

export const AsHeDidBefore = ({ durationSeconds, appCut = false }: AsHeDidBeforeProps) => {
  const f = useCurrentFrame();
  const total = Math.round(durationSeconds * FPS);
  const boil = boilSeed(f);
  // The paper stains drift slowly; a bounded time keeps the sheet covered across 178 s.
  const pf = 140 + 110 * Math.sin(f / 520);
  let idx = 0;
  for (let i = 0; i < S.length; i++) if (f >= S[i]) idx = i;
  const nextStart = idx + 1 < S.length ? S[idx + 1] : null;
  const p = nextStart !== null && f >= nextStart - BLEED ? T(f, nextStart - BLEED, nextStart) : 0;
  const warm = f < S[13] ? 0 : f < S[14] ? 0.3 * ease(T(f, S[13], S[14])) : 0.3 + 0.3 * ease(T(f, S[14], total));
  const scene = (i: number) => {
    const Sc = SCENES[i];
    return (
      <g filter="url(#inkBoil)">
        <Sc lf={f - S[i]} dur={sceneDur(i, total)} />
      </g>
    );
  };
  const bl = p > 0 ? blobs(idx) : [];
  return (
    <AbsoluteFill style={{ background: INK }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0 }}>
        <PaperDefs boil={boil} />
        <InkDefs boil={boil} />
        <Parchment f={pf} warm={warm} />
        {scene(idx)}
        {p > 0 ? (
          <g>
            <g filter="url(#inkBleed)" opacity={0.9 * bell(p, 0.5, 0.35)}>
              {bl.map((b, k) => (
                <circle key={k} cx={b.x} cy={b.y} r={b.R * ease(p / 0.75) * 1.05} fill={INK} />
              ))}
            </g>
            <mask id="bleedMask" maskUnits="userSpaceOnUse" x={-200} y={-200} width={1480} height={2320}>
              <g filter="url(#inkBleed)">
                {bl.map((b, k) => (
                  <circle key={k} cx={b.x} cy={b.y} r={b.R * ease(T(p, 0.3 + b.d * 0.2, 1)) * 1.12} fill="#fff" />
                ))}
              </g>
            </mask>
            <g mask="url(#bleedMask)">
              <Parchment f={pf} warm={warm} />
              {scene(idx + 1)}
            </g>
          </g>
        ) : null}
        <Burn vig={1} warm={warm * 0.6} />
      </svg>
      <Title f={f} />
      {CARDS.map((c, i) => (
        <ScriptureCard key={i} card={c} f={f} />
      ))}
      <ReflectionLabel f={f} />
      {appCut ? null : <Karaoke f={f} />}
      {appCut ? null : <EndCard f={f} />}
    </AbsoluteFill>
  );
};
