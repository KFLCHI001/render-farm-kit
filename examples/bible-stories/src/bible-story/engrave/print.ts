/*
 * Ported from the onPaper pass in styles/magic-lantern/render.js and the paper, speck and wash
 * ideas in styles/linocut/lino.js (artstyles repository), rewritten in TypeScript. The engraved
 * lines are printed as a block on cream paper: ink that spreads a little, uneven inking, paper
 * specks, a tint wash that sits a hair off the key block and pools at its edges.
 *
 * MIT License
 *
 * Copyright (c) 2026 Miranda Dixon-Luinenburg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { GLSL_HEAD } from './gl';
import type { GLX, Target } from './gl';
import type { GB } from './gbuf';

export type Rgb = readonly [number, number, number];
export const hexRgb = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// The engrave pass says where lines are. Light print: lines are ink. Dusk print: the block is
// inked solid and the lines are carved away, so the lines show the (tinted) paper.
const FS_PRINT = `${GLSL_HEAD}
uniform sampler2D uE, uC;
uniform float uMode, uSpread, uSeed, uSpeck, uMottle, uInkTint, uEdge, uWash;
uniform vec3 uPaper, uInk, uWashCol;
float inkAt(vec2 p){
  vec4 e = texture(uE, p);
  return uMode > .5 ? max(1. - e.r, e.b) : max(e.r, e.b);
}
void main(){
  vec2 uvf = UVF(), uvc = UVC(), px = PX(), e = 1. / uRes;
  vec2 so = vec2(uSeed * 53.7, uSeed * 29.3);
  float i0 = inkAt(uvf);
  float sp = (inkAt(uvf + vec2(e.x, 0.)) + inkAt(uvf - vec2(e.x, 0.)) + inkAt(uvf + vec2(0., e.y)) + inkAt(uvf - vec2(0., e.y))) * .25;
  float ink = clamp(max(i0, sp * uSpread) * 1.04, 0., 1.);
  vec4 n1 = NZ(px + so, 512.), n2 = NZ(px + so, 90.), n3 = NZ(px + so * 3., 1700.);
  float rough = .82 + .18 * smoothstep(.2, .8, n3.g) + .06 * (n1.r - .5);
  ink *= mix(1., rough, uMottle);
  // paper specks showing through the ink
  float spk = smoothstep(1. - uSpeck * .9 - .06, 1. - uSpeck * .9 + .02, NZ(px + so, 1024.).a * .55 + n1.r * .45);
  ink *= 1. - spk * (.55 + .45 * n2.b);
  // the paper
  float fib = (NZ(px * vec2(1., 3.), 180.).b - .5) * .05 + (n1.a - .5) * .035;
  float fox = smoothstep(.72, .9, NZ(px, 900.).g) * .5;
  vec3 paper = uPaper * (1. + fib) - vec3(.04, .06, .09) * fox - vec3(.02, .03, .045) * smoothstep(.55, 1., n3.b);
  // the tint plate sits a hair off the key block and pools at its edges
  vec2 mis = vec2(1.4, 1.0) * e;
  vec4 tc = texture(uC, uvc + mis);
  float a = tc.a;
  vec3 tcol = a > .003 ? tc.rgb / a : vec3(0.);
  float ab = (texture(uC, uvc + mis + vec2(3., 0.) * e).a + texture(uC, uvc + mis - vec2(3., 0.) * e).a + texture(uC, uvc + mis + vec2(0., 3.) * e).a + texture(uC, uvc + mis - vec2(0., 3.) * e).a) * .25;
  float pool = clamp(a - ab, 0., 1.) * .5;
  float aa = clamp(a * (.9 + .2 * n2.g) + pool, 0., 1.);
  // ragged print edge
  float d = min(min(px.x, uRes.x - px.x), min(px.y, uRes.y - px.y));
  float rg = uEdge * (.3 + 1.1 * NZ(px, 150.).b) + uEdge * .5 * NZ(px, 37.).g;
  float cov = smoothstep(rg - 1.5, rg + 1.5, d);
  ink *= cov;
  aa *= cov;
  vec3 exposed = mix(paper, tcol, aa);
  vec3 inkc = uMode > .5 ? uInk * (1. + .2 * (n2.r - .5) + .12 * (n3.g - .5)) : uInk * (1. + .16 * (n2.r - .5));
  inkc = mix(inkc, tcol, aa * uInkTint);
  vec3 col = mix(exposed, inkc, ink);
  col = mix(col, uWashCol * (1. + fib), uWash);
  o = vec4(col, 1.);
}`;

export type PrintOpts = {
  dusk: boolean;
  paper: Rgb;
  ink: Rgb;
  seed: number;
  spread?: number;
  speck?: number;
  mottle?: number;
  inkTint?: number;
  edge?: number;
  wash?: number;
  washCol?: Rgb;
};

export const print = (glx: GLX, S: GB, engraved: Target, o: PrintOpts, out: Target | null) => {
  glx.pass(
    'print',
    FS_PRINT,
    { uE: engraved.tex, uC: glx.upload('C', S.C, true) },
    {
      uMode: o.dusk ? 1 : 0,
      uSpread: o.spread ?? 0.7,
      uSeed: o.seed,
      uSpeck: o.speck ?? 0.06,
      uMottle: o.mottle ?? (o.dusk ? 0.45 : 1),
      uInkTint: o.inkTint ?? 0,
      uEdge: o.edge ?? 6,
      uWash: o.wash ?? 0,
      uPaper: o.paper,
      uInk: o.ink,
      uWashCol: o.washCol ?? o.paper,
    },
    out,
  );
};

// A wipe from one print to another: below the edge the first shows, above it the second.
const FS_WIPE = `${GLSL_HEAD}
uniform sampler2D uA, uB;
uniform float uY, uSeed;
void main(){
  vec2 uvf = UVF(), px = PX();
  vec2 so = vec2(uSeed * 41.3, uSeed * 17.9);
  float rag = 26. * max(0., NZ(vec2(px.x, 0.) + so, 260.).g * 1.6 - .25) + 12. * NZ(vec2(px.x * 3.1, 7.) + so, 300.).b;
  float below = step(uY + rag, px.y);
  o = mix(texture(uB, uvf), texture(uA, uvf), below);
}`;

export const wipe = (glx: GLX, a: Target, b: Target, y: number, seed: number) => {
  glx.pass('wipe', FS_WIPE, { uA: a.tex, uB: b.tex }, { uY: y, uSeed: seed }, null);
};
