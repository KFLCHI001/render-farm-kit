import { Audio } from '@remotion/media';
import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { enterEase, mulish } from './brand';
import {
  AMB, BLU, BRN, Cloud, Defs, Dots, Flower, GRN, Hole, INK, Keep, Lat, LampScreen, Layer, Ln, ORG, Piece, RED, Rivet, Rod, Rods, Valance, WoodFrame, Weave, YEL,
  noise, poly, scallop, smooth, spiralD,
} from './bible-story/shadow';
import type { Pt } from './bible-story/shadow';
import { H, W, clamp01 } from './bible-story/world';

// Style test A, "The father ran" (a retelling of Luke 15:11-24), as a shadow puppet play.
// 20 s at 30 fps, 1080x1920. Translucent carved leather puppets printed on a lamp-lit
// cloth, jointed at brass rivets, worked by rods from below, stepped at 10 fps.
// Ported from the huashu 34_shadowpuppet recipe (MIT); every figure here is ours.
//
// Beats (frames): 0 hook, the father mid-run | 20 "didn't run." | 75 cut to the house at
// dusk | 108 he turns his head to the road | 180 cut to the road, the son far off |
// 300 cut back to the father | 306 head snaps up, the lamp swings | 360 he drops the lamp
// pole and runs | 410 the son comes into frame | 450 the embrace, the lamp glow blooms |
// 520 end card.
// appCut: the in-app cut, with no captions and no end card text.
export type FatherRanProps = { durationSeconds: number; bedAudio?: string; appCut?: boolean };
export const defaultFatherRanProps: FatherRanProps = { durationSeconds: 20, bedAudio: '', appCut: false };

export const BEATS = {
  hook: 0,
  didntRun: 20,
  cutHouse: 75,
  headTurn: 108,
  cutRoad: 180,
  cutSees: 300,
  headSnap: 306,
  lampDrop: 360,
  runFast: 376,
  sonEnters: 410,
  slowToMeet: 424,
  embrace: 450,
  bloom: 454,
  cardIn: 520,
  cardCite: 548,
} as const;

const fredoka = loadFredoka('normal', { weights: ['600'], subsets: ['latin'] });
const G0 = 1500;
const r1 = (n: number) => Math.round(n * 10) / 10;
const rad = (d: number) => (d * Math.PI) / 180;
const span = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
const ease = (f: number, a: number, b: number) => enterEase(span(f, a, b));
const rot2 = (x: number, y: number, deg: number): Pt => [x * Math.cos(rad(deg)) - y * Math.sin(rad(deg)), x * Math.sin(rad(deg)) + y * Math.cos(rad(deg))];
// A point len along a limb whose forward angle (from straight down) is a degrees.
const along = (o: Pt, a: number, len: number): Pt => [o[0] + len * Math.sin(rad(a)), o[1] + len * Math.cos(rad(a))];
const T = (o: Pt, deg: number) => `translate(${r1(o[0])} ${r1(o[1])}) rotate(${r1(deg)})`;

// ---------------------------------------------------------------- rig

type Arm = readonly [number, number, number];
type Leg = readonly [number, number, number];
type Pose = {
  lean: number;
  head: number;
  hs: number;
  beard: number;
  tail: number;
  nA: Arm;
  fA: Arm;
  nL: Leg;
  fL: Leg;
  skirt: number;
  skirtB: number;
  sash: number;
  sash2: number;
};
type Dim = { TH: number; SH: number; UA: number; FA: number; sh: Pt; nk: Pt };

const FATHER_DIM: Dim = { TH: 230, SH: 222, UA: 132, FA: 116, sh: [4, -262], nk: [8, -298] };
const SON_DIM: Dim = { TH: 205, SH: 198, UA: 112, FA: 100, sh: [2, -232], nk: [6, -262] };
const FOOT: readonly Pt[] = [[-16, 34], [50, 36], [76, 30], [-6, -8]];

const joints = (p: Pose, d: Dim) => {
  const sh = rot2(d.sh[0], d.sh[1], p.lean);
  const nk = rot2(d.nk[0], d.nk[1], p.lean);
  const wa = rot2(0, -36, p.lean);
  const arm = (a: Arm) => {
    const el = along(sh, a[0], d.UA);
    const wr = along(el, a[0] + a[1], d.FA);
    return { el, wr, ha: a[0] + a[1] + a[2] };
  };
  const leg = (l: Leg) => {
    const kn = along([0, 0], l[0], d.TH);
    const an = along(kn, l[0] + l[1], d.SH);
    const fa = l[0] + l[1] + l[2];
    const low = an[1] + Math.max(...FOOT.map(([x, y]) => -x * Math.sin(rad(fa)) + y * Math.cos(rad(fa))));
    return { kn, an, fa, low };
  };
  return { sh, nk, wa, na: arm(p.nA), fa: arm(p.fA), nl: leg(p.nL), fl: leg(p.fL) };
};
type Joints = ReturnType<typeof joints>;

// Where a puppet stands: hip position so the lower foot rests on the ground, plus a hop.
const hipY = (p: Pose, d: Dim, ground: number, s: number, hop = 0) => {
  const j = joints(p, d);
  return ground - Math.max(j.nl.low, j.fl.low) * s - hop;
};

type Place = { x: number; y: number; s: number; flip: 1 | -1 };
const worldPt = (pl: Place, p: Pt): Pt => [pl.x + pl.flip * pl.s * p[0], pl.y + pl.s * p[1]];

const limb = (w0: number, w1: number, L: number) =>
  smooth([[0, -w0 * 0.5], [w0 * 0.5, -w0 * 0.15], [w1 * 0.5, L * 0.5], [w1 * 0.5, L - w1 * 0.2], [0, L + w1 * 0.3], [-w1 * 0.5, L - w1 * 0.2], [-w1 * 0.5, L * 0.5], [-w0 * 0.5, -w0 * 0.15]]);

const FOOT_D = smooth([[-18, -10], [24, -14], [52, 0], [76, 16], [78, 32], [48, 36], [-16, 36], [-24, 14]]);
const HAND_D = smooth([[0, -6], [14, 2], [18, 24], [14, 48], [4, 62], [-8, 58], [-16, 40], [-14, 14]]);
const FACE_D = smooth([[-32, -26], [-50, -70], [-44, -120], [-14, -152], [26, -148], [46, -122], [48, -104], [58, -90], [78, -72], [78, -72], [58, -66], [56, -52], [50, -40], [40, -28], [12, -24], [-10, -20]]);

// ---------------------------------------------------------------- the father

const FD = {
  torso: smooth([[-58, 14], [-68, -60], [-64, -150], [-52, -238], [-30, -284], [6, -298], [40, -284], [60, -236], [78, -150], [82, -70], [66, 16]]),
  skirt: smooth([[-74, -8], [-80, 60], [-98, 150], [-112, 250], [-92, 306], [-56, 288], [-12, 318], [30, 292], [70, 314], [104, 262], [98, 150], [82, 60], [74, -8], [0, -16]]),
  skirtB: smooth([[-50, -6], [-120, 60], [-176, 200], [-190, 330], [-130, 350], [-86, 290], [-40, 330], [0, 200], [34, -6]]),
  sash: smooth([[-68, -80], [-72, -40], [-4, -30], [74, -34], [82, -72], [6, -64]]),
  thigh: limb(78, 58, 232),
  shin: limb(56, 40, 222),
  ua: limb(64, 54, 134),
  fa: limb(50, 62, 118),
  tailA: limb(32, 28, 240),
  tailB: limb(30, 26, 196),
  cloth: smooth([[-50, -52], [-54, -110], [-30, -160], [20, -160], [46, -138], [44, -120], [16, -128], [-12, -112], [-24, -70]]),
  clothTail: limb(34, 22, 120),
  beard: smooth([[14, -8], [30, 2], [34, 36], [30, 90], [18, 150], [2, 196], [-12, 170], [-22, 110], [-28, 50], [-22, 6], [-4, -12]]),
};

const armPieces = (k: string, a: Arm, sh: Pt, j: Joints['na'], ua: string, fa: string, d: Dim, cuff: string, sleeve: string) => (
  <g>
    <g transform={T(sh, -a[0])}>
      <Piece id={`${k}-ua`} d={ua} fill={sleeve} carve={<><Cloud x={-2} y={d.UA * 0.38} r={18} /><Dots x={-40} y={d.UA - 40} w={80} h={34} k="s" /></>} />
    </g>
    <g transform={T(j.el, -(a[0] + a[1]))}>
      <Piece id={`${k}-fa`} d={fa} fill={cuff} carve={<><Dots x={-44} y={12} w={88} h={d.FA - 24} k="m" /><Ln d={`M 0 8 L 0 ${d.FA - 14}`} w={4} /></>} />
    </g>
    <g transform={`${T(j.wr, -j.ha)} scale(1.35)`}>
      <Piece id={`${k}-hd`} d={HAND_D} fill={ORG} edge={5} carve={<><Hole d={HAND_D} /><Keep d="M 2 26 L 2 54" w={3} /><Keep d="M -7 28 L -8 50" w={3} /></>} />
    </g>
  </g>
);

const legPieces = (k: string, l: Leg, j: Joints['nl'], th: string, sn: string, d: Dim, thighFill: string, bare: boolean) => (
  <g>
    <g transform={T([0, 0], -l[0])}>
      <Piece id={`${k}-th`} d={th} fill={thighFill} carve={<Lat x={-50} y={10} w={100} h={d.TH - 20} k="s" />} />
    </g>
    <g transform={T(j.kn, -(l[0] + l[1]))}>
      <Piece
        id={`${k}-sh`}
        d={sn}
        fill={YEL}
        carve={<><Ln d={`M -9 18 L -7 ${d.SH - 36}`} w={4} /><Ln d={`M 9 18 L 7 ${d.SH - 36}`} w={4} />{bare ? <Dots x={-30} y={30} w={60} h={d.SH - 80} k="m" /> : <Dots x={-30} y={d.SH - 60} w={60} h={38} k="s" />}</>}
      />
    </g>
    <g transform={T(j.an, -j.fa)}>
      <Piece
        id={`${k}-ft`}
        d={FOOT_D}
        fill={bare ? ORG : RED}
        carve={<><Ln d="M 4 6 L 4 28" w={4} /><Ln d="M 22 4 L 22 28" w={4} /><Dots x={34} y={6} w={40} h={24} k="s" /></>}
      />
    </g>
  </g>
);

const Father = ({ p, id = 'fa' }: { p: Pose; id?: string }) => {
  const d = FATHER_DIM;
  const j = joints(p, d);
  const k = (s: string) => `${id}-${s}`;
  return (
    <g>
      <g transform={T(rot2(50, -52, p.lean), -p.sash)}>
        <Piece id={k('tA')} d={FD.tailA} fill={RED} carve={<><Dots x={-30} y={30} w={60} h={80} k="s" /><Ln d="M -8 150 L -8 215" w={4} /><Ln d="M 8 150 L 8 215" w={4} /></>} />
      </g>
      <g transform={T(rot2(52, -48, p.lean), -p.sash2)}>
        <Piece id={k('tB')} d={FD.tailB} fill={RED} carve={<><Dots x={-30} y={30} w={60} h={60} k="s" /><Ln d="M 0 110 L 0 170" w={4} /></>} />
      </g>
      {armPieces(k('fr'), p.fA, j.sh, j.fa, FD.ua, FD.fa, d, YEL, BLU)}
      {legPieces(k('fl'), p.fL, j.fl, FD.thigh, FD.shin, d, ORG, false)}
      <g transform={T(j.wa, -p.skirtB)}>
        <Piece id={k('sB')} d={FD.skirtB} fill={BLU} carve={<><Lat x={-190} y={80} w={220} h={270} k="d" /><Ln d="M -20 30 L -100 200" w={4} /></>} />
      </g>
      {legPieces(k('nl'), p.nL, j.nl, FD.thigh, FD.shin, d, ORG, false)}
      <g transform={T(j.wa, -p.skirt)}>
        <Piece
          id={k('sk')}
          d={FD.skirt}
          fill={BLU}
          carve={<><Cloud x={-52} y={66} r={22} /><Cloud x={36} y={92} r={24} dir={-1} /><Lat x={-100} y={130} w={210} h={130} k="d" /><Dots x={-112} y={268} w={230} h={30} k="m" /></>}
        />
      </g>
      <g transform={`rotate(${r1(p.lean)})`}>
        <Piece
          id={k('to')}
          d={FD.torso}
          fill={BLU}
          carve={<><Dots x={-62} y={-292} w={140} h={44} k="s" /><Flower x={14} y={-206} r={32} /><Flower x={4} y={-110} r={26} /><Cloud x={-40} y={-160} r={22} /><Cloud x={46} y={-150} r={18} dir={-1} /><Cloud x={-36} y={-72} r={18} rot={1} /><Lat x={32} y={-96} w={50} h={90} k="s" /></>}
        />
        <Piece id={k('sb')} d={FD.sash} fill={RED} carve={<><Ln d="M -40 -70 L -42 -42" w={5} /><Ln d="M -10 -68 L -10 -38" w={5} /><Ln d="M 22 -68 L 22 -38" w={5} /><Ln d="M 54 -70 L 56 -42" w={5} /></>} />
      </g>
      <g transform={`${T(j.nk, p.lean + p.head)} scale(${r1(1.22 * p.hs)} 1.22)`}>
        <g transform={T([-44, -100], -p.tail)}>
          <Piece id={k('ct')} d={FD.clothTail} fill={AMB} carve={<><Dots x={-30} y={20} w={60} h={100} k="s" /></>} />
        </g>
        <Piece id={k('fc')} d={FACE_D} fill={ORG} edge={6} carve={<Hole d={FACE_D} />} />
        <Piece id={k('hc')} d={FD.cloth} fill={AMB} carve={<><Ln d="M -44 -116 Q -10 -152 30 -148" w={4} /><Ln d="M -50 -88 Q -20 -122 24 -126" w={4} /><Dots x={-44} y={-80} w={60} h={26} k="s" /></>} />
        <g transform={T([30, -44], -p.beard)}>
          <Piece
            id={k('bd')}
            d={FD.beard}
            fill={ORG}
            edge={6}
            carve={<><Hole d={FD.beard} /><Keep d="M 8 0 Q 14 70 0 172" w={4} /><Keep d="M -8 0 Q -10 60 -14 132" w={4} /><Keep d="M 20 4 Q 28 60 20 132" w={4} /><Keep d="M 30 12 Q 34 46 28 92" w={4} /></>}
          />
        </g>
        <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 24 -102 Q 42 -114 64 -104" strokeWidth={3.6} />
          <path d="M 28 -99 Q 46 -92 62 -101" strokeWidth={2.4} />
          <path d="M 18 -120 Q 38 -130 62 -114" strokeWidth={5} />
          <path d="M 44 -56 L 57 -55" strokeWidth={3} />
          <path d="M 8 -80 Q 22 -70 30 -62" strokeWidth={2.4} />
          <circle cx={-8} cy={-86} r={11} strokeWidth={2.6} />
          <circle cx={46} cy={-103} r={3.6} fill={INK} stroke="none" />
        </g>
      </g>
      {armPieces(k('nr'), p.nA, j.sh, j.na, FD.ua, FD.fa, d, YEL, BLU)}
      <Rivet x={j.sh[0]} y={j.sh[1]} r={11} />
      <Rivet x={j.na.el[0]} y={j.na.el[1]} r={9} />
      <Rivet x={j.na.wr[0]} y={j.na.wr[1]} r={8} />
      <Rivet x={j.fa.el[0]} y={j.fa.el[1]} r={9} />
      <Rivet x={j.fa.wr[0]} y={j.fa.wr[1]} r={8} />
      <Rivet x={0} y={0} r={11} />
      <Rivet x={j.nl.kn[0]} y={j.nl.kn[1]} />
      <Rivet x={j.fl.kn[0]} y={j.fl.kn[1]} />
      <Rivet x={j.nl.an[0]} y={j.nl.an[1]} r={8} />
      <Rivet x={j.fl.an[0]} y={j.fl.an[1]} r={8} />
      <Rivet x={j.nk[0]} y={j.nk[1]} r={11} />
    </g>
  );
};

// ---------------------------------------------------------------- the son

const SD = {
  torso: smooth([[-40, 10], [-46, -60], [-42, -150], [-30, -222], [-6, -252], [18, -246], [34, -220], [44, -150], [48, -70], [40, 12]]),
  tunic: poly([[-48, -6], [-54, 70], [-64, 142], [-46, 128], [-38, 176], [-22, 132], [-8, 184], [6, 140], [22, 190], [36, 134], [54, 156], [58, 70], [48, -6]]),
  thigh: limb(52, 40, 208),
  shin: limb(40, 30, 198),
  ua: limb(40, 34, 114),
  fa: limb(34, 30, 102),
  hair: smooth([[-48, -60], [-58, -100], [-40, -148], [-6, -164], [30, -152], [46, -130], [42, -112], [10, -122], [-12, -100], [-22, -60]]),
};

const SonFig = ({ p, id = 'so' }: { p: Pose; id?: string }) => {
  const d = SON_DIM;
  const j = joints(p, d);
  const k = (s: string) => `${id}-${s}`;
  const arm = (key: string, a: Arm, jj: Joints['na']) => (
    <g>
      <g transform={T(j.sh, -a[0])}>
        <Piece id={`${key}-ua`} d={SD.ua} fill={GRN} carve={<><Lat x={-30} y={6} w={60} h={70} k="s" /><Hole d={poly([[8, 80], [20, 100], [-4, 108]])} /></>} />
      </g>
      <g transform={T(jj.el, -(a[0] + a[1]))}>
        <Piece id={`${key}-fa`} d={SD.fa} fill={YEL} carve={<><Dots x={-30} y={14} w={60} h={72} k="m" /><Ln d="M 0 8 L 0 86" w={3} /></>} />
      </g>
      <g transform={T(jj.wr, -jj.ha)}>
        <Piece id={`${key}-hd`} d={HAND_D} fill={ORG} edge={5} carve={<Hole d={HAND_D} />} />
      </g>
    </g>
  );
  return (
    <g>
      {arm(k('fr'), p.fA, j.fa)}
      {legPieces(k('fl'), p.fL, j.fl, SD.thigh, SD.shin, d, YEL, true)}
      {legPieces(k('nl'), p.nL, j.nl, SD.thigh, SD.shin, d, YEL, true)}
      <g transform={T(j.wa, -p.skirt)}>
        <Piece
          id={k('tu')}
          d={SD.tunic}
          fill={GRN}
          carve={<><Lat x={-60} y={20} w={70} h={90} k="s" /><Hole d={poly([[20, 40], [48, 76], [34, 112], [12, 84]])} /><Hole d={poly([[-44, 120], [-24, 150], [-52, 150]])} /></>}
        />
      </g>
      <g transform={`rotate(${r1(p.lean)})`}>
        <Piece
          id={k('to')}
          d={SD.torso}
          fill={GRN}
          carve={<><Lat x={-46} y={-220} w={64} h={120} k="d" /><Hole d={poly([[10, -170], [42, -138], [26, -102], [2, -126]])} /><Ln d="M 36 -30 L 24 -4" w={4} /></>}
        />
      </g>
      <g transform={`${T(j.nk, p.lean + p.head)} scale(${r1(0.98 * p.hs)} 0.98)`}>
        <Piece id={k('fc')} d={FACE_D} fill={ORG} edge={6} carve={<Hole d={FACE_D} />} />
        <Piece id={k('hr')} d={SD.hair} fill={AMB} carve={<><Ln d="M -40 -110 Q -10 -150 30 -144" w={4} /><Ln d="M -48 -80 Q -20 -118 24 -122" w={4} /><Dots x={-44} y={-78} w={40} h={24} k="s" /></>} />
        <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 24 -100 Q 42 -92 62 -102" strokeWidth={4} />
          <path d="M 18 -114 Q 40 -112 62 -106" strokeWidth={4.5} />
          <path d="M 46 -54 L 56 -57" strokeWidth={3} />
          <circle cx={-8} cy={-84} r={11} strokeWidth={2.6} />
        </g>
      </g>
      <Rivet x={j.sh[0]} y={j.sh[1]} r={11} />
      <Rivet x={j.na.el[0]} y={j.na.el[1]} r={9} />
      <Rivet x={j.na.wr[0]} y={j.na.wr[1]} r={8} />
      <Rivet x={0} y={0} r={11} />
      <Rivet x={j.nl.kn[0]} y={j.nl.kn[1]} />
      <Rivet x={j.fl.kn[0]} y={j.fl.kn[1]} />
      <Rivet x={j.nk[0]} y={j.nk[1]} r={11} />
    </g>
  );
};

// ---------------------------------------------------------------- poses

const arm0: Arm = [0, 0, 0];
const IDLE: Pose = { lean: 2, head: 0, hs: 1, beard: 0, tail: 4, nA: arm0, fA: arm0, nL: [3, 0, 0], fL: [-3, 0, 0], skirt: 0, skirtB: 3, sash: -6, sash2: -10 };

// Flat-out running: phi is the stride phase in radians, wob the loose wrist.
const runPose = (phi: number, wob: number, k = 1): Pose => {
  const leg = (ph: number): Leg => [(44 * Math.sin(ph) + 6) * k, -(54 + 50 * Math.cos(ph - 1.5 * Math.PI + 0.4)) * k, 12 * Math.sin(ph) - 30 * Math.max(0, Math.cos(ph - 1.5 * Math.PI))];
  const arm = (ph: number): Arm => [-42 * Math.sin(ph) * k + 8, (78 + 22 * Math.sin(ph + 1)) * k, 22 * Math.sin(wob + ph)];
  return {
    lean: 15 * k + 2,
    head: -8,
    hs: 1,
    beard: -(36 + 10 * Math.sin(2 * phi)) * k,
    tail: -(48 + 12 * Math.sin(2 * phi + 0.7)) * k,
    nA: arm(phi),
    fA: arm(phi + Math.PI),
    nL: leg(phi),
    fL: leg(phi + Math.PI),
    skirt: -(30 + 8 * Math.sin(2 * phi + 1)) * k,
    skirtB: -(54 + 14 * Math.sin(2 * phi)) * k,
    sash: -(72 + 12 * Math.sin(2 * phi)) * k,
    sash2: -(88 + 10 * Math.sin(2 * phi + 1.3)) * k,
  };
};

const trudgePose = (phi: number): Pose => {
  const leg = (ph: number): Leg => [20 * Math.sin(ph) + 3, -(8 + 28 * Math.max(0, Math.cos(ph - 1.5 * Math.PI + 0.3))), 6 * Math.sin(ph)];
  const arm = (ph: number): Arm => [-9 * Math.sin(ph) + 3, 10 + 5 * Math.sin(ph), 4];
  return { ...IDLE, lean: 11, head: 30, skirt: 4 * Math.sin(phi * 2), nA: arm(phi), fA: arm(phi + Math.PI), nL: leg(phi), fL: leg(phi + Math.PI) };
};

// ---------------------------------------------------------------- props

type Hill = { x0: number; x1: number; peak: number; fill: string; carve: ReactNode };
const Hills = ({ id, base, hills, drop = 150 }: { id: string; base: number; hills: Hill[]; drop?: number }) => (
  <>
    {hills.map((h, i) => {
      const top = smooth([[h.x0, base], [h.x0 + (h.x1 - h.x0) * 0.2, base - h.peak * 0.64], [(h.x0 + h.x1) / 2, base - h.peak], [h.x0 + (h.x1 - h.x0) * 0.8, base - h.peak * 0.6], [h.x1, base]], false);
      return <Piece key={i} id={`${id}${i}`} d={`${top} L ${h.x1} ${base + drop} L ${h.x0} ${base + drop} Z`} strokeD={top} fill={h.fill} carve={h.carve} />;
    })}
  </>
);

const FarHills = () => {
  const b = G0 - 430;
  return (
    <Hills
      id="hf"
      base={b}
      hills={[
        { x0: 0, x1: 640, peak: 250, fill: YEL, carve: <Dots x={0} y={b - 260} w={640} h={420} k="l" /> },
        { x0: 480, x1: 1100, peak: 330, fill: YEL, carve: <><Cloud x={700} y={b - 150} r={34} /><Cloud x={860} y={b - 90} r={28} dir={-1} /><Cloud x={620} y={b - 60} r={24} /><Dots x={480} y={b + 30} w={620} h={120} k="m" /></> },
        { x0: 960, x1: 1500, peak: 230, fill: YEL, carve: <Lat x={960} y={b - 240} w={540} h={400} k="d" /> },
      ]}
    />
  );
};

const NearHills = () => {
  const b = G0 - 190;
  return (
    <Hills
      id="hn"
      base={b}
      drop={110}
      hills={[
        { x0: 0, x1: 520, peak: 210, fill: ORG, carve: <><Flower x={200} y={b - 110} r={34} /><Flower x={330} y={b - 60} r={26} /><Dots x={0} y={b - 220} w={520} h={240} k="m" /></> },
        { x0: 380, x1: 950, peak: 280, fill: ORG, carve: <><Cloud x={620} y={b - 170} r={34} /><Cloud x={780} y={b - 100} r={30} dir={-1} /><Lat x={380} y={b - 40} w={570} h={150} k="s" /></> },
        { x0: 820, x1: 1300, peak: 190, fill: ORG, carve: <><Flower x={1000} y={b - 100} r={30} /><Flower x={1130} y={b - 60} r={24} /><Dots x={820} y={b - 200} w={480} h={230} k="m" /></> },
      ]}
    />
  );
};

const Tree = ({ id, x, base, s }: { id: string; x: number; base: number; s: number }) => (
  <g transform={`translate(${x} ${base}) scale(${s})`}>
    <Piece
      id={`${id}t`}
      d={smooth([[-16, 0], [-12, -120], [-24, -210], [-8, -262], [8, -262], [24, -210], [12, -120], [16, 0]])}
      fill={BRN}
      carve={<><Ln d="M -4 -10 L -4 -110" w={4} /><Ln d="M 6 -40 L 6 -130" w={4} /></>}
    />
    <Piece id={`${id}c`} d={scallop(0, -340, 128, 108, 8, 0.15)} fill={GRN} carve={<><Flower x={-50} y={-360} r={34} /><Flower x={46} y={-330} r={34} /><Flower x={-4} y={-410} r={28} /><Dots x={-130} y={-290} w={260} h={60} k="m" /></>} />
  </g>
);

const Trees = () => (
  <>
    <Tree id="trA" x={190} base={G0 - 20} s={1} />
    <Tree id="trB" x={700} base={G0 - 20} s={0.8} />
    <Tree id="trC" x={1170} base={G0 - 20} s={1.15} />
  </>
);

const roadPts = (y: (x: number) => number, T0: number) => {
  const pts: Pt[] = [];
  for (let x = 0; x <= T0; x += 40) pts.push([x, y(x)]);
  return pts;
};
const Road = () => {
  const T0 = 1200;
  const top = roadPts((x) => G0 - 25 + 10 * Math.sin((x / 400) * Math.PI * 2), T0);
  const bot = roadPts((x) => G0 + 125 + 8 * Math.sin((x / 600) * Math.PI * 2 + 1), T0);
  const topD = `M ${top.map((p) => `${p[0]} ${r1(p[1])}`).join(' L ')}`;
  const botD = `M ${bot.map((p) => `${p[0]} ${r1(p[1])}`).join(' L ')}`;
  const d = `${topD} L ${bot[bot.length - 1][0]} ${r1(bot[bot.length - 1][1])} ${[...bot].reverse().map((p) => `L ${p[0]} ${r1(p[1])}`).join(' ')} Z`;
  return (
    <Piece
      id="rd"
      d={d}
      strokeD={`${topD} ${botD}`}
      fill={YEL}
      carve={<>
        <Dots x={0} y={G0 - 8} w={T0} h={26} k="m" />
        <Dots x={0} y={G0 + 100} w={T0} h={26} k="m" />
        {[60, 360, 660, 960].map((x) => <Ln key={x} d={`M ${x} ${G0 + 52} L ${x + 120} ${G0 + 52}`} w={9} />)}
      </>}
    />
  );
};

const Field = () => {
  const T0 = 1200;
  const y0 = G0 + 125;
  return (
    <Piece
      id="fd"
      d={`M 0 ${y0} L ${T0} ${y0} L ${T0} ${y0 + 1100} L 0 ${y0 + 1100} Z`}
      strokeD={`M 0 ${y0} L ${T0} ${y0}`}
      fill={GRN}
      carve={<>
        <Dots x={0} y={y0 + 14} w={T0} h={1100} k="l" />
        {[110, 420, 760, 1060].map((x) => <Flower key={x} x={x} y={y0 + 70} r={26} />)}
      </>}
    />
  );
};

const Sun = ({ x, y, r }: { x: number; y: number; r: number }) => {
  const star: Pt[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rr = i % 2 ? r * 1.2 : r * 1.55;
    star.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  return (
    <>
      <Piece id="sunr" d={poly(star)} fill={AMB} carve={<Hole d={`M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`} />} />
      <Piece id="sund" d={`M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`} fill={RED} carve={<><Flower x={x} y={y} r={r * 0.6} /><Dots x={x - r} y={y + r * 0.55} w={2 * r} h={r * 0.4} k="m" /></>} />
    </>
  );
};

const CloudPiece = ({ id, x, y, s }: { id: string; x: number; y: number; s: number }) => {
  const d = scallop(x, y, 150 * s, 52 * s, 6, 0.2);
  return (
    <Piece
      id={id}
      d={d}
      fill={YEL}
      edge={6}
      carve={<><Hole d={d} /><Keep d={spiralD(x - 60 * s, y, 26 * s, 1, 2)} w={4} /><Keep d={spiralD(x + 50 * s, y + 4, 24 * s, -1, 2)} w={4} /></>}
    />
  );
};

const House = () => (
  <>
    <Piece
      id="hsB"
      d="M 0 0 L 0 -500 Q 0 -540 40 -540 L 560 -540 Q 600 -540 600 -500 L 600 0 Z"
      fill={ORG}
      carve={<>
        <Hole d="M 100 0 L 100 -230 Q 100 -330 165 -330 Q 230 -330 230 -230 L 230 0 Z" />
        <Keep d="M 132 -2 L 132 -300" w={5} /><Keep d="M 166 -2 L 166 -326" w={5} /><Keep d="M 200 -2 L 200 -300" w={5} /><Keep d="M 100 -150 L 230 -150" w={5} />
        <Hole d="M 340 -440 L 500 -440 L 500 -300 L 340 -300 Z" />
        <Keep d="M 393 -440 L 393 -300" w={6} /><Keep d="M 447 -440 L 447 -300" w={6} /><Keep d="M 340 -370 L 500 -370" w={6} />
        <Dots x={20} y={-500} w={560} h={36} k="m" />
        <Cloud x={60} y={-380} r={30} /><Cloud x={300} y={-110} r={28} dir={-1} /><Cloud x={530} y={-160} r={26} />
        <Lat x={260} y={-80} w={300} h={80} k="s" />
      </>}
    />
    <Piece id="hsR" d="M 380 -540 L 380 -700 Q 380 -720 400 -720 L 540 -720 Q 560 -720 560 -700 L 560 -540 Z" fill={YEL} carve={<><Hole d="M 420 -680 L 520 -680 L 520 -600 L 420 -600 Z" /><Keep d="M 470 -680 L 470 -600" w={5} /><Dots x={380} y={-590} w={180} h={40} k="s" /></>} />
    <Piece id="hsP" d="M -24 -540 L 624 -540 L 624 -574 L -24 -574 Z" fill={RED} carve={<Dots x={-24} y={-570} w={648} h={26} k="m" />} />
  </>
);

const Gate = () => (
  <>
    {[0, 1].map((i) => {
      const x = i ? 700 : 520;
      return (
        <Piece
          key={i}
          id={`gp${i}`}
          d={smooth([[x - 30, 0], [x - 30, -300], [x - 40, -326], [x - 18, -352], [x + 18, -352], [x + 40, -326], [x + 30, -300], [x + 30, 0]])}
          fill={AMB}
          carve={<><Flower x={x} y={-318} r={22} /><Ln d={`M ${x - 8} -30 L ${x - 8} -250`} w={4} /><Ln d={`M ${x + 10} -60 L ${x + 10} -270`} w={4} /></>}
        />
      );
    })}
    <Piece id="gw0" d="M 480 0 L 490 -150 L 520 -150 L 520 0 Z" fill={YEL} carve={<Dots x={484} y={-140} w={34} h={130} k="s" />} />
    <Piece id="gw1" d="M 700 0 L 700 -150 L 1200 -150 L 1200 0 Z" fill={YEL} carve={<><Dots x={710} y={-142} w={480} h={30} k="m" /><Lat x={710} y={-100} w={480} h={90} k="s" /></>} />
    <Tree id="trH" x={960} base={-140} s={0.9} />
    <Piece id="gbeam" d="M 506 -226 L 714 -226 L 714 -200 L 506 -200 Z" fill={BRN} carve={<Dots x={510} y={-224} w={200} h={22} k="s" />} />
  </>
);

// One scrolling tile, repeated across the screen with the given offset.
const Scroll = ({ id, T0, off, dy = 0, dx = 5, dyS = 4, fade = 0.72, children }: { id: string; T0: number; off: number; dy?: number; dx?: number; dyS?: number; fade?: number; children: ReactNode }) => {
  const o = -(((off % T0) + T0) % T0);
  return (
    <>
      <defs>
        <g id={`tile-${id}`}>{children}</g>
      </defs>
      <Layer id={`ly-${id}`} dx={dx} dy={dyS} a={0.22} fade={fade}>
        {[-1, 0, 1, 2].map((k) => (
          <use key={k} href={`#tile-${id}`} transform={`translate(${r1(o + k * T0)} ${dy})`} />
        ))}
      </Layer>
    </>
  );
};

// ---------------------------------------------------------------- scenes

type Lamp = { x: number; y: number; s: number; rot: number; swing: number };
type Scene = {
  f: number;
  mode: 'hook' | 'home' | 'road';
  off: number;
  G: number;
  sunX: number;
  sunY: number;
  dusk: number;
  bloom: number;
  cam: { z: number; x: number; y: number; px: number };
  father?: { p: Pose; pl: Place; wrists: boolean };
  son?: { p: Pose; pl: Place };
  lamp?: Lamp;
};

const runSpeed = (k: number) => {
  if (k < BEATS.lampDrop) return 0;
  if (k < BEATS.runFast) return (1500 * (k - BEATS.lampDrop)) / (BEATS.runFast - BEATS.lampDrop);
  if (k < BEATS.slowToMeet) return 1500;
  if (k < 452) return (1500 * (452 - k)) / (452 - BEATS.slowToMeet);
  return 0;
};
const runScroll = (pf: number) => {
  let s = 0;
  for (let k = BEATS.lampDrop; k < pf; k++) s += runSpeed(k) / 30;
  return s;
};
const SEND = runScroll(453);

const lampWorld = (l: Lamp): Pt => {
  const top = rot2(0, -400, l.rot);
  const sw = rot2(0, 100, l.rot + l.swing);
  return [l.x + l.s * (top[0] + sw[0]), l.y + l.s * (top[1] + sw[1])];
};

const scene = (f: number): Scene => {
  const pf = Math.floor(f / 3) * 3;
  const ts = pf / 30;
  const base = { f, mode: 'home' as const, off: 0, G: G0, sunX: 240, sunY: 740, dusk: 0.6, bloom: 0, cam: { z: 1, x: 540, y: G0, px: 0 } };
  const holdLamp = (pl: Place, p: Pose, swing: number): Lamp => {
    const j = joints(p, FATHER_DIM);
    const hand = along(j.na.wr, j.na.ha, 26);
    const w = worldPt(pl, hand);
    return { x: w[0], y: w[1], s: pl.s, rot: p.lean * 0.5 + 2 * Math.sin(ts * 1.7), swing };
  };

  if (f < BEATS.cutHouse) {
    // Hook: flat-out run, the world sliding past.
    const phi = (pf / 15) * Math.PI * 2;
    const p = runPose(phi, ts * 11);
    const s = 1;
    const hop = 20 * Math.max(0, Math.cos(2 * phi + 0.4));
    const pl: Place = { x: 470, y: hipY(p, FATHER_DIM, G0, s, hop), s, flip: 1 };
    return { ...base, mode: 'hook', off: pf * 36.7, sunX: 905, sunY: 700, dusk: 0.15, father: { p, pl, wrists: true } };
  }

  if (f < BEATS.cutRoad) {
    // The house at dusk: the father at his gate, turning to look down the road.
    const hs = f < BEATS.headTurn ? -1 : [-0.55, 0.15, 0.7, 1][Math.min(3, Math.floor((f - BEATS.headTurn) / 3))];
    const b = Math.sin(ts * 2.1);
    const p: Pose = {
      ...IDLE,
      lean: 3 + 2 * b,
      head: f < BEATS.headTurn ? 12 : 4 + 6 * Math.sin(ts * 1.4),
      nL: [3 + 2 * Math.sin(ts * 1.1), 0, 0],
      fL: [-3 - 2 * Math.sin(ts * 1.1), 0, 0],
      hs,
      beard: 3 * b,
      tail: 6 + 3 * Math.sin(ts * 2.6),
      nA: [44 + 2 * b, 62, 0],
      fA: [5 + 3 * Math.sin(ts * 1.9), 9, 6],
      skirt: 1.5 * b,
      skirtB: 3 + 2 * b,
    };
    const s = 0.88;
    const pl: Place = { x: 610, y: hipY(p, FATHER_DIM, G0, s), s, flip: 1 };
    const swing = 10 * Math.sin(ts * 2.5) + 4 * Math.sin(ts * 5.3);
    return { ...base, sunY: 740 + (f - 75) * 0.5, dusk: 0.62, father: { p, pl, wrists: true }, lamp: holdLamp(pl, p, swing) };
  }

  if (f < BEATS.cutSees) {
    // The road: the son far off, trudging home, the world drifting past him.
    const phi = (pf / 26) * Math.PI * 2;
    const p = trudgePose(phi);
    const s = 0.85;
    const G = 1400;
    const pl: Place = { x: 600 + 14 * Math.sin(ts * 0.8), y: hipY(p, SON_DIM, G, s), s, flip: -1 };
    return { ...base, mode: 'road', G, off: -(pf - 180) * 6, sunX: 880, sunY: 800, dusk: 0.62, son: { p, pl } };
  }

  if (f < BEATS.lampDrop) {
    // He sees him. The head snaps up, the lamp swings, the free hand goes to the brow.
    const lf = f - BEATS.headSnap;
    const sn = f >= BEATS.headSnap;
    const up = ease(f, 309, 321);
    const p: Pose = {
      ...IDLE,
      lean: sn ? 3 - 6 * Math.exp(-(lf - 2) / 20) * (lf > 1 ? 1 : 0) + 5 * ease(f, 330, 360) : 6,
      head: sn ? -16 : 14,
      hs: 1,
      beard: sn ? -9 * Math.exp(-lf / 14) : 0,
      tail: sn ? -26 * Math.exp(-lf / 10) : 6,
      nA: [44, 62, 0],
      fA: [6 + 88 * up, 14 + 92 * up, 0],
      skirt: sn ? 6 * Math.exp(-lf / 14) : 0,
      skirtB: 3,
    };
    const s = 0.88;
    const pl: Place = { x: 610, y: hipY(p, FATHER_DIM, G0, s), s, flip: 1 };
    const swing = sn ? 40 * Math.exp(-lf / 24) * Math.cos(lf * 0.32) : 5 * Math.sin(ts * 2.5);
    return { ...base, dusk: 0.55, cam: { z: 1 + 0.05 * span(f, 300, 360), x: 610, y: G0, px: 0 }, father: { p, pl, wrists: true }, lamp: holdLamp(pl, p, swing) };
  }

  // 360 on: he drops the lamp pole and runs; the world slides back; he reaches his son.
  const off = runScroll(pf);
  const lf = pf - BEATS.lampDrop;
  const startUp = clamp01(lf / 16);
  const run = f < BEATS.embrace;
  const phi = (lf / 12) * Math.PI * 2;
  const bloom = ease(f, BEATS.embrace, BEATS.bloom + 8) * (1 - 0.1 * span(f, 480, 600));
  const dusk = Math.max(0, 0.5 - 0.5 * span(f, 360, 440));
  const fx = 610 - 120 * ease(f, 360, 452);
  let p: Pose;
  let pl: Place;
  let wrists = true;
  if (run) {
    p = runPose(phi, ts * 11, 0.35 + 0.65 * startUp);
    const s = 0.88;
    const hop = 18 * Math.max(0, Math.cos(2 * phi + 0.4)) * startUp;
    pl = { x: fx, y: hipY(p, FATHER_DIM, G0, s, hop), s, flip: 1 };
  } else {
    const ef = pf - BEATS.embrace;
    const br = Math.sin(ts * 3.1);
    const k = ease(f, 450, 466);
    p = {
      ...IDLE,
      lean: 8 + 12 * k + 2.2 * br,
      head: 4 + 12 * k + 3 * br,
      beard: -4 * k,
      tail: -10 * k,
      nA: [20 + 42 * k, 16 + 6 * k, 6],
      fA: [14 + 36 * k, 20 + 10 * k, 0],
      nL: [14 * k + 3, -12 * k, 0],
      fL: [-8 * k - 3, -8 * k, 0],
      skirt: -8 * k * 0.5,
      skirtB: 3 - 12 * k * Math.exp(-ef / 30),
      sash: -6 - 22 * Math.exp(-ef / 20),
      sash2: -10 - 24 * Math.exp(-ef / 22),
    };
    const s = 0.88;
    pl = { x: 490, y: hipY(p, FATHER_DIM, G0, s), s, flip: 1 };
    wrists = false;
  }
  // The pole falls: a short ballistic drop from his hand, then it rides the ground.
  let lamp: Lamp | undefined;
  {
    const held = holdLamp({ x: 610, y: hipY({ ...IDLE, lean: 3, nA: [44, 62, 0] }, FATHER_DIM, G0, 0.88), s: 0.88, flip: 1 }, { ...IDLE, lean: 3, nA: [44, 62, 0] }, 0);
    const u = clamp01(lf / 15);
    const gy = G0 + 20;
    const y = held.y + (gy - held.y) * u * u;
    const x = held.x + 70 * u - off;
    const landed = lf >= 15;
    lamp = { x, y, s: 0.88, rot: -84 * (u * u * (landed ? 1 : 1)) - (landed ? 3 * Math.sin((lf - 15) * 0.6) * Math.exp(-(lf - 15) / 5) : 0), swing: landed ? 12 * Math.exp(-(lf - 15) / 6) * Math.cos((lf - 15) * 0.9) : -25 * u };
  }
  let son: Scene['son'];
  if (f >= BEATS.sonEnters - 20) {
    const k = ease(f, 450, 468);
    const sp: Pose = run
      ? { ...trudgePose((pf / 8) * Math.PI * 2), lean: 8, head: 20 }
      : {
          ...IDLE,
          lean: 3 + 1.4 * Math.sin(ts * 3.4),
          head: 14 - 22 * k,
          skirt: 2 * Math.sin(ts * 3),
          nA: [14 + 62 * k, 16 + 30 * k, 4],
          fA: [10 + 46 * k, 20 + 40 * k, 0],
          nL: [3, 0, 0],
          fL: [-3, 0, 0],
        };
    const s = 0.9;
    const sx = 770 + (SEND - off) - 20 * k;
    son = { p: sp, pl: { x: sx, y: hipY(sp, SON_DIM, G0, s), s, flip: -1 } };
  }
  const ending = span(f, BEATS.cardIn - 8, BEATS.cardIn + 14);
  const z = 1 - 0.3 * enterEase(ending);
  const cam = { z, x: 660, y: G0 + 20, px: 0 };
  return { ...base, off, dusk, bloom, cam, father: { p, pl, wrists }, son, lamp };
};

// ---------------------------------------------------------------- rendering

const Pole = ({ l, lit, f }: { l: Lamp; lit: boolean; f: number }) => {
  const fl = 1 + 0.28 * noise(Math.floor(f / 2) * 0.9, 3);
  return (
    <Layer id="lamp" dx={5} dy={4}>
      <g transform={`translate(${r1(l.x)} ${r1(l.y)}) scale(${l.s}) rotate(${r1(l.rot)})`}>
        <Piece id="lp-pole" d="M -7 90 L 7 90 L 5 -400 L -5 -400 Z" fill={BRN} carve={<><Ln d="M 0 60 L 0 -120" w={3} /><Ln d="M 0 -200 L 0 -320" w={3} /></>} />
        <g transform={T([0, -400], -l.swing)}>
          <Piece id="lp-chain" d="M -4 0 L 4 0 L 4 56 L -4 56 Z" fill={BRN} />
          <Piece id="lp-cap" d={poly([[-30, 56], [30, 56], [46, 82], [-46, 82]])} fill={RED} carve={<Dots x={-40} y={60} w={80} h={18} k="s" />} />
          <Piece
            id="lp-body"
            d={poly([[-46, 82], [46, 82], [42, 184], [-42, 184]])}
            fill={AMB}
            edge={6}
            carve={<><Hole d={poly([[-31, 96], [31, 96], [27, 172], [-27, 172]])} /><Keep d="M 0 94 L 0 174" w={5} /><Keep d="M -30 134 L 30 134" w={5} /></>}
          />
          <Piece id="lp-base" d={poly([[-42, 184], [42, 184], [32, 208], [-32, 208]])} fill={RED} carve={<Dots x={-38} y={188} w={76} h={16} k="s" />} />
          {lit ? (
            <g transform={`translate(0 168) scale(1 ${r1(fl)}) translate(0 -168)`}>
              <Piece id="lp-fl" d={smooth([[0, 118], [10, 138], [8, 162], [0, 170], [-8, 162], [-10, 138]])} fill={ORG} />
            </g>
          ) : null}
          <Rivet x={0} y={56} r={6} />
        </g>
      </g>
    </Layer>
  );
};

const World = ({ sc }: { sc: Scene }) => {
  const { G, off, mode, f } = sc;
  const dy = G - G0;
  const drift = (f / 30) * 14;
  const road = mode === 'road';
  return (
    <>
      <Layer id="sky" dx={4} dy={3} a={0.2} fade={0.85}>
        <g transform={`translate(${r1(-(off * 0.03))} 0)`}>
          <Sun x={sc.sunX} y={sc.sunY} r={74} />
        </g>
        <CloudPiece id="cl1" x={((220 - drift - off * 0.05) % 1500 + 1500) % 1500 - 200} y={330 + dy} s={1} />
        <CloudPiece id="cl2" x={((780 - drift * 0.7 - off * 0.05) % 1500 + 1500) % 1500 - 200} y={560 + dy} s={0.8} />
        <CloudPiece id="cl3" x={((1290 - drift * 1.2 - off * 0.05) % 1500 + 1500) % 1500 - 200} y={455 + dy} s={0.7} />
      </Layer>
      <Scroll id="hf" T0={1500} off={off * 0.1} dy={dy}><FarHills /></Scroll>
      <Scroll id="hn" T0={1300} off={off * 0.28} dy={dy}><NearHills /></Scroll>
      {mode === 'home' ? null : (
        <Scroll id="tr" T0={1440} off={off * 0.6} dy={dy}>
          <Trees />
        </Scroll>
      )}
      {mode === 'home' ? (
        <Layer id="house" dx={6} dy={4} a={0.24} fade={0.88}>
          <g transform={`translate(${r1(10 - off)} ${G0}) scale(0.8)`}>
            <House />
          </g>
          <g transform={`translate(${r1(0 - off)} ${G0})`}>
            <Gate />
          </g>
        </Layer>
      ) : null}
      {road ? (
        <Layer id="far-house" dx={3} dy={3} a={0.2} fade={0.85}>
          <g transform={`translate(${r1(70 - off * 0.2)} ${G - 200}) scale(0.3)`}>
            <House />
          </g>
        </Layer>
      ) : null}
      <Scroll id="rd" T0={1200} off={off} dy={dy} fade={0.85}><Road /></Scroll>
      <Scroll id="fd" T0={1200} off={off} dy={dy} dx={4} dyS={3} fade={0.7}><Field /></Scroll>
    </>
  );
};

const Cam = ({ z, x, y, children }: { z: number; x: number; y: number; children: ReactNode }) => (
  <g transform={`translate(${x} ${y}) scale(${r1(z * 1000) / 1000}) translate(${-x} ${-y})`}>{children}</g>
);

const Shot = ({ sc }: { sc: Scene }) => {
  const { father, son, lamp, f } = sc;
  const pf = Math.floor(f / 3) * 3;
  const fj = father ? joints(father.p, FATHER_DIM) : null;
  const sj = son ? joints(son.p, SON_DIM) : null;
  const lamp0 = lamp ? lampWorld(lamp) : null;
  const rodPts: Pt[] = [];
  if (father && fj) {
    const pl = father.pl;
    rodPts.push(worldPt(pl, fj.nk));
    if (father.wrists) {
      rodPts.push(worldPt(pl, fj.na.wr), worldPt(pl, fj.fa.wr));
    } else {
      rodPts.push(worldPt(pl, fj.na.el), worldPt(pl, fj.fa.el));
    }
    rodPts.push(worldPt(pl, [0, 8]));
  }
  if (son && sj) {
    rodPts.push(worldPt(son.pl, sj.nk), worldPt(son.pl, sj.na.wr), worldPt(son.pl, [0, 8]));
  }
  return (
    <>
      <g>
        {lamp0 ? (
          <g style={{ mixBlendMode: 'screen' }}>
            <defs>
              <radialGradient id="lampHalo" gradientUnits="userSpaceOnUse" cx={lamp0[0]} cy={lamp0[1]} r={300}>
                <stop offset={0} stopColor="rgba(255,238,170,0.55)" />
                <stop offset={1} stopColor="rgba(255,238,170,0)" />
              </radialGradient>
            </defs>
            <circle cx={lamp0[0]} cy={lamp0[1]} r={300} fill="url(#lampHalo)" />
          </g>
        ) : null}
        <World sc={sc} />
        {lamp ? <Pole l={lamp} lit f={pf} /> : null}
        {father ? (
          <Layer id="father" fade={0.94}>
            <g transform={`translate(${r1(father.pl.x)} ${r1(father.pl.y)}) scale(${father.pl.s})`}>
              <Father p={father.p} />
            </g>
          </Layer>
        ) : null}
        {son ? (
          <Layer id="son" fade={0.94}>
            <g transform={`translate(${r1(son.pl.x)} ${r1(son.pl.y)}) scale(${-son.pl.s} ${son.pl.s})`}>
              <SonFig p={son.p} />
            </g>
          </Layer>
        ) : null}
        <Rods>
          {rodPts.map((q, i) => (
            <Rod key={i} x={q[0]} y={q[1]} x2={q[0] + (q[0] - 540) * 0.05} />
          ))}
        </Rods>
      </g>
    </>
  );
};

// ---------------------------------------------------------------- captions

type Cap = { from: number; to: number; text: string; y: number; hot?: boolean; size?: number; cite?: string };
const RING = ['-3px -3px', '3px -3px', '-3px 3px', '3px 3px', '0 -4px', '0 4px', '-4px 0', '4px 0'].map((o) => `${o} 0 #fff3d2`).join(', ');

const CAPTIONS: Cap[] = [
  { from: 0, to: 75, text: 'Men his age', y: 370, size: 150 },
  { from: BEATS.didntRun, to: 75, text: "didn't run.", y: 510, size: 150, hot: true },
  { from: 80, to: 178, text: 'Every evening', y: 400, size: 116 },
  { from: 108, to: 178, text: 'he watched the road.', y: 530, size: 100, hot: true },
  { from: 186, to: 298, text: 'Father, I have sinned', y: 360, size: 96 },
  { from: 200, to: 298, text: 'against heaven and', y: 465, size: 96 },
  { from: 214, to: 298, text: 'in your sight.', y: 570, size: 96, cite: 'Luke 15:18' },
  { from: 302, to: 358, text: 'But while he was', y: 345, size: 92 },
  { from: 314, to: 358, text: 'still far off,', y: 440, size: 92 },
  { from: 328, to: 358, text: 'his father saw him', y: 545, size: 92, hot: true, cite: 'Luke 15:20' },
  { from: 452, to: 518, text: 'and ran,', y: 360, size: 104 },
  { from: 462, to: 518, text: 'fell on his neck,', y: 470, size: 104 },
  { from: 474, to: 518, text: 'and kissed him.', y: 580, size: 104, hot: true, cite: 'Luke 15:20' },
];

const Caption = ({ cap, f }: { cap: Cap; f: number }) => {
  if (f < cap.from || f >= cap.to) return null;
  const pop = interpolate(f - cap.from, [0, 3, 6], [0.82, 1.06, 1], { extrapolateRight: 'clamp' });
  const out = interpolate(f, [cap.to - 3, cap.to], [1, 0], { extrapolateLeft: 'clamp' });
  const size = cap.size ?? 92;
  return (
    <div style={{ position: 'absolute', top: cap.y - size / 2, left: 40, right: 40, textAlign: 'center', opacity: out }}>
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${pop})`,
          fontFamily: fredoka.fontFamily,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.05,
          color: cap.hot ? '#b3261e' : '#2e1208',
          textShadow: `${RING}, 0 6px 16px rgba(58,22,10,0.35)`,
        }}
      >
        {cap.text}
      </div>
      {cap.cite ? (
        <div style={{ marginTop: 14, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 34, letterSpacing: '0.16em', color: '#2e1208', textShadow: RING.replace(/3px/g, '2px').replace(/4px/g, '3px') }}>
          {cap.cite.toUpperCase()}
        </div>
      ) : null}
    </div>
  );
};

const EndCard = ({ f }: { f: number }) => {
  if (f < BEATS.cardIn) return null;
  const a = ease(f, BEATS.cardIn, BEATS.cardIn + 16);
  const b = ease(f, BEATS.cardIn + 14, BEATS.cardIn + 30);
  const c = ease(f, BEATS.cardCite, BEATS.cardCite + 18);
  const shadow = `${RING}, 0 6px 16px rgba(58,22,10,0.3)`;
  return (
    <div style={{ position: 'absolute', top: 330, left: 50, right: 50, textAlign: 'center', fontFamily: fredoka.fontFamily, fontWeight: 600, color: '#2e1208' }}>
      <div style={{ fontSize: 112, lineHeight: 1.06, opacity: a, transform: `translateY(${(1 - a) * 22}px)`, textShadow: shadow }}>was dead,</div>
      <div style={{ fontSize: 100, lineHeight: 1.08, opacity: b, transform: `translateY(${(1 - b) * 22}px)`, color: '#b3261e', textShadow: shadow }}>and is alive again.</div>
      <div style={{ opacity: c, marginTop: 30, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 32, letterSpacing: '0.16em', textShadow: RING.replace(/3px/g, '2px').replace(/4px/g, '3px') }}>LUKE 15:24, WEBCE</div>
      <div style={{ opacity: c * 0.9, marginTop: 12, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 30, textShadow: RING.replace(/3px/g, '2px').replace(/4px/g, '3px') }}>A retelling of Luke 15</div>
    </div>
  );
};

export const FatherRan = (props: FatherRanProps) => {
  const f = useCurrentFrame();
  const sc = scene(f);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a140a' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <Defs />
        <LampScreen f={f} bloom={sc.bloom} dusk={sc.dusk} W={W} H={H} />
        <Cam z={sc.cam.z} x={sc.cam.x} y={sc.cam.y}>
          <Shot sc={sc} />
        </Cam>
        <Layer id="valanceL" dx={5} dy={6} a={0.3} fade={0.95}>
          <Valance W={W} />
        </Layer>
        <Weave W={W} H={H} />
        <WoodFrame W={W} H={H} />
      </svg>
      {props.appCut
        ? null
        : CAPTIONS.map((cap) => <Caption key={`${cap.from}-${cap.text}`} cap={cap} f={f} />)}
      {props.appCut ? null : <EndCard f={f} />}
      {props.bedAudio ? <Audio src={staticFile(props.bedAudio)} /> : null}
    </AbsoluteFill>
  );
};
