import type { ReactNode } from 'react';

// Shadow puppet toolkit (after the huashu 34_shadowpuppet recipe, MIT), in SVG.
// A piece is leather: a colour fill, carved patterns cut out of it (an SVG mask),
// an uncut leather edge so carving never breaks the outline, and a dark edge line.
// A layer is printed on the lamp screen with multiply, after a soft offset shadow,
// so leather overlaps darken like real translucent hide.

export type Pt = readonly [number, number];

export const INK = '#3a160a';
export const RED = '#c0352a';
export const GRN = '#2f7d4c';
export const AMB = '#d99a2e';
export const YEL = '#e2bd4a';
export const BLU = '#2c5a8a';
export const ORG = '#d9782a';
export const BRN = '#8a4a22';

const r1 = (n: number) => Math.round(n * 10) / 10;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Smooth value noise in -1..1.
export const noise = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const fr = x - i;
  const u = fr * fr * (3 - 2 * fr);
  const a = hash(i + seed * 57.3);
  const b = hash(i + 1 + seed * 57.3);
  return (a + (b - a) * u) * 2 - 1;
};

// Catmull-Rom through the points, as a cubic bezier path.
export const smooth = (pts: readonly Pt[], closed = true, t = 1) => {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C ${r1(p1[0] + ((p2[0] - p0[0]) / 6) * t)} ${r1(p1[1] + ((p2[1] - p0[1]) / 6) * t)} ${r1(p2[0] - ((p3[0] - p1[0]) / 6) * t)} ${r1(p2[1] - ((p3[1] - p1[1]) / 6) * t)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
};

export const poly = (pts: readonly Pt[]) => `M ${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join(' L ')} Z`;

// A bumpy cloud or canopy outline: n round bumps with cusps between them.
export const scallop = (cx: number, cy: number, rx: number, ry: number, n: number, amp = 0.16, rot = 0, steps = 96) => {
  const pts: Pt[] = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const r = 1 - amp + amp * Math.abs(Math.sin((n * a) / 2));
    pts.push([cx + rx * r * Math.cos(a + rot), cy + ry * r * Math.sin(a + rot)]);
  }
  return poly(pts);
};

// An Archimedean cloud spiral with a short tail.
export const spiralD = (x: number, y: number, r: number, dir = 1, turns = 2, rot = 0) => {
  const n = 44;
  let d = '';
  let ex = x;
  let ey = y;
  let ea = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = rot + dir * u * turns * Math.PI * 2;
    const rr = r * (0.1 + 0.9 * u);
    ex = x + rr * Math.cos(a);
    ey = y + rr * Math.sin(a);
    ea = a;
    d += `${i ? ' L' : 'M'} ${r1(ex)} ${r1(ey)}`;
  }
  const tx = -Math.sin(ea) * dir;
  const ty = Math.cos(ea) * dir;
  return `${d} Q ${r1(ex + tx * r * 0.7)} ${r1(ey + ty * r * 0.7)} ${r1(ex + tx * r * 1.5 + Math.cos(ea) * r * 0.5)} ${r1(ey + ty * r * 1.5 + Math.sin(ea) * r * 0.5)}`;
};

// ---- carving (children of a piece's mask: black cuts, white keeps) ----

export const Dots = ({ x, y, w, h, k = 'm' }: { x: number; y: number; w: number; h: number; k?: 's' | 'm' | 'l' }) => (
  <rect x={x} y={y} width={w} height={h} fill={`url(#dots-${k})`} />
);
export const Lat = ({ x, y, w, h, k = 'l' }: { x: number; y: number; w: number; h: number; k?: 's' | 'l' | 'd' }) => (
  <rect x={x} y={y} width={w} height={h} fill={`url(#lat-${k})`} />
);
export const Flower = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={`translate(${x} ${y})`}>
    {[0, 1, 2, 3, 4].map((i) => (
      <ellipse key={i} cx={0} cy={-r * 0.56} rx={r * 0.3} ry={r * 0.46} transform={`rotate(${i * 72})`} fill="#000" />
    ))}
  </g>
);
export const Cloud = ({ x, y, r, dir = 1, rot = 0 }: { x: number; y: number; r: number; dir?: 1 | -1; rot?: number }) => (
  <path d={spiralD(x, y, r, dir, 2, rot)} fill="none" stroke="#000" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
);
export const Ln = ({ d, w = 4 }: { d: string; w?: number }) => (
  <path d={d} fill="none" stroke="#000" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
);
export const Keep = ({ d, w = 4 }: { d: string; w?: number }) => (
  <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
);
export const Hole = ({ d }: { d: string }) => <path d={d} fill="#000" />;

// ---- pieces ----

export const Piece = ({
  id,
  d,
  fill,
  edge = 6,
  line = 3,
  strokeD,
  carve,
}: {
  id: string;
  d: string;
  fill: string;
  edge?: number;
  line?: number;
  strokeD?: string;
  carve?: ReactNode;
}) => (
  <g>
    {carve ? (
      <mask id={id} maskUnits="userSpaceOnUse" x={-3000} y={-3000} width={6000} height={6000}>
        <rect x={-3000} y={-3000} width={6000} height={6000} fill="#fff" />
        {carve}
        <path d={d} fill="none" stroke="#fff" strokeWidth={edge * 2} strokeLinejoin="round" />
      </mask>
    ) : null}
    <path d={d} fill={fill} mask={carve ? `url(#${id})` : undefined} />
    <path d={strokeD ?? d} fill="none" stroke={INK} strokeWidth={line} strokeLinejoin="round" strokeLinecap="round" />
  </g>
);

export const Rivet = ({ x, y, r = 10 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#2a1006" />
    <circle cx={x - 1} cy={y - 1} r={r * 0.45} fill="#b07a3a" />
  </g>
);

// A control rod: from a joint straight down past the bottom of the screen.
export const Rod = ({ x, y, x2 }: { x: number; y: number; x2?: number }) => (
  <path d={`M ${r1(x)} ${r1(y)} L ${r1(x2 ?? x)} 2500`} stroke="rgba(60,30,12,0.88)" strokeWidth={5.5} strokeLinecap="round" fill="none" />
);

export const Rods = ({ children }: { children: ReactNode }) => (
  <g style={{ mixBlendMode: 'multiply' }} filter="url(#rodBlur)">
    {children}
  </g>
);

// A layer printed on the screen: soft offset shadow, then the leather, both multiplied.
export const Layer = ({ id, dx = 7, dy = 5, a = 0.28, fade = 1, children }: { id: string; dx?: number; dy?: number; a?: number; fade?: number; children: ReactNode }) => (
  <>
    <defs>
      <g id={id}>{children}</g>
    </defs>
    <g style={{ mixBlendMode: 'multiply' }}>
      <use href={`#${id}`} transform={`translate(${dx} ${dy})`} filter="url(#shadowSoft)" opacity={a} />
      <use href={`#${id}`} opacity={fade} />
    </g>
  </>
);

export const Defs = () => (
  <defs>
    <pattern id="dots-s" width={15} height={15} patternUnits="userSpaceOnUse">
      <circle cx={7.5} cy={7.5} r={2.8} fill="#000" />
    </pattern>
    <pattern id="dots-m" width={22} height={22} patternUnits="userSpaceOnUse">
      <circle cx={11} cy={11} r={3.8} fill="#000" />
    </pattern>
    <pattern id="dots-l" width={32} height={32} patternUnits="userSpaceOnUse">
      <circle cx={16} cy={16} r={5.6} fill="#000" />
    </pattern>
    <pattern id="lat-l" width={32} height={32} patternUnits="userSpaceOnUse">
      <rect x={7} y={7} width={18} height={18} fill="#000" />
    </pattern>
    <pattern id="lat-s" width={22} height={22} patternUnits="userSpaceOnUse">
      <rect x={5} y={5} width={12} height={12} fill="#000" />
    </pattern>
    <pattern id="lat-d" width={34} height={34} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect x={8} y={8} width={18} height={18} fill="#000" />
    </pattern>
    <pattern id="weave" width={3} height={3} patternUnits="userSpaceOnUse">
      <rect width={3} height={3} fill="#fff" />
      <rect width={3} height={1} fill="rgba(120,90,50,0.10)" />
      <rect width={1} height={3} fill="rgba(120,90,50,0.10)" />
    </pattern>
    <filter id="shadowSoft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.1  0 0 0 0 0.03  0 0 0 1 0" />
      <feGaussianBlur stdDeviation={6} />
    </filter>
    <filter id="rodBlur" filterUnits="userSpaceOnUse" x={-4000} y={-4000} width={9000} height={9000}>
      <feGaussianBlur stdDeviation={1.2} />
    </filter>
    <filter id="softGlow" filterUnits="userSpaceOnUse" x={-4000} y={-4000} width={9000} height={9000}>
      <feGaussianBlur stdDeviation={14} />
    </filter>
  </defs>
);

const mixHex = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};

// The lamp-lit cloth: warm radial glow, a hot spot, a flickering centre stepped at 15 fps.
export const LampScreen = ({ f, bloom = 0, dusk = 0, W, H }: { f: number; bloom?: number; dusk?: number; W: number; H: number }) => {
  const ts = Math.floor(f / 2) / 15;
  const fl = 0.5 * noise(ts * 3, 1) + 0.3 * noise(ts * 9, 4);
  const cx = W / 2 + fl * 26;
  const cy = 800 + noise(ts * 2, 7) * 18;
  const pale = (c: string, dk: string, bk = 0.5) => mixHex(mixHex(c, dk, dusk), '#fffbe6', bloom * bk);
  const hot = 340 + fl * 50 + bloom * 520;
  const hotA = Math.min(0.95, 0.55 + fl * 0.25 + bloom * 0.35) * (1 - dusk * 0.45);
  return (
    <g>
      <defs>
        <radialGradient id="lampGrad" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} fx={cx} fy={cy + 40} r={1100}>
          <stop offset={0} stopColor={`rgb(255,${Math.round(246 + fl * 8)},${Math.round(214 + fl * 20)})`} />
          <stop offset={0.3} stopColor={pale('#f2d39a', '#d99a5a', 0.55)} />
          <stop offset={0.62} stopColor={pale('#c98a46', '#8a5528', 0.4)} />
          <stop offset={1} stopColor={pale('#5e3416', '#2a1408', 0.22)} />
        </radialGradient>
        <radialGradient id="hotGrad" gradientUnits="userSpaceOnUse" cx={cx} cy={cy - 10} r={hot}>
          <stop offset={0} stopColor={`rgba(255,236,190,${hotA})`} />
          <stop offset={1} stopColor="rgba(255,236,190,0)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#lampGrad)" />
      <rect x={0} y={0} width={W} height={H} fill="url(#hotGrad)" style={{ mixBlendMode: 'screen' }} />
    </g>
  );
};

export const Weave = ({ W, H }: { W: number; H: number }) => (
  <rect x={0} y={0} width={W} height={H} fill="url(#weave)" style={{ mixBlendMode: 'multiply' }} />
);

// The carved wooden frame of the screen, with a vignette on the cloth inside it.
export const WoodFrame = ({ W, H }: { W: number; H: number }) => {
  const b = 36;
  return (
    <g>
      <defs>
        <radialGradient id="frameVig" gradientUnits="userSpaceOnUse" cx={W / 2} cy={H * 0.45} r={H * 0.62}>
          <stop offset={0.55} stopColor="rgba(40,15,0,0)" />
          <stop offset={1} stopColor="rgba(40,15,0,0.42)" />
        </radialGradient>
      </defs>
      <rect x={b} y={b} width={W - 2 * b} height={H - 2 * b} fill="url(#frameVig)" />
      <path d={`M 0 0 H ${W} V ${H} H 0 Z M ${b} ${b} V ${H - b} H ${W - b} V ${b} Z`} fillRule="evenodd" fill="#2a140a" />
      <rect x={b - 14} y={b - 14} width={W - 2 * b + 28} height={H - 2 * b + 28} fill="none" stroke="#a8742e" strokeWidth={3} strokeDasharray="18 10" />
      <rect x={b - 2} y={b - 2} width={W - 2 * b + 4} height={H - 2 * b + 4} fill="none" stroke="#5a3016" strokeWidth={4} />
    </g>
  );
};

// A carved valance across the top of the screen, scalloped below.
export const Valance = ({ W }: { W: number }) => {
  const b = 36;
  const pts: Pt[] = [[b, b], [W - b, b]];
  const n = 24;
  for (let i = n; i >= 0; i--) {
    const x = b + ((W - 2 * b) * i) / n;
    pts.push([x, 112 + 34 * Math.abs(Math.sin((i / n) * Math.PI * 6))]);
  }
  const d = poly(pts);
  return (
    <Piece
      id="valance"
      d={d}
      fill={RED}
      edge={7}
      carve={
        <>
          <Dots x={b + 8} y={b + 8} w={W - 2 * b - 16} h={26} k="l" />
          <Lat x={b + 8} y={b + 56} w={W - 2 * b - 16} h={64} k="l" />
          {Array.from({ length: 6 }, (_, i) => (
            <Flower key={i} x={b + 90 + i * 180} y={b + 28} r={22} />
          ))}
        </>
      }
    />
  );
};
