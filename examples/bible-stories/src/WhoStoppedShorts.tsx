import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { loadFont as loadMulish } from '@remotion/google-fonts/Mulish';
import { Burn, INK, PaperDefs, Parchment, back, boilSeed, ease } from './bible-story/paper/paper';
import { Caption, CREAM, GOLD, fredoka, ring } from './bible-story/paper/paper-caption';
import { Peel, TapeStrip, torn } from './bible-story/paper/paper-ancient';
import { InnDefs } from './bible-story/paper/paper-world';
import { Ambush, DonkeyRide, CrowdSnap, InnMorning, LawyerClose, Opening, Passers, PEEL_LEN, Rescue, Return, RoadWideScene, SC, SquareTalk, returnWarm } from './bible-story/paper/paper-scenes';
import { clamp01 } from './bible-story/world';
import captions from './bible-story/paper/who-stopped-shorts-captions.json';

// Bible story short, "Who stopped" (a retelling of Luke 10:25 to 37), the Shorts cut.
// Lane A: the paper parable, the pilot's flat cut-paper bean people stretched to almost
// three minutes. 168 s at 30 fps, 1080x1920. The modern street opens and closes the cut
// and the old road is dressed in torn card; a paper peel carries the story between them.
// Jesus is never drawn: his words are Scripture text. People step on twos (12 fps), lines
// boil at 8 fps, the camera is smooth. Audio is muxed after the render.
//
// Beats (s): 0 the street, people walk past | 6 title | 9 peel to the old square, the lawyer
// | 30 arms folded, "Who is my neighbor?" | 38 the road, wide | 52 the robbers | 62 the
// priest and the Levite | 80 the Samaritan on a donkey, the crowd turns | 96 the freeze, he
// kneels | 106 tape, oil, the lift, the inn door | 122 coins at the inn | 134 the lawyer
// unfolds his arms | 148 fold back to the street, the red helper kneels | 164 end card.
// appCut drops the narration captions and the end card; Scripture plates and cards stay in both cuts.
export type WhoStoppedShortsProps = { durationSeconds: number; appCut?: boolean };
export const defaultWhoStoppedShortsProps: WhoStoppedShortsProps = { durationSeconds: 168, appCut: false };

const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const mulish = loadMulish('normal', { weights: ['600', '700'], subsets: ['latin'] });

type W = { w: string; s: number; e: number };
type Line = { kind: string; ref: string | null; start_s: number; words: W[] };
const LINES = captions.lines as Line[];

/* ---------- narration captions: two to four words at a time ---------- */

type Chunk = { words: W[]; from: number; to: number };
const chunkLine = (line: Line): Chunk[] => {
  const out: W[][] = [];
  let cur: W[] = [];
  line.words.forEach((w, i) => {
    cur.push(w);
    const text = cur.map((x) => x.w).join(' ');
    const stop = /[.,;:?!]$/.test(w.w);
    const gap = i + 1 < line.words.length ? line.words[i + 1].s - w.e : 9;
    if ((stop && cur.length >= 2) || cur.length >= 4 || (cur.length >= 3 && text.length >= 15) || text.length >= 20 || gap > 0.5) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  const chunks: Chunk[] = [];
  out.forEach((ws, i) => {
    const from = Math.max(0, fr(ws[0].s) - 2);
    const next = out[i + 1];
    const nextFrom = next ? fr(next[0].s) - 2 : Infinity;
    const endF = fr(ws[ws.length - 1].e) + 8;
    chunks.push({ words: ws, from, to: Math.max(from + 8, nextFrom - from < 12 ? nextFrom : endF) });
  });
  return chunks;
};
const CHUNKS: Chunk[] = LINES.filter((l) => l.kind === 'narration').flatMap(chunkLine);

const splitLines = (words: string[]): string[][] => {
  const total = words.join(' ').length;
  if (total <= 13 || words.length < 2) return [words];
  let best = 1;
  let bestD = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [words.slice(0, best), words.slice(best)];
};

const NarrationCaption = ({ f }: { f: number }) => {
  const idx = CHUNKS.findIndex((c) => f >= c.from && f < c.to);
  if (idx < 0) return null;
  const c = CHUNKS[idx];
  const a = f - c.from;
  const pop = 0.62 + 0.51 * clamp01(a / 3) - (a > 3 ? 0.13 * clamp01((a - 3) / 3) : 0);
  const tilt = ((idx * 7) % 5) - 2;
  const out = clamp01((c.to - f) / 2);
  const rows = splitLines(c.words.map((w) => w.w));
  const longest = Math.max(...rows.map((r) => r.join(' ').length));
  const size = 124 * Math.min(1, 940 / (longest * 124 * 0.54));
  const t = f / FPS;
  const active = c.words.reduce((acc, w, i) => (t >= w.s ? i : acc), 0);
  let k = 0;
  return (
    <div style={{ position: 'absolute', top: 300, left: 40, right: 40, textAlign: 'center', opacity: out }}>
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${pop}) rotate(${tilt * Math.max(0, 1 - a / 14)}deg)`,
          fontFamily: fredoka.fontFamily,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.06,
          whiteSpace: 'pre',
          textShadow: ring(Math.max(5, size * 0.06)),
        }}
      >
        {rows.map((row, ri) => (
          <div key={ri}>
            {row.map((w, wi) => {
              const gi = k++;
              return (
                <span key={wi} style={{ color: gi === active ? GOLD : CREAM }}>
                  {w}
                  {wi < row.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Scripture, on torn paper ---------- */

type Plate = { text: string; cite: string; from: number; to: number; words?: W[] };

const PW = 940;
const wrapWords = (words: string[], maxChars: number): string[][] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    if (cur.length && cur.join(' ').length + 1 + w.length > maxChars) {
      rows.push(cur);
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) rows.push(cur);
  return rows;
};

const ScripturePlate = ({ p, f }: { p: Plate; f: number }) => {
  if (f < p.from || f >= p.to) return null;
  const a = f - p.from;
  const ws = p.words ? p.words.map((w) => w.w) : p.text.split(' ');
  let size = 66;
  let rows = wrapWords(ws, 20);
  for (; size >= 40; size -= 2) {
    rows = wrapWords(ws, Math.floor((PW - 120) / (size * 0.56)));
    if (rows.length * size * 1.16 + 190 <= 520) break;
  }
  const h = Math.round(rows.length * size * 1.16 + 190);
  const pop = a < 9 ? 0.86 + 0.14 * back(a / 9) : 1;
  const tilt = ((p.from * 7) % 5) - 2;
  const o = clamp01(a / 6) * clamp01((p.to - f) / 8);
  const t = f / FPS;
  const pts: [number, number][] = [[16, 22], [PW * 0.5, 14], [PW + 14, 20], [PW + 18, h * 0.5], [PW + 12, h + 16], [PW * 0.5, h + 22], [14, h + 14], [10, h * 0.5]];
  const d = torn(pts, p.from + 5, 6, 70);
  let wi = 0;
  return (
    <div style={{ position: 'absolute', top: 210, left: (1080 - PW) / 2 - 16, width: PW + 32, height: h + 32, opacity: o, transform: `scale(${pop}) rotate(${tilt * Math.max(0, 1 - a / 16)}deg)` }}>
      <svg width={PW + 32} height={h + 36} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <g filter="url(#cut)">
          <path d={d} fill="#f1e3bf" transform="translate(-6 -8)" />
          <path d={d} fill="#34231a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d={torn([[44, 44], [PW - 12, 40], [PW - 8, h - 8], [40, h - 4]], p.from + 9, 3, 70)} fill="none" stroke="#6b4c2e" strokeWidth={3} opacity={0.6} strokeDasharray="22 14" />
        </g>
        <TapeStrip x={96} y={26} rot={-24} len={70} w={26} />
        <TapeStrip x={PW - 66} y={h + 14} rot={18} len={70} w={26} />
      </svg>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 16, bottom: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: fredoka.fontFamily, fontWeight: 600, fontSize: size, lineHeight: 1.16, whiteSpace: 'pre', textShadow: ring(Math.max(4, size * 0.04)) }}>
          {rows.map((row, ri) => (
            <div key={ri}>
              {row.map((w, i) => {
                const gi = wi++;
                const lit = p.words ? t >= p.words[gi].s : false;
                return (
                  <span key={i} style={{ color: lit ? GOLD : CREAM }}>
                    {w}
                    {i < row.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 40, letterSpacing: '0.12em', color: CREAM, textShadow: ring(3.5) }}>{p.cite.toUpperCase()}</div>
      </div>
    </div>
  );
};

// Scripture on screen only. The words are the World English Bible, Catholic Edition, with the
// curly quotes kept.
const SCRIPTURE = {
  s1: 'You shall love the Lord your God with all your heart, with all your soul, with all your strength, and with all your mind; and your neighbor as yourself.',
  s3b: 'he fell among robbers, who both stripped him and beat him, and departed, leaving him half dead.',
  s4: 'When he saw him, he passed by on the other side.',
  s5: '(For Jews have no dealings with Samaritans.)',
  s8: 'Whatever you spend beyond that, I will repay you when I return.',
};

const lineStart = (i: number) => fr(LINES[i].words[0].s);
const lineEnd = (i: number) => fr(LINES[i].words[LINES[i].words.length - 1].e);
// A card arrives once the narration inside its beat has ended (or a moment after the beat starts if there is none).
const afterNarration = (beat: number, next: number, minDelay = 12): number => {
  let end = beat + minDelay;
  LINES.forEach((l, i) => {
    if (l.kind === 'narration' && lineStart(i) >= beat && lineStart(i) < next) end = Math.max(end, lineEnd(i) + 6);
  });
  return end;
};
const readAloud = (line: number, sceneStart: number, to: number, cite: string): Plate => ({
  text: LINES[line].words.map((w) => w.w).join(' '),
  cite,
  from: Math.max(sceneStart + 8, lineStart(line) - 10),
  to,
  words: LINES[line].words,
});
const PLATES: Plate[] = [
  { text: SCRIPTURE.s1, cite: 'Luke 10:27', from: afterNarration(SC.s1, SC.s2), to: SC.s2 },
  readAloud(3, SC.s2, SC.s3, 'Luke 10:29'),
  { text: SCRIPTURE.s3b, cite: 'Luke 10:30', from: afterNarration(SC.s3b, SC.s4, 14), to: SC.s4 },
  { text: SCRIPTURE.s4, cite: 'Luke 10:31', from: afterNarration(SC.s4, SC.s5), to: SC.s5 },
  { text: SCRIPTURE.s5, cite: 'John 4:9', from: afterNarration(SC.s5, SC.s6), to: SC.s6 },
  readAloud(7, SC.s6, SC.s7, 'Luke 10:33'),
  readAloud(8, SC.s7, SC.s8, 'Luke 10:34'),
  { text: SCRIPTURE.s8, cite: 'Luke 10:35', from: afterNarration(SC.s8, SC.s9), to: SC.s9 },
  readAloud(10, SC.s9, lineStart(11) - 10, 'Luke 10:36'),
  readAloud(11, SC.s9, lineStart(12) - 10, 'Luke 10:37'),
  readAloud(12, SC.s9, SC.s10, 'Luke 10:37'),
];

/* ---------- title, reflection label and end card ---------- */

const TITLE_AT = fr(6);

const Title = ({ f }: { f: number }) => {
  if (f < TITLE_AT || f >= SC.s1 + 10) return null;
  const o = 1 - clamp01((f - SC.s1) / 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o, filter: 'url(#cut)' }}>
      <Caption cap={{ from: TITLE_AT, to: SC.s1 + 10, text: 'Who stopped', y: 330, size: 160, sub: 'A retelling of Luke 10' }} f={f} subFrom={TITLE_AT} />
    </div>
  );
};

const ReflectionLabel = ({ f, appCut }: { f: number; appCut: boolean }) => {
  const o = clamp01((f - SC.s10) / 14) * (appCut ? 1 : 1 - clamp01((f - SC.end) / 10));
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 38, letterSpacing: '0.18em', color: CREAM, textShadow: ring(3.5), opacity: o }}>
      A Come Aside reflection
    </div>
  );
};

const PLATE_D = torn([[40, 396], [540, 384], [1040, 394], [1046, 740], [1042, 1090], [540, 1100], [38, 1086], [34, 740]], 77, 6, 70);
const EndCard = ({ f }: { f: number }) => {
  if (f < SC.end) return null;
  const a = f - SC.end;
  const rip = clamp01(a / 8);
  const pop = a < 10 ? 0.7 + 0.3 * back(a / 10) : 1;
  const sub = clamp01((a - 14) / 10);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0 }}>
        <defs>
          <clipPath id="ripClip">
            <rect x={0} y={360} width={1080 * rip} height={780} />
          </clipPath>
        </defs>
        <g clipPath="url(#ripClip)" filter="url(#cut)">
          <path d={PLATE_D} fill="#f1e3bf" transform="translate(-6 -8)" />
          <path d={PLATE_D} fill="#34231a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d={torn([[78, 438], [1002, 432], [1006, 1052], [74, 1058]], 78, 3, 70)} fill="none" stroke="#6b4c2e" strokeWidth={3} opacity={0.6} strokeDasharray="22 14" />
        </g>
        <TapeStrip x={150} y={420} rot={-24} len={90} w={32} op={rip >= 1 ? 0.93 : 0} />
        <TapeStrip x={930} y={1070} rot={18} len={90} w={32} op={rip >= 1 ? 0.93 : 0} />
      </svg>
      <div style={{ position: 'absolute', top: 480, left: 70, right: 70, textAlign: 'center', transform: `scale(${pop})` }}>
        <div style={{ fontFamily: fredoka.fontFamily, fontWeight: 600, fontSize: 150, lineHeight: 1.06, color: GOLD, textShadow: ring(9) }}>Go and do likewise.</div>
        <div style={{ marginTop: 22, fontFamily: mulish.fontFamily, fontWeight: 700, fontSize: 42, letterSpacing: '0.12em', color: CREAM, textShadow: ring(4) }}>LUKE 10:37, WEBCE</div>
      </div>
      <div style={{ position: 'absolute', left: 130, right: 130, top: 900, textAlign: 'center', fontFamily: mulish.fontFamily, fontWeight: 600, fontSize: 34, lineHeight: 1.4, color: CREAM, textShadow: ring(3), opacity: sub }}>
        Luke 10:25-37. Scripture from the World English Bible, Catholic Edition.
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the two worlds and the peel ---------- */

const OLD_WARM = 0.42;
const modernScene = (f: number): ReactNode => (f < SC.s1 + PEEL_LEN ? <Opening f={f} /> : <Return f={f} />);
const oldScene = (f: number): ReactNode => {
  if (f < SC.s2) return <SquareTalk f={f} />;
  if (f < SC.s3) {
    const lf = f - SC.s2;
    const lift = Math.max(0, Math.min(1, (lf - 120) / 40));
    return <LawyerClose f={f} start={SC.s2} brow={() => [0.15 + 0.85 * ease((lf - 96) / 12) * (1 - ease((lf - 200) / 20)), -0.35]} soft={0 * lift} />;
  }
  if (f < SC.s3b) return <RoadWideScene f={f} />;
  if (f < SC.s4) return <Ambush f={f} />;
  if (f < SC.s5) return <Passers f={f} />;
  if (f < SC.s6) return f >= SC.s5 + 175 && f < SC.s5 + 285 ? <CrowdSnap f={f} /> : <DonkeyRide f={f} />;
  if (f < SC.s8) return <Rescue f={f} />;
  if (f < SC.s9) return <InnMorning f={f} />;
  const lf = f - SC.s9;
  const unfold = ease((lf - 258) / 70);
  return <LawyerClose f={f} start={SC.s9} unfold={unfold} soft={unfold} brow={() => [0.2 * (1 - unfold) - 0.15, 0.25 * (1 - unfold)]} />;
};

const World = ({ f, warm, children }: { f: number; warm: number; children: ReactNode }) => (
  <g>
    <Parchment f={f} warm={warm} drift={0.015} />
    {children}
  </g>
);

export const WhoStoppedShorts = ({ appCut = false }: WhoStoppedShortsProps) => {
  const f = useCurrentFrame();
  const mWarm = returnWarm(f);
  const modern = <World f={f} warm={f >= SC.s10 ? mWarm : 0}>{modernScene(f)}</World>;
  const old = (
    <World f={f} warm={OLD_WARM}>
      {oldScene(Math.min(f, SC.s10 - 1))}
    </World>
  );
  const inPeel1 = f >= SC.s1 && f < SC.s1 + PEEL_LEN;
  const inPeel2 = f >= SC.s10 && f < SC.s10 + PEEL_LEN;
  const vig = 1 - 0.55 * mWarm;
  const burnWarm = f < SC.s1 ? 0 : f < SC.s10 ? OLD_WARM * 0.5 : mWarm * 0.55;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1a10' }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <PaperDefs boil={boilSeed(f)} whip={0} />
        <InnDefs />
        {inPeel1 ? (
          <Peel p={(f - SC.s1) / PEEL_LEN} ang={55} under={<World f={f} warm={OLD_WARM}>{oldScene(f)}</World>} over={<World f={f} warm={0}>{modernScene(f)}</World>} />
        ) : inPeel2 ? (
          <Peel p={(f - SC.s10) / PEEL_LEN} ang={235} under={modern} over={old} />
        ) : f < SC.s1 || f >= SC.s10 ? (
          modern
        ) : (
          old
        )}
        <Burn vig={vig} warm={burnWarm} />
      </svg>
      {appCut ? null : <NarrationCaption f={f} />}
      {PLATES.map((p, i) => (
        <ScripturePlate key={i} p={p} f={f} />
      ))}
      <Title f={f} />
      <ReflectionLabel f={f} appCut={appCut} />
      {appCut ? null : <EndCard f={f} />}
    </AbsoluteFill>
  );
};
