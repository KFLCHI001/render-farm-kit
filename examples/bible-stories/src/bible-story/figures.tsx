// Characters for the Bible story shorts: Peter in silhouette, the Lord as a
// figure of light (never a drawn face), the boat, and Wren the sparrow.
import { rng } from './world';

const r1 = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
const INK = '#02040a';

type Pt = [number, number];
// A limb segment end point: angle in degrees from straight down, positive toward +x.
const reach = ([x, y]: Pt, deg: number, len: number): Pt => [x + Math.sin(rad(deg)) * len, y + Math.cos(rad(deg)) * len];
const line = (a: Pt, b: Pt, c?: Pt) => `M ${r1(a[0])} ${r1(a[1])} L ${r1(b[0])} ${r1(b[1])}${c ? ` L ${r1(c[0])} ${r1(c[1])}` : ''}`;

export type Pose = {
  // Walk phase in radians and stride 0..1.
  phase?: number;
  stride?: number;
  // Shoulder and elbow angles, degrees. 0 hangs down, 90 points ahead, 170 straight up.
  frontArm?: [number, number];
  backArm?: [number, number];
  lean?: number;
  // Seconds, for the cloak in the wind.
  wind?: number;
  windStrength?: number;
  // 0..1 warm light catching the side that faces the Lord.
  rim?: number;
};

// Peter, side on, facing +x. Feet at the origin; about 300 units tall.
export const Peter = ({ x, y, scale, pose, id }: { x: number; y: number; scale: number; pose: Pose; id: string }) => {
  const { phase = 0, stride = 0, frontArm = [12, 8], backArm = [-10, 6], lean = 0, wind = 0, windStrength = 1, rim = 0 } = pose;
  const hip: Pt = [0, -132];
  const legs = [0, Math.PI].map((off) => {
    const s = Math.sin(phase + off) * stride;
    const knee = reach(hip, s * 28, 70);
    const foot = reach(knee, s * 28 - Math.max(0, Math.cos(phase + off)) * stride * 26, 66);
    return line(hip, knee, foot);
  });
  const shoulder: Pt = [6, -222];
  const arm = ([a, e]: [number, number]) => {
    const elbow = reach(shoulder, a, 60);
    const hand = reach(elbow, a + e, 56);
    return { d: line(shoulder, elbow, hand), hand };
  };
  const fa = arm(frontArm);
  const ba = arm(backArm);
  const flap = Math.sin(wind * 7.3) * 10 * windStrength + Math.sin(wind * 13.1) * 5 * windStrength;
  const robe = `M -15 -240 L 17 -240 L 30 -222 L 26 -140 L ${r1(46 + flap * 0.3)} -54 L ${r1(-42 + flap)} -58 L -24 -140 L -26 -222 Z`;
  const cloak = `M -22 -232 C -60 -200 ${r1(-88 - flap * 2.2)} -150 ${r1(-96 - flap * 3)} -96 L ${r1(-60 - flap)} -84 C -44 -120 -34 -170 -18 -214 Z`;
  const body = (
    <>
      <path d={legs[0]} stroke="currentColor" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={legs[1]} stroke="currentColor" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={ba.d} stroke="currentColor" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={cloak} />
      <path d={robe} />
      <circle cx={2} cy={-264} r={25} />
      <path d="M 18 -262 L 31 -255 L 24 -251 Z" />
      <ellipse cx={8} cy={-247} rx={18} ry={14} />
      <path d={`M -16 -280 C -27 -272 ${r1(-30 - flap * 0.4)} -258 ${r1(-28 - flap * 0.5)} -246 L -12 -252 Z`} />
      <path d={fa.d} stroke="currentColor" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={r1(fa.hand[0])} cy={r1(fa.hand[1])} r={10} />
    </>
  );
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${scale}) rotate(${lean})`}>
      <defs>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" stopColor="#ffd48a" stopOpacity={0} />
          <stop offset="1" stopColor="#ffd48a" stopOpacity={1} />
        </linearGradient>
      </defs>
      <g fill={INK} color={INK}>
        {body}
      </g>
      {rim > 0 ? (
        <g fill="none" stroke={`url(#rim-${id})`} color={`url(#rim-${id})`} strokeWidth={3.5} opacity={rim} style={{ mixBlendMode: 'screen' }}>
          <path d={robe} />
          <circle cx={2} cy={-264} r={25} />
          <path d={fa.d} strokeWidth={4} />
        </g>
      ) : null}
    </g>
  );
};

// The Lord as a standing figure of light. No face is ever drawn. reachDeg lifts
// the right arm toward the viewer's left (where Peter is) for "Come!".
export const LightFigure = ({
  x,
  y,
  scale,
  t,
  intensity,
  reachDeg = 8,
  rays: rayAmount = 1,
  id,
}: {
  x: number;
  y: number;
  scale: number;
  t: number;
  intensity: number;
  reachDeg?: number;
  rays?: number;
  id: string;
}) => {
  const pulse = 1 + 0.05 * Math.sin(t * 2.1);
  const shoulder: Pt = [-44, -222];
  const elbow = reach(shoulder, -reachDeg, 62);
  const hand = reach(elbow, -reachDeg * 1.1, 58);
  const rays = rng(3);
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${scale})`} opacity={intensity}>
      <defs>
        <radialGradient id={`lf-${id}`} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#fff2cf" />
          <stop offset="1" stopColor="#f3c36e" />
        </radialGradient>
        <radialGradient id={`halo-${id}`}>
          <stop offset="0" stopColor="#fff4d6" stopOpacity={0.9} />
          <stop offset="0.35" stopColor="#ffd98f" stopOpacity={0.35} />
          <stop offset="1" stopColor="#f0a94a" stopOpacity={0} />
        </radialGradient>
        <filter id={`soft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <g style={{ mixBlendMode: 'screen' }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * 360 + t * 6 + rays() * 10;
          const len = 700 + rays() * 500;
          return (
            <path
              key={i}
              d={`M 0 -170 L ${r1(Math.sin(rad(a - 2)) * len)} ${r1(-170 + Math.cos(rad(a - 2)) * len)} L ${r1(Math.sin(rad(a + 2)) * len)} ${r1(-170 + Math.cos(rad(a + 2)) * len)} Z`}
              fill="#ffe2a0"
              opacity={(0.05 + 0.04 * Math.sin(t * 1.3 + i)) * rayAmount}
            />
          );
        })}
        <circle cx={0} cy={-170} r={460 * pulse} fill={`url(#halo-${id})`} opacity={0.7} />
        <circle cx={0} cy={-250} r={130 * pulse} fill={`url(#halo-${id})`} opacity={0.8} />
      </g>
      <g fill={`url(#lf-${id})`} filter={`url(#soft-${id})`}>
        <path d="M -20 -248 C -40 -246 -50 -238 -52 -222 L -40 -150 C -40 -100 -56 -40 -66 0 L 66 0 C 56 -40 40 -100 40 -150 L 52 -222 C 50 -238 40 -246 20 -248 Z" />
        <path d="M -28 -282 C -31 -252 -36 -238 -42 -224 L 42 -224 C 36 -238 31 -252 28 -282 Z" />
        <circle cx={0} cy={-278} r={27} />
        <path d={line(shoulder, elbow, hand)} stroke={`url(#lf-${id})`} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx={r1(hand[0])} cy={r1(hand[1])} r={14} />
        <path d={line([44, -222], reach([44, -222], 6, 66), reach(reach([44, -222], 6, 66), -4, 60))} stroke={`url(#lf-${id})`} strokeWidth={26} strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
};

// Light rings where a foot meets the water.
export const Ripples = ({ x, y, age, scale = 1 }: { x: number; y: number; age: number; scale?: number }) => {
  if (age < 0 || age > 1.6) return null;
  return (
    <g style={{ mixBlendMode: 'screen' }}>
      {[0, 0.25, 0.5].map((d) => {
        const a = age - d;
        if (a < 0) return null;
        return (
          <ellipse
            key={d}
            cx={x}
            cy={y}
            rx={r1((20 + a * 150) * scale)}
            ry={r1((5 + a * 32) * scale)}
            fill="none"
            stroke="#ffe0a0"
            strokeWidth={3}
            opacity={Math.max(0, 0.8 - a / 1.6)}
          />
        );
      })}
    </g>
  );
};

// The fishing boat, with the other disciples huddled low and a swinging lantern.
export const Boat = ({ x, y, scale, rock, t, lantern = 1, mast = true }: { x: number; y: number; scale: number; rock: number; t: number; lantern?: number; mast?: boolean }) => {
  const swing = Math.sin(t * 2.4) * 14;
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${scale}) rotate(${r1(rock)})`}>
      <defs>
        <radialGradient id="lantern">
          <stop offset="0" stopColor="#ffd27a" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g fill={INK}>
        {mast ? (
          <>
            <rect x={-4} y={-390} width={9} height={392} />
            <path d="M -120 -338 L 120 -332 L 118 -326 L -120 -330 Z" />
            <path d="M -112 -332 C -60 -318 60 -316 112 -328 C 70 -300 -70 -300 -112 -332 Z" />
          </>
        ) : null}
        {[-190, -96, 40, 138].map((hx, i) => (
          <g key={hx}>
            <ellipse cx={hx} cy={-34} rx={34} ry={30} />
            <circle cx={hx + (i % 2 ? 6 : -6)} cy={-66 + Math.sin(t * 2 + i) * 2} r={17} />
          </g>
        ))}
        <path d="M -300 -40 C -250 -30 -200 -24 0 -22 C 200 -24 250 -30 286 -58 L 300 -64 C 280 -10 230 54 0 60 C -200 54 -262 20 -300 -40 Z" />
      </g>
      {lantern > 0 ? (
        <g transform={`translate(-214 -118) rotate(${r1(swing)})`} opacity={lantern}>
          <line x1={0} y1={0} x2={0} y2={30} stroke={INK} strokeWidth={3} />
          <circle cx={0} cy={44} r={110} fill="url(#lantern)" style={{ mixBlendMode: 'screen' }} />
          <rect x={-10} y={32} width={20} height={26} rx={5} fill="#ffcf73" />
        </g>
      ) : null}
    </g>
  );
};

export type WrenMood = {
  // 0 shut, 1 wide.
  eyes?: number;
  // Pupil offset, -1..1.
  lookX?: number;
  lookY?: number;
  // Wing over the face, 0 folded, 1 covering the beak.
  cover?: number;
  // 0..1 soaked: darker feathers, spiky outline, drips.
  wet?: number;
  // Seconds into a shake-off; negative when not shaking.
  shake?: number;
  // Seconds, for blinks and breathing.
  t: number;
  // Warm side light from the lantern or the Lord.
  warm?: number;
};

// Wren, a round house sparrow, facing +x. About 220 units across.
export const Wren = ({ x, y, scale, mood, flip = false }: { x: number; y: number; scale: number; mood: WrenMood; flip?: boolean }) => {
  const { eyes = 1, lookX = 0, lookY = 0, cover = 0, wet = 0, shake = -1, t, warm = 0 } = mood;
  const blink = (t % 3.7) > 3.55 ? 0.1 : 1;
  const open = Math.max(0.05, eyes * blink);
  const breathe = 1 + Math.sin(t * 3) * 0.015;
  const shaking = shake >= 0 && shake < 0.7;
  const jitter = shaking ? Math.sin(shake * 70) * 9 * (1 - shake / 0.7) : 0;
  const puff = shaking ? 1 + 0.12 * Math.sin((shake / 0.7) * Math.PI) : 1;
  const brown = wet > 0 ? mixHex('#9a6a45', '#5a3c28', wet) : '#9a6a45';
  const cap = wet > 0 ? mixHex('#6e4630', '#3e281b', wet) : '#6e4630';
  const belly = wet > 0 ? mixHex('#efdcb9', '#a99a80', wet) : '#efdcb9';
  const wingY = -10 - cover * 70;
  const wingRot = -cover * 62;
  const drops = rng(41);
  const spikes = wet > 0.2 ? Array.from({ length: 12 }, (_, i) => {
    const a = Math.PI * (0.95 + (i / 11) * 1.1);
    const rr = 98 + (i % 2 ? 16 : 0) * wet;
    return `${i ? 'L' : 'M'} ${r1(Math.cos(a) * rr)} ${r1(Math.sin(a) * rr * 0.92)}`;
  }).join(' ') : '';
  return (
    <g transform={`translate(${r1(x + jitter)} ${r1(y)}) scale(${r1(scale * (flip ? -1 : 1) * puff * 1000) / 1000} ${r1(scale * puff * breathe * 1000) / 1000})`}>
      <defs>
        <linearGradient id="wrenWarm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.45" stopColor="#ffc46b" stopOpacity={0} />
          <stop offset="1" stopColor="#ffc46b" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {/* tail */}
      <path d="M -70 10 L -168 -30 L -160 6 L -176 26 L -66 44 Z" fill={cap} />
      {/* feet */}
      <path d="M -14 80 L -20 106 M -20 106 L -36 112 M -20 106 L -4 114 M 26 80 L 24 106 M 24 106 L 8 114 M 24 106 L 40 112" stroke="#d99a52" strokeWidth={7} strokeLinecap="round" fill="none" />
      {/* body and spiky wet outline */}
      {spikes ? <path d={`${spikes} Z`} fill={brown} /> : null}
      <ellipse cx={0} cy={0} rx={104} ry={92} fill={brown} />
      <ellipse cx={30} cy={30} rx={70} ry={58} fill={belly} />
      {/* head */}
      <circle cx={46} cy={-62} r={62} fill={brown} />
      <path d="M -4 -96 C 20 -132 80 -132 104 -90 C 80 -104 30 -104 -4 -96 Z" fill={cap} />
      <ellipse cx={74} cy={-36} rx={34} ry={24} fill={belly} opacity={0.9} />
      {/* beak */}
      <path d="M 100 -60 L 138 -48 L 100 -36 Z" fill="#e0a24e" />
      {/* eye */}
      <g transform={`translate(64 -70)`}>
        <ellipse cx={0} cy={0} rx={24} ry={28 * open} fill="#fbf6ec" />
        {open > 0.2 ? (
          <>
            <circle cx={r1(4 + lookX * 8)} cy={r1(lookY * 8 * open)} r={15 * Math.min(1, open + 0.2)} fill="#120c0a" />
            <circle cx={r1(9 + lookX * 8)} cy={r1(-6 + lookY * 6)} r={5} fill="#ffffff" />
          </>
        ) : null}
        <path d={`M -26 ${r1(-28 * open)} Q 0 ${r1(-36 * open - 4)} 26 ${r1(-28 * open)}`} stroke={cap} strokeWidth={6} fill="none" strokeLinecap="round" />
      </g>
      {/* wing */}
      <g transform={`translate(-10 ${r1(wingY)}) rotate(${r1(wingRot)})`}>
        <path d="M -60 -30 C -10 -60 70 -40 92 10 C 50 40 -30 46 -78 20 Z" fill={cap} />
        <path d="M -40 -6 C 0 -16 40 -8 70 10 M -46 10 C -6 4 30 12 60 24" stroke="#4a2f20" strokeWidth={4} fill="none" />
      </g>
      {warm > 0 ? (
        <g fill="url(#wrenWarm)" opacity={warm} style={{ mixBlendMode: 'screen' }}>
          <ellipse cx={0} cy={0} rx={104} ry={92} />
          <circle cx={46} cy={-62} r={62} />
        </g>
      ) : null}
      {wet > 0
        ? Array.from({ length: shaking ? 16 : 3 }, (_, i) => {
            const life = shaking ? (shake / 0.7 + drops() * 0.2) : (t * (0.7 + drops()) + drops()) % 1;
            const ang = drops() * Math.PI * 2;
            const dx = shaking ? Math.cos(ang) * life * 220 : -30 + drops() * 80;
            const dy = shaking ? Math.sin(ang) * life * 160 : 80 + life * 140;
            return <ellipse key={i} cx={r1(dx)} cy={r1(dy)} rx={5} ry={8} fill="#cfe0f4" opacity={(1 - life) * 0.9 * wet} />;
          })
        : null}
    </g>
  );
};

const mixHex = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * k));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

// One hand and forearm. The wrist is at the origin; fingers point along angle
// (degrees, 0 is up, clockwise). curl 0 is open and spread, 1 is a closed grip.
export const Hand = ({ x, y, angle, scale, curl, fill, side = 1 }: { x: number; y: number; angle: number; scale: number; curl: number; fill: string; side?: 1 | -1 }) => {
  const dir = (deg: number, len: number): Pt => [Math.sin(rad(deg)) * len, -Math.cos(rad(deg)) * len];
  const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
  const fingers = [-30, -10, 10, 30].map((bx, i) => {
    const len = [60, 74, 70, 54][i];
    const a = [-12, -4, 4, 12][i] * (1 - curl);
    const base: Pt = [bx, -92];
    const mid = add(base, dir(a, len * 0.55));
    const tip = add(mid, dir(a + curl * 150 * side, len * 0.5));
    return line(base, mid, tip);
  });
  const tb: Pt = [-36 * side, -34];
  const tm = add(tb, dir(-58 * side, 34));
  const thumb = line(tb, tm, add(tm, dir((-58 + curl * 120) * side, 28)));
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)}) scale(${scale})`} fill={fill} stroke={fill} strokeLinecap="round" strokeLinejoin="round">
      <path d="M -34 6 L -34 760 L 34 760 L 34 6 Z" stroke="none" />
      <path d="M -40 6 C -46 -36 -48 -68 -43 -96 L 43 -96 C 48 -68 46 -36 40 6 Z" stroke="none" />
      {fingers.map((d, i) => (
        <path key={i} d={d} strokeWidth={21} fill="none" />
      ))}
      <path d={thumb} strokeWidth={22} fill="none" />
    </g>
  );
};

// The rescue, close: Peter's hand up out of the water and the Lord's hand of
// light coming down to take his wrist. grip runs 0 (apart) to 1 (held).
export const Hands = ({ grip, t }: { grip: number; t: number }) => {
  const tremble = (1 - grip) * Math.sin(t * 38) * 5;
  const pw: Pt = [400 + tremble, 1420];
  const lw: Pt = [pw[0] + 250 + (1 - grip) * 260, pw[1] - 300 - (1 - grip) * 380];
  const drops = rng(61);
  return (
    <g>
      <defs>
        <radialGradient id="handGlow">
          <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="0.3" stopColor="#ffe3a4" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f0a94a" stopOpacity={0} />
        </radialGradient>
        <filter id="armSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <circle cx={lw[0]} cy={lw[1]} r={620} fill="url(#handGlow)" opacity={0.45 + grip * 0.45} style={{ mixBlendMode: 'screen' }} />
      <Hand x={pw[0]} y={pw[1]} angle={14} scale={2.2} curl={0.12 + grip * 0.25} fill={INK} />
      {Array.from({ length: 8 }, (_, i) => {
        const life = (t * 1.4 + drops()) % 1;
        return <ellipse key={i} cx={r1(pw[0] - 60 + drops() * 200)} cy={r1(pw[1] - 220 + life * 600)} rx={7} ry={15} fill="#9fb3d8" opacity={(1 - life) * 0.8} />;
      })}
      <g filter="url(#armSoft)">
        <Hand x={lw[0]} y={lw[1]} angle={214} scale={2.2} curl={0.2 + grip * 0.65} fill="#fff6e0" side={-1} />
      </g>
    </g>
  );
};
