import { Audio } from '@remotion/media';
import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { enterEase, garamondItalic, mulish } from './brand';
import { Boat, Hands, LightFigure, Peter, Ripples, Wren } from './bible-story/figures';
import { Bolt, H, Rain, Sea, Sky, Spray, Vignette, W, Weather, clamp01, layerBase, rng as rngW, standY } from './bible-story/world';

// Bible story short S1, Peter on the water (a retelling of Matthew 14:22-33).
// 30 s at 30 fps. Code-drawn: the storm, Peter in silhouette, the Lord as a
// figure of light who says only His recorded words, and Wren the sparrow.
//
// Beats (frames): 0 hook, Peter already standing on the storm | 90 Wren in the
// boat | 210 a light on the water | 300 "Come!" | 360 he steps down and walks |
// 510 he sees the wind; the music cuts at 540 | 570 he sinks, "Lord, save me!" |
// 664 the hand of light; white flash at 672, the storm is gone | 680 calm |
// 790 Matthew 14:31 card.
// appCut: the in-app cut, with no captions, no verse card text and no darkening behind the card.
export type PeterOnTheWaterProps = {
  durationSeconds: number;
  bedAudio?: string;
  grain?: string;
  appCut?: boolean;
};

export const defaultPeterOnTheWaterProps: PeterOnTheWaterProps = { durationSeconds: 30, bedAudio: '', grain: '', appCut: false };

export const BEATS = { musicCut: 540, grip: 672, calm: 680 } as const;

const fredoka = loadFredoka('normal', { weights: ['500', '600'], subsets: ['latin'] });
const FPS = 30;
const GOLD = '#ffcf6e';

// Lightning: bright on the strike frame, gone within six frames.
const strike = (f: number, at: number) => (f >= at && f < at + 7 ? [1, 0.35, 0.85, 0.3, 0.15, 0.06, 0][f - at] : 0);
const span = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
const ease = (f: number, a: number, b: number) => enterEase(span(f, a, b));

type Cap = { from: number; to: number; text: string; y: number; gold?: boolean; size?: number; cite?: string };

const CAPTIONS: Cap[] = [
  { from: 0, to: 88, text: 'He actually', y: 380 },
  { from: 22, to: 88, text: 'stepped out.', y: 490, gold: true, size: 120 },
  { from: 98, to: 150, text: 'Miles from shore.', y: 560 },
  { from: 152, to: 206, text: 'Middle of the night.', y: 560 },
  { from: 220, to: 262, text: 'Then someone', y: 560 },
  { from: 262, to: 298, text: 'walked on the waves.', y: 560 },
  { from: 312, to: 358, text: 'Come!', y: 560, gold: true, size: 190, cite: 'Matthew 14:29' },
  { from: 392, to: 430, text: 'And the water', y: 560 },
  { from: 430, to: 506, text: 'held.', y: 560, gold: true, size: 150 },
  { from: 516, to: 568, text: 'Then he saw', y: 560 },
  { from: 532, to: 568, text: 'the wind.', y: 670 },
  { from: 590, to: 662, text: 'Lord, save me!', y: 560, size: 120, cite: 'Matthew 14:30' },
  { from: 730, to: 788, text: 'I sink at', y: 520 },
  { from: 744, to: 788, text: 'the same part', y: 620 },
  { from: 756, to: 788, text: 'every time.', y: 720, gold: true },
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
          color: cap.gold ? GOLD : '#fffaf0',
          textShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 28px rgba(0,0,0,0.65)',
          WebkitTextStroke: '3px rgba(10,12,24,0.55)',
        }}
      >
        {cap.text}
      </div>
      {cap.cite ? (
        <div style={{ marginTop: 18, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 34, letterSpacing: '0.12em', color: '#f3e3c0', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          {cap.cite.toUpperCase()}
        </div>
      ) : null}
    </div>
  );
};

// Camera: zoom about a point, plus a small storm shake.
const Cam = ({ zoom, cx, cy, shake = 0, f, children }: { zoom: number; cx: number; cy: number; shake?: number; f: number; children: ReactNode }) => {
  const sx = shake * (Math.sin(f * 1.7) * 6 + Math.sin(f * 4.3) * 3);
  const sy = shake * (Math.cos(f * 1.3) * 5 + Math.sin(f * 3.1) * 2);
  return <g transform={`translate(${cx + sx} ${cy + sy}) scale(${zoom}) translate(${-cx} ${-cy})`}>{children}</g>;
};

// A wall of foreground water whose surface sits at y, for the sinking shot.
const FrontWater = ({ y, t, storm }: { y: number; t: number; storm: number }) => {
  let surf = '';
  for (let x = -40; x <= W + 40; x += 16) {
    const h = Math.pow((Math.sin(x / 210 + t * 2.4) + 1) / 2, 2.2) * 70 * storm + Math.sin(x / 90 - t * 3.1) * 12;
    surf += `${surf ? ' L ' : 'M '}${x} ${Math.round(y - h)}`;
  }
  return (
    <g>
      <defs>
        <linearGradient id="frontWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2744" />
          <stop offset="0.25" stopColor="#070b16" />
          <stop offset="1" stopColor="#020309" />
        </linearGradient>
      </defs>
      <path d={`${surf} L ${W + 40} ${H + 40} L -40 ${H + 40} Z`} fill="url(#frontWater)" />
      <path d={surf} fill="none" stroke="#7f93ba" strokeWidth={5} opacity={0.6} />
    </g>
  );
};

// A gunwale across the bottom of the frame, for over-the-edge shots.
const Gunwale = ({ y, tilt }: { y: number; tilt: number }) => (
  <g transform={`rotate(${tilt} 540 ${y})`}>
    <path d={`M -60 ${y} C 300 ${y - 26} 780 ${y - 26} 1140 ${y} L 1140 ${H + 80} L -60 ${H + 80} Z`} fill="#03050b" />
    <path d={`M -60 ${y} C 300 ${y - 26} 780 ${y - 26} 1140 ${y}`} fill="none" stroke="#3b2a1c" strokeWidth={10} />
  </g>
);

const storming = (flash: number): Weather => ({ storm: 1, flash });

const Shot = ({ f, appCut = false }: { f: number; appCut?: boolean }) => {
  const t = f / FPS;
  const L = 16;

  if (f < 90) {
    // Hook: a man standing on the storm.
    const flash = Math.max(strike(f, 0), strike(f, 46));
    const hz = 1180;
    const px = 540;
    const k = 10;
    return (
      <Cam zoom={interpolate(f, [0, 90], [1, 1.08])} cx={540} cy={1300} shake={0.8} f={f}>
        <Sky t={t} horizon={hz} weather={storming(flash * 0.55)} />
        <Bolt x={640} horizon={hz} seed={2} opacity={f < 3 ? 1 : 0} />
        <Bolt x={190} horizon={hz} seed={8} opacity={f >= 46 && f < 49 ? 1 : 0} />
        <Sea t={t} horizon={hz} weather={storming(flash * 0.55)} glowX={1000} glow={0.6} range={[0, k + 1]} />
        <Boat x={150} y={layerBase(2, L, hz) + 4} scale={0.3} rock={Math.sin(t * 1.6) * 7} t={t} />
        <Peter x={px} y={standY(k, L, hz, px, t, 1) + 6} scale={2.2} id="hook" pose={{ frontArm: [66, -14], backArm: [-58, 14], lean: Math.sin(t * 1.4) * 3, wind: t, rim: 0.8 }} />
        <Sea t={t} horizon={hz} weather={storming(flash * 0.55)} range={[k + 1, L]} />
        <Spray t={t} y={1700} intensity={1} />
        <Rain tr={t} intensity={1} flash={flash} />
      </Cam>
    );
  }

  if (f < 210) {
    // Wren clinging to the mast, soaked, eyes shut until something makes him look.
    const lf = f - 90;
    const flash = strike(f, 128);
    const look = span(f, 158, 166);
    const rock = Math.sin(t * 1.8) * 5;
    return (
      <Cam zoom={interpolate(lf, [0, 120], [1.04, 1.12])} cx={520} cy={1000} shake={1} f={f}>
        <Sky t={t} horizon={880} weather={storming(flash)} />
        <Sea t={t} horizon={880} weather={storming(flash)} />
        <g transform={`rotate(${rock} 540 1500)`}>
          <rect x={496} y={-40} width={44} height={1700} fill="#03050b" />
          <rect x={496} y={-40} width={6} height={1700} fill="#3b2a1c" opacity={0.7} />
          <rect x={360} y={1206} width={400} height={30} rx={8} fill="#03050b" />
          <Wren x={600} y={1020} scale={1.75} flip mood={{ t, wet: 0.85, eyes: interpolate(look, [0, 1], [0.12, 1]), lookX: -look, lookY: -0.2 * look, warm: 0.75, cover: 0.25 * (1 - look) }} />
          <Boat x={560} y={1760} scale={2.3} rock={0} t={t} mast={false} />
        </g>
        <Rain tr={t} intensity={1.2} flash={flash} />
      </Cam>
    );
  }

  if (f < 300) {
    // Over the gunwale: far out, a light walking on the water toward the boat.
    const lf = f - 210;
    const hz = 1020;
    const near = ease(lf, 0, 90);
    return (
      <Cam zoom={1 + lf * 0.0009} cx={700} cy={1100} shake={0.6} f={f}>
        <Sky t={t} horizon={hz} weather={storming(0)} />
        <Sea t={t} horizon={hz} weather={storming(0)} glowX={720} glow={0.5 + 0.4 * near} range={[0, 6]} />
        <LightFigure x={720} y={standY(5, L, hz, 720, t, 1)} scale={0.42 + 0.22 * near} t={t} intensity={interpolate(lf, [0, 14], [0, 1], { extrapolateRight: 'clamp' })} id="far" />
        <Sea t={t} horizon={hz} weather={storming(0)} range={[6, L]} />
        <Rain tr={t} intensity={1} flash={0} />
        <Gunwale y={1600} tilt={Math.sin(t * 1.6) * 3} />
        <Wren x={250} y={1560} scale={1.15} mood={{ t, wet: 0.85, eyes: 1, lookX: 1, lookY: -0.4, warm: 0.9 }} />
      </Cam>
    );
  }

  if (f < 360) {
    // "Come!"
    const lf = f - 300;
    const hz = 1180;
    const arm = interpolate(f, [304, 318], [8, 72], { easing: enterEase, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const speak = f >= 312 ? Math.exp(-(f - 312) / 10) : 0;
    return (
      <Cam zoom={1.02 + lf * 0.0012} cx={560} cy={1300} shake={0.4} f={f}>
        <Sky t={t} horizon={hz} weather={storming(0)} />
        <Sea t={t} horizon={hz} weather={storming(0)} glowX={600} glow={1} range={[0, 7]} />
        <LightFigure x={600} y={standY(6, L, hz, 600, t, 1) + 6} scale={1.75} t={t} intensity={1 + 0.3 * speak} reachDeg={arm} id="come" />
        <Sea t={t} horizon={hz} weather={storming(0)} range={[7, L]} />
        <Rain tr={t} intensity={0.8} flash={0} />
      </Cam>
    );
  }

  if (f < 510) {
    // He steps down from the boat, and the water holds.
    const hz = 1040;
    const k = 8;
    const step = 392;
    const walk = clamp01((f - step) / 118);
    const px = f < step ? 300 : 300 + walk * 380;
    const ground = standY(k, L, hz, px, t, 0.85);
    const lift = f < step ? interpolate(f, [360, 378, step], [-170, -190, 0], { extrapolateLeft: 'clamp' }) : 0;
    const phase = f < step ? 0 : (f - step) * 0.16;
    const stepAges = f >= step ? Array.from({ length: 6 }, (_, i) => step + i * 20).filter((s) => s <= f) : [];
    return (
      <Cam zoom={interpolate(f, [360, 510], [1.18, 1.28])} cx={(px + 1010) / 2} cy={1150} shake={0.5} f={f}>
        <Sky t={t} horizon={hz} weather={{ storm: 0.9, flash: 0 }} />
        <Sea t={t} horizon={hz} weather={{ storm: 0.85, flash: 0 }} glowX={960} glow={0.9} range={[0, k + 1]} />
        <LightFigure x={1010} y={standY(k - 1, L, hz, 1010, t, 0.85)} scale={1.15} t={t} intensity={1} reachDeg={64} id="walk" />
        <Boat x={60} y={layerBase(k, L, hz) + 50} scale={1.0} rock={Math.sin(t * 1.6) * 3} t={t} />
        <Wren x={190} y={layerBase(k, L, hz) - 52} scale={0.5} mood={{ t, wet: 0.8, eyes: 1, lookX: 1, cover: 0.85, warm: 0.6 }} />
        {stepAges.map((s, i) => (
          <Ripples key={s} x={300 + clamp01((s - step) / 118) * 380 + (i % 2 ? 14 : -10)} y={standY(k, L, hz, px, t, 0.85) + 2} age={(f - s) / FPS} />
        ))}
        <Peter
          x={px}
          y={ground + lift}
          scale={1.05}
          id="walk"
          pose={{ phase, stride: f < step ? 0.15 : 0.55, frontArm: f < step ? [40, 20] : [34, -10], backArm: [-30, 10], lean: f < step ? -4 : 4, wind: t, rim: 0.8 }}
        />
        <Sea t={t} horizon={hz} weather={{ storm: 0.85, flash: 0 }} range={[k + 1, L]} />
        <Rain tr={t} intensity={0.9} flash={0} />
      </Cam>
    );
  }

  if (f < 570) {
    // He sees the wind. A wave rises behind him, and time slows.
    const hz = 1040;
    const k = 8;
    const slow = f < BEATS.musicCut ? t : BEATS.musicCut / FPS + (f - BEATS.musicCut) / FPS / 6;
    const rise = ease(f, 510, 566);
    const px = 680;
    const crestY = (x: number) => hz + 120 - rise * 860 * Math.pow(Math.sin(((x + 300) / 1700) * Math.PI), 0.7) - Math.sin(x / 47 + slow * 4) * 12 - Math.sin(x / 19 - slow * 7) * 5;
    let wave = `M -40 ${hz + 300}`;
    for (let x = -40; x <= 1120; x += 12) wave += ` L ${x} ${Math.round(crestY(x))}`;
    wave += ` L 1120 ${hz + 300} Z`;
    const fr = rngW(17);
    const foam = Array.from({ length: 90 }, (_, i) => {
      const x = -40 + fr() * 1160;
      const up = fr() * 70 * rise;
      return <ellipse key={i} cx={Math.round(x)} cy={Math.round(crestY(x) + 4 - up)} rx={Math.round(3 + fr() * 12)} ry={Math.round(2 + fr() * 4)} fill="#d5e0f2" opacity={(0.2 + fr() * 0.5) * rise} />;
    });
    const spray = Array.from({ length: 120 }, (_, i) => {
      const x = -40 + fr() * 1160;
      const life = (slow * (0.5 + fr()) + fr()) % 1;
      return <circle key={i} cx={Math.round(x + life * 140)} cy={Math.round(crestY(x) - life * 120)} r={Math.round(2 + fr() * 6)} fill="#c9d6ee" opacity={(1 - life) * 0.45 * rise} />;
    });
    return (
      <Cam zoom={interpolate(f, [510, 570], [1.1, 1.3])} cx={px} cy={1180} shake={f < BEATS.musicCut ? 1 : 0.15} f={f}>
        <Sky t={slow} horizon={hz} weather={storming(strike(f, 514))} />
        <defs>
          <filter id="foamSoft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <linearGradient id="bigWave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b6f96" />
            <stop offset="0.12" stopColor="#1a2846" />
            <stop offset="1" stopColor="#060a14" />
          </linearGradient>
        </defs>
        <path d={wave} fill="url(#bigWave)" />
        <g filter="url(#foamSoft)">
          {foam}
          {spray}
        </g>
        <Sea t={slow} horizon={hz} weather={storming(0)} glowX={1050} glow={0.5 * (1 - rise)} range={[0, k + 1]} />
        <Peter x={px} y={standY(k, L, hz, px, slow, 1)} scale={1.5} id="wind" pose={{ frontArm: [60 + rise * 40, -20], backArm: [-50, 20], lean: -10 * rise, wind: slow, windStrength: 1.8, rim: 0.6 * (1 - rise) }} />
        <Sea t={slow} horizon={hz} weather={storming(0)} range={[k + 1, L]} />
        <Rain tr={slow} intensity={1.1} flash={0} />
      </Cam>
    );
  }

  if (f < 664) {
    // He sinks. One arm up.
    const lf = f - 570;
    const sink = ease(f, 570, 604);
    const bob = Math.sin(lf * 0.21) * 10;
    const surface = 1200;
    const flash = strike(f, 626);
    return (
      <Cam zoom={1.04 + lf * 0.0008} cx={540} cy={1100} shake={1.1} f={f}>
        <Sky t={t} horizon={1000} weather={storming(flash)} />
        <Sea t={t} horizon={1000} weather={storming(flash)} range={[0, 6]} />
        <Peter x={520} y={1690 + sink * 220 + bob} scale={3.0} id="sink" pose={{ frontArm: [160, 10], backArm: [-150, -14], lean: -4, wind: t, windStrength: 1.5 }} />
        <FrontWater y={surface} t={t} storm={1} />
        <Spray t={t} y={surface} intensity={1.2} />
        <Rain tr={t} intensity={1.2} flash={flash} />
      </Cam>
    );
  }

  if (f < BEATS.calm) {
    // The hand of light takes his wrist.
    const grip = ease(f, 664, BEATS.grip);
    const flash = f >= BEATS.grip ? 1 : 0;
    return (
      <g>
        <Sky t={t} horizon={1500} weather={storming(0)} />
        <Rain tr={t} intensity={1} flash={0} />
        <Hands grip={grip} t={t} />
        <FrontWater y={1500} t={t} storm={1} />
        {flash ? <rect x={0} y={0} width={W} height={H} fill="#fffaf0" opacity={interpolate(f, [BEATS.grip, BEATS.calm], [1, 0.7])} /> : null}
      </g>
    );
  }

  // Calm. The sea is glass, the stars are out, and they stand together.
  const lf = f - BEATS.calm;
  const hz = 1000;
  const k = 9;
  const calm: Weather = { storm: 0, flash: 0 };
  const whiteOut = interpolate(lf, [0, 14], [0.7, 0], { extrapolateRight: 'clamp' });
  const shake = f >= 712 ? (f - 712) / FPS : -1;
  const dry = clamp01((f - 735) / 30);
  return (
    <g>
      <Cam zoom={interpolate(lf, [0, 220], [1.1, 1.0])} cx={560} cy={1300} f={f}>
        <Sky t={t} horizon={hz} weather={calm} moon={1} />
        <Sea t={t} horizon={hz} weather={calm} moonX={760} moon={1} glowX={570} glow={0.6} range={[0, k + 1]} />
        <Boat x={150} y={layerBase(4, L, hz) + 10} scale={0.5} rock={Math.sin(t) * 1} t={t} />
        <LightFigure x={650} y={standY(k, L, hz, 650, t, 0)} scale={1.6} t={t} intensity={0.95} reachDeg={30} rays={0.35} id="calm" />
        <Peter x={480} y={standY(k, L, hz, 480, t, 0)} scale={1.55} id="calm" pose={{ frontArm: [36, 30], backArm: [-6, 4], lean: 6, rim: 1, windStrength: 0.1 }} />
        <Sea t={t} horizon={hz} weather={calm} range={[k + 1, L]} />
      </Cam>
      <Gunwale y={1780} tilt={0} />
      <Wren x={880} y={1716} scale={0.95} flip mood={{ t, wet: 1 - 0.6 * dry, shake, eyes: f >= 744 ? 0.55 : 1, lookX: -0.3, warm: 0.5 }} />
      {!appCut && f >= 790 ? <rect x={0} y={0} width={W} height={H} fill="#03050c" opacity={interpolate(f, [790, 806], [0, 0.42], { extrapolateRight: 'clamp' })} /> : null}
      {whiteOut > 0 ? <rect x={0} y={0} width={W} height={H} fill="#fffaf0" opacity={whiteOut} /> : null}
    </g>
  );
};

const VerseCard = ({ f }: { f: number }) => {
  if (f < 796) return null;
  const a = ease(f, 796, 816);
  const b = ease(f, 816, 836);
  const c = ease(f, 842, 860);
  return (
    <div style={{ position: 'absolute', top: 560, left: 70, right: 70, textAlign: 'center' }}>
      <div style={{ fontFamily: garamondItalic.fontFamily, fontStyle: 'italic', fontSize: 86, lineHeight: 1.15, color: '#fbf4e2', textShadow: '0 2px 24px rgba(0,0,0,0.8)' }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>"You of little faith,</div>
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 20}px)` }}>why did you doubt?"</div>
      </div>
      <div style={{ opacity: c, marginTop: 40, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 32, letterSpacing: '0.14em', color: GOLD }}>MATTHEW 14:31, WEBCE</div>
      <div style={{ opacity: c * 0.85, marginTop: 14, fontFamily: mulish.fontFamily, fontWeight: 400, fontSize: 28, color: '#e8dcc2' }}>A retelling of Matthew 14</div>
    </div>
  );
};

export const PeterOnTheWater = (props: PeterOnTheWaterProps) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#02040a' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <Shot f={f} appCut={props.appCut} />
        <Vignette strength={f >= BEATS.calm ? 0.55 : 0.8} />
      </svg>
      {props.grain ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${staticFile(props.grain)})`,
            backgroundSize: '384px 384px',
            backgroundPosition: `${(f * 37) % 384}px ${(f * 61) % 384}px`,
            opacity: 0.1,
            mixBlendMode: 'overlay',
          }}
        />
      ) : null}
      {props.appCut
        ? null
        : CAPTIONS.map((cap) => <Caption key={`${cap.from}-${cap.text}`} cap={cap} f={f} />)}
      {props.appCut ? null : <VerseCard f={f} />}
      {props.bedAudio ? <Audio src={staticFile(props.bedAudio)} /> : null}
    </AbsoluteFill>
  );
};
