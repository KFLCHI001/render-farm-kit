import type { CSSProperties } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadGaramond } from '@remotion/google-fonts/EBGaramond';
import { loadFont as loadMulish } from '@remotion/google-fonts/Mulish';

export const garamond = loadGaramond('normal', { weights: ['400', '600'], subsets: ['latin'] });
export const garamondItalic = loadGaramond('italic', { weights: ['400', '500'], subsets: ['latin'] });
export const mulish = loadMulish('normal', { weights: ['400', '700'], subsets: ['latin'] });

// Brand tokens from DESIGN.md. The base palette is fixed; the accent follows the season.
export const tokens = {
  bg: '#F5EEE1',
  surface: '#FBF6EC',
  ink: '#2C2823',
  muted: '#6E6559',
  line: '#E4DAC6',
  gold: '#AE8B4B',
};

export const accents: Record<string, { accent: string; soft: string }> = {
  green: { accent: '#5F7E69', soft: '#E7ECE4' },
  violet: { accent: '#5C4E8C', soft: '#E8E5EF' },
  gold: { accent: '#AE8B4B', soft: '#F1E9D8' },
  rose: { accent: '#C98B9A', soft: '#F3E6E9' },
  red: { accent: '#9C3A33', soft: '#EFE0DD' },
};

export const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

export const labelStyle: CSSProperties = {
  fontFamily: mulish.fontFamily,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

export type ShortCaptionWord = {
  text: string;
  start: number;
  end: number;
};

export type ShortCaption = {
  text: string;
  start: number;
  end: number;
  kind: string;
  // Word-level timings (absolute seconds) from whisper alignment. When absent,
  // the caption renders as a static block.
  words?: ShortCaptionWord[];
};

export const Flourish = ({ color }: { color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
    <div style={{ width: 110, height: 2, backgroundColor: tokens.line }} />
    <svg width="30" height="30" viewBox="0 0 30 30">
      <path
        d="M15 3v24M5 12h20"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
    <div style={{ width: 110, height: 2, backgroundColor: tokens.line }} />
  </div>
);

// Words gently surface as they are spoken: already-spoken words rest at full
// ink, upcoming words wait as a faint impression. Calm, no movement per word.
export const WordFlow = ({
  caption,
  style,
}: {
  caption: ShortCaption;
  style: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSeconds = caption.start + frame / fps;

  if (!caption.words) {
    return <div style={style}>{caption.text}</div>;
  }

  return (
    <div style={style}>
      {caption.words.map((word, index) => {
        const progress = interpolate(nowSeconds, [word.start, word.start + 0.28], [0, 1], {
          easing: enterEase,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const opacity = 0.16 + 0.84 * progress;
        return (
          <span key={index} style={{ opacity }}>
            {word.text}
            {index < caption.words!.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};

// The one slow-moving element shared by the Short compositions: a soft seasonal
// glow drifting behind the text over the whole duration.
export const DriftingGlow = ({ accentSoft, bg = tokens.bg }: { accentSoft: string; bg?: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 80]);
  return (
    <div
      style={{
        position: 'absolute',
        width: 1300,
        height: 1300,
        borderRadius: '50%',
        left: -260,
        top: 420 + drift,
        background: `radial-gradient(circle, ${accentSoft} 0%, ${bg} 68%)`,
      }}
    />
  );
};
