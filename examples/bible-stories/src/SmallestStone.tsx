import { Audio } from '@remotion/media';
import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { mulish } from './brand';
import {
  Arm, BEAT, DK, Ell, Film, FILM_H, FILM_W, Hose, INK, LT, MID, PAPER, PieEye, Puffs, SepiaDefs, Shape, SKIN, SpeedLines, SpiralEye, Star, WHITE,
  bnc, boing, clamp, smooth, stepT, weave,
} from './bible-story/rubber';
import { rng } from './bible-story/world';

// Bible story short S5, The smallest stone (a retelling of 1 Samuel 17).
// Style test B: a 1930 rubber-hose cartoon, ported from the huashu 33_rubberhose
// recipe. 20 s at 30 fps. Characters step on twos (12 fps) and bounce on a
// 128 BPM beat; the film layer runs at 24 fps. Everything is flattened to
// sepia newsprint after the characters are drawn.
//
// Beats (frames): 0 to 45 hook, the boot slams at 14 | 45 Goliath towers, David
// at his feet | 150 David close, the speech card | 255 five stones, one per
// half beat | 300 sling wind-up | 345 release, then a 15 frame stop-down |
// 360 BONK | 390 he topples, dust fills the frame at 420 | 450 dust clears,
// David on the helmet, the 1 Samuel 17:47 card.
// appCut: the in-app cut, with no captions and no verse card text.
export type SmallestStoneProps = { durationSeconds: number; bedAudio?: string; appCut?: boolean };
export const defaultSmallestStoneProps: SmallestStoneProps = { durationSeconds: 20, bedAudio: '', appCut: false };

export const BEATS = {
  bootSlam: 14,
  shakeEnd: 20,
  cutGoliath: 45,
  captionBoy: 98,
  cutDavid: 150,
  speechSword: 164,
  speechSpear: 178,
  speechJavelin: 192,
  speechLord: 232,
  cutStones: 255,
  stone1: 255,
  stone2: 262,
  stone3: 269,
  stone4: 276,
  stone5: 283,
  windup: 300,
  release: 345,
  freezeStart: 345,
  freezeEnd: 360,
  bonk: 360,
  spirals: 366,
  cutTimber: 390,
  fall: 391,
  dust: 420,
  dustClear: 432,
  endCard: 450,
  verse: 464,
  retelling: 500,
} as const;

const fredoka = loadFredoka('normal', { weights: ['600'], subsets: ['latin'] });
const CREAM = '#fff4d8';
const GOLD = '#ffd04a';
const GROUND = 1500;

const span = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const back = (t: number) => 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2);
const decay = (f: number, a: number, k: number) => (f >= a ? Math.exp(-(f - a) / k) : 0);

type Cap = { from: number; to: number; text: string; y: number; size?: number; gold?: boolean; cite?: string; sub?: string };

const CAPTIONS: Cap[] = [
  { from: 0, to: 45, text: 'Over nine feet', y: 500, size: 128 },
  { from: 14, to: 45, text: 'tall.', y: 700, size: 190, gold: true },
  { from: 49, to: 150, text: 'And the only one', y: 880, size: 94 },
  { from: 70, to: 150, text: 'who stepped up', y: 1000, size: 94 },
  { from: 98, to: 150, text: 'was a shepherd boy.', y: 1124, size: 94, gold: true },
  { from: 150, to: 197, text: 'You come to me', y: 400, size: 120 },
  { from: 164, to: 197, text: 'with a sword,', y: 540, size: 120 },
  { from: 178, to: 197, text: 'with a spear,', y: 680, size: 120 },
  { from: 192, to: 226, text: 'and with a\njavelin;', y: 440, size: 140 },
  { from: 206, to: 226, text: 'but I come to you', y: 760, size: 104 },
  { from: 226, to: 255, text: 'in the name of', y: 380, size: 112 },
  { from: 232, to: 255, text: 'the LORD', y: 560, size: 190, gold: true },
  { from: 242, to: 255, text: 'of Armies,', y: 730, size: 130, cite: '1 Samuel 17:45' },
  { from: 464, to: 600, text: 'for the battle\nis the LORD’s', y: 420, size: 108, gold: false, cite: '1 Samuel 17:47, WEBCE', sub: 'A retelling of 1 Samuel 17' },
];

const ring = (r: number) =>
  `${Array.from({ length: 16 }, (_, i) => `${(Math.cos((i / 16) * Math.PI * 2) * r).toFixed(1)}px ${(Math.sin((i / 16) * Math.PI * 2) * r).toFixed(1)}px 0 ${INK}`).join(',')},0 ${(r + 5).toFixed(1)}px 0 ${INK}`;

const Caption = ({ cap, f }: { cap: Cap; f: number }) => {
  if (f < cap.from || f >= cap.to) return null;
  const a = f - cap.from;
  const pop = interpolate(a, [0, 3, 6], [cap.from === 0 ? 0.86 : 0.62, 1.13, 1], { extrapolateRight: 'clamp' });
  const tilt = ((cap.from * 7) % 5) - 2;
  const out = interpolate(f, [cap.to - 2, cap.to], [1, 0], { extrapolateLeft: 'clamp' });
  const size = cap.size ?? 100;
  const lines = cap.text.split('\n').length;
  return (
    <div style={{ position: 'absolute', top: cap.y - size * 0.62, left: 40, right: 40, textAlign: 'center', opacity: out }}>
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${pop}) rotate(${tilt * Math.max(0, 1 - a / 14)}deg)`,
          fontFamily: fredoka.fontFamily,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.06,
          whiteSpace: 'pre',
          color: cap.gold ? GOLD : CREAM,
          textShadow: ring(Math.max(5, size * 0.06)),
        }}
      >
        {cap.text}
      </div>
      {cap.cite ? (
        <div style={{ marginTop: lines > 1 ? 26 : 12, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 42, letterSpacing: '0.12em', color: CREAM, textShadow: ring(4) }}>{cap.cite.toUpperCase()}</div>
      ) : null}
      {cap.sub ? (
        <div style={{ marginTop: 14, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 38, color: CREAM, textShadow: ring(3.5) }}>{cap.sub}</div>
      ) : null}
    </div>
  );
};

/* ---------- set ---------- */

const SunFace = ({ x, y, k, tq }: { x: number; y: number; k: number; tq: number }) => {
  const b = bnc(tq, 0);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <g transform={`rotate(${((tq * 1.6) / Math.PI) * 180})`}>
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 30})`}>
            <Shape d={`M -12 -66 L 0 ${-108 - (i % 2) * 16} L 12 -66 Z`} fill={WHITE} w={4} />
          </g>
        ))}
      </g>
      <g transform={boing(0, 58, b, 8)}>
        <Ell x={0} y={0} rx={60} ry={60} fill={WHITE} w={5} />
        <PieEye x={-20} y={-10} rx={11} ry={16} look={-0.4} />
        <PieEye x={16} y={-10} rx={11} ry={16} look={-0.4} />
        <path d="M -28 12 A 26 26 0 0 0 24 12" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <circle cx={-36} cy={14} r={9} fill={MID} />
        <circle cx={32} cy={14} r={9} fill={MID} />
      </g>
    </g>
  );
};

const Cloud = ({ x, y, k, b }: { x: number; y: number; k: number; b: number }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <g transform={boing(0, 30, b, 10)}>
      <Shape d={smooth([[-60, 30], [-70, 6], [-40, -18], [-6, -30], [30, -22], [62, -4], [66, 26]])} fill={WHITE} w={5} />
    </g>
  </g>
);

const Tent = ({ x, y, s, b }: { x: number; y: number; s: number; b: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g transform={boing(0, 0, b, 12)}>
      <path d="M 0 -80 L 0 -116" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <Shape d="M 0 -116 L 30 -106 L 0 -96 Z" fill={DK} w={3} />
      <Shape d="M -52 0 L 0 -82 L 52 0 Z" fill={WHITE} w={5} />
      <Shape d="M -15 0 L 0 -40 L 15 0 Z" fill={DK} w={4} />
    </g>
  </g>
);

const Bush = ({ x, y, s, b }: { x: number; y: number; s: number; b: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g transform={boing(0, 0, b, 10)}>
      <Shape d={smooth([[-70, 0], [-78, -36], [-46, -66], [-8, -58], [24, -80], [66, -50], [76, -10], [60, 0]])} fill={MID} w={6} />
      <path d="M -30 -20 Q -10 -40 10 -22 M 20 -30 Q 38 -44 52 -26" fill="none" stroke={DK} strokeWidth={5} strokeLinecap="round" />
    </g>
  </g>
);

const SetPiece = ({ tq, h, z = 1, sun = [880, 400] }: { tq: number; h: number; z?: number; sun?: number[] }) => {
  const rays = Array.from({ length: 7 }, (_, i) => {
    const a0 = tq * 1.6 + (i * 2 * Math.PI) / 7;
    const a1 = a0 + Math.PI / 7;
    const R = 2800;
    return `M ${sun[0]} ${sun[1]} L ${(sun[0] + Math.cos(a0) * R).toFixed(0)} ${(sun[1] + Math.sin(a0) * R).toFixed(0)} L ${(sun[0] + Math.cos(a1) * R).toFixed(0)} ${(sun[1] + Math.sin(a1) * R).toFixed(0)} Z`;
  });
  const hillL = smooth([[-140, h + 70], [-140, h - 110 * z], [90, h - 168 * z], [300, h - 150 * z], [470, h - 84 * z], [610, h + 70]]);
  const hillR = smooth([[1220, h + 70], [1220, h - 100 * z], [1010, h - 172 * z], [820, h - 142 * z], [650, h - 64 * z], [510, h + 70]]);
  const rows = Array.from({ length: 12 }, (_, i) => h + 18 + Math.pow(i + 1, 1.55) * 30);
  const sy = Math.max(0.5, z);
  return (
    <g>
      <rect x={-60} y={-60} width={FILM_W + 120} height={FILM_H + 120} fill={PAPER} />
      {rays.map((d, i) => (
        <path key={i} d={d} fill="#e4dac0" opacity={0.8} />
      ))}
      <SunFace x={sun[0]} y={sun[1]} k={1.15} tq={tq} />
      <Cloud x={((180 + tq * 24) % 1500) - 200} y={300} k={1.5} b={bnc(tq, 0.1)} />
      <Cloud x={((760 + tq * 18) % 1500) - 200} y={190} k={1.2} b={bnc(tq, 0.6)} />
      <Shape d={hillL} fill={LT} w={7} />
      <Shape d={hillR} fill={LT} w={7} />
      {[[110, -150], [270, -138], [410, -90]].map(([x, dy], i) => (
        <Tent key={`l${i}`} x={x} y={h + dy * z + 6} s={0.95 * sy} b={bnc(tq, 0.2 + i * 0.25)} />
      ))}
      {[[990, -150], [860, -122], [720, -74]].map(([x, dy], i) => (
        <Tent key={`r${i}`} x={x} y={h + dy * z + 6} s={0.95 * sy} b={bnc(tq, 0.45 + i * 0.25)} />
      ))}
      <rect x={-60} y={h} width={FILM_W + 120} height={FILM_H + 200} fill="#d6cdb2" />
      {rows.map((y, i) => {
        const gap = 150 + i * 42;
        const off = (i % 2) * gap * 0.5;
        const nextY = rows[i + 1] ?? y + 160;
        return (
          <g key={i} stroke="#8a816c" strokeWidth={3} opacity={0.55}>
            <line x1={-60} y1={y} x2={FILM_W + 60} y2={y} />
            {Array.from({ length: Math.ceil(1200 / gap) + 1 }, (_, k) => (
              <line key={k} x1={off + k * gap - 60} y1={y} x2={off + k * gap - 60} y2={nextY} />
            ))}
          </g>
        );
      })}
      <rect x={-60} y={h} width={FILM_W + 120} height={18} fill={DK} />
      <path d={`M -60 ${h} L ${FILM_W + 60} ${h} M -60 ${h + 18} L ${FILM_W + 60} ${h + 18}`} stroke={INK} strokeWidth={5} />
      <Bush x={90} y={h + 150} s={1.1 * sy} b={bnc(tq, 0.35)} />
      <Bush x={990} y={h + 230} s={1.3 * sy} b={bnc(tq, 0.85)} />
    </g>
  );
};

/* ---------- David ---------- */

type DavidProps = {
  x: number; y: number; s: number; tq: number; ph?: number; amp?: number; rate?: number;
  look?: number; lookY?: number; tilt?: number; mouth?: number; shut?: boolean;
  hL?: number[]; hR?: number[]; bL?: number; bR?: number; stones?: number; drop?: number;
  sling?: { end: number[]; ring?: { rx: number; ry: number; a: number; trail: number } };
};

const David = ({ x, y, s, tq, ph = 0.25, amp = 20, rate = 1, look = 0, lookY = 0, tilt = 0, mouth = 0, shut = false, hL = [-96, -112], hR = [96, -112], bL = 26, bR = -26, stones = 0, drop = 1, sling }: DavidProps) => {
  const b = bnc(tq * rate, ph);
  const stoneAt = [[50, -138], [68, -144], [86, -138], [100, -132], [76, -152]];
  const mo = mouth;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={96 - b * 16} ry={14} fill={INK} opacity={0.22} />
      <g transform={boing(0, 0, b, amp / s)}>
        <Hose a={[-22, -96]} b={[-36, -14]} bend={10} w={22} col={SKIN} />
        <Hose a={[22, -96]} b={[36, -14]} bend={-10} w={22} col={SKIN} />
        {[-1, 1].map((sg) => (
          <g key={sg}>
            <Shape d={smooth([[sg * 80, -10], [sg * 76, -30], [sg * 46, -38], [sg * 18, -28], [sg * 14, -8], [sg * 30, 5], [sg * 70, 5]])} fill={INK} w={4} />
            <path d={`M ${sg * 68} -26 Q ${sg * 52} -34 ${sg * 36} -28`} fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" />
          </g>
        ))}
        <Shape d="M -58 -192 L 58 -192 Q 84 -130 88 -66 L 66 -48 L 46 -68 L 26 -46 L 6 -68 L -14 -46 L -34 -68 L -54 -48 L -88 -66 Q -84 -130 -58 -192 Z" fill={LT} w={6} />
        <path d="M -78 -130 Q 0 -112 78 -130" fill="none" stroke={INK} strokeWidth={26} strokeLinecap="round" />
        <path d="M -78 -130 Q 0 -112 78 -130" fill="none" stroke={DK} strokeWidth={14} strokeLinecap="round" />
        {stones > 0
          ? Array.from({ length: Math.min(stones, 5) }, (_, i) => {
              const isLast = i === stones - 1;
              const dy = isLast ? -Math.pow(1 - drop, 2) * 190 : 0;
              const sc = isLast ? 1 + (1 - drop) * 0.5 : 1;
              return <Ell key={i} x={stoneAt[i][0]} y={stoneAt[i][1] + dy} rx={13 * sc} ry={10.5 * sc} fill={i % 2 ? LT : MID} w={4} rot={i * 30} />;
            })
          : null}
        <path d="M -52 -188 L 64 -106" fill="none" stroke={INK} strokeWidth={24} strokeLinecap="round" />
        <path d="M -52 -188 L 64 -106" fill="none" stroke={DK} strokeWidth={12} strokeLinecap="round" />
        <Shape d={smooth([[38, -128], [100, -126], [114, -78], [98, -46], [42, -46], [28, -80]])} fill={DK} w={6} />
        <path d="M 40 -118 Q 70 -100 104 -118" fill="none" stroke={INK} strokeWidth={5} />
        <circle cx={72} cy={-104} r={7} fill={LT} stroke={INK} strokeWidth={3} />
        <Ell x={0} y={-192} rx={24} ry={16} fill={SKIN} w={5} />
        <g transform={`rotate(${tilt} 0 -192)`}>
          <Ell x={-90} y={-262} rx={19} ry={25} fill={SKIN} w={5} />
          <Ell x={90} y={-262} rx={19} ry={25} fill={SKIN} w={5} />
          <Ell x={0} y={-268} rx={91} ry={87} fill={SKIN} w={6} />
          <circle cx={-60} cy={-232} r={15} fill={MID} opacity={0.4} />
          <circle cx={60} cy={-232} r={15} fill={MID} opacity={0.4} />
          <path d="M 0 -352 C -4 -392 28 -404 38 -384 C 44 -368 20 -366 24 -380" fill="none" stroke={INK} strokeWidth={24} strokeLinecap="round" />
          <path d="M 0 -352 C -4 -392 28 -404 38 -384 C 44 -368 20 -366 24 -380" fill="none" stroke={DK} strokeWidth={12} strokeLinecap="round" />
          <Shape d="M -90 -272 C -98 -342 -52 -366 0 -362 C 52 -366 98 -342 90 -272 C 80 -298 72 -302 62 -294 C 54 -316 42 -318 32 -302 C 22 -322 6 -322 -2 -304 C -14 -322 -34 -320 -40 -300 C -52 -316 -68 -312 -72 -294 C -80 -300 -86 -294 -90 -272 Z" fill={DK} w={6} />
          <path d="M -58 -338 Q -30 -356 0 -352" fill="none" stroke={WHITE} strokeWidth={9} strokeLinecap="round" opacity={0.85} />
          <PieEye x={-31} y={-264} rx={23} ry={31} look={look} lookY={lookY} shut={shut} />
          <PieEye x={31} y={-264} rx={23} ry={31} look={look} lookY={lookY} shut={shut} />
          <path d="M -56 -308 Q -32 -322 -8 -306 M 8 -306 Q 32 -322 56 -308" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <Ell x={0} y={-238} rx={11} ry={9} fill={SKIN} w={4} />
          {mo < 0.15 ? (
            <path d="M -26 -214 Q 0 -196 26 -214" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          ) : (
            <g>
              <path d={`M -32 -216 Q 0 -204 32 -216 Q 26 ${-216 + 44 * mo} 0 ${-216 + 50 * mo} Q -26 ${-216 + 44 * mo} -32 -216 Z`} fill={INK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
              <path d={`M -16 -211 L 16 -211 L 14 ${-211 + 11 * mo} L -14 ${-211 + 11 * mo} Z`} fill={WHITE} />
              <ellipse cx={0} cy={-216 + 40 * mo} rx={15} ry={Math.max(3, 9 * mo)} fill={MID} />
            </g>
          )}
        </g>
        {sling ? (
          <g>
            {sling.ring ? (
              <g fill="none" stroke={INK} strokeLinecap="round">
                <ellipse cx={hR[0]} cy={hR[1] - 24} rx={sling.ring.rx} ry={sling.ring.ry} strokeWidth={5} strokeDasharray="22 26" opacity={0.45} />
                <path
                  d={Array.from({ length: 12 }, (_, i) => {
                    const an = sling.ring!.a - (i / 11) * sling.ring!.trail;
                    return `${i ? 'L' : 'M'} ${(hR[0] + Math.cos(an) * sling.ring!.rx).toFixed(1)} ${(hR[1] - 24 + Math.sin(an) * sling.ring!.ry).toFixed(1)}`;
                  }).join(' ')}
                  strokeWidth={12}
                  opacity={0.7}
                />
              </g>
            ) : null}
            <path d={`M ${hR[0]} ${hR[1] - 10} L ${sling.end[0]} ${sling.end[1]}`} stroke={INK} strokeWidth={13} strokeLinecap="round" />
            <path d={`M ${hR[0]} ${hR[1] - 10} L ${sling.end[0]} ${sling.end[1]}`} stroke={LT} strokeWidth={5} strokeLinecap="round" />
            <Ell x={sling.end[0]} y={sling.end[1]} rx={32} ry={23} fill={DK} w={5} />
            <Ell x={sling.end[0]} y={sling.end[1] - 4} rx={19} ry={15} fill={LT} w={4} />
          </g>
        ) : null}
        <Arm a={[-58, -172]} b={hL} bend={bL} w={22} gs={0.95} />
        <Arm a={[58, -172]} b={hR} bend={bR} w={22} gs={0.95} />
      </g>
    </g>
  );
};

/* ---------- Goliath ---------- */

type Mood = 'scowl' | 'shock' | 'dizzy';

const Helm = ({ spread = 1, dent = false }: { spread?: number; dent?: boolean }) => (
  <g>
    {[-46, -23, 0, 23, 46].map((a, i) => (
      <g key={i} transform={`rotate(${a * spread} 0 -980)`}>
        <rect x={-24} y={-1128} width={48} height={170} rx={24} fill={i % 2 ? DK : MID} stroke={INK} strokeWidth={6} />
      </g>
    ))}
    <Shape d={smooth([[-168, -790], [-176, -880], [-140, -965], [-70, -1010], [0, -1020], [70, -1010], [140, -965], [176, -880], [168, -790], [110, -838], [0, -862], [-110, -838]])} fill={MID} w={8} />
    <path d="M -122 -950 Q -82 -1000 -20 -1006" fill="none" stroke={WHITE} strokeWidth={14} strokeLinecap="round" opacity={0.85} />
    <Shape d={smooth([[-16, -862], [16, -862], [12, -802], [0, -784], [-12, -802]])} fill={MID} w={6} />
    {[-110, -60, 60, 110].map((x) => (
      <circle key={x} cx={x} cy={Math.abs(x) > 80 ? -846 : -858} r={7} fill={LT} stroke={INK} strokeWidth={3} />
    ))}
    {dent ? (
      <g>
        <Star x={44} y={-905} r={52} fill={LT} w={5} />
        <path d="M 10 -905 L 76 -905 M 44 -940 L 44 -870" stroke={INK} strokeWidth={4} />
      </g>
    ) : null}
  </g>
);

type GolProps = { x: number; y: number; s: number; tq: number; ph?: number; amp?: number; mood?: Mood; look?: number; lookY?: number; tilt?: number; headDy?: number; spiral?: number; spear?: boolean; rot?: number; dent?: boolean };

const Goliath = ({ x, y, s, tq, ph = 0, amp = 30, mood = 'scowl', look = -0.5, lookY = 0.6, tilt = 0, headDy = 0, spiral = 0, spear = true, rot = 0, dent = false }: GolProps) => {
  const b = bnc(tq, ph);
  const sway = Math.sin((Math.PI * tq) / BEAT) * 2.5;
  const legs = (sg: number) => (
    <g transform={sg > 0 ? 'scale(-1 1)' : undefined}>
      <Hose a={[-100, -380]} b={[-128, -90]} bend={26} w={96} col={SKIN} ol={12} />
      <Shape d={smooth([[-185, -300], [-70, -300], [-78, -200], [-82, -96], [-178, -96], [-172, -200]])} fill={MID} w={7} />
      <path d="M -150 -280 L -146 -112" stroke={WHITE} strokeWidth={14} strokeLinecap="round" opacity={0.75} />
      <Ell x={-124} y={-318} rx={66} ry={44} fill={MID} w={7} />
      <Shape d={smooth([[-60, -130], [-200, -128], [-272, -84], [-276, -24], [-190, -4], [-60, -4], [-48, -60]])} fill={DK} w={8} />
      <Shape d={smooth([[-278, -30], [-272, -4], [-190, 2], [-56, 2], [-50, -18], [-190, -18]])} fill={INK} w={5} />
      <path d="M -252 -78 Q -234 -102 -198 -106" fill="none" stroke={WHITE} strokeWidth={9} strokeLinecap="round" opacity={0.8} />
    </g>
  );
  const sp = (
    <g transform={`rotate(${sway + rot} -340 -520)`}>
      <path d="M -340 14 L -340 -1090" stroke={INK} strokeWidth={56} strokeLinecap="round" />
      <path d="M -340 14 L -340 -1090" stroke={LT} strokeWidth={42} strokeLinecap="round" />
      <path d="M -352 -40 L -352 -1000" stroke={WHITE} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
      <ellipse cx={-340} cy={-760} rx={40} ry={20} fill="none" stroke={INK} strokeWidth={16} />
      <ellipse cx={-340} cy={-760} rx={40} ry={20} fill="none" stroke={DK} strokeWidth={7} />
      <Shape d={smooth([[-340, -1090], [-384, -1150], [-340, -1250], [-296, -1150]])} fill={DK} w={8} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={6} rx={330 - b * 30} ry={40} fill={INK} opacity={0.22} />
      <g transform={boing(0, 0, b, amp / s, 0.8)}>
        {legs(-1)}
        {legs(1)}
        {Array.from({ length: 9 }, (_, i) => {
          const px = -176 + i * 44;
          return <Shape key={i} d={smooth([[px - 21, -440], [px + 21, -440], [px + 19, -330], [px, -306], [px - 19, -330]])} fill={i % 2 ? LT : MID} w={6} />;
        })}
        <Shape d={smooth([[-170, -700], [170, -700], [228, -610], [212, -520], [190, -440], [-190, -440], [-212, -520], [-228, -610]])} fill="url(#scales)" w={8} />
        <Shape d={smooth([[-208, -456], [208, -456], [212, -404], [-212, -404]])} fill={DK} w={7} />
        <Ell x={0} y={-430} rx={32} ry={26} fill={WHITE} w={6} />
        <Ell x={-232} y={-668} rx={92} ry={66} fill={MID} w={7} />
        <Ell x={232} y={-668} rx={92} ry={66} fill={MID} w={7} />
        <path d="M -290 -690 Q -232 -716 -176 -690 M 176 -690 Q 232 -716 290 -690" fill="none" stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={0.75} />
        <Arm a={[232, -650]} b={[168, -448]} bend={-70} w={64} gs={2} />
        {spear ? sp : null}
        <Arm a={[-232, -650]} b={[-338, -520]} bend={40} w={64} gs={2} />
        <Ell x={0} y={-706} rx={76} ry={42} fill={SKIN} w={7} />
        <g transform={`translate(0 ${headDy}) rotate(${tilt} 0 -700)`}>
          <Ell x={-160} y={-778} rx={25} ry={38} fill={SKIN} w={7} />
          <Ell x={160} y={-778} rx={25} ry={38} fill={SKIN} w={7} />
          <Ell x={0} y={-790} rx={157} ry={141} fill={SKIN} w={8} />
          <circle cx={-96} cy={-740} r={26} fill={MID} opacity={0.35} />
          <circle cx={96} cy={-740} r={26} fill={MID} opacity={0.35} />
          <Shape d="M -150 -790 C -158 -700 -100 -636 0 -630 C 100 -636 158 -700 150 -790 C 120 -750 70 -738 0 -742 C -70 -738 -120 -750 -150 -790 Z" fill={DK} w={7} />
          {mood === 'scowl' ? (
            <g>
              <Shape d={smooth([[-82, -668], [-42, -704], [0, -712], [42, -704], [82, -668], [48, -678], [0, -688], [-48, -678]])} fill={INK} w={6} />
              <path d="M -28 -704 L 28 -704 L 24 -690 L -24 -690 Z" fill={WHITE} stroke={INK} strokeWidth={3} />
              <path d="M 0 -704 L 0 -690" stroke={INK} strokeWidth={3} />
            </g>
          ) : (
            <g>
              <Shape d={smooth([[-52, -710], [0, -722], [52, -710], [58, -672], [0, -640], [-58, -672]])} fill={INK} w={6} />
              <Ell x={0} y={-662} rx={30} ry={14} fill={MID} w={4} />
              <path d="M -30 -710 L 30 -710 L 26 -696 L -26 -696 Z" fill={WHITE} stroke={INK} strokeWidth={3} />
            </g>
          )}
          <g transform="scale(-1 1)">
            <Shape d={smooth([[-8, -738], [-60, -762], [-122, -750], [-148, -716], [-110, -724], [-70, -716], [-20, -718]])} fill="#6f675a" w={6} />
          </g>
          <Shape d={smooth([[-8, -738], [-60, -762], [-122, -750], [-148, -716], [-110, -724], [-70, -716], [-20, -718]])} fill="#6f675a" w={6} />
          <Ell x={0} y={-768} rx={32} ry={28} fill={SKIN} w={6} />
          {mood === 'dizzy' ? (
            <g>
              <SpiralEye x={-60} y={-818} r={42} rot={spiral} />
              <SpiralEye x={60} y={-818} r={42} rot={-spiral} />
            </g>
          ) : (
            <g>
              <PieEye x={-60} y={-818} rx={mood === 'shock' ? 44 : 38} ry={mood === 'shock' ? 50 : 42} look={look} lookY={lookY} pupil={mood === 'shock' ? 0.55 : 1} w={6} />
              <PieEye x={60} y={-818} rx={mood === 'shock' ? 44 : 38} ry={mood === 'shock' ? 50 : 42} look={look} lookY={lookY} pupil={mood === 'shock' ? 0.55 : 1} w={6} />
            </g>
          )}
          {mood === 'scowl' ? (
            <g>
              <path d="M -128 -872 L -14 -834 L -12 -808 L -130 -846 Z" fill={INK} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
              <path d="M 128 -872 L 14 -834 L 12 -808 L 130 -846 Z" fill={INK} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
            </g>
          ) : (
            <path d="M -112 -884 Q -62 -914 -16 -884 M 16 -884 Q 62 -914 112 -884" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
          )}
          <Helm dent={dent} />
        </g>
      </g>
    </g>
  );
};

/* ---------- the boot ---------- */

const GiantBoot = () => (
  <g>
    <Shape d={smooth([[-190, -300], [130, -300], [150, -800], [140, -1900], [-175, -1900], [-190, -800]])} fill={MID} w={10} />
    {[-520, -700, -900, -1100, -1300].map((yy) => (
      <path key={yy} d={`M -184 ${yy} Q -20 ${yy + 24} 138 ${yy}`} fill="none" stroke={INK} strokeWidth={7} />
    ))}
    <path d="M -128 -330 L -118 -1700" stroke={WHITE} strokeWidth={30} strokeLinecap="round" opacity={0.55} />
    <Shape d={smooth([[-410, -10], [-420, -112], [-352, -204], [-222, -240], [-172, -304], [140, -304], [162, -192], [212, -110], [204, -10], [-30, 8]])} fill={DK} w={10} />
    <path d="M -178 -250 Q -20 -224 150 -250 M -180 -196 Q -20 -170 156 -196" fill="none" stroke={INK} strokeWidth={22} strokeLinecap="round" />
    <path d="M -178 -250 Q -20 -224 150 -250 M -180 -196 Q -20 -170 156 -196" fill="none" stroke={LT} strokeWidth={10} strokeLinecap="round" />
    <path d="M -380 -110 Q -340 -176 -270 -190" fill="none" stroke={WHITE} strokeWidth={16} strokeLinecap="round" opacity={0.8} />
    <path d="M -300 -120 Q -250 -128 -226 -96" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <Shape d={smooth([[-426, -36], [-420, 0], [-200, 16], [212, 14], [226, -18], [-200, -36]])} fill={INK} w={6} />
    {[-340, -240, -140, -40, 60, 160].map((xx) => (
      <path key={xx} d={`M ${xx} 4 L ${xx + 14} -18`} stroke={MID} strokeWidth={6} strokeLinecap="round" />
    ))}
  </g>
);

/* ---------- shots ---------- */

const Hook = ({ f, tq }: { f: number; tq: number }) => {
  const slam = BEATS.bootSlam;
  const age = f - slam;
  const fall = f < slam ? Math.pow(1 - f / slam, 2) : 0;
  const k = f >= slam ? Math.exp(-age / 5) * Math.cos(age * 0.85) : 0;
  const sx = f < slam ? 1 - fall * 0.06 : 1 + 0.22 * k;
  const sy = f < slam ? 1 + fall * 0.12 : 1 - 0.22 * k;
  const shakeK = f >= slam && f < BEATS.shakeEnd ? 1 - age / 6 : 0;
  const rs = rng(f * 31 + 7);
  const shx = (rs() - 0.5) * 2 * 20 * shakeK;
  const shy = (rs() - 0.5) * 2 * 20 * shakeK;
  const bootY = 1770 - fall * 1150;
  const puffs =
    f >= slam
      ? Array.from({ length: 12 }, (_, i) => {
          const sg = i < 6 ? -1 : 1;
          const j = i % 6;
          const a = clamp(age / 22);
          const R = (50 + j * 16) * easeOut(clamp(age / 8)) * (1 - clamp((age - 20) / 26));
          return { x: (sg < 0 ? 170 : 900) + sg * (20 + j * 66) * easeOut(a), y: 1752 - j * 10 - age * (1.4 + j * 0.3), r: R };
        })
      : [];
  const stones =
    f >= slam
      ? Array.from({ length: 6 }, (_, i) => {
          const r = rng(i * 17 + 3);
          const vx = (r() - 0.5) * 34;
          const vy = -22 - r() * 16;
          return { x: 600 + vx * age, y: 1720 + vy * age + 1.9 * age * age, a: age * (r() - 0.5) * 0.9 };
        })
      : [];
  return (
    <g transform={`translate(${shx} ${shy})`}>
      <SetPiece tq={tq} h={1240} z={1.1} sun={[860, 640]} />
      <ellipse cx={650} cy={1772} rx={300 + (1 - fall) * 200} ry={44 + (1 - fall) * 26} fill={INK} opacity={0.28 + (1 - fall) * 0.12} />
      <g transform={`translate(640 ${bootY}) scale(${1.55 * sx} ${1.55 * sy})`}>
        <GiantBoot />
      </g>
      {f < slam ? (
        <g stroke={INK} strokeWidth={9} strokeLinecap="round" opacity={0.55}>
          {Array.from({ length: 12 }, (_, i) => {
            const rr = rng(i * 41 + f);
            const x = 130 + i * 70 + rr() * 30;
            const y0 = bootY + 30 + rr() * 60;
            return <line key={i} x1={x} y1={y0} x2={x} y2={y0 + 160 + rr() * 330 * fall} />;
          })}
        </g>
      ) : null}
      {age >= 0 && age < 6 ? <SpeedLines cx={650} cy={1730} r0={300 + age * 40} r1={480 + age * 60} n={22} seed={f * 5 + 1} w={9} opacity={1 - age / 6} /> : null}
      <Puffs items={puffs} />
      {stones.map((p, i) => (p.y < 1790 ? <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${(p.a * 180) / Math.PI})`}><Ell x={0} y={0} rx={20} ry={15} fill={MID} w={5} /></g> : null))}
    </g>
  );
};

const Wide = ({ f, tq }: { f: number; tq: number }) => {
  const z = 1 + 0.18 * decay(f, BEATS.cutGoliath, 3.5);
  const lookY = 0.75;
  return (
    <g transform={`translate(540 ${GROUND}) scale(${z}) translate(-540 ${-GROUND})`}>
      <SetPiece tq={tq} h={1300} z={1} sun={[900, 360]} />
      <Goliath x={690} y={GROUND} s={1.08} tq={tq} amp={32} look={-0.7} lookY={lookY} />
      <David x={206} y={GROUND + 40} s={0.86} tq={tq} rate={2} amp={14} look={0.5} lookY={-0.7} tilt={-6} mouth={0.2} hL={[-100, -150]} bL={30} hR={[96, -118]} />
    </g>
  );
};

const Speech = ({ f, tq }: { f: number; tq: number }) => {
  const swing = Math.sin((Math.PI * tq) / BEAT) * 26;
  const mouth = 0.3 + 0.7 * Math.abs(Math.sin(tq * 19));
  const hR = [118, -292];
  return (
    <g>
      <SetPiece tq={tq} h={1180} z={1.5} sun={[130, 880]} />
      <David x={540} y={1990} s={3.2} tq={tq} amp={34} look={0.15} lookY={-0.85} tilt={-7} mouth={f % 2 === 0 ? mouth : mouth * 0.8} hL={[-92, -178]} bL={42} hR={hR} bR={-36} sling={{ end: [hR[0] + 8 + swing, hR[1] + 150] }} />
    </g>
  );
};

const Numeral = ({ n, f, at, x, y, tq }: { n: number; f: number; at: number; x: number; y: number; tq: number }) => {
  if (f < at) return null;
  const a = f - at;
  const pop = a < 8 ? back(clamp(a / 8)) * 1.0 : 1;
  const b = bnc(tq, 0.12 * n);
  return (
    <g transform={`translate(${x} ${y - b * 16}) rotate(${((n * 37) % 11) - 5}) scale(${pop * (1 + (1 - b) * 0.05)} ${pop * (1 - (1 - b) * 0.05)})`}>
      <text x={0} y={70} textAnchor="middle" fontFamily={fredoka.fontFamily} fontWeight={600} fontSize={210} fill={n === 5 ? GOLD : CREAM} stroke={INK} strokeWidth={26} paintOrder="stroke" strokeLinejoin="round">
        {n}
      </text>
    </g>
  );
};

const Stones = ({ f, tq }: { f: number; tq: number }) => {
  const pops = [BEATS.stone1, BEATS.stone2, BEATS.stone3, BEATS.stone4, BEATS.stone5];
  const count = pops.filter((p) => f >= p).length;
  const last = pops[Math.max(0, count - 1)];
  const age = f - last;
  const drop = count ? clamp(age / 6) : 1;
  return (
    <g>
      <SetPiece tq={tq} h={1270} z={1.2} sun={[890, 210]} />
      <David x={540} y={1640} s={2.6} tq={tq} rate={2} amp={34} look={0} lookY={-0.55} tilt={-4} mouth={0.2} hL={[-112, -300]} bL={-34} hR={[102, -136]} bR={-30} stones={count} drop={drop} />
      {pops.map((p, i) => (f >= p && f - p < 7 ? <SpeedLines key={i} cx={742} cy={1384} r0={50} r1={150} n={12} seed={p * 3 + f} w={7} opacity={1 - (f - p) / 7} /> : null))}
      {pops.map((p, i) => (
        <Numeral key={i} n={i + 1} f={f} at={p} x={140 + i * 200} y={410} tq={tq} />
      ))}
    </g>
  );
};

// Sling arc. The sling spins faster and faster, capped so each step still reads as forward.
const slingAngle = (f: number) => {
  const t = clamp((f - BEATS.windup) / (BEATS.release - BEATS.windup));
  const steps = Math.floor((f - BEATS.windup) * 0.4);
  let a = 0;
  for (let i = 0; i < steps; i++) a += 0.9 + 1.5 * (i / 18);
  return { a: a - 1.1, t };
};

const Windup = ({ f, tq, frozen }: { f: number; tq: number; frozen: boolean }) => {
  const { a, t } = slingAngle(Math.min(f, BEATS.release));
  const amp = 30 + 60 * t;
  const R = 140;
  const spinHand = [104, -396];
  const hR = frozen ? [140, -322] : spinHand;
  const end = frozen ? [hR[0] + 85, hR[1] - 40] : [hR[0] + Math.cos(a) * R, hR[1] - 24 + Math.sin(a) * R * 0.38];
  const sx = 340;
  const sy = 1570;
  const stone = [sx + (end[0] + 46) * 2.3, sy + (end[1] - 16) * 2.3];
  return (
    <g>
      <SetPiece tq={tq} h={1230} z={1.2} sun={[860, 300]} />
      <Goliath x={880} y={1330} s={0.42} tq={tq} amp={10} mood="scowl" look={-0.6} lookY={0} />
      {!frozen ? <SpeedLines cx={sx + spinHand[0] * 2.3} cy={sy + (spinHand[1] - 24) * 2.3} r0={340 + t * 40} r1={900} n={16} seed={Math.floor(f * 0.4) * 11 + 5} w={6 + t * 7} col={DK} opacity={0.25 + t * 0.5} /> : null}
      <David
        x={sx} y={sy} s={2.3} tq={tq} rate={t > 0.5 ? 2 : 1} amp={amp} look={frozen ? 0.9 : 0.4} lookY={frozen ? -0.1 : -0.95} tilt={frozen ? -9 : -9} mouth={frozen ? 0.65 : 0.45}
        hL={frozen ? [-96, -150] : [-92, -214]} bL={frozen ? 36 : 34} hR={hR} bR={frozen ? 8 : -34}
        sling={{ end, ring: frozen ? undefined : { rx: R, ry: R * 0.38, a, trail: 0.5 + t * 1.6 } }}
      />
      {frozen ? (
        <g>
          <SpeedLines cx={stone[0]} cy={stone[1]} r0={50} r1={170} n={14} seed={77} w={8} />
          <path d={`M ${stone[0] - 60} ${stone[1] - 34} L ${stone[0] - 420} ${stone[1] - 10} M ${stone[0] - 70} ${stone[1] + 8} L ${stone[0] - 500} ${stone[1] + 40} M ${stone[0] - 56} ${stone[1] + 46} L ${stone[0] - 360} ${stone[1] + 96}`} stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <Ell x={stone[0]} y={stone[1]} rx={38} ry={30} fill={MID} w={7} />
          <path d={`M ${stone[0] - 14} ${stone[1] - 10} q 8 -10 20 -8`} stroke={WHITE} strokeWidth={7} strokeLinecap="round" fill="none" />
        </g>
      ) : null}
    </g>
  );
};

const Bonk = ({ f, tq }: { f: number; tq: number }) => {
  const a = f - BEATS.bonk;
  const kick = decay(f, BEATS.bonk, 5);
  const wob = Math.sin(a * 0.75) * decay(f, BEATS.bonk, 16);
  const mood: Mood = f < BEATS.spirals ? 'shock' : 'dizzy';
  const rs = rng(f * 13 + 3);
  const shk = f < BEATS.bonk + 12 ? 1 - a / 12 : 0;
  const gx = 540;
  const gy = 2760;
  const gs = 2;
  const impact = [gx + 44 * gs, gy - 900 * gs];
  const stone = { x: impact[0] + a * 26, y: impact[1] - a * 52 + a * a * 2.4 };
  const orbit = (i: number) => {
    const ang = tq * 4.6 + (i * Math.PI * 2) / 5;
    return { x: 540 + Math.cos(ang) * 380, y: 770 + Math.sin(ang) * 80, front: Math.sin(ang) > 0 };
  };
  const stars = Array.from({ length: 5 }, (_, i) => orbit(i));
  const bonkIn = Math.max(0.4, back(clamp(a / 7)));
  return (
    <g transform={`translate(${(rs() - 0.5) * 20 * shk} ${(rs() - 0.5) * 20 * shk})`}>
      <SetPiece tq={tq} h={1560} z={1.6} sun={[110, 640]} />
      {f > BEATS.bonk ? stars.filter((p) => !p.front).map((p, i) => <Star key={`b${i}`} x={p.x} y={p.y} r={40} rot={tq * 3 + i} fill={GOLD} />) : null}
      <Goliath x={gx} y={gy} s={gs} tq={tq} amp={26} mood={mood} look={0} lookY={0} headDy={-34 * kick} tilt={10 * wob + (f < BEATS.spirals ? -6 * kick : 0)} spiral={tq * 7} spear={false} dent={f >= BEATS.bonk} />
      {f > BEATS.bonk ? stars.filter((p) => p.front).map((p, i) => <Star key={`f${i}`} x={p.x} y={p.y} r={46} rot={tq * 3 + i} fill={GOLD} />) : null}
      {a < 6 ? (
        <g>
          <Star x={impact[0]} y={impact[1] - 68 * kick} r={150 - a * 10} rot={a * 0.3} fill={WHITE} w={8} />
          <SpeedLines cx={impact[0]} cy={impact[1]} r0={120} r1={260} n={14} seed={f * 3} w={9} opacity={1 - a / 6} />
        </g>
      ) : null}
      {a >= 1 && a < 28 ? <g transform={`translate(${stone.x} ${stone.y}) rotate(${a * 40})`}><Ell x={0} y={0} rx={26} ry={20} fill={MID} w={6} /></g> : null}
      <g transform={`translate(540 390) rotate(${-6 + Math.sin(tq * 6) * 2}) scale(${bonkIn})`}>
        <text x={0} y={80} textAnchor="middle" fontFamily={fredoka.fontFamily} fontWeight={600} fontSize={250} fill={CREAM} stroke={INK} strokeWidth={20} paintOrder="stroke" strokeLinejoin="round">
          BONK!
        </text>
      </g>
    </g>
  );
};

const Timber = ({ f, tq }: { f: number; tq: number }) => {
  const fa = clamp((f - BEATS.fall) / 24);
  const ang = Math.pow(fa, 1.1) * (Math.PI / 2) * 0.96;
  const sA = 1 + 1.1 * Math.pow(Math.sin(ang), 1.3);
  const sy = sA * (Math.cos(ang) * 0.8 + 0.1);
  const dy = 290 * Math.pow(Math.sin(ang), 2);
  const sw = f < BEATS.fall ? Math.sin(tq * 9) * 5 : Math.sin(tq * 9) * 5 * (1 - fa);
  const fx = 640;
  const starsOut = clamp((f - BEATS.fall) / 10);
  return (
    <g>
      <SetPiece tq={tq} h={1300} z={1} sun={[900, 360]} />
      <g transform={`translate(${fx} ${GROUND + dy}) rotate(${sw}) scale(${sA} ${sy}) translate(${-fx} ${-GROUND})`}>
        <Goliath x={fx} y={GROUND} s={1.08} tq={tq} amp={f < BEATS.fall ? 20 : 0} mood="dizzy" spiral={tq * 7} headDy={0} spear={true} rot={ang * 40} />
      </g>
      {f >= BEATS.fall + 4 ? <SpeedLines cx={fx} cy={760} r0={380} r1={1000} n={18} seed={Math.floor(f * 0.4) * 7 + 2} w={8} col={DK} opacity={0.55 * fa} /> : null}
      {Array.from({ length: 5 }, (_, i) => {
        const an = tq * 4.6 + (i * Math.PI * 2) / 5;
        return <Star key={i} x={fx + Math.cos(an) * (170 + starsOut * 500)} y={250 + Math.sin(an) * 34 - starsOut * 120} r={34} rot={tq * 3 + i} fill={GOLD} />;
      })}
    </g>
  );
};

const Dust = ({ f }: { f: number }) => {
  const g0 = 408;
  const c0 = BEATS.dustClear;
  if (f < g0 || f > c0 + 20) return null;
  const items = Array.from({ length: 24 }, (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const r = rng(i * 53 + 9);
    const x = (col + 0.5) * 270 + (r() - 0.5) * 80;
    const y = (row + 0.5) * 330 + (r() - 0.5) * 80;
    const R = 180 + r() * 60;
    const dist = Math.hypot(x - 540, y - 1500);
    const grow = clamp((f - g0 - dist / 200) / 8);
    const fade = clamp((f - c0 - (1 - y / 1920) * 4 - r() * 3) / 12);
    return { x: x + Math.sin((f + i * 3) * 0.5) * 6, y: y - Math.pow(fade, 1.6) * 1500, r: R * back(grow) * (1 - 0.3 * fade) };
  });
  return <Puffs items={items} fill={LT} ol={9} />;
};

// The fallen helmet, seen from the side: crest lobes along the top, a dent, rivets on the rim.
const FallenHelmet = () => (
  <g>
    {Array.from({ length: 7 }, (_, i) => {
      const x = -200 + i * 66;
      const y = -250 * Math.sqrt(Math.max(0, 1 - Math.pow(x / 300, 2))) - 14;
      return <Ell key={i} x={x} y={y} rx={40} ry={34} fill={i % 2 ? MID : DK} w={7} />;
    })}
    <Ell x={252} y={-128} rx={34} ry={28} fill={DK} w={7} />
    <Ell x={290} y={-80} rx={26} ry={22} fill={MID} w={7} />
    <Shape d="M -300 0 C -300 -170 -170 -260 0 -262 C 170 -260 300 -170 300 0 Z" fill={MID} w={10} />
    <Shape d={smooth([[-300, -62], [-392, -42], [-372, 12], [-300, 2]])} fill={MID} w={8} />
    <Shape d={smooth([[-312, -46], [312, -46], [320, 8], [-320, 8]])} fill={DK} w={8} />
    {[-240, -120, 0, 120, 240].map((x) => (
      <circle key={x} cx={x} cy={-20} r={9} fill={LT} stroke={INK} strokeWidth={3} />
    ))}
    <path d="M -210 -186 Q -130 -246 -30 -254" fill="none" stroke={WHITE} strokeWidth={18} strokeLinecap="round" opacity={0.85} />
    <Star x={-130} y={-170} r={46} fill={LT} w={5} />
    <path d="M -170 -170 L -90 -170 M -130 -208 L -130 -132" stroke={INK} strokeWidth={4} />
  </g>
);

const FinalScene = ({ f, tq }: { f: number; tq: number }) => {
  const b = bnc(tq, 0);
  const hb = bnc(tq, 0.5);
  const sparkles = Array.from({ length: 7 }, (_, i) => {
    const r = rng(i * 29 + 5);
    return { x: 100 + r() * 880, y: 760 + r() * 600, tw: Math.abs(Math.sin((tq + i * 0.31) * 7)) };
  });
  const k = 1.6;
  const apex = 1570 - 262 * k;
  return (
    <g>
      <SetPiece tq={tq} h={1330} z={1.2} sun={[900, 960]} />
      <g transform="rotate(-8 300 1500)">
        <path d="M -200 1480 L 900 1540" stroke={INK} strokeWidth={52} strokeLinecap="round" />
        <path d="M -200 1480 L 900 1540" stroke={LT} strokeWidth={38} strokeLinecap="round" />
        <ellipse cx={420} cy={1510} rx={40} ry={20} fill="none" stroke={DK} strokeWidth={9} />
      </g>
      <ellipse cx={540} cy={1574} rx={440} ry={40} fill={INK} opacity={0.25} />
      <g transform={`translate(540 1570) scale(${k})`}>
        <g transform={boing(0, 0, hb, 14 / k, 1)}>
          <FallenHelmet />
        </g>
      </g>
      <David x={540} y={apex + 8} s={1.0} tq={tq} ph={0} amp={44} look={-0.3} lookY={-0.5} tilt={-4} mouth={0.55} hL={[-110, -330]} bL={-30} hR={[112, -318]} bR={30} />
      {sparkles.map((p, i) => (
        <Star key={i} x={p.x} y={p.y} r={14 + p.tw * 26} rot={tq * 2 + i} fill={i % 2 ? WHITE : GOLD} w={4} />
      ))}
      <ellipse cx={540} cy={apex + 14} rx={100 - b * 12} ry={12} fill={INK} opacity={0.2} />
    </g>
  );
};

const Shot = ({ f }: { f: number }) => {
  const frozen = f >= BEATS.freezeStart && f < BEATS.freezeEnd;
  const tq = stepT(frozen ? BEATS.freezeStart : f);
  let body: ReactNode;
  if (f < BEATS.cutGoliath) body = <Hook f={f} tq={tq} />;
  else if (f < BEATS.cutDavid) body = <Wide f={f} tq={tq} />;
  else if (f < BEATS.cutStones) body = <Speech f={f} tq={tq} />;
  else if (f < BEATS.windup) body = <Stones f={f} tq={tq} />;
  else if (f < BEATS.bonk) body = <Windup f={f} tq={tq} frozen={frozen} />;
  else if (f < BEATS.cutTimber) body = <Bonk f={f} tq={tq} />;
  else if (f < 426) body = <Timber f={f} tq={tq} />;
  else body = <FinalScene f={f} tq={tq} />;
  const cuts = [BEATS.cutDavid, BEATS.cutStones, BEATS.windup, BEATS.release, BEATS.cutTimber, BEATS.endCard];
  const lastCut = cuts.filter((c) => f >= c).pop();
  const punch = lastCut === undefined ? 0 : 0.07 * decay(f, lastCut, 3);
  return (
    <g transform={`translate(540 960) scale(${1 + punch}) translate(-540 -960)`}>
      {body}
      <Dust f={f} />
    </g>
  );
};

export const SmallestStone = (props: SmallestStoneProps) => {
  const f = useCurrentFrame();
  const [jx, jy] = weave(f);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0a08' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${jx}px, ${jy}px)` }}>
        <svg width={FILM_W} height={FILM_H} viewBox={`0 0 ${FILM_W} ${FILM_H}`} style={{ position: 'absolute', inset: 0 }}>
          <SepiaDefs />
          <defs>
            <pattern id="scales" width={44} height={30} patternUnits="userSpaceOnUse">
              <rect width={44} height={30} fill={MID} />
              <path d="M 0 30 A 22 22 0 0 1 44 30 M -22 15 A 22 22 0 0 1 22 15 M 22 15 A 22 22 0 0 1 66 15" fill={LT} stroke={INK} strokeWidth={2.5} />
            </pattern>
          </defs>
          <g filter="url(#sepia)">
            <Shot f={f} />
          </g>
        </svg>
        {props.appCut
          ? null
          : CAPTIONS.map((cap) => <Caption key={`${cap.from}-${cap.text}`} cap={cap} f={f} />)}
      </div>
      <Film f={f} />
      {props.bedAudio ? <Audio src={staticFile(props.bedAudio)} /> : null}
    </AbsoluteFill>
  );
};
