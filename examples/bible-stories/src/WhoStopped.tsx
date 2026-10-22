import { Audio } from '@remotion/media';
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  Burn, Cam, Chalk, ChalkArrow, ChalkSmile, ChalkText, Cup, GroundShadow, INK, Parchment, PaperDefs, Person, Phone, Plank, Post, TrouserLegs, Watch,
  bell, boilSeed, ease, fromLocal, lerp, lerpPt, stepF, toLocal,
} from './bible-story/paper/paper';
import type { PersonProps, Pt } from './bible-story/paper/paper';
import { Caption } from './bible-story/paper/paper-caption';
import type { Cap } from './bible-story/paper/paper-caption';
import { clamp01, rng } from './bible-story/world';

// Bible story short S6, Who stopped (a retelling of Luke 10:30 to 37).
// Style test D: the paper parable lane. Flat cut-paper people on mottled
// parchment, heavy-lidded eyes, chalk signposts. 20 s at 30 fps. People step on
// twos (12 fps), chalk redraws at 8 fps, the camera is smooth.
//
// Beats (frames): 0 to 60 hook, low at pavement level | 60 wide street, the first
// passer steps around him | 150 the second passer rushes past | 240 whip pan to
// the helper under the sign | 300 hit, he stops, 12 frame freeze | 312 compassion
// | 360 he kneels, five tape strips pop on the tear | 426 he lifts the man |
// 450 they walk off, the parchment warms | 510 end card.
// appCut drops every caption and the end card; frames 510 to 600 hold the final walk-off scene.
export type WhoStoppedProps = { durationSeconds: number; bedAudio?: string; appCut?: boolean };
export const defaultWhoStoppedProps: WhoStoppedProps = { durationSeconds: 20, bedAudio: '', appCut: false };

export const BEATS = {
  hook: 0,
  captionTwoPeople: 0,
  captionWalkedPast: 18,
  eyeOpens: 8,
  legsPassOne: 20,
  legsPassTwo: 40,
  cutStreet: 60,
  stepsAround: 100,
  cutRush: 150,
  watchCheck: 168,
  swerve: 178,
  whipStart: 240,
  whipLand: 252,
  sideEyes: 258,
  hit: 300,
  freezeStart: 300,
  freezeEnd: 312,
  compassion: 312,
  cutKneel: 360,
  tape1: 372,
  tape2: 384,
  tape3: 396,
  tape4: 408,
  tape5: 420,
  lift: 426,
  walkOff: 450,
  warmStart: 450,
  endCard: 510,
  likewise: 552,
  retelling: 570,
} as const;

// People. Slate green, mustard, the outsider in deep red, the torn man in cream.
export const MAN = { col: '#efe2c4', shade: '#cdb98e', iris: '#9fb9cc' };
export const P1 = { col: '#4f6b5a', shade: '#35493c', iris: '#d6e39a' };
export const P2 = { col: '#c99a2e', shade: '#94701a', iris: '#cfe0a4' };
export const HELP = { col: '#a8322a', shade: '#76201a', iris: '#d8e4a6' };
export const X1 = { col: '#8d8576', shade: '#645d50', iris: '#e6dc8a' };
export const X2 = { col: '#7a7f52', shade: '#555a36', iris: '#cfe3b0' };

const CAPTIONS: Cap[] = [
  { from: 0, to: 60, text: 'Two people', y: 330, size: 150 },
  { from: 18, to: 60, text: 'walked past\nhim.', y: 500, size: 150, gold: true },
  { from: 60, to: 150, text: 'passed by on\nthe other side.', y: 340, size: 112, cite: 'Luke 10:31' },
  { from: 150, to: 240, text: 'He had somewhere', y: 340, size: 104 },
  { from: 170, to: 240, text: 'to be.', y: 470, size: 170, gold: true },
  { from: 240, to: 300, text: 'Not him.', y: 340, size: 150 },
  { from: 262, to: 300, text: 'Not that guy.', y: 510, size: 128, gold: true },
  { from: 312, to: 372, text: 'he was moved\nwith compassion', y: 340, size: 112, cite: 'Luke 10:33' },
  { from: 510, to: 552, text: 'He who showed\nmercy on him.', y: 520, size: 124, cite: 'Luke 10:37' },
  { from: 552, to: 600, text: 'Go and do\nlikewise.', y: 480, size: 150, gold: true, cite: 'Luke 10:37, WEBCE', sub: 'A retelling of Luke 10' },
];

/* ---------- the street ---------- */

const WALL = 1120;
const KERB = 1440;
const ROAD = 1486;

export const Buildings = ({ sx, lit, base = WALL }: { sx: number; lit: number; base?: number }) => {
  const r = rng(31);
  const blocks: ReactNode[] = [];
  const tones = ['#7a5a38', '#69492c', '#85633d', '#73522f'];
  let x = -520;
  let i = 0;
  while (x < 1700) {
    const w = 130 + r() * 110;
    const h = 210 + r() * 120;
    const top = base - h;
    const col = tones[i % tones.length];
    const cols = Math.max(2, Math.floor(w / 56));
    const rows = Math.floor((h - 50) / 78);
    const wins: ReactNode[] = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const on = r() < 0.2 + 0.6 * lit;
        wins.push(
          <rect key={`${cx}-${cy}`} x={x + sx + 20 + cx * ((w - 40) / cols) + 6} y={top + 30 + cy * 78} width={26} height={38} fill={on ? '#e8bd68' : '#4a3220'} opacity={on ? 0.95 : 0.7} stroke={INK} strokeWidth={3} />,
        );
      }
    }
    const roof = r() * 16;
    blocks.push(
      <g key={i}>
        <path d={`M ${x + sx} ${base} L ${x + sx} ${top + roof} L ${x + sx + w * 0.5} ${top} L ${x + sx + w} ${top + roof * 0.6} L ${x + sx + w} ${base} Z`} fill={col} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        {wins}
        {i % 3 === 0 ? <rect x={x + sx + w * 0.62} y={top - 34} width={26} height={40} fill={col} stroke={INK} strokeWidth={5} /> : null}
      </g>,
    );
    x += w - 4;
    i++;
  }
  return <g filter="url(#cut)">{blocks}</g>;
};

export const Lamp = ({ x, ground, lit }: { x: number; ground: number; lit: number }) => (
  <g>
    {lit > 0 ? <circle cx={x - 36} cy={ground - 700} r={240} fill="url(#lampGlow)" opacity={lit} /> : null}
    <g filter="url(#cut)">
      <path d={`M ${x - 9} ${ground} L ${x - 7} ${ground - 700} L ${x + 8} ${ground - 700} L ${x + 10} ${ground} Z`} fill="#3d2c1e" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M ${x} ${ground - 696} Q ${x} ${ground - 740} ${x - 38} ${ground - 736}`} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d={`M ${x - 54} ${ground - 732} L ${x - 18} ${ground - 732} L ${x - 24} ${ground - 702} L ${x - 48} ${ground - 702} Z`} fill={lit > 0.3 ? '#f2d58c' : '#8a7a5a'} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    </g>
  </g>
);

export const BusStop = ({ x, ground, w = 360 }: { x: number; ground: number; w?: number }) => (
  <g>
    <g filter="url(#cut)">
      <rect x={x + 10} y={ground - 360} width={w - 20} height={300} fill="#8a6a44" opacity={0.55} stroke={INK} strokeWidth={5} />
      <Post x={x + 14} top={ground - 380} ground={ground} w={28} />
      <Post x={x + w - 14} top={ground - 380} ground={ground} w={28} />
      <Plank x={x + w / 2} y={ground - 392} w={w + 50} h={44} seed={3} />
      <Plank x={x + w - 30} y={ground - 560} w={150} h={120} seed={4}>
        <ChalkText x={0} y={14} size={56}>BUS</ChalkText>
      </Plank>
      <Post x={x + w - 30} top={ground - 500} ground={ground - 380} w={18} />
      <Plank x={x + w / 2} y={ground - 86} w={w - 70} h={26} seed={5} />
    </g>
    <ChalkSmile x={x + 96} y={ground - 262} r={36} sad />
  </g>
);

export const Street = ({ lit = 0, sx = 0, children, extra }: { lit?: number; sx?: number; children?: ReactNode; extra?: ReactNode }) => (
  <g>
    <Buildings sx={sx * 0.35} lit={lit} />
    <g filter="url(#cut)">
      <rect x={-600} y={WALL} width={2400} height={KERB - WALL} fill="#a07a4a" stroke={INK} strokeWidth={6} />
      {Array.from({ length: 16 }, (_, i) => {
        const jx = ((i * 175 + sx) % 2800) - 700;
        return <path key={i} d={`M ${jx} ${WALL + 6} L ${jx - 24} ${KERB - 4}`} stroke="#6a4c28" strokeWidth={4} opacity={0.5} />;
      })}
      <path d={`M -600 ${WALL + 120} L 1800 ${WALL + 120} M -600 ${WALL + 230} L 1800 ${WALL + 230}`} stroke="#6a4c28" strokeWidth={3} opacity={0.35} />
      <rect x={-600} y={KERB} width={2400} height={ROAD - KERB} fill="#c19a5c" stroke={INK} strokeWidth={6} />
      <rect x={-600} y={ROAD} width={2400} height={600} fill="#5b4129" />
    </g>
    <Chalk w={7} op={0.85}>
      <path d={`M -600 ${KERB + 4} L 1800 ${KERB + 4}`} />
      <path d={Array.from({ length: 14 }, (_, i) => `M ${(i * 220 + sx * 1.0) % 3000 - 700} 1720 l 110 0`).join(' ')} />
    </Chalk>
    {extra}
    {children}
  </g>
);

/* ---------- the torn man ---------- */

type ManOpts = { id: string; x: number; y: number; s: number; sf: number; look?: Pt; lids?: readonly [number, number]; tapes?: readonly number[]; rot?: number; dir?: 1 | -1; headTilt?: number; extra?: Partial<PersonProps> };

export const LyingMan = ({ id, x, y, s, sf, look = [0, 0.1], lids = [0.55, 0.5], tapes, rot = -90, dir = 1, headTilt, extra }: ManOpts) => (
  <Person
    id={id}
    x={x}
    y={y}
    s={s}
    dir={dir}
    rot={rot}
    sq={0.012 * Math.sin(sf * 0.3)}
    {...MAN}
    ph={0}
    headTilt={headTilt ?? (rot < 0 ? 90 : -90)}
    lids={lids}
    look={look}
    mouth="none"
    tear
    tapes={tapes}
    legF={[26, -6]}
    legB={[-30, 0]}
    armF={[110, -190]}
    armB={[-100, -200]}
    {...extra}
  />
);

/* ---------- shots ---------- */

export const Hook = ({ f }: { f: number }) => {
  const sf = stepF(f);
  const k = 1 + 0.07 * ease(f / 60);
  const open = ease((sf - BEATS.eyeOpens) / 26);
  const pass1 = sf - BEATS.legsPassOne;
  const pass2 = sf - BEATS.legsPassTwo;
  const x1 = -260 + 1650 * clamp01(pass1 / 22);
  const x2 = -260 + 1650 * clamp01(pass2 / 20);
  const lookX = 0.7 - 1.2 * clamp01((sf - 14) / 30);
  const ox = 1160;
  const oy = 1352;
  const vp = 980;
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
      <Chalk w={8} op={0.8}>
        <path d={`M -600 ${vp + 154} L 1800 ${vp + 154}`} />
      </Chalk>
      <GroundShadow x={ox - 380} y={1478} w={560} o={0.34} />
      <LyingMan id="m" x={ox} y={oy} s={1.75} sf={sf} look={[lookX, 0.15]} lids={[0.98, lerp(0.98, 0.3, open)]} />
      {pass1 > -2 && pass1 < 30 ? <TrouserLegs x={x1} y={1562} s={2.3} ph={pass1 * 0.55} stride={110} lift={70} col={P1.col} /> : null}
      {pass2 > -2 && pass2 < 30 ? <TrouserLegs x={x2} y={1580} s={2.4} ph={pass2 * 0.62} stride={120} lift={80} col={P2.col} /> : null}
    </Cam>
  );
};

export const WalkBy = ({ f }: { f: number }) => {
  const sf = stepF(f) - BEATS.cutStreet;
  const k = 1 + 0.1 * ease((f - BEATS.cutStreet) / 90);
  const px = 70 + 1100 * (sf / 90);
  const py = 1334 + 92 * bell(px, 640, 170);
  const stride = 58 + 28 * bell(px, 640, 210);
  const ph = sf * 0.3;
  const sq = 0.05 * Math.pow(Math.abs(Math.sin(ph)), 6);
  const mx = 770;
  const my = 1297;
  return (
    <Cam fx={620} fy={1180} k={k}>
      <Street lit={0.1} extra={<><Lamp x={960} ground={1410} lit={0} /><BusStop x={40} ground={1405} /></>} />
      <GroundShadow x={mx - 150} y={1342} w={190} />
      <LyingMan id="m" x={mx} y={my} s={0.62} sf={stepF(f)} look={[clamp01(Math.abs(px - 500) / 500) * Math.sign(px - 500) * 0.8, 0.25]} lids={[0.5, 0.55]} />
      <GroundShadow x={px} y={py} w={110} />
      <Person
        id="p1"
        x={px}
        y={py}
        s={0.95}
        {...P1}
        hat="beanie"
        ph={ph}
        stride={stride}
        lift={34}
        sq={sq}
        headTilt={8}
        lids={[0.55, 0.55]}
        look={[0.15, 0.95]}
        mouth="line"
        armF={[62, -368]}
        hands={({ f: hf }) => <Phone at={[hf[0] + 12, hf[1] - 16]} />}
      />
    </Cam>
  );
};

export const Rush = ({ f }: { f: number }) => {
  const fl = f - BEATS.cutRush;
  const sf = stepF(f) - BEATS.cutRush;
  const k = 1.1 + 0.08 * ease(fl / 90);
  const px = 1320 - 1560 * (sf / 90);
  const py = 1318 - 70 * bell(px, 650, 200);
  const stride = 82;
  const ph = sf * 0.33;
  const sq = 0.06 * Math.pow(Math.abs(Math.sin(ph)), 6);
  const raise = ease((sf - 12) / 6) * (1 - ease((sf - 44) / 6));
  const sw: Pt = [12 + 38 * Math.sin(ph + Math.PI), -200];
  const armF = lerpPt(sw, [50, -396], raise);
  const look: Pt = sf < 14 ? [-0.7, 0.1] : sf < 26 ? [-0.3, 0.95] : sf < 42 ? [-0.95, 0.85] : [-0.8, 0.1];
  const mx = 770;
  const my = 1297;
  return (
    <Cam fx={620} fy={1180} k={k} tx={-80 * ease(fl / 90)}>
      <Street lit={0.1} extra={<><Lamp x={960} ground={1410} lit={0} /><BusStop x={40} ground={1405} /></>} />
      <GroundShadow x={px} y={py + 4} w={120} />
      <Person
        id="p2"
        x={px}
        y={py}
        s={0.98}
        dir={-1}
        rot={-7}
        {...P2}
        tie
        ph={ph}
        stride={stride}
        lift={46}
        sq={sq}
        headTilt={sf < 14 ? 0 : 7}
        lids={[0.42, 0.42]}
        look={look}
        mouth="line"
        armF={armF}
        hands={({ f: hf, b }) => (
          <g>
            <Cup at={[b[0] + 6, b[1] - 6]} steam={6 + 6 * Math.sin(sf * 0.9)} />
            {raise > 0.3 ? <Watch at={[hf[0] + 2, hf[1] + 4]} /> : null}
          </g>
        )}
      />
      <GroundShadow x={mx - 150} y={1342} w={190} />
      <LyingMan id="m" x={mx} y={my} s={0.62} sf={stepF(f)} look={[px < 700 ? -0.4 : 0.6, 0.3]} lids={[0.5, 0.55]} />
    </Cam>
  );
};

const SignScene = ({ f }: { f: number }) => {
  const fl = f - BEATS.whipStart;
  const sf = stepF(f) - BEATS.whipStart;
  const k = 1 + 0.06 * ease(fl / 60);
  const hx = -140 + 11.5 * sf;
  const ph = sf * 0.27;
  const sq = 0.05 * Math.pow(Math.abs(Math.sin(ph)), 6);
  const react = (i: number) => ease((f - BEATS.sideEyes - i * 3) / 6);
  const crowd = [
    { id: 'c1', x: 700, y: 1392, s: 0.95, c: P1, hat: 'beanie' as const },
    { id: 'c2', x: 812, y: 1410, s: 0.97, c: P2, hat: 'none' as const },
    { id: 'c3', x: 926, y: 1388, s: 0.93, c: X1, hat: 'none' as const },
    { id: 'c4', x: 1030, y: 1412, s: 0.98, c: X2, hat: 'none' as const },
  ];
  return (
    <Cam fx={600} fy={1180} k={k}>
      <Street lit={0.15} extra={<BusStop x={650} ground={1400} w={420} />}>
        <g>
          <g filter="url(#cut)">
            <Post x={400} top={700} ground={1405} w={42} />
            <Plank x={400} y={760} w={520} h={190} point={-1} seed={9} rot={-1.5}>
              <ChalkText x={8} y={-8} size={66}>THAT SIDE</ChalkText>
              <ChalkText x={8} y={64} size={66}>OF TOWN</ChalkText>
            </Plank>
          </g>
          <Chalk w={6}>
            <path d="M 200 880 l -60 0 m 22 -18 l -22 18 l 22 18" />
          </Chalk>
        </g>
      </Street>
      {crowd.map((p, i) => {
        const r = react(i);
        return (
          <g key={p.id}>
            <GroundShadow x={p.x} y={p.y} w={100} />
            <Person
              id={p.id}
              x={p.x}
              y={p.y}
              s={p.s}
              dir={-1}
              {...p.c}
              hat={p.hat}
              sq={0.012 * Math.sin(stepF(f) * 0.25 + i)}
              headTilt={lerp(0, -9, r)}
              lids={[0.5, 0.5]}
              look={[lerp(0.1, -0.95, r), lerp(0.2, 0.1, r)]}
              mouth="line"
              armF={i === 0 ? [58, -372] : i === 1 ? [48, -250] : undefined}
              hands={i === 0 ? ({ f: hf }) => <Phone at={[hf[0] + 12, hf[1] - 16]} /> : i === 1 ? ({ f: hf }) => <Cup at={[hf[0] + 4, hf[1] - 6]} steam={6} /> : undefined}
            />
          </g>
        );
      })}
      <GroundShadow x={hx} y={1396} w={110} />
      <Person id="h" x={hx} y={1396} s={1.0} {...HELP} hat="cap" ph={ph} stride={60} lift={34} sq={sq} headTilt={3} lids={[0.45, 0.45]} look={[0.2, 0.05]} mouth="line" />
    </Cam>
  );
};

const Stop = ({ f }: { f: number }) => {
  const frozen = f < BEATS.freezeEnd;
  const sfRaw = stepF(f);
  const sf = frozen ? BEATS.freezeStart : sfRaw;
  const fl = f - BEATS.hit;
  const punch = 0.09 * Math.exp(-fl / 6);
  const k = 1.0 + 0.08 * ease(fl / 60) + punch;
  const settle = ease((f - BEATS.freezeEnd) / 10);
  const walkIn = ease((f - 334) / 24);
  const hx = 290 + 250 * walkIn;
  const walking = f >= 334;
  const ph = frozen ? 1.7 : walking ? (sf - 334) * 0.27 + 1.7 : 1.7;
  const stride = frozen ? 60 : walking ? 56 * ease((f - 334) / 6) : 60 * (1 - settle);
  const lift = frozen ? 34 : walking ? 28 : 34 * (1 - settle);
  const chest = ease((f - 322) / 8) * (1 - ease((f - 340) / 8));
  const swing: Pt = [12 + 38 * Math.sin(ph + Math.PI) * (stride / 60), -200];
  const armF = lerpPt(swing, [36, -296], chest);
  const soft = f >= BEATS.freezeEnd;
  const mx = 1010;
  const my = 1327;
  const burst = f < BEATS.freezeEnd;
  const hy = 1390;
  return (
    <Cam fx={640} fy={1180} k={k}>
      <Street lit={0.1} extra={<Lamp x={960} ground={1410} lit={0} />} />
      <GroundShadow x={mx - 190} y={hy + 6} w={240} />
      <LyingMan id="m" x={mx} y={my} s={0.9} sf={sfRaw} look={[-0.9, 0.2]} lids={[soft ? 0.25 : 0.5, soft ? 0.2 : 0.5]} />
      <GroundShadow x={hx} y={hy} w={110} />
      <Person
        id="h"
        x={hx}
        y={hy}
        s={1.0}
        {...HELP}
        hat="cap"
        ph={ph}
        stride={stride}
        lift={lift}
        sq={frozen ? 0.05 : 0.01 * Math.sin(sfRaw * 0.25)}
        headTilt={soft ? 6 : 0}
        lids={soft ? [0.3, 0.3] : [0.45, 0.45]}
        lidCurve={soft ? -6 : 7}
        brow={soft ? -1 : 0}
        look={soft ? [0.85, 0.55] : [0.9, 0.25]}
        mouth="line"
        armF={armF}
      />
      {burst ? (
        <Chalk w={9}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (-Math.PI * 0.95 + (i * Math.PI * 0.9) / 8);
            const r0 = 130;
            const r1 = 210 + (i % 2) * 40;
            return <path key={i} d={`M ${hx + 20 + Math.cos(a) * r0} ${hy - 470 + Math.sin(a) * r0} L ${hx + 20 + Math.cos(a) * r1} ${hy - 470 + Math.sin(a) * r1}`} />;
          })}
        </Chalk>
      ) : null}
    </Cam>
  );
};

// The kneeling, the tape and the lift. Man: s, origin (feet) fixed at x 700.
export const SM = 1.05;
export const Mend = ({ f }: { f: number }) => {
  const sf = stepF(f);
  const fl = f - BEATS.cutKneel;
  const k = 1.0 + 0.07 * ease(fl / 90);
  const t = ease((f - BEATS.lift) / 24);
  const tapes = [BEATS.tape1, BEATS.tape2, BEATS.tape3, BEATS.tape4, BEATS.tape5].map((b) => clamp01((sf - b) / 6));
  const lastPop = [BEATS.tape1, BEATS.tape2, BEATS.tape3, BEATS.tape4, BEATS.tape5].filter((b) => sf >= b).pop() ?? -99;
  const tap = Math.exp(-(sf - lastPop) / 3) * (sf >= BEATS.tape1 ? 1 : 0);
  // Man: lying head left, then he pivots about his feet to lean on the helper.
  const mRot = lerp(-90, 12, t);
  const mx = 700;
  const my = lerp(1312, 1385, t);
  const mHead = lerp(90, 24, t);
  // Helper: kneels behind him, then stands facing left (hands over to the walk off).
  const hx = lerp(590, 905, t);
  const hy = lerp(1296, 1385, t);
  const hip = lerp(98, 160, t);
  const bend = lerp(62, 0, t) + (1 - t) * 3 * tap;
  const hs = SM;
  const tear = fromLocal(mx, my, SM, 1, mRot, [0, -240]);
  const aimLy = toLocal(hx, hy, hs, -1, 0, tear[0] + 4, tear[1] - 66 + 16 * tap * (1 - t));
  const shoulderW: Pt = [hx - 14 * hs, hy - 322 * hs];
  const manHand = toLocal(mx, my, SM, 1, mRot, shoulderW[0], shoulderW[1] + 8);
  const manHandLying: Pt = [30, -170];
  const armFman = lerpPt(manHandLying, manHand, t);
  const helperHandF = lerpPt(aimLy, toLocal(hx, hy, hs, -1, 0, mx + 130, hy - 300 * hs), t);
  const kneelLegF: Pt = [96, 0];
  const kneelLegB: Pt = [-108, -10];
  const standF: Pt = [14, 0];
  const standB: Pt = [-14, 0];
  return (
    <Cam fx={640} fy={1180} k={k}>
      <Street lit={0.12} extra={<Lamp x={990} ground={1410} lit={0} />} />
      <GroundShadow x={hx} y={hy} w={130} o={0.24} />
      <Person
        id="h"
        x={hx}
        y={hy}
        s={hs}
        dir={-1}
        {...HELP}
        hat="cap"
        hip={hip}
        bend={bend}
        legF={lerpPt(kneelLegF, standF, t)}
        legB={lerpPt(kneelLegB, standB, t)}
        armF={helperHandF}
        armB={lerpPt(aimLy, [-20, -200], t)}
        headTilt={lerp(-26, 4, t)}
        lids={[0.3, 0.3]}
        lidCurve={-6}
        brow={-1}
        look={[-0.7, 0.6]}
        mouth="line"
      />
      <GroundShadow x={mx - 160 * (1 - t)} y={1388} w={lerp(260, 120, t)} />
      <LyingMan
        id="m"
        x={mx}
        y={my}
        s={SM}
        sf={sf}
        rot={mRot}
        headTilt={mHead}
        look={[lerp(-0.4, 0.5, t), lerp(0.7, 0.4, t)]}
        lids={[lerp(0.3, 0.45, t), lerp(0.28, 0.45, t)]}
        tapes={tapes}
        extra={{ legF: lerpPt([26, -6], [16, -4], t), legB: lerpPt([-30, 0], [-26, 0], t), armF: armFman, armB: lerpPt([-60, -250], [-30, -150], t) }}
      />
    </Cam>
  );
};

export const WalkOff = ({ f }: { f: number }) => {
  const fl = f - BEATS.walkOff;
  const sf = stepF(f) - BEATS.walkOff;
  const e = ease(fl / 60);
  const k = 1.0 + 0.04 * ease(fl / 60) + 0.05 * Math.exp(-fl / 5);
  const hs = lerp(SM, 0.62, e);
  const hx = lerp(905, 1340, Math.pow(e, 2.2));
  const hy = lerp(1385, 1290, e);
  const ph = sf * 0.27;
  const sq = 0.05 * Math.pow(Math.abs(Math.sin(ph)), 6);
  const mx = hx - 205 * hs;
  const my = hy + 2;
  const shoulderW: Pt = [hx - 14 * hs, hy - 322 * hs];
  const manHand = toLocal(mx, my, hs, 1, 12, shoulderW[0], shoulderW[1] + 8);
  const hold = toLocal(hx, hy, hs, 1, 0, mx + 150 * hs, hy - 250 * hs);
  const lit = ease(fl / 50);
  return (
    <Cam fx={720} fy={1180} k={k}>
      <Street lit={0.12 + 0.88 * lit} sx={-fl * 1.6} extra={<Lamp x={990} ground={1410} lit={lit} />} />
      <GroundShadow x={hx - 90 * hs} y={hy + 4} w={230 * hs} />
      <Person
        id="h"
        x={hx}
        y={hy}
        s={hs}
        dir={1}
        {...HELP}
        hat="cap"
        ph={ph}
        stride={46}
        lift={26}
        sq={sq}
        headTilt={-4}
        lids={[0.34, 0.34]}
        lidCurve={-6}
        brow={-0.6}
        look={[-0.6, 0.35]}
        mouth="smile"
        armF={hold}
        armB={undefined}
      />
      <Person
        id="m"
        x={mx}
        y={my}
        s={hs}
        {...MAN}
        rot={12}
        ph={ph + 0.9}
        stride={22}
        lift={9}
        sq={sq * 0.6}
        headTilt={lerp(18, 8, e)}
        lids={[0.45, 0.45]}
        look={[0.5, 0.5]}
        mouth="none"
        tear
        tapes={[1, 1, 1, 1, 1]}
        armF={manHand}
        armB={[-30, -170]}
      />
    </Cam>
  );
};

const Card = ({ f }: { f: number }) => {
  const sf = stepF(f);
  const wob = Math.sin(sf * 0.6) * 0.8;
  const pop = ease((f - 552) / 8);
  return (
    <g>
      <g filter="url(#cut)" transform={`rotate(${wob} 190 1500)`}>
        <Post x={190} top={1180} ground={1500} w={44} />
        <Plank x={200} y={1230} w={340} h={150} point={1} seed={12} rot={-2}>
          <ChalkText x={-18} y={34} size={104}>go</ChalkText>
          <ChalkArrow x={52} y={4} len={80} />
        </Plank>
        {f >= 530 ? (
          <Plank x={168} y={1376} w={250} h={120} point={-1} seed={13} rot={2}>
            <g />
          </Plank>
        ) : null}
      </g>
      {f >= 530 ? <ChalkSmile x={186} y={1376} r={38} /> : null}
      {pop > 0 ? (
        <Chalk w={7}>
          <path d={`M 340 1190 q 20 -16 40 0 M 380 1160 q 18 -14 36 0`} opacity={pop} />
        </Chalk>
      ) : null}
    </g>
  );
};

/* ---------- composition ---------- */

const Shot = ({ f, appCut }: { f: number; appCut: boolean }) => {
  if (f < BEATS.cutStreet) return <Hook f={f} />;
  if (f < BEATS.cutRush) return <WalkBy f={f} />;
  if (f < BEATS.whipStart) return <Rush f={f} />;
  if (f < BEATS.whipLand) {
    const p = ease((f - BEATS.whipStart) / (BEATS.whipLand - BEATS.whipStart));
    return (
      <g>
        <g transform={`translate(${-p * 1300} 0)`} filter="url(#whip)">
          <Rush f={BEATS.whipStart - 1} />
        </g>
        <g transform={`translate(${(1 - p) * 1300} 0)`} filter="url(#whip)">
          <SignScene f={f} />
        </g>
      </g>
    );
  }
  if (f < BEATS.hit) return <SignScene f={f} />;
  if (f < BEATS.cutKneel) return <Stop f={f} />;
  if (f < BEATS.walkOff) return <Mend f={f} />;
  if (f < BEATS.endCard) return <WalkOff f={f} />;
  return appCut ? <WalkOff f={BEATS.endCard - 1} /> : <Card f={f} />;
};

export const WhoStopped = (props: WhoStoppedProps) => {
  const f = useCurrentFrame();
  const warm = ease((f - BEATS.warmStart) / 60);
  const vig = 1 - 0.55 * warm;
  const whipP = ease((f - BEATS.whipStart) / (BEATS.whipLand - BEATS.whipStart));
  const whipSd = f >= BEATS.whipStart && f < BEATS.whipLand ? 70 * Math.sin(Math.PI * whipP) + 4 : 0;
  const cardFade = interpolate(f, [BEATS.endCard - 1, BEATS.endCard + 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1a10' }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <PaperDefs boil={boilSeed(f)} whip={whipSd} />
        <Parchment f={f} warm={warm} />
        <Shot f={f} appCut={!!props.appCut} />
        {!props.appCut && f >= BEATS.endCard && f < BEATS.endCard + 7 ? (
          <g opacity={cardFade}>
            <WalkOff f={BEATS.endCard - 1} />
          </g>
        ) : null}
        <Burn vig={vig} warm={warm} />
      </svg>
      {props.appCut ? null : CAPTIONS.map((cap) => <Caption key={`${cap.from}-${cap.text}`} cap={cap} f={f} subFrom={BEATS.retelling} />)}
      {props.bedAudio ? <Audio src={staticFile(props.bedAudio)} /> : null}
    </AbsoluteFill>
  );
};
