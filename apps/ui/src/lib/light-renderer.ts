/**
 * Draws additive light only: hair-fine line segments and soft points into a half-float buffer, then a three-level bloom
 * and a tone map, so a bright core comes from overlapping filaments rather than paint. No text is ever drawn here.
 * Geometry is in CSS pixels of the canvas; vertices are x, y, r, g, b, a (7 floats with `size` for points).
 */
export interface LightFrame {
  lines: Float32Array; points: Float32Array; bloom: number; exposure: number; nebula?: boolean;
  /** Added to every line vertex on the GPU, so panning moves cached geometry without rebuilding or re-uploading it. */
  offset?: [number, number];
  /** The lines are uploaded only when this differs from the last frame's; omit it to upload every frame. */
  linesKey?: number;
}

const QUAD = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0, 1); }`;
const LINE_VS = `#version 300 es
in vec2 pos; in vec4 col; uniform vec2 size; uniform vec2 offset; out vec4 c;
void main(){ c = col; gl_Position = vec4((pos + offset) / size * 2. - 1., 0, 1); gl_Position.y *= -1.; }`;
const LINE_FS = `#version 300 es
precision highp float; in vec4 c; out vec4 o; void main(){ o = vec4(c.rgb * c.a, 1); }`;
const POINT_VS = `#version 300 es
in vec2 pos; in vec4 col; in float sz; uniform vec2 size; uniform float dpr; out vec4 c;
void main(){ c = col; gl_PointSize = sz * dpr; gl_Position = vec4(pos / size * 2. - 1., 0, 1); gl_Position.y *= -1.; }`;
const POINT_FS = `#version 300 es
precision highp float; in vec4 c; out vec4 o;
void main(){ float d = length(gl_PointCoord - .5) * 2.; float core = smoothstep(.35, 0., d), halo = exp(-d * d * 5.) * .35; o = vec4(c.rgb * c.a * (core + halo), 1); }`;
const BLUR_FS = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D src; uniform vec2 step; out vec4 o;
void main(){ vec3 s = texture(src, uv).rgb * .227; float w[4] = float[](.194, .121, .054, .016);
  for (int i = 1; i < 5; i++) { s += (texture(src, uv + step * float(i)).rgb + texture(src, uv - step * float(i)).rgb) * w[i - 1]; } o = vec4(s, 1); }`;
const FINAL_FS = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D sharp, b1, b2, b3; uniform float bloom, exposure, nebula; uniform vec2 aspect; out vec4 o;
float blob(vec2 p, vec2 c, float r){ p = (p - c) * aspect; return exp(-dot(p, p) / (r * r)); }
void main(){ vec3 light = texture(sharp, uv).rgb + bloom * (texture(b1, uv).rgb * .55 + texture(b2, uv).rgb * .75 + texture(b3, uv).rgb * .9);
  vec3 haze = vec3(.16, .08, .3) * blob(uv, vec2(.32, .62), .32) + vec3(.03, .14, .22) * blob(uv, vec2(.74, .38), .28);
  vec3 c = vec3(.004, .005, .008) + haze * .09 * nebula + (1. - exp(-light * exposure));
  o = vec4(pow(c, vec3(.92)), 1); }`;

interface Target { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }

export class LightRenderer {
  private gl: WebGL2RenderingContext;
  private half: boolean;
  private programs: Record<'line' | 'point' | 'blur' | 'final', WebGLProgram>;
  private quad: WebGLBuffer;
  private lineBuffer: WebGLBuffer;
  private pointBuffer: WebGLBuffer;
  private targets: Target[] = [];
  private size = { w: 0, h: 0, dpr: 1 };
  private lineKey: number | undefined;

  /** Undefined when WebGL2 is unavailable; callers keep their non-light presentation. */
  static create(canvas: HTMLCanvasElement): LightRenderer | undefined {
    try {
      const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
      return gl ? new LightRenderer(gl) : undefined;
    } catch { return undefined; }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.half = !!gl.getExtension('EXT_color_buffer_float');
    this.programs = { line: this.program(LINE_VS, LINE_FS), point: this.program(POINT_VS, POINT_FS), blur: this.program(QUAD, BLUR_FS), final: this.program(QUAD, FINAL_FS) };
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.lineBuffer = gl.createBuffer()!;
    this.pointBuffer = gl.createBuffer()!;
  }

  private program(vs: string, fs: string) {
    const gl = this.gl, p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program');
    return p;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl, tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, this.half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  /** CSS size of the canvas; buffers are rebuilt only when it changes. */
  resize(width: number, height: number, dpr: number) {
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    if (w === this.size.w && h === this.size.h) return;
    const gl = this.gl, canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = w; canvas.height = h;
    for (const t of this.targets) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    this.targets = [this.target(w, h), ...[1, 1, 2, 2, 3, 3].map((level) => this.target(Math.max(1, w >> level), Math.max(1, h >> level)))];
    this.size = { w, h, dpr };
  }

  private attrib(prog: WebGLProgram, name: string, size: number, stride: number, offset: number) {
    const gl = this.gl, at = gl.getAttribLocation(prog, name);
    if (at < 0) return;
    gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
  }

  private pass(prog: WebGLProgram, to: Target | null, uniforms: Record<string, number | [number, number] | Target>) {
    const gl = this.gl;
    gl.useProgram(prog); gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fb : null); gl.viewport(0, 0, to ? to.w : this.size.w, to ? to.h : this.size.h);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); this.attrib(prog, 'p', 2, 8, 0);
    let unit = 0;
    for (const [key, value] of Object.entries(uniforms)) {
      const at = gl.getUniformLocation(prog, key);
      if (typeof value === 'number') gl.uniform1f(at, value);
      else if (Array.isArray(value)) gl.uniform2fv(at, value);
      else { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value.tex); gl.uniform1i(at, unit++); }
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  draw(frame: LightFrame) {
    const gl = this.gl, [sharp, h1, v1, h2, v2, h3, v3] = this.targets as [Target, Target, Target, Target, Target, Target, Target];
    if (!sharp) return;
    const W = this.size.w / this.size.dpr, H = this.size.h / this.size.dpr;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sharp.fb); gl.viewport(0, 0, sharp.w, sharp.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const line = this.programs.line;
    gl.useProgram(line); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    // Cached geometry stays on the GPU between frames; only a new key uploads it again.
    if (frame.linesKey === undefined || frame.linesKey !== this.lineKey) { gl.bufferData(gl.ARRAY_BUFFER, frame.lines, gl.DYNAMIC_DRAW); this.lineKey = frame.linesKey; }
    this.attrib(line, 'pos', 2, 24, 0); this.attrib(line, 'col', 4, 24, 8);
    gl.uniform2f(gl.getUniformLocation(line, 'size'), W, H); gl.uniform2f(gl.getUniformLocation(line, 'offset'), frame.offset?.[0] ?? 0, frame.offset?.[1] ?? 0);
    gl.drawArrays(gl.LINES, 0, frame.lines.length / 6);
    const point = this.programs.point;
    gl.useProgram(point); gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer); gl.bufferData(gl.ARRAY_BUFFER, frame.points, gl.DYNAMIC_DRAW);
    this.attrib(point, 'pos', 2, 28, 0); this.attrib(point, 'col', 4, 28, 8); this.attrib(point, 'sz', 1, 28, 24);
    gl.uniform2f(gl.getUniformLocation(point, 'size'), W, H); gl.uniform1f(gl.getUniformLocation(point, 'dpr'), this.size.dpr);
    gl.drawArrays(gl.POINTS, 0, frame.points.length / 7);
    gl.disable(gl.BLEND);
    if (frame.bloom) {
      // Each level blurs the one above it, so the halo widens without a large kernel.
      const blur = this.programs.blur;
      this.pass(blur, h1, { src: sharp, step: [1 / h1.w, 0] }); this.pass(blur, v1, { src: h1, step: [0, 1 / v1.h] });
      this.pass(blur, h2, { src: v1, step: [1 / h2.w, 0] }); this.pass(blur, v2, { src: h2, step: [0, 1 / v2.h] });
      this.pass(blur, h3, { src: v2, step: [1 / h3.w, 0] }); this.pass(blur, v3, { src: h3, step: [0, 1 / v3.h] });
    }
    const m = Math.max(W, H);
    this.pass(this.programs.final, null, { sharp, b1: v1, b2: v2, b3: v3, bloom: frame.bloom, exposure: frame.exposure, nebula: frame.nebula ? 1 : 0, aspect: [W / m, H / m] });
  }

  dispose() { (this.gl.getExtension('WEBGL_lose_context'))?.loseContext(); }
}
