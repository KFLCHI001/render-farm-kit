import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import { interpolate } from 'remotion';
import { mulish } from '../../brand';
import { INK } from './paper';

// The Who stopped caption look, shared by the pilot and the long Shorts cut:
// Fredoka 600, cream with a gold word, an ink ring outline and a pop-in.
export const fredoka = loadFredoka('normal', { weights: ['600'], subsets: ['latin'] });
export const CREAM = '#fff4d8';
export const GOLD = '#ffd04a';

export type Cap = { from: number; to: number; text: string; y: number; size: number; gold?: boolean; cite?: string; sub?: string };

export const ring = (r: number) =>
  `${Array.from({ length: 16 }, (_, i) => `${(Math.cos((i / 16) * Math.PI * 2) * r).toFixed(1)}px ${(Math.sin((i / 16) * Math.PI * 2) * r).toFixed(1)}px 0 ${INK}`).join(',')},0 ${(r + 5).toFixed(1)}px 0 ${INK}`;

export const Caption = ({ cap, f, subFrom }: { cap: Cap; f: number; subFrom: number }) => {
  if (f < cap.from || f >= cap.to) return null;
  const a = f - cap.from;
  const pop = interpolate(a, [0, 3, 6], [cap.from === 0 ? 0.86 : 0.62, 1.13, 1], { extrapolateRight: 'clamp' });
  const tilt = ((cap.from * 7) % 5) - 2;
  const out = interpolate(f, [cap.to - 2, cap.to], [1, 0], { extrapolateLeft: 'clamp' });
  const lines = cap.text.split('\n');
  const est = Math.max(...lines.map((l) => l.length)) * cap.size * 0.54;
  const size = cap.size * Math.min(1, 940 / est);
  return (
    <div style={{ position: 'absolute', top: cap.y, left: 40, right: 40, textAlign: 'center', opacity: out }}>
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
        <div style={{ marginTop: lines.length > 1 ? 22 : 10, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 42, letterSpacing: '0.12em', color: CREAM, textShadow: ring(4) }}>{cap.cite.toUpperCase()}</div>
      ) : null}
      {cap.sub && f >= subFrom ? (
        <div style={{ marginTop: 24, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 40, color: CREAM, textShadow: ring(3.5) }}>{cap.sub}</div>
      ) : null}
    </div>
  );
};
