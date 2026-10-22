/*
 * Ported from styles/magic-lantern/render.js in the artstyles repository (the WebGL2 pass
 * helpers and the noise tile), rewritten in TypeScript. Passes here render into textures so
 * the engrave and print passes chain without leaving the GPU.
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
import { lerp, rng } from './math';

export type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture };
export type Uni = number | readonly number[];

const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

// Canvas textures are uploaded top row first, so UVC() maps a fragment to a canvas texel.
// Render targets keep gl_FragCoord order, so UVF() maps a fragment to a target texel.
export const GLSL_HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform sampler2D uN;
out vec4 o;
vec2 UVC(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes; }
vec2 UVF(){ return gl_FragCoord.xy / uRes; }
vec2 PX(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); }
vec4 NZ(vec2 p, float s){ return texture(uN, p / s); }
`;

const hash2 = (x: number, y: number, s: number) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// A 512 tile of noise: R white, G smooth, B smooth (other seed), A white (other seed). It repeats with no join.
const noiseData = () => {
  const n = 512;
  const data = new Uint8Array(n * n * 4);
  const R = rng(99);
  const pn = (x: number, y: number, per: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const H = (a: number, b: number) => hash2(((a % per) + per) % per, ((b % per) + per) % per, s);
    return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), v);
  };
  const tile = (x: number, y: number, s: number, cells: number) => {
    let t = 0;
    let a = 0.5;
    let per = cells;
    for (let o = 0; o < 4; o++) {
      t += a * pn((x / n) * per, (y / n) * per, per, s + o * 7);
      per *= 2;
      a *= 0.5;
    }
    return t / 0.9375;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      data[i] = R() * 255;
      data[i + 1] = tile(x, y, 11, 8) * 255;
      data[i + 2] = tile(x, y, 23, 21) * 255;
      data[i + 3] = R() * 255;
    }
  }
  return data;
};

export class GLX {
  readonly gl: WebGL2RenderingContext;
  readonly w: number;
  readonly h: number;
  private vb: WebGLBuffer;
  private progs = new Map<string, WebGLProgram>();
  private texs = new Map<string, WebGLTexture>();
  private targets = new Map<string, Target>();
  private noise: WebGLTexture;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.w = canvas.width;
    this.h = canvas.height;
    const vb = gl.createBuffer();
    if (!vb) throw new Error('no buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.vb = vb;
    const t = gl.createTexture();
    if (!t) throw new Error('no texture');
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseData());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    this.noise = t;
  }

  private prog(name: string, fs: string) {
    const cached = this.progs.get(name);
    if (cached) return cached;
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error('no shader');
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${name}: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    if (!p) throw new Error('no program');
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
    this.progs.set(name, p);
    return p;
  }

  // Put a canvas into a named texture. Premultiplied keeps a tint's alpha exact at low strengths.
  upload(name: string, src: TexImageSource, premult = false, nearest = false) {
    const gl = this.gl;
    let t = this.texs.get(name);
    const fresh = !t;
    if (!t) {
      const nt = gl.createTexture();
      if (!nt) throw new Error('no texture');
      t = nt;
      this.texs.set(name, t);
    }
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (fresh) {
      const f = nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    return t;
  }

  target(name: string): Target {
    const cached = this.targets.get(name);
    if (cached) return cached;
    const gl = this.gl;
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) throw new Error('no target');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.w, this.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const t = { fbo, tex };
    this.targets.set(name, t);
    return t;
  }

  // Run a fragment shader over the whole frame. out null draws to the canvas.
  pass(name: string, fs: string, texs: Record<string, WebGLTexture>, unis: Record<string, Uni>, out: Target | null) {
    const gl = this.gl;
    const p = this.prog(name, fs);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    const la = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(la);
    gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    let unit = 0;
    for (const [k, t] of Object.entries({ ...texs, uN: this.noise })) {
      const loc = gl.getUniformLocation(p, k);
      if (!loc) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(loc, unit);
      unit++;
    }
    gl.uniform2f(gl.getUniformLocation(p, 'uRes'), this.w, this.h);
    for (const [k, v] of Object.entries(unis)) {
      const loc = gl.getUniformLocation(p, k);
      if (!loc) continue;
      const a = typeof v === 'number' ? [v] : v;
      if (a.length === 1) gl.uniform1f(loc, a[0]);
      else if (a.length === 2) gl.uniform2f(loc, a[0], a[1]);
      else if (a.length === 3) gl.uniform3f(loc, a[0], a[1], a[2]);
      else gl.uniform4f(loc, a[0], a[1], a[2], a[3]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

const glxCache = new WeakMap<HTMLCanvasElement, GLX>();
export const glxFor = (canvas: HTMLCanvasElement) => {
  let g = glxCache.get(canvas);
  if (!g) {
    g = new GLX(canvas);
    glxCache.set(canvas, g);
  }
  return g;
};
