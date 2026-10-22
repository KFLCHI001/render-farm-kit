// Bakes the static feTurbulence noise of the paper and ink styles into PNGs in public/noise/.
//
// Why: feTurbulence is recomputed by Chrome for every filtered element on every frame, which made
// the paper and ink styles several times slower to render than the same frames without filters
// (and far slower still on software GL). The patterns that never change (fixed seeds) are rendered
// here once, by Chrome itself with the very same filters the compositions used to carry, and the
// compositions read them back with feImage or image. The sheets are in the local coordinates of
// the element that carries the filter, so they line up exactly as the live noise did.
//
//   node tools/bake-noise.mjs          (run from video/, needs the Chrome Remotion already uses)
//
// The sheet rectangles live in src/bible-story/noise-sheets.json (shared with the components).
// Two kinds:
//   noise: the R and G channels of the turbulence, alpha 1. Read by feDisplacementMap as in2.
//   alpha: a flat colour whose alpha is the filter result. Painted with mix-blend-mode multiply.
// Rerun this tool only if a pattern below changes; commit the PNGs it writes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'package.json'));
const { openBrowser } = require('@remotion/renderer');

const sheets = JSON.parse(fs.readFileSync(path.join(root, 'src/bible-story/noise-sheets.json'), 'utf8'));
const outDir = path.join(root, 'public/noise');

// kind noise: the turbulence is passed through a matrix that keeps R and G and sets alpha to 1.
const NOISE_MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1';
const noise = (freq, octaves, seed) => ({ kind: 'noise', turb: `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"/><feColorMatrix type="matrix" values="${NOISE_MATRIX}"/>` });
const alpha = (freq, octaves, seed, rgb, a, b) => ({ kind: 'alpha', rgb, turb: `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  ${a} 0 0 0 ${b}"/>` });

// The patterns, exactly as the old live filters had them.
const PATTERNS = {
  cut: noise('0.03', 2, 4),
  inkEdge: noise('0.028', 2, 9),
  inkBleed: noise('0.012', 2, 17),
  stainBig: alpha('0.0022 0.0032', 3, 8, [0.45, 0.26, 0.1], 1.5, -0.55),
  stainMid: alpha('0.007 0.009', 3, 21, [0.5, 0.3, 0.12], 1.2, -0.5),
  fibre: alpha('0.9 0.5', 2, 5, [0.4, 0.24, 0.1], 1.2, -0.52),
};

// Runs in the page: draws the filtered rect as an SVG image on a canvas and returns the PNG.
const bakeInPage = async ({ s, p }) => {
  const W = Math.round(s.w * s.k);
  const H = Math.round(s.h * s.k);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${s.x} ${s.y} ${s.w} ${s.h}">` +
    `<filter id="f" filterUnits="userSpaceOnUse" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" color-interpolation-filters="sRGB">${p.turb}</filter>` +
    `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" filter="url(#f)"/></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  if (p.kind === 'alpha') {
    // Keep only the alpha; the colour is a constant, so store it exactly instead of the premultiplied round trip.
    const d = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = Math.round(p.rgb[0] * 255);
      d.data[i + 1] = Math.round(p.rgb[1] * 255);
      d.data[i + 2] = Math.round(p.rgb[2] * 255);
    }
    ctx.putImageData(d, 0, 0);
  }
  return c.toDataURL('image/png');
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await openBrowser('chrome', { chromiumOptions: { gl: 'swangle' } });
const page = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => undefined });
await page.goto({ url: 'about:blank', timeout: 30000 });
for (const [name, s] of Object.entries(sheets)) {
  const p = PATTERNS[name];
  if (!p) throw new Error(`no pattern for sheet ${name}`);
  const url = await page.evaluate(bakeInPage, { s, p });
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(outDir, s.file), buf);
  console.log(name, s.file, `${Math.round(s.w * s.k)}x${Math.round(s.h * s.k)}`, `${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close({ silent: true });
process.exit(0);
