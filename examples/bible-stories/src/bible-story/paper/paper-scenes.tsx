import type { ReactNode } from 'react';
import { Cam, GroundShadow, INK, TrouserLegs, back, bell, ease, fromLocal, lerp, lerpPt, stepF, toLocal } from './paper';
import type { Pt } from './paper';
import { Ancient, Burst, CROWD, Coin, DustPuff, Donkey, INN, Mini, OilJar, Scraps, Scroll, Sparkle, Staff, torn } from './paper-ancient';
import type { Kind } from './paper-ancient';
import { CloseRoad, Inn, Jar, Rock, Square, Sun, WideRoad, WIDE_ROAD, roadAt, ROAD_MAX } from './paper-world';
import { Buildings, BusStop, HELP, Hook, Lamp, LyingMan, MAN, Mend, P1, P2, Rush, SM, Street, WalkBy, WalkOff, X1, X2 } from '../../WhoStopped';
import { clamp01 } from '../world';

// The scenes of the Who stopped long cut. Every scene takes the absolute frame f. The
// modern street is the pilot's own (its shots are reused as they are); the old world is
// built from the layers in paper-world with the figures in paper-ancient.
export const SC = { s0: 0, s1: 270, s2: 900, s3: 1140, s3b: 1560, s4: 1860, s5: 2400, s6: 2880, s7: 3180, s8: 3660, s9: 4020, s10: 4440, end: 4923 } as const;
export const PEEL_LEN = 24;

const r1 = (n: number) => Math.round(n * 10) / 10;
const T = (a: number, b: number, f: number) => clamp01((f - a) / (b - a));

// Walk cycle foot and hand positions in a person's local space, as the Person does by default.
const walkPose = (ph: number, stride: number, lift: number, swing = 38) => {
  const foot = (a: number, hx: number): Pt => [hx + stride * Math.sin(a), -lift * Math.max(0, Math.cos(a))];
  const hy = -322 + 122 - 5 * Math.abs(Math.cos(ph));
  return { legF: foot(ph, 14), legB: foot(ph + Math.PI, -14), armF: [12 + swing * Math.sin(ph + Math.PI), hy] as Pt, armB: [-12 + swing * Math.sin(ph), hy] as Pt };
};
// Walking phase for a distance covered at scale s.
const phase = (dist: number, stride: number, s: number) => (dist * Math.PI * 2) / (4 * stride * s);

// Road position at a given x, to step people along the road by screen distance.
const tOfX = (x: number) => {
  let lo = 0;
  let hi = ROAD_MAX;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (roadAt(m).x < x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
const onRoad = (x: number, lane = 0) => {
  const p = roadAt(tOfX(x));
  return { x, y: p.y + lane * p.s, s: p.s };
};

/* =============================================================
   Scene 0: the pilot's opening, plus the lone man for the title
   ============================================================= */

// Frames 0 to 239 are the pilot's Hook, WalkBy and Rush. After that the street holds on the
// man and the camera pushes in while the title sits above him.
export const Opening = ({ f }: { f: number }) => {
  if (f < 60) return <Hook f={f} />;
  if (f < 150) return <WalkBy f={f} />;
  if (f < 240) return <Rush f={f} />;
  const sf = stepF(f);
  const u = ease((f - 240) / 60);
  return (
    <Cam fx={617} fy={1318} k={1 + 0.34 * u}>
      <Cam fx={620} fy={1180} k={1.18} tx={-80}>
        <Street lit={0.1} extra={<><Lamp x={960} ground={1410} lit={0} /><BusStop x={40} ground={1405} /></>} />
        <GroundShadow x={620} y={1342} w={190} />
        <LyingMan id="m" x={770} y={1297} s={0.62} sf={sf} look={[0.3 - 0.4 * T(240, 300, f), 0.3]} lids={[0.5, 0.55]} />
      </Cam>
    </Cam>
  );
};

/* =============================================================
   The crowd
   ============================================================= */

type CrowdSpec = { x: number; y: number; s: number; kind: Kind; ci: number };
const CROWD_SPEC: CrowdSpec[] = [
  { x: 110, y: 1236, s: 0.4, kind: 'traveller', ci: 0 },
  { x: 250, y: 1230, s: 0.42, kind: 'levite', ci: 1 },
  { x: 410, y: 1240, s: 0.41, kind: 'traveller', ci: 2 },
  { x: 540, y: 1236, s: 0.38, kind: 'priest', ci: 3 },
  { x: 700, y: 1238, s: 0.42, kind: 'traveller', ci: 4 },
  { x: 840, y: 1232, s: 0.4, kind: 'levite', ci: 5 },
  { x: 990, y: 1240, s: 0.41, kind: 'traveller', ci: 6 },
  { x: 70, y: 1304, s: 0.5, kind: 'traveller', ci: 7 },
  { x: 215, y: 1312, s: 0.52, kind: 'priest', ci: 2 },
  { x: 360, y: 1304, s: 0.5, kind: 'traveller', ci: 5 },
  { x: 625, y: 1296, s: 0.46, kind: 'traveller', ci: 1 },
  { x: 770, y: 1308, s: 0.52, kind: 'levite', ci: 0 },
  { x: 915, y: 1304, s: 0.5, kind: 'traveller', ci: 4 },
  { x: 1050, y: 1312, s: 0.51, kind: 'traveller', ci: 3 },
  { x: 135, y: 1392, s: 0.6, kind: 'traveller', ci: 6 },
  { x: 305, y: 1398, s: 0.62, kind: 'levite', ci: 7 },
  { x: 815, y: 1394, s: 0.6, kind: 'traveller', ci: 3 },
  { x: 985, y: 1400, s: 0.62, kind: 'priest', ci: 1 },
];
const ROBES = ['#cdb98e', '#b9a578', '#a8b09a', '#c7ab86', '#9aa8a0'];

// The crowd of small bean people. They look at focus; at snapAt every head snaps toward
// toward (screen right) with eyes wide.
export const CrowdRow = ({ f, focus, snapAt, toward = 1 }: { f: number; focus: number; snapAt?: number; toward?: 1 | -1 }) => {
  const sf = stepF(f);
  return (
    <g filter="url(#cut)">
      {CROWD_SPEC.map((c, i) => {
        const pal = CROWD[c.ci % CROWD.length];
        const snap = snapAt === undefined ? 0 : T(snapAt + (i % 6) * 2, snapAt + (i % 6) * 2 + 5, f);
        const idle = ((c.x < focus ? 1 : -1) as 1 | -1);
        const dir = snap > 0 ? toward : idle;
        const bump = snap > 0 ? Math.max(0, back(snap) - 1) * 4 + snap : 0;
        return (
          <Mini
            key={i}
            id={`o-c${i}`}
            x={c.x}
            y={c.y}
            s={c.s}
            col={pal.col}
            shade={pal.shade}
            kind={c.kind}
            robe={ROBES[(c.ci + i) % ROBES.length]}
            dir={dir}
            look={snap > 0 ? [toward * 0.95, 0.1] : [0.8, 0.25]}
            lid={snap > 0.2 ? 0 : 0.42}
            wide={snap}
            sq={0.012 * Math.sin(sf * 0.3 + i * 1.7) + (snap > 0 && snap < 1 ? 0.05 * (1 - snap) : 0)}
            turn={bump * 0.5}
            armUp={snap > 0.5 ? 0 : i % 5 === 0 ? 0.0 : 0}
          />
        );
      })}
    </g>
  );
};

const SquareFront = () => (
  <g filter="url(#cut)">
    <path d={torn([[-260, 520], [34, 540], [30, 2400], [-260, 2400]], 201, 3, 90)} fill="#6a4a2e" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d={torn([[-30, 540], [34, 540], [30, 2400], [-30, 2400]], 202, 2, 90)} fill="#4a321e" opacity={0.6} />
    <Jar x={150} y={1960} s={1.7} />
    <Jar x={300} y={1990} s={1.2} fill="#9a6a3a" />
    <Jar x={960} y={1990} s={1.9} fill="#a8683a" />
    <path d={torn([[1060, 1760], [1200, 1740], [1210, 2000], [1040, 2000]], 203, 3, 60)} fill="#7a5a36" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
  </g>
);

/* =============================================================
   The lawyer
   ============================================================= */

type LawProps = { f: number; x: number; y: number; s: number; id: string; dir?: 1 | -1; talk?: boolean; folded?: number; brows?: readonly [number, number]; look?: Pt; lids?: number; mouth?: 'line' | 'o' | 'none' | 'smile'; scroll?: boolean; tilt?: number };
export const Lawyer = ({ f, x, y, s, id, dir = 1, talk = false, folded = 0, brows = [0.2, 0.2], look = [0.55, 0.2], lids = 0.45, mouth, scroll = true, tilt = 0 }: LawProps) => {
  const sf = stepF(f);
  const g = talk ? Math.max(0, Math.sin(sf * 0.085)) : 0;
  const g2 = talk ? Math.max(0, Math.sin(sf * 0.085 + 2.2)) : 0;
  const restF: Pt = scroll ? [64, -246] : [30, -190];
  const restB: Pt = [-34, -190];
  const gestF = lerpPt(restF, [96, -392], g);
  const gestB = lerpPt(restB, [44, -300], g2 * 0.6);
  const foldF: Pt = [-58, -268];
  const foldB: Pt = [70, -262];
  const armF = lerpPt(gestF, foldF, folded);
  const armB = lerpPt(gestB, foldB, folded);
  const mouthKind = mouth ?? (talk && Math.floor(sf / 2) % 3 === 0 ? 'o' : 'line');
  return (
    <g>
      <GroundShadow x={x - 20 * s} y={y + 6} w={150 * s} />
      <Ancient
        id={id}
        kind="lawyer"
        {...X1}
        x={x}
        y={y}
        s={s}
        dir={dir}
        sq={0.012 * Math.sin(sf * 0.3)}
        headTilt={tilt + (talk ? 3 * Math.sin(sf * 0.17) : 0)}
        lids={[lids, lids]}
        look={look}
        mouth={mouthKind}
        brows={brows}
        armF={armF}
        armB={armB}
        backArmFront={folded > 0.02 ? armB : undefined}
        hands={scroll && folded < 0.5 ? ({ f: hf }) => <Scroll at={[hf[0] + 8, hf[1] - 34]} rot={-8} /> : undefined}
      />
    </g>
  );
};

/* =============================================================
   Scene 1: the square, the lawyer talks
   ============================================================= */

export const SquareTalk = ({ f }: { f: number }) => {
  const lf = f - SC.s1;
  const u = ease(lf / 630);
  const cam = { cx: lerp(540, 575, u), cy: lerp(930, 985, u), k: lerp(1.0, 1.3, u) };
  const talking = f > 330 && f < 760;
  return (
    <Square
      cam={cam}
      crowd={<CrowdRow f={f} focus={560} />}
      hero={<Lawyer f={f} id="o-law" x={560} y={1690} s={1.45} talk={talking} look={[0.7, 0.2]} />}
      front={<SquareFront />}
    />
  );
};

/* =============================================================
   Scenes 2 and 9: the lawyer close up, arms folded
   ============================================================= */

// start is the scene's first frame. unfold (0 to 1) opens his arms at the end.
export const LawyerClose = ({ f, start, unfold = 0, brow, soft = 0 }: { f: number; start: number; unfold?: number; brow: (lf: number) => readonly [number, number]; soft?: number }) => {
  const lf = f - start;
  const u = ease(lf / 300);
  const cam = { cx: lerp(560, 575, u), cy: lerp(1170, 1190, u), k: lerp(1.0, 1.14, u) };
  return (
    <Square
      cam={cam}
      crowd={<CrowdRow f={f} focus={560} />}
      hero={<Lawyer f={f} id="o-lawc" x={560} y={2210} s={2.4} dir={1} folded={1 - unfold} scroll={false} brows={brow(lf)} look={[lerp(0.15, 0.05, soft), 0.12]} lids={lerp(0.48, 0.3, soft)} mouth={soft > 0.5 ? 'smile' : 'line'} tilt={lerp(-3, 2, soft)} />}
      front={<SquareFront />}
    />
  );
};

/* =============================================================
   Scene 3: the wide road, Jerusalem to Jericho
   ============================================================= */

type WP = { seg: number; x: number; y: number };
const buildWalk = () => {
  const pts: WP[] = [];
  WIDE_ROAD.forEach((c, i) => c.forEach((p) => pts.push({ seg: i, x: p[0], y: p[1] })));
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
};
const WALK = buildWalk();
const wideAt = (d: number) => {
  const dd = Math.max(0, Math.min(WALK.len, d));
  let i = 1;
  while (i < WALK.cum.length - 1 && WALK.cum[i] < dd) i++;
  const a = WALK.pts[i - 1];
  const b = WALK.pts[i];
  const k = (dd - WALK.cum[i - 1]) / (WALK.cum[i] - WALK.cum[i - 1] || 1);
  const x = lerp(a.x, b.x, k);
  const y = lerp(a.y, b.y, k);
  return { seg: a.seg, x, y, dir: (b.x >= a.x ? 1 : -1) as 1 | -1 };
};

export const RoadWideScene = ({ f }: { f: number }) => {
  const lf = f - SC.s3;
  const sf = stepF(f) - SC.s3;
  const d = WALK.len * T(16, 400, sf);
  const tr = wideAt(d);
  const sTr = lerp(0.22, 0.56, clamp01((tr.y - 600) / 1000));
  const e = ease((lf - 30) / 380);
  const w = 0.92 * e;
  const cam = { cx: lerp(540, tr.x, w), cy: lerp(960, tr.y - 40, w), k: 1 + 1.15 * e };
  const stride = 56;
  const ph = phase(d, stride, sTr);
  return (
    <WideRoad
      cam={cam}
      layerKids={(i) =>
        i === tr.seg ? (
          <g>
            <GroundShadow x={tr.x} y={tr.y + 4} w={110 * sTr} o={0.3} />
            <Ancient id="o-tw" kind="traveller" plain {...MAN} x={tr.x} y={tr.y} s={sTr} dir={tr.dir} ph={ph} stride={stride} lift={30} sq={0.04 * Math.pow(Math.abs(Math.sin(ph)), 6)} lids={[0.45, 0.45]} look={[0.5 * tr.dir, 0.3]} mouth="line" hands={({ f: hf }) => <Staff at={[hf[0] + 8, hf[1] + 20]} rot={6} />} />
          </g>
        ) : null
      }
    />
  );
};

/* =============================================================
   The traveller on the close road: walking, waylaid, lying
   ============================================================= */

export const MX = 780;
export const MY = 1340;

type TravProps = { id: string; x: number; y: number; s: number; sf: number; g: number; ph: number; stride: number; lift: number; tear: boolean; tapes?: readonly number[]; lids?: readonly [number, number]; look?: Pt; mouth?: 'none' | 'line' | 'o'; shake?: number; brow?: number };
// Blends from a walking cream traveller (g 0) to the pilot's lying man (g 1), falling backward.
export const Trav = ({ id, x, y, s, sf, g, ph, stride, lift, tear, tapes, lids = [0.5, 0.5], look = [0, 0.1], mouth = 'none', shake = 0, brow = 0 }: TravProps) => {
  const w = walkPose(ph, stride, lift);
  return (
    <Ancient
      id={id}
      kind="traveller"
      plain
      {...MAN}
      x={x}
      y={y}
      s={s}
      dir={1}
      rot={-90 * g + shake}
      sq={0.012 * Math.sin(sf * 0.3) + (g < 1 ? 0.03 * Math.abs(shake) / 6 : 0)}
      ph={ph}
      legF={lerpPt(w.legF, [26, -6], g)}
      legB={lerpPt(w.legB, [-30, 0], g)}
      armF={lerpPt(w.armF, [110, -190], g)}
      armB={lerpPt(w.armB, [-100, -200], g)}
      headTilt={90 * g}
      lids={lids}
      look={look}
      mouth={mouth}
      brow={brow}
      tear={tear}
      tapes={tapes}
    />
  );
};

/* =============================================================
   Scene 3b: the ambush
   ============================================================= */

const ROCK_A = { x: 470, y: 1215, w: 380, h: 560 };
const ROCK_B = { x: 1020, y: 1450, w: 360, h: 430 };

export const Ambush = ({ f }: { f: number }) => {
  const lf = f - SC.s3b;
  const sf = stepF(f);
  const slf = sf - SC.s3b;
  const e = ease(lf / 300);
  const kA = lerp(1.0, 1.24, e);
  const cam = { cx: lerp(470, 620, e), cy: lerp(1170, 1290, e) - 340 / kA, k: kA };
  // the traveller walks in, is jumped at 84, falls at 150 to 176
  const walkX = lerp(430, MX, T(0, 84, slf));
  const wp = onRoad(walkX);
  const sTr = 1.05;
  const g = T(150, 178, slf);
  const fall = back(clamp01(g));
  const struggle = slf >= 84 && slf < 150;
  const jig = (i: number) => (struggle ? Math.sin(slf * 1.7 + i * 2.1) * 9 : 0);
  const ph = phase(walkX - 430, 56, sTr);
  const walking = slf < 84;
  const tx = walking ? wp.x : MX;
  const ty = walking ? lerp(wp.y + 14 * wp.s, MY, T(60, 84, slf)) : MY;
  const shake = struggle ? Math.sin(slf * 1.9) * 6 : 0;
  // robbers
  const runT = T(176, 236, slf);
  const rob = [
    { id: 'o-r1', from: [ROCK_A.x + 10, 1206] as Pt, to: [MX - 120, MY - 8] as Pt, t0: 76, fleeY: 1240 },
    { id: 'o-r2', from: [ROCK_A.x + 60, 1200] as Pt, to: [MX - 70, MY - 62] as Pt, t0: 80, fleeY: 1210 },
    { id: 'o-r3', from: [ROCK_B.x - 20, 1444] as Pt, to: [MX + 120, MY + 8] as Pt, t0: 78, fleeY: 1400 },
  ];
  const robber = (r: (typeof rob)[number], i: number) => {
    const out = T(r.t0, r.t0 + 9, slf);
    const arrive = T(r.t0 + 4, r.t0 + 14, slf);
    const hop = Math.sin(Math.PI * clamp01((slf - r.t0) / 12)) * 70;
    let x = lerp(r.from[0], r.to[0], ease(arrive));
    let y = lerp(r.from[1], r.to[1], ease(arrive)) - hop;
    if (slf >= 84 && slf < 176) {
      x += jig(i) * 1.2;
      y += Math.abs(jig(i)) * 0.4;
    }
    let fleeing = 0;
    if (slf >= 176) {
      fleeing = ease(runT);
      x = lerp(r.to[0], 1450 + i * 90, ease(runT)) + jig(i) * 0;
      y = lerp(r.to[1], r.fleeY, ease(runT));
    }
    const sR = lerp(0.9, 0.82, fleeing) + (i === 2 ? 0.06 : 0);
    const hidden = slf < r.t0 - 2;
    const wk = walkPose(phase(slf * 9, 80, sR), 80, 40);
    const raise = slf >= 84 && slf < 150 ? (Math.sin(slf * 1.7 + i) > 0 ? 1 : 0.35) : 0;
    const dirR = (x < MX && slf < 176 ? 1 : slf < 176 ? -1 : 1) as 1 | -1;
    if (hidden) return null;
    return (
      <g key={r.id}>
        <GroundShadow x={x} y={y + 4} w={90 * sR} />
        <Ancient
          id={r.id}
          kind="robber"
          {...X2}
          x={x}
          y={y}
          s={sR}
          dir={dirR}
          rot={fleeing > 0 ? -8 : struggle ? 6 : 0}
          sq={0.05 * Math.pow(Math.abs(Math.sin(slf * 0.9 + i)), 6)}
          ph={phase(slf * 9, 80, sR)}
          stride={fleeing > 0 ? 80 : struggle ? 18 : 60}
          lift={fleeing > 0 ? 44 : 22}
          legF={fleeing > 0 || out < 1 ? wk.legF : undefined}
          legB={fleeing > 0 || out < 1 ? wk.legB : undefined}
          armF={raise > 0 ? lerpPt(wk.armF, [64, -420], raise) : fleeing > 0 ? wk.armF : undefined}
          armB={slf >= 84 && slf < 150 ? [-40, -330] : undefined}
          headTilt={struggle ? 6 : 0}
          lids={[0.55, 0.55]}
          brow={1}
          look={[x < MX ? 0.9 : -0.9, 0.3]}
          mouth="none"
        />
      </g>
    );
  };
  const behind = (r: (typeof rob)[number]) => slf < r.t0 + 8;
  return (
    <CloseRoad
      cam={cam}
      flap={f}
      back={<>{rob.filter(behind).map((r) => robber(r, rob.indexOf(r)))}</>}
      mid={
        <g>
          <g filter="url(#cut)">
            <Rock {...ROCK_A} seed={61} fill="#8c6a44" />
            <Rock {...ROCK_B} seed={62} fill="#8c6a44" />
          </g>
          {rob.filter((r) => !behind(r)).map((r) => robber(r, rob.indexOf(r)))}
          <GroundShadow x={tx - 150 * g} y={ty + 6} w={lerp(120, 250, g)} o={0.3} />
          <Trav id="o-trav" x={tx} y={ty} s={sTr} sf={sf} g={fall} ph={walking ? ph : 1.7} stride={walking ? 56 : 30} lift={walking ? 30 : 10} tear={slf >= 112} lids={struggle ? [0.1, 0.1] : g > 0 ? [0.55, 0.5] : [0.45, 0.45]} look={struggle ? [0.5, 0.5] : [0.5, 0.2]} mouth={struggle ? 'o' : g > 0.6 ? 'none' : 'line'} shake={shake} />
          <Scraps x={MX} y={MY - 230} t={T(106, 140, slf)} n={12} seed={5} spread={230} />
          <Scraps x={MX - 40} y={MY - 200} t={T(124, 156, slf)} n={9} seed={9} spread={190} />
          {struggle ? <Burst x={MX} y={MY - 320} r0={170} r1={250} n={9} a0={-Math.PI * 0.95} a1={-Math.PI * 0.05} w={8} t={bell(slf, 100, 18)} /> : null}
        </g>
      }
    />
  );
};

/* =============================================================
   Scene 4: the priest and the Levite pass by
   ============================================================= */

const lyingMan = (f: number, tapes?: readonly number[], extra?: Parameters<typeof LyingMan>[0]['extra'], look: Pt = [0.5, 0.2], lids: readonly [number, number] = [0.55, 0.5]) => (
  <g>
    <GroundShadow x={MX - 170} y={MY + 10} w={250} o={0.3} />
    <LyingMan id="o-man" x={MX} y={MY} s={SM} sf={stepF(f)} look={look} lids={lids} tapes={tapes} extra={extra} />
  </g>
);

export const Passers = ({ f }: { f: number }) => {
  const lf = f - SC.s4;
  const slf = stepF(f) - SC.s4;
  const e = ease(lf / 420);
  const tail = ease((lf - 420) / 120);
  const kP = lerp(lerp(1.0, 1.3, e), 1.5, tail);
  const cam = { cx: lerp(lerp(400, 640, e), 590, tail), cy: lerp(lerp(1230, 1310, e), 1330, tail) - 300 / kP, k: kP };
  // x positions
  const xP = slf < 8 ? -140 : slf < 50 ? lerp(-140, 310, T(8, 50, slf)) : slf < 70 ? lerp(310, 345, T(50, 70, slf)) : slf < 104 ? lerp(345, 800, ease(T(70, 104, slf))) : lerp(800, 1380, T(104, 160, slf));
  const xL = slf < 130 ? -140 : slf < 250 ? lerp(-140, 390, T(130, 250, slf)) : slf < 290 ? lerp(390, 410, T(250, 290, slf)) : slf < 340 ? lerp(410, 800, ease(T(290, 340, slf))) : lerp(800, 1400, T(340, 410, slf));
  const mkPasser = (kind: Kind, pal: typeof P1, id: string, x: number, active: boolean, swerveC: number, glance: boolean, who: 'p' | 'l') => {
    if (!active) return null;
    const base = onRoad(x);
    const sw = bell(x, swerveC, 230);
    const lane = -150 * sw;
    const s = base.s;
    const y = base.y + lane * base.s;
    const stride = who === 'p' ? 62 : 74;
    const ph = phase(x - -140, stride, s);
    const sq = 0.05 * Math.pow(Math.abs(Math.sin(ph)), 6);
    const near = bell(x, 520, 260);
    const seeing = who === 'p' ? T(40, 56, slf) * (1 - T(88, 100, slf)) : T(240, 258, slf) * (1 - T(310, 326, slf));
    const looking: Pt = seeing > 0.3 ? [-0.55, 0.9] : glance ? [-0.95, 0.35] : [0.9, 0.05];
    const wk = walkPose(ph, stride, 34);
    const chest = who === 'p' ? seeing : seeing * 0.6;
    const away = who === 'p' ? T(62, 90, slf) * (1 - T(110, 140, slf)) : T(290, 320, slf) * (1 - T(340, 380, slf));
    const rot = -7 * Math.max(near * 0.8, away);
    return (
      <g key={id}>
        <GroundShadow x={x} y={y + 6} w={110 * s} />
        <Ancient
          id={id}
          kind={kind}
          {...pal}
          x={x}
          y={y}
          s={s}
          dir={1}
          rot={rot}
          ph={ph}
          stride={stride}
          lift={34}
          sq={sq}
          legF={wk.legF}
          legB={wk.legB}
          armF={lerpPt(wk.armF, who === 'p' ? [60, -300] : [44, -290], chest)}
          armB={wk.armB}
          headTilt={seeing > 0.3 ? 4 : away > 0.3 ? -9 : glance ? -10 : 0}
          lids={seeing > 0.3 ? [0.15, 0.15] : [0.42, 0.42]}
          look={looking}
          brow={seeing > 0.3 ? -1 : away > 0.3 ? 0.5 : 0}
          mouth={seeing > 0.3 ? 'o' : 'line'}
        />
      </g>
    );
  };
  const glanceL = slf >= 344 && slf < 372;
  return (
    <CloseRoad
      cam={cam}
      flap={f}
      back={null}
      mid={
        <g>
          <g filter="url(#cut)">
            <Rock {...ROCK_A} seed={61} fill="#8c6a44" />
          </g>
          {mkPasser('priest', P1, 'o-pri', xP, xP > -130 && xP < 1370, 540, false, 'p')}
          {mkPasser('levite', P2, 'o-lev', xL, xL > -130 && xL < 1390, 580, glanceL, 'l')}
          {lyingMan(f)}
          <g filter="url(#cut)">
            <Rock {...ROCK_B} seed={62} fill="#8c6a44" />
          </g>
        </g>
      }
    />
  );
};

/* =============================================================
   Scene 5: the donkey, the crowd, the donkey again
   ============================================================= */

export const DK_STOP = { x: 650, y: 1262, s: 0.95 };

// Where the donkey is at lf frames into scene 5 (approach), and its walking phase.
const donkeyAt = (slf: number) => {
  const u = clamp01(slf / 470);
  const x = -90 + (DK_STOP.x + 90) * (1 - Math.pow(1 - u, 1.7));
  const base = onRoad(Math.max(x, -60));
  const blend = ease((x - 120) / 400);
  const y = lerp(base.y, DK_STOP.y, blend);
  const s = lerp(base.s * 0.96, DK_STOP.s, blend);
  return { x, y, s };
};

// The Samaritan on the donkey: a rider with dangling legs.
export const Rider = ({ id, x, y, s, sf, look = [0.9, 0.4], lids = [0.38, 0.38], brow = 0, mouth = 'line' }: { id: string; x: number; y: number; s: number; sf: number; look?: Pt; lids?: readonly [number, number]; brow?: number; mouth?: 'line' | 'o' | 'smile' | 'none' }) => (
  <Ancient id={id} kind="samaritan" {...HELP} x={x} y={y - 350 * s + 150 * s} s={s} dir={1} sq={0.012 * Math.sin(sf * 0.3)} legF={[34, -34]} legB={[-6, -52]} armF={[58, -250]} armB={[-30, -230]} headTilt={3} lids={lids} look={look} brow={brow} mouth={mouth} />
);

export const DonkeyRide = ({ f }: { f: number }) => {
  const lf = f - SC.s5;
  const sf = stepF(f);
  const slf = sf - SC.s5;
  const d = donkeyAt(slf);
  const ph = phase(d.x + 90, 46, d.s);
  const arriving = 1 - T(380, 470, slf);
  const stride = 46 * (0.3 + 0.7 * arriving);
  const e1 = ease(lf / 175);
  const e2 = ease((lf - 285) / 195);
  const cam = lf < 285 ? { cx: lerp(330, 380, e1), cy: lerp(1120, 1150, e1) - 120, k: lerp(1.0, 1.12, e1) } : { cx: lerp(470, 560, e2), cy: lerp(930, 800, e2), k: lerp(1.0, 1.15, e2) };
  const concern = T(300, 440, slf);
  const dust = (i: number) => {
    const c = ((slf + i * 20) % 40) / 40;
    return c;
  };
  return (
    <CloseRoad
      cam={cam}
      flap={f}
      mid={
        <g>
          <g filter="url(#cut)">
            <Rock {...ROCK_A} seed={61} fill="#8c6a44" />
          </g>
          {lyingMan(f)}
          <GroundShadow x={d.x} y={d.y + 6} w={190 * d.s} o={0.3} />
          <DustPuff x={d.x - 160 * d.s} y={d.y} t={dust(0)} s={d.s} />
          <Donkey id="o-dk" x={d.x} y={d.y} s={d.s} ph={ph} stride={stride} lift={26 * (0.4 + 0.6 * arriving)} bob={4 * d.s * Math.abs(Math.sin(ph)) * arriving} nod={4 * Math.sin(ph)} ear={0.2 * Math.sin(ph * 0.5)} />
          <Rider id="o-sam" x={d.x} y={d.y} s={d.s} sf={sf} look={[0.8, 0.3 + 0.5 * concern]} lids={[lerp(0.4, 0.15, concern), lerp(0.4, 0.15, concern)]} brow={-concern} mouth={concern > 0.7 ? 'o' : 'line'} />
          <g filter="url(#cut)">
            <Rock {...ROCK_B} seed={62} fill="#8c6a44" />
          </g>
        </g>
      }
    />
  );
};

// The crowd's cut in the middle of the donkey scene: every head snaps to the right.
export const CrowdSnap = ({ f }: { f: number }) => {
  const lf = f - SC.s5;
  const u = ease((lf - 175) / 110);
  const cam = { cx: lerp(600, 680, u), cy: lerp(1300, 1260, u), k: lerp(1.45, 1.62, u) };
  const snap = SC.s5 + 198;
  const sn = T(snap, snap + 6, f);
  return (
    <Square
      cam={cam}
      crowd={<CrowdRow f={f} focus={420} snapAt={snap} toward={1} />}
      hero={
        <g>
          <GroundShadow x={330} y={1730} w={190} />
          <Ancient id="o-lawr" kind="lawyer" {...X1} x={330} y={1730} s={1.3} dir={sn > 0 ? 1 : -1} sq={0.012 * Math.sin(stepF(f) * 0.3) + 0.04 * (1 - sn) * (sn > 0 ? 1 : 0)} headTilt={sn > 0 ? 6 : 0} lids={sn > 0.2 ? [0.02, 0.02] : [0.45, 0.45]} look={sn > 0 ? [0.95, 0.1] : [0.5, 0.2]} mouth={sn > 0 ? 'o' : 'line'} brows={sn > 0.2 ? [1, 1] : [0.2, 0.2]} armF={[-58, -268]} armB={[70, -262]} />
        </g>
      }
      front={<SquareFront />}
    />
  );
};

/* =============================================================
   Scenes 6 and 7: the freeze, the kneeling, the tape, the oil, the lift, the walk
   ============================================================= */

export const TAPES_AT = [315, 345, 375, 540, 580];
export const OIL_AT = [400, 500];
export const LIFT_AT = 600;
const FREEZE = 12;

// the pilot's kneel, at its own place beside the man
const kneelPose = () => ({ hx: MX - 110, hy: MY - 16 });

// Pour of oil: drops falling from the jar mouth to the tear.
const OilStream = ({ x0, y0, x1, y1, t }: { x0: number; y0: number; x1: number; y1: number; t: number }) => {
  if (t <= 0 || t >= 1) return null;
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => {
        const p = (t * 3 + i / 6) % 1;
        const x = lerp(x0, x1, p);
        const y = lerp(y0, y1, p * p);
        return <ellipse key={i} cx={r1(x)} cy={r1(y)} rx={8} ry={13} fill="#e7b23a" stroke={INK} strokeWidth={3} opacity={0.95} />;
      })}
      <path d={`M ${r1(x0)} ${r1(y0)} Q ${r1((x0 + x1) / 2 + 6)} ${r1((y0 + y1) / 2 - 20)} ${r1(x1)} ${r1(y1)}`} fill="none" stroke="#f1c85a" strokeWidth={6} strokeLinecap="round" opacity={0.85} />
    </g>
  );
};

export const Rescue = ({ f }: { f: number }) => {
  const lf = f - SC.s6;
  const frozen = lf < FREEZE;
  const sf = frozen ? stepF(SC.s6) : stepF(f);
  const slf = sf - SC.s6;
  const lfa = frozen ? FREEZE : lf;
  const tapes = TAPES_AT.map((b) => clamp01((slf - b) / 6));
  const lastPop = TAPES_AT.filter((b) => slf >= b).pop() ?? -99;
  const tap = Math.exp(-(slf - lastPop) / 3) * (slf >= TAPES_AT[0] ? 1 : 0);
  // donkey stands behind the man
  const dk = DK_STOP;
  // helper: slide off (12 to 40), walk (40 to 82), turn and kneel (86 to 116)
  const slide = T(12, 40, lfa);
  const walkT = T(40, 84, lfa);
  const kneelT = ease(T(88, 120, lfa));
  const { hx, hy } = kneelPose();
  const sSeat = dk.s;
  const seatY = dk.y - 350 * sSeat + 150 * sSeat;
  const gx = lerp(dk.x, dk.x - 48, slide);
  const gy = lerp(seatY, 1352, ease(slide));
  const sAir = lerp(sSeat, 1.05, ease(slide));
  const walkX = lerp(gx, hx - 8, ease(walkT));
  const walkY = lerp(gy, hy + 14, ease(walkT));
  const phW = phase(walkX - (dk.x - 48), 56, 1.05);
  const wkp = walkPose(phW, 52 * (walkT < 1 ? 1 : 0), 26 * (walkT < 1 ? 1 : 0));
  // oil, lift
  const oilT = T(OIL_AT[0], OIL_AT[1], lfa);
  const jarT = bell(lfa, (OIL_AT[0] + OIL_AT[1]) / 2, 55);
  const lift = ease(T(LIFT_AT, LIFT_AT + 44, lfa));
  const toSeat = ease(T(LIFT_AT + 40, LIFT_AT + 78, lfa));
  // the man
  const mRot = lerp(-90, 12, lift);
  const manS = SM;
  const mx0 = MX;
  const my0 = lerp(MY, 1385, lift);
  // seat on the donkey
  const mSeat = { x: dk.x + 20, y: dk.y - 350 * 0.9 + 150 * 0.9, s: 0.9 };
  const mx = lerp(mx0, mSeat.x, toSeat);
  const my = lerp(my0, mSeat.y, toSeat);
  const ms = lerp(manS, mSeat.s, toSeat);
  const rot = lerp(mRot, 8, toSeat);
  const mHead = lerp(lerp(90, 24, lift), 20, toSeat);
  // the walk after the lift: the donkey, man and helper move right toward the inn
  const walkOff = ease(T(660, 780, lfa));
  const dkx = lerp(dk.x, dk.x + 760, walkOff);
  const shift = dkx - dk.x;
  const dkPh = phase(shift, 46, dk.s);
  const dkWalk = walkOff > 0 && walkOff < 1;
  // camera
  const kneelCam = { cx: 600, cy: 1290, k: 1.0 };
  const e1 = ease(lfa / 300);
  const tearW = fromLocal(MX, MY, SM, 1, -90, [0, -240]);
  const e2 = ease(T(300, 340, lfa));
  const e3 = ease(T(520, 640, lfa));
  const e4 = ease(T(640, 780, lfa));
  const punch = lfa < FREEZE ? 0.07 : 0.07 * Math.exp(-(lfa - FREEZE) / 7);
  const kR = lerp(lerp(lerp(lerp(1.0 + 0.3 * e1, 1.55, e2), 1.18, e3), 1.0, e4), 1.0, 0) + punch;
  const cam = {
    cx: lerp(lerp(lerp(lerp(kneelCam.cx, 570, e1), tearW[0] + 60, e2), 650, e3), 1250, e4),
    // the plate sits over the top of the frame, so the action is held in the lower half
    cy: lerp(lerp(lerp(lerp(kneelCam.cy, 1300, e1), tearW[1] - 30, e2), 1290, e3), 1330, e4) - lerp(330, 540, e3) / kR,
    k: kR,
  };
  // the helper's arms (the pilot's kneel math)
  const hs = SM;
  const bend = lerp(0, 62, kneelT) * (1 - lift) + (1 - lift) * 3 * tap * kneelT;
  const hip = lerp(160, 98, kneelT) * (1 - lift) + lift * 160;
  const tearNow = fromLocal(mx0, my0, SM, 1, mRot, [0, -240]);
  const aim = toLocal(hx, hy, hs, -1, 0, tearNow[0] + 4, tearNow[1] - 66 + 16 * tap * (1 - lift));
  const shoulderW: Pt = [hx - 14 * hs, hy - 322 * hs];
  const manHand = toLocal(mx0, my0, SM, 1, mRot, shoulderW[0], shoulderW[1] + 8);
  const manHandLying: Pt = [30, -170];
  const armFman = lerpPt(manHandLying, manHand, lift);
  const jarSwing = jarT;
  const jarHandWorld: Pt = [hx - 150, hy - 232];
  const jarArm = toLocal(hx, hy, hs, -1, 0, jarHandWorld[0], jarHandWorld[1]);
  const aimNow = lerpPt(aim, jarArm, jarSwing);
  const helperHandF = lerpPt(aimNow, toLocal(hx, hy, hs, -1, 0, mx0 + 130, hy - 300 * hs), lift);
  const kneelLegF: Pt = [96, 0];
  const kneelLegB: Pt = [-108, -10];
  const hy2 = lerp(hy, 1385, lift);
  const hx2 = lerp(hx, 905, lift);
  // after the lift the helper walks beside the donkey
  const hwx = dkx - 150 * dk.s * 1.0;
  const hwy = dk.y + 112;
  const hAfterX = lerp(hx2, hwx, T(LIFT_AT + 40, LIFT_AT + 90, lfa));
  const hAfterY = lerp(hy2, hwy, T(LIFT_AT + 40, LIFT_AT + 90, lfa));
  const phH = phase(shift, 56, 1.0);
  const wkH = walkPose(phH, dkWalk ? 50 : 0, dkWalk ? 24 : 0);
  const showWalkHelper = lfa >= LIFT_AT + 40;
  // the inn
  const doorOpen = ease(T(675, 710, lfa));
  const glow = ease(T(660, 700, lfa));
  // what the helper draws
  const helper = (() => {
    if (lfa < 40) return null;
    if (showWalkHelper)
      return (
        <g>
          <GroundShadow x={hAfterX} y={hAfterY + 6} w={120} />
          <Ancient id="o-samh" kind="samaritan" {...HELP} x={hAfterX} y={hAfterY} s={1.0} dir={1} ph={phH} stride={dkWalk ? 50 : 0} lift={dkWalk ? 24 : 0} sq={dkWalk ? 0.04 * Math.pow(Math.abs(Math.sin(phH)), 6) : 0.01 * Math.sin(sf * 0.25)} legF={wkH.legF} legB={wkH.legB} armF={[70 * 1, -330 + 40]} armB={wkH.armB} headTilt={-4} lids={[0.34, 0.34]} lidCurve={-6} brow={-0.6} look={[0.5, 0.4]} mouth="smile" />
        </g>
      );
    if (lfa < 88 && lfa >= 40)
      return (
        <g>
          <GroundShadow x={walkX} y={walkY + 6} w={120} />
          <Ancient id="o-sam2" kind="samaritan" {...HELP} x={walkX} y={walkY} s={lerp(sAir, 1.05, walkT)} dir={1} ph={phW} stride={52} lift={26} sq={0.04 * Math.pow(Math.abs(Math.sin(phW)), 6)} legF={wkp.legF} legB={wkp.legB} armF={wkp.armF} armB={wkp.armB} headTilt={6} lids={[0.3, 0.3]} lidCurve={-6} brow={-1} look={[0.9, 0.6]} mouth="line" />
        </g>
      );
    return (
      <g>
        <GroundShadow x={hx2} y={hy2} w={130} o={0.24} />
        <Ancient
          id="o-sam3"
          kind="samaritan"
          {...HELP}
          x={hx2}
          y={hy2}
          s={hs}
          dir={-1}
          hip={hip}
          bend={bend}
          legF={lerpPt(kneelLegF, [14, 0], lift)}
          legB={lerpPt(kneelLegB, [-14, 0], lift)}
          armF={helperHandF}
          armB={lerpPt(aimNow, [-20, -200], lift)}
          headTilt={lerp(-26, 4, lift)}
          lids={[0.3, 0.3]}
          lidCurve={-6}
          brow={-1}
          look={[-0.7, 0.6]}
          mouth="line"
        />
      </g>
    );
  })();
  const jarOnHelper = lfa >= OIL_AT[0] - 40 && lfa < OIL_AT[1] + 40 && !showWalkHelper;
  return (
    <CloseRoad
      cam={cam}
      flap={f}
      mid={
        <g>
          <Inn x={1590} base={1500} door={doorOpen} glow={glow} />
          <g filter="url(#cut)">
            <Rock {...ROCK_A} seed={61} fill="#8c6a44" />
          </g>
          <GroundShadow x={dkx} y={dk.y + 6} w={190 * dk.s} o={0.3} />
          <Donkey id="o-dk" x={dkx} y={dk.y} s={dk.s} ph={dkWalk ? dkPh : 0.4} stride={dkWalk ? 46 : 0} lift={dkWalk ? 26 : 0} bob={dkWalk ? 4 * Math.abs(Math.sin(dkPh)) : 1.5 * Math.sin(sf * 0.2)} nod={frozen ? 0 : 3 * Math.sin(sf * 0.12)} ear={frozen ? 0 : Math.max(0, Math.sin(sf * 0.1)) * 0.8} />
          {lfa < 40 ? <Rider id="o-sam" x={dk.x} y={dk.y} s={dk.s} sf={sf} look={[0.8, 0.8]} lids={[0.05, 0.05]} brow={-1} mouth="o" />  : null}
          {lfa >= 12 && lfa < 40 ? (
            <g>
              <GroundShadow x={gx} y={gy + 6} w={100} />
              <Ancient id="o-sam1" kind="samaritan" {...HELP} x={gx} y={gy} s={sAir} dir={1} rot={lerp(0, -10, slide) * (1 - slide)} legF={lerpPt([34, -34], [14, 0], ease(slide))} legB={lerpPt([-6, -52], [-14, 0], ease(slide))} armF={lerpPt([58, -250], [-30, -200], slide)} armB={lerpPt([-30, -230], [10, -200], slide)} headTilt={3} lids={[0.05, 0.05]} brow={-1} look={[0.8, 0.8]} mouth="o" />
            </g>
          ) : null}
          <g>
            <GroundShadow x={mx - 160 * (1 - lift) * (1 - toSeat)} y={lerp(1388, 1388, lift) + 0} w={lerp(260, 120, lift) * (1 - toSeat * 0.6)} o={0.28 * (1 - toSeat)} />
            <LyingMan
              id="o-man"
              x={mx}
              y={my}
              s={ms}
              sf={sf}
              rot={rot}
              headTilt={mHead}
              look={[lerp(-0.4, 0.5, lift), lerp(0.7, 0.4, lift)]}
              lids={[lerp(0.3, 0.45, lift), lerp(0.28, 0.45, lift)]}
              tapes={tapes}
              extra={{
                legF: lerpPt(lerpPt([26, -6], [16, -4], lift), [44, -44], toSeat),
                legB: lerpPt(lerpPt([-30, 0], [-26, 0], lift), [-4, -58], toSeat),
                armF: lerpPt(armFman, [70, -230], toSeat),
                armB: lerpPt(lerpPt([-60, -250], [-30, -150], lift), [-24, -200], toSeat),
              }}
            />
          </g>
          {helper}
          {jarOnHelper ? (
            <g>
              <OilJar at={[hx - 168, hy - 290 + 10]} rot={lerp(-8, -118, jarSwing)} />
              <OilStream x0={hx - 190} y0={hy - 242} x1={tearNow[0] + 6} y1={tearNow[1] - 20} t={jarSwing > 0.45 ? oilT : 0} />
            </g>
          ) : null}
          <Sparkle x={tearNow[0] + 6} y={tearNow[1] - 30} r={34} t={T(OIL_AT[0] + 36, OIL_AT[0] + 60, lfa)} />
          <g filter="url(#cut)">
            <Rock {...ROCK_B} seed={62} fill="#8c6a44" />
          </g>
          {lfa < FREEZE + 8 ? <Burst x={dk.x + 28 + 0} y={dk.y - 350 * dk.s - 240 * dk.s} r0={150} r1={250} n={9} t={T(0, FREEZE, lfa)} /> : null}
        </g>
      }
    />
  );
};

/* =============================================================
   Scene 8: morning at the inn
   ============================================================= */

export const InnMorning = ({ f }: { f: number }) => {
  const lf = f - SC.s8;
  const sf = stepF(f);
  const slf = sf - SC.s8;
  const e = ease(lf / 360);
  const out = ease(T(96, 120, slf));
  const cx = lerp(lerp(540, 640, ease(T(40, 74, slf))), 600, ease(T(130, 250, slf)));
  const cy = lerp(lerp(1130, 1340, ease(T(40, 74, slf))), 1170, ease(T(130, 250, slf)));
  const k = lerp(lerp(1.0, 1.75, ease(T(40, 74, slf))), 1.18, ease(T(130, 250, slf))) + 0.04 * e;
  const cam = { cx, cy, k };
  const P: Pt = [650, 1330];
  const samX = 500;
  const inkX = 800;
  const Y = 1690;
  const SS = 1.45;
  const rest: Pt = [30, -190];
  // the Samaritan reaches out with coins, the innkeeper's palm opens
  const reachS = ease(T(40, 66, slf)) * (1 - ease(T(110, 134, slf)));
  const reachI = ease(T(50, 70, slf)) * (1 - ease(T(120, 142, slf)));
  const armS = lerpPt(rest, toLocal(samX, Y, SS, 1, 0, P[0] - 10, P[1] - 6), reachS);
  const armI = lerpPt([30, -190], toLocal(inkX, Y, SS, -1, 0, P[0] + 10, P[1] + 12), reachI);
  const coinFrom: Pt = [P[0] - 10, P[1] - 30];
  const coinTo: Pt = [P[0] + 10, P[1] + 6];
  const cT = ease(T(74, 92, slf));
  const talk = slf > 130 && slf < 250;
  const nod = Math.max(0, Math.sin(sf * 0.12)) * 5;
  const gesture = slf > 140 && slf < 240 ? Math.max(0, Math.sin((slf - 140) * 0.1)) : 0;
  const armS2 = lerpPt(armS, [80, -300], gesture * (1 - reachS));
  return (
    <CloseRoadFree cam={cam}>
      <g>
        <Inn x={640} base={1560} door={1} glow={0.55} />
      </g>
      <g>
        <Mat f={f} />
        <GroundShadow x={samX} y={Y + 6} w={150 * SS} />
        <Ancient id="o-sam8" kind="samaritan" {...HELP} x={samX} y={Y} s={SS} dir={1} sq={0.012 * Math.sin(sf * 0.3)} headTilt={3 + nod * 0.3} lids={[0.32, 0.32]} lidCurve={-6} look={[0.8, 0.2]} mouth={talk || cT > 0 && cT < 1 ? 'smile' : 'line'} armF={armS2} armB={[-30, -200]} />
        <GroundShadow x={inkX} y={Y + 6} w={150 * SS} />
        <Ancient id="o-ink" kind="innkeeper" {...INN} x={inkX} y={Y} s={SS} dir={-1} sq={0.012 * Math.sin(sf * 0.3 + 2)} headTilt={-3 - nod * 0.4} lids={[0.4, 0.4]} look={[-0.7, 0.3]} mouth={slf > 96 ? 'smile' : 'line'} armF={armI} armB={[-30, -200]} brows={[0.3 * (1 - out), 0.3 * (1 - out)]} />
        {cT < 1 ? <Coin x={lerp(coinFrom[0], coinTo[0], cT) - 6} y={lerp(coinFrom[1], coinTo[1], cT)} r={24} rot={cT * 120} /> : slf < 134 ? <Coin x={coinTo[0] - 6} y={coinTo[1]} r={24} rot={20} /> : null}
        {cT < 1 ? <Coin x={lerp(coinFrom[0], coinTo[0], cT) + 28} y={lerp(coinFrom[1], coinTo[1], cT) - 8} r={24} rot={-cT * 90} /> : slf < 134 ? <Coin x={coinTo[0] + 24} y={coinTo[1] - 6} r={24} rot={-15} /> : null}
        <Sparkle x={P[0] + 10} y={P[1] - 10} r={60} t={T(88, 112, slf)} />
        <Sparkle x={P[0] - 26} y={P[1] + 16} r={34} t={T(94, 114, slf)} />
      </g>
    </CloseRoadFree>
  );
};

const Mat = ({ f }: { f: number }) => {
  const sf = stepF(f);
  return (
    <g>
      <g filter="url(#cut)">
        <path d={torn([[-120, 1850], [440, 1830], [470, 1930], [-130, 1950]], 301, 3, 60)} fill="#a9453a" stroke={INK} strokeWidth={6} strokeLinejoin="round" opacity={0.0} />
        <path d={torn([[-120, 1846], [470, 1826], [496, 1936], [-132, 1960]], 302, 3, 60)} fill="#6f8a8c" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d="M -100 1880 L 470 1862 M -104 1912 L 480 1898" stroke="#efe2c4" strokeWidth={9} opacity={0.8} />
      </g>
      <GroundShadow x={290} y={1856} w={260} o={0.28} />
      <LyingMan id="o-man8" x={420} y={1850} s={0.85} sf={sf} look={[0.3, 0.3]} lids={[0.9, 0.9]} tapes={[1, 1, 1, 1, 1]} />
    </g>
  );
};

// A free camera over the old world with no backdrop of its own (the inn scene draws its own sky).
const CloseRoadFree = ({ cam, children }: { cam: { cx: number; cy: number; k: number }; children: ReactNode }) => {
  const kids = (Array.isArray(children) ? children : [children]) as ReactNode[];
  return (
    <g>
      <g transform={`translate(540 960) scale(${r1(cam.k * 1000) / 1000}) translate(${r1(-cam.cx)} ${r1(-cam.cy)})`}>
        <InnBack />
        {kids}
      </g>
    </g>
  );
};

const InnBack = () => (
  <g>
    <Sun x={540} y={940} r={170} />
    <Hill2 />
  </g>
);

// A far ridge and the ground in front of the inn.
const Hill2 = () => (
  <g filter="url(#cut)">
    <path d={torn([[-700, 1220], [-300, 1180], [100, 1230], [480, 1170], [900, 1230], [1400, 1170], [1800, 1220], [1800, 1640], [-700, 1640]], 311, 4, 80)} fill="#d4ae70" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d={torn([[-700, 1560], [300, 1550], [900, 1566], [1500, 1552], [1800, 1560], [1800, 2400], [-700, 2400]], 312, 4, 80)} fill="#b98e52" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d={torn([[-700, 1760], [300, 1750], [900, 1766], [1500, 1752], [1800, 1760], [1800, 2400], [-700, 2400]], 313, 4, 80)} fill="#a47b42" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
  </g>
);

/* =============================================================
   Scene 10: back on the modern street
   ============================================================= */

const LEGS = [
  { at: 22, dur: 26, col: P1.col, y: 1562, s: 2.3, stride: 110, lift: 70, x0: -260, x1: 1390 },
  { at: 100, dur: 18, col: P2.col, y: 1580, s: 2.4, stride: 120, lift: 80, x0: -260, x1: 1390 },
  { at: 172, dur: 26, col: X1.col, y: 1566, s: 2.3, stride: 110, lift: 70, x0: -260, x1: 1390 },
];

// The pilot's low opening again: legs walk past, then the red pair stops at about 157 s.
export const LegsLow = ({ f }: { f: number }) => {
  const lf = f - SC.s10;
  const sf = stepF(f) - SC.s10;
  const k = 1 + 0.1 * ease(lf / 285);
  const open = ease((sf - 8) / 26);
  const ox = 1160;
  const oy = 1352;
  const vp = 980;
  const stopAt = 270;
  const helpT = T(232, stopAt, sf);
  const hx = -260 + 960 * ease(helpT);
  const hph = sf * 0.5;
  const hStride = 110 * (1 - ease(T(stopAt - 8, stopAt, sf)));
  return (
    <Cam fx={420} fy={1300} k={k}>
      <Buildings sx={0} lit={0} base={vp} />
      <g filter="url(#cut)">
        <rect x={-600} y={vp} width={2400} height={150} fill="#5b4129" stroke={INK} strokeWidth={6} />
        <rect x={-600} y={vp + 150} width={2400} height={50} fill="#c19a5c" stroke={INK} strokeWidth={6} />
        <rect x={-600} y={vp + 200} width={2400} height={1000} fill="#a07a4a" />
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M ${540 + (i - 6) * 70} ${vp + 204} L ${540 + (i - 6) * 330} 1980`} stroke="#6a4c28" strokeWidth={5} opacity={0.5} />
        ))}
        {[1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M -600 ${vp + 200 + Math.pow(i, 1.9) * 38} L 1800 ${vp + 200 + Math.pow(i, 1.9) * 38}`} stroke="#6a4c28" strokeWidth={5} opacity={0.5} />
        ))}
      </g>
      <GroundShadow x={ox - 380} y={1478} w={560} o={0.34} />
      <LyingMan id="m" x={ox} y={oy} s={1.75} sf={stepF(f)} look={[0.5, 0.15]} lids={[0.98, lerp(0.98, 0.3, open)]} />
      {LEGS.map((l, i) => {
        const p = sf - l.at;
        if (p < -2 || p > l.dur + 6) return null;
        const x = l.x0 + (l.x1 - l.x0) * clamp01(p / l.dur);
        return <TrouserLegs key={i} x={x} y={l.y} s={l.s} ph={p * 0.55} stride={l.stride} lift={l.lift} col={l.col} />;
      })}
      {sf >= 232 ? <TrouserLegs x={hx} y={1572} s={2.35} ph={hph} stride={hStride} lift={hStride * 0.65} col={HELP.col} /> : null}
    </Cam>
  );
};

// The kneel and the lift, then the walk off, are the pilot's own shots, mapped onto this cut.
const KNEEL_AT = 4725;
const WALKOFF_AT = 4815;
export const Return = ({ f }: { f: number }) => {
  if (f < KNEEL_AT) return <LegsLow f={f} />;
  if (f < WALKOFF_AT) return <Mend f={360 + (f - KNEEL_AT)} />;
  const held = Math.min(Math.floor((f - WALKOFF_AT) * 0.55), 59);
  const u = ease((f - WALKOFF_AT) / 225);
  return (
    <Cam fx={720} fy={1180} k={1 + 0.06 * u} tx={-30 * u}>
      <WalkOff f={450 + held} />
    </Cam>
  );
};
export const returnWarm = (f: number) => ease((f - WALKOFF_AT) / 60);
