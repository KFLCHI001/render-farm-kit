// The sea, sky and weather for the Bible story shorts. Everything is drawn from
// a fixed seed and the current time, so any frame renders the same way twice.

export const W = 1080;
export const H = 1920;
const TAU = Math.PI * 2;

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const r1 = (n: number) => Math.round(n * 10) / 10;

// Hex colour blend, for grading a palette between storm and calm.
export const blend = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(mix(ch(pa, s), ch(pb, s), clamp01(k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};

export type Weather = {
  // 1 is the full storm, 0 is the glassy calm after the rescue.
  storm: number;
  // 0..1 lightning brightness this frame.
  flash: number;
};

// Peaked waves: narrow crests, wide troughs, like a sea under wind.
const crest = (u: number) => Math.pow((Math.sin(u) + 1) / 2, 2.4);

export const swellAmp = (f: number, storm: number) => (3 + 230 * f * f) * (0.04 + 0.96 * storm);

// The water surface height at x for one depth layer. f runs 0 (horizon) to 1 (camera).
export const waveY = (x: number, t: number, f: number, storm: number, seed: number) => {
  const wl = 70 + 520 * f * f;
  const amp = swellAmp(f, storm);
  const sp = 0.8 + 1.6 * f;
  return (
    -amp *
    (0.62 * crest((x / wl) * TAU + t * sp + seed * 1.7) +
      0.38 * crest((x / (wl * 0.57)) * TAU - t * sp * 1.27 + seed * 0.9) -
      0.3)
  );
};

export const Sky = ({ t, horizon, weather, moon = 0 }: { t: number; horizon: number; weather: Weather; moon?: number }) => {
  const { storm, flash } = weather;
  const top = blend(blend('#04060f', '#03050d', storm), '#7d8fb8', flash * 0.9);
  const low = blend(blend('#17264a', '#263450', storm), '#c9d4ea', flash);
  const r = rng(77);
  const clouds = Array.from({ length: 9 }, (_, i) => ({
    x: r() * 1500 - 210 + ((t * (14 + r() * 22)) % 1700) - 300,
    y: horizon * (0.08 + r() * 0.72),
    rx: 260 + r() * 320,
    ry: 90 + r() * 120,
    k: i,
  }));
  const stars = rng(91);
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <radialGradient id="moonGlow">
          <stop offset="0" stopColor="#f6ecd2" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f6ecd2" stopOpacity={0} />
        </radialGradient>
        <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
      </defs>
      <rect x={0} y={0} width={W} height={horizon + 4} fill="url(#sky)" />
      {moon > 0 ? (
        <g opacity={moon}>
          {Array.from({ length: 140 }, (_, i) => {
            const sx = stars() * W;
            const sy = stars() * horizon * 0.95;
            const tw = 0.5 + 0.5 * Math.sin(t * (1 + stars() * 2) + i);
            return <circle key={i} cx={r1(sx)} cy={r1(sy)} r={r1(0.8 + stars() * 2.2)} fill="#f3ecdc" opacity={0.35 + 0.6 * tw * stars()} />;
          })}
          <circle cx={760} cy={horizon * 0.3} r={260} fill="url(#moonGlow)" />
          <circle cx={760} cy={horizon * 0.3} r={54} fill="#f7f0dc" />
        </g>
      ) : null}
      {storm > 0.02 ? (
        <g filter="url(#cloudBlur)" opacity={storm}>
          {clouds.map((c) => (
            <ellipse
              key={c.k}
              cx={r1(c.x)}
              cy={r1(c.y)}
              rx={c.rx}
              ry={c.ry}
              fill={blend(c.k % 2 ? '#0b1120' : '#141c30', '#aebcdc', flash * (0.6 + 0.4 * (c.k % 3) / 2))}
            />
          ))}
        </g>
      ) : null}
    </g>
  );
};

// A jagged bolt from the clouds toward the horizon.
export const Bolt = ({ x, horizon, seed, opacity }: { x: number; horizon: number; seed: number; opacity: number }) => {
  if (opacity <= 0) return null;
  const r = rng(seed);
  let px = x;
  let d = `M ${px} -10`;
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    px += (r() - 0.5) * 90;
    d += ` L ${r1(px)} ${r1((horizon * i) / steps)}`;
  }
  return (
    <g opacity={opacity}>
      <path d={d} stroke="#c9d8ff" strokeWidth={22} fill="none" opacity={0.25} strokeLinejoin="round" />
      <path d={d} stroke="#ffffff" strokeWidth={5} fill="none" strokeLinejoin="round" />
    </g>
  );
};

export const layerBase = (k: number, layers: number, horizon: number) => horizon + Math.pow(k / (layers - 1), 1.7) * (H - horizon + 260);

// Where a figure standing on layer k at x meets the water.
export const standY = (k: number, layers: number, horizon: number, x: number, t: number, storm: number) =>
  layerBase(k, layers, horizon) + waveY(x, t, k / (layers - 1), storm, k);

// Depth layers of water from the horizon down past the bottom of the frame.
export const Sea = ({
  t,
  horizon,
  weather,
  glowX,
  glow = 0,
  moonX,
  moon = 0,
  layers = 16,
  range = [0, 16],
}: {
  t: number;
  horizon: number;
  weather: Weather;
  glowX?: number;
  glow?: number;
  moonX?: number;
  moon?: number;
  layers?: number;
  // Draw only layers [from, to), so a figure can stand between them.
  range?: [number, number];
}) => {
  const { storm, flash } = weather;
  const bands = [];
  const far = blend(blend('#1c2c52', '#2b3956', storm), '#8796b8', flash * 0.8);
  const near = blend('#03050c', '#05070e', storm);
  for (let k = range[0]; k < Math.min(layers, range[1]); k++) {
    const f = k / (layers - 1);
    const yBase = layerBase(k, layers, horizon);
    let surf = '';
    const foam = [];
    const fr = rng(300 + k);
    for (let x = -40; x <= W + 40; x += 14) {
      const y = yBase + waveY(x, t, f, storm, k);
      surf += `${surf ? ' L ' : 'M '}${x} ${r1(y)}`;
      // White water only on the highest crests of the nearer swells.
      const peak = -waveY(x, t, f, storm, k) / swellAmp(f, storm);
      if (storm > 0.3 && f > 0.35 && peak > 0.48 && fr() < 0.8) {
        foam.push(<ellipse key={x} cx={r1(x + fr() * 8)} cy={r1(y + 2 + fr() * 6 * f)} rx={r1(6 + 22 * f * fr())} ry={r1(2 + 6 * f * fr())} fill="#c7d4ec" opacity={r1((0.2 + 0.5 * fr()) * storm * 100) / 100} />);
      }
    }
    const d = `${surf} L ${W + 40} ${H + 40} L -40 ${H + 40} Z`;
    const base = blend(far, near, Math.pow(f, 0.7));
    const lit = blend(base, blend('#6d80a8', '#dfe8ff', flash), 0.06 + 0.5 * storm);
    // Highlight depth on each swell's face: thin, so it reads as light on water.
    const edge = Math.min(0.5, 26 / (H + 40 - yBase + 60));
    bands.push(
      <g key={k}>
        <defs>
          <linearGradient id={`band${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lit} />
            <stop offset={r1(edge * 1000) / 1000} stopColor={base} />
            <stop offset="1" stopColor={blend(base, '#000000', 0.35)} />
          </linearGradient>
        </defs>
        <path d={d} fill={`url(#band${k})`} />
        {foam}
      </g>,
    );
  }
  return (
    <g>
      <defs>
        <radialGradient id="seaGlow">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity={0.75} />
          <stop offset="0.4" stopColor="#f2b75e" stopOpacity={0.28} />
          <stop offset="1" stopColor="#f2b75e" stopOpacity={0} />
        </radialGradient>
      </defs>
      {bands}
      {range[0] === 0 && glow > 0 && glowX !== undefined ? (
        <ellipse cx={glowX} cy={horizon + 260} rx={520} ry={190} fill="url(#seaGlow)" opacity={glow} style={{ mixBlendMode: 'screen' }} />
      ) : null}
      {range[0] === 0 && moon > 0 && moonX !== undefined ? <MoonPath t={t} x={moonX} horizon={horizon} opacity={moon} /> : null}
    </g>
  );
};

// The moon's reflection on calm water: a soft column with a few slow glints.
const MoonPath = ({ t, x, horizon, opacity }: { t: number; x: number; horizon: number; opacity: number }) => {
  const r = rng(5);
  return (
    <g opacity={opacity} style={{ mixBlendMode: 'screen' }}>
      <defs>
        <linearGradient id="moonCol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6ecd2" stopOpacity={0.7} />
          <stop offset="1" stopColor="#f6ecd2" stopOpacity={0} />
        </linearGradient>
        <filter id="moonBlur" x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <path d={`M ${x - 30} ${horizon} L ${x + 30} ${horizon} L ${x + 190} ${H} L ${x - 190} ${H} Z`} fill="url(#moonCol)" filter="url(#moonBlur)" opacity={0.6} />
      {Array.from({ length: 18 }, (_, i) => {
        const f = r();
        const y = horizon + 10 + Math.pow(f, 1.3) * (H - horizon);
        const w = 14 + 90 * f;
        const dx = (r() - 0.5) * 120 * f + Math.sin(t * 0.9 + i * 2.3) * 10;
        return <ellipse key={i} cx={r1(x + dx)} cy={r1(y)} rx={r1(w)} ry={r1(1.5 + 3 * f)} fill="#fff6dc" opacity={r1((0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + i))) * 100) / 100} />;
      })}
    </g>
  );
};

// Wind-driven rain. tr is rain time, which slows for the slow-motion beat.
export const Rain = ({ tr, intensity, flash }: { tr: number; intensity: number; flash: number }) => {
  if (intensity <= 0) return null;
  const r = rng(13);
  const drops = [];
  for (let i = 0; i < 260; i++) {
    const speed = 1700 + r() * 1400;
    const len = 40 + r() * 80;
    const x0 = r() * (W + 900) - 300;
    const y0 = r() * (H + 300);
    const y = ((y0 + tr * speed) % (H + 300)) - 150;
    const x = x0 - (y + 150) * 0.38;
    drops.push(
      <line
        key={i}
        x1={r1(x)}
        y1={r1(y)}
        x2={r1(x - len * 0.38)}
        y2={r1(y + len)}
        stroke={blend('#9fb2d6', '#ffffff', flash)}
        strokeWidth={1.4 + r() * 1.6}
        opacity={(0.16 + r() * 0.28) * intensity}
      />,
    );
  }
  return <g>{drops}</g>;
};

// Spray thrown off the crests in the foreground.
export const Spray = ({ t, y, intensity }: { t: number; y: number; intensity: number }) => {
  if (intensity <= 0) return null;
  const r = rng(29);
  return (
    <g>
      {Array.from({ length: 70 }, (_, i) => {
        const life = (t * (0.6 + r()) + r()) % 1;
        const x = r() * W + life * 260;
        const yy = y - Math.sin(life * Math.PI) * (80 + r() * 160);
        return <circle key={i} cx={r1(x)} cy={r1(yy)} r={r1(2 + r() * 5)} fill="#c6d3ea" opacity={(1 - life) * 0.5 * intensity} />;
      })}
    </g>
  );
};

export const Vignette = ({ strength = 0.75 }: { strength?: number }) => (
  <g>
    <defs>
      <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={strength} />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={W} height={H} fill="url(#vig)" />
  </g>
);
