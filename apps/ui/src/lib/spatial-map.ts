/** Presentation coordinates only; depth never claims dependency strength. */
export interface SpatialPoint { x: number; y: number; z: number }
export function fileDepth(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) / 4294967295 - .5) * 1.1;
}
export function spatialProject(point: SpatialPoint, yaw: number, pitch: number) {
  const x = point.x - .5, y = point.y - .5;
  const rx = x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const rz = -x * Math.sin(yaw) + point.z * Math.cos(yaw);
  const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
  const z = y * Math.sin(pitch) + rz * Math.cos(pitch);
  const perspective = 2.5 / (2.5 - z);
  return { x: .5 + rx * perspective, y: .5 + ry * perspective, z: -z / 1.5, scale: perspective };
}

export type MapVertex = { x: number; y: number; z: number; size: number; alpha: number };
/** GPU draws spatial points/edges only. Projection and picking share CPU camera math. */
export function createSpatialRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return undefined;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Spatial map shader unavailable'); }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, 'attribute vec3 position; attribute float size; attribute float alpha; varying float opacity; void main(){ gl_Position=vec4(position,1.); gl_PointSize=size; opacity=alpha; }');
  const fs = shader(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec3 colour; uniform bool points; varying float opacity; void main(){ if(points && distance(gl_PointCoord,vec2(.5))>.5) discard; gl_FragColor=vec4(colour,opacity); }');
  const program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); return undefined; }
  const buffer = gl.createBuffer()!;
  const position = gl.getAttribLocation(program, 'position'), size = gl.getAttribLocation(program, 'size'), alpha = gl.getAttribLocation(program, 'alpha');
  const colour = gl.getUniformLocation(program, 'colour'), points = gl.getUniformLocation(program, 'points');
  const rgb = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255) : [0.94, 0.95, 0.98];
  const paint = (vertices: MapVertex[], mode: number, ink: string, width: number, height: number, dpr: number) => {
    const data = new Float32Array(vertices.length * 5);
    for (let i = 0; i < vertices.length; i++) { const v = vertices[i]!; data.set([v.x / width * 2 - 1, 1 - v.y / height * 2, v.z, v.size * dpr, v.alpha], i * 5); }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(size, 1, gl.FLOAT, false, 20, 12); gl.vertexAttribPointer(alpha, 1, gl.FLOAT, false, 20, 16);
    gl.uniform3fv(colour, rgb(ink)); gl.uniform1i(points, mode === gl.POINTS ? 1 : 0); gl.drawArrays(mode, 0, vertices.length);
  };
  return {
    draw(nodes: MapVertex[], edges: MapVertex[], ink: string, width: number, height: number, dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const attribute of [position, size, alpha]) gl.enableVertexAttribArray(attribute);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false); paint(edges, gl.LINES, ink, width, height, dpr);
      gl.depthMask(true); paint(nodes, gl.POINTS, ink, width, height, dpr);
    },
    dispose() { gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); }
  };
}
