/*
 * Ported from styles/magic-lantern/render.js in the artstyles repository (the engrave pass:
 * parallel lines whose width follows the tone, cross lines in the darks, laid at each
 * surface's own angle, outlines on top), rewritten in TypeScript. Extended so a surface can
 * carry its own line phase (class 16, sawtooth in the F buffer) and so lines are anchored to
 * the world, not the screen, while the camera moves.
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

// Output: R = line ink (1 = a line), G = tone, B = outline ink.
const FS_ENGRAVE = `${GLSL_HEAD}
uniform sampler2D uT, uL, uH, uF, uO;
uniform float uP, uWob, uGain, uLift, uOut, uS, uBreak, uMottle, uCut, uFlow;
uniform vec2 uTr;
float lineInk(float c, float w, float fw){ float thr = cos(3.14159265 * clamp(w, 0., 1.)); return smoothstep(thr - fw, thr + fw, c) * smoothstep(0., .06, w); }
void main(){
  vec2 uvc = UVC(), px = PX();
  vec2 wp = (px - uTr) / uS;
  vec2 cutOff = vec2(uCut * 37.1, uCut * 19.7);
  vec4 nL = NZ(wp + cutOff, 2600.), nM = NZ(wp + cutOff, 700.), nS = NZ(wp + cutOff, 170.), nT = NZ(wp + cutOff, 73.);
  vec4 nB = NZ(wp + cutOff - vec2(uFlow, 0.), 170.), nB2 = NZ(wp + cutOff - vec2(uFlow * .7, 0.), 73.);
  float t = clamp(texture(uT, uvc).r * texture(uL, uvc).r * uGain + uLift, 0., 1.);
  vec4 hh = texture(uH, uvc);
  float cls = floor(hh.b * 255. + .5);
  float d0 = 1. - t;
  float dark = clamp(d0 * (1. + (nM.g - .5) * uMottle * 1.5 * (1. - smoothstep(.55, .9, d0))), 0., 1.);
  float c1 = 1., c2 = 1., ws = 1., cross = 1., wmin = 0.;
  if (cls > 15.5 && cls < 16.5) {
    vec4 f = texture(uF, uvc);
    float w1 = (nS.g - .5) * .30 + (nM.b - .5) * .22;
    c1 = cos(6.2831853 * (f.r + w1));
    c2 = cos(6.2831853 * (f.g + w1 * .6 + .5));
    ws = .5 + hh.r; cross = hh.g;
    float dp = fwidth(f.r); dp = dp > .5 ? 1. - dp : dp;
    wmin = clamp(1.15 * dp, .05, .4);
  } else {
    float sp = uP * (.42 + .085 * cls);
    if (cls < 2.5) { ws = .6; cross = 0.; }
    float a1 = hh.r * 3.14159265, a2 = hh.g * 3.14159265;
    vec2 d1 = vec2(-sin(a1), cos(a1)), d2 = vec2(-sin(a2), cos(a2));
    float wob = (nL.g - .5) * uWob + (nM.b - .5) * uWob * .25;
    c1 = cos(6.2831853 * (dot(wp, d1) / sp + wob));
    c2 = cos(6.2831853 * (dot(wp, d2) / sp + wob * .6 + .5));
  }
  float fw1 = max(fwidth(c1) * 1.1, .05), fw2 = max(fwidth(c2) * 1.1, .05);
  float bk = mix(1., smoothstep(.2, .55, nB.g * .6 + nB2.b * .4 + dark * .8), uBreak);
  float w1r = clamp(pow(dark, 1.2) * 1.02, 0., .74) * (.86 + .28 * nM.g) * ws * bk;
  // lines thinner than a pixel hold a minimum width, so they do not shimmer
  float w1v = (wmin > 0. && w1r < wmin) ? wmin * smoothstep(.015, .05, w1r) : w1r;
  float w2v = clamp((dark - .6) * 1.5, 0., .52) * cross;
  float ink = max(lineInk(c1, w1v, fw1), lineInk(c2, w2v, fw2));
  ink = max(ink, smoothstep(.9, .975, dark));
  float flat0 = smoothstep(.8, .92, dark);
  ink = cls > .5 ? ink : flat0;
  o = vec4(ink, t, texture(uO, uvc).a * uOut, 1.);
}`;

export type EngraveOpts = {
  period?: number;
  wob?: number;
  gain?: number;
  lift?: number;
  out?: number;
  brk?: number;
  mottle?: number;
  cam: { s: number; tx: number; ty: number };
  cut?: number;
  flow?: number;
};

export const engrave = (glx: GLX, S: GB, o: EngraveOpts, into = 'engrave'): Target => {
  const tgt = glx.target(into);
  glx.pass(
    'engrave',
    FS_ENGRAVE,
    {
      uT: glx.upload('T', S.T),
      uL: glx.upload('Lt', S.Lt),
      uH: glx.upload('Hh', S.Hh),
      uF: glx.upload('F', S.F, false, true),
      uO: glx.upload('O', S.O),
    },
    {
      uP: o.period ?? 6.2,
      uWob: o.wob ?? 0.9,
      uGain: o.gain ?? 1,
      uLift: o.lift ?? 0,
      uOut: o.out ?? 1,
      uS: o.cam.s,
      uTr: [o.cam.tx, o.cam.ty],
      uBreak: o.brk ?? 0.3,
      uMottle: o.mottle ?? 0.25,
      uCut: o.cut ?? 0,
      uFlow: o.flow ?? 0,
    },
    tgt,
  );
  return tgt;
};
