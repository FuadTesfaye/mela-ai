/** Optional procedural WebGL character. No signing or language translation is implied. */
export function mountAvatar(host: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 180;
  canvas.style.cssText = "width:100%;height:90px;display:block";
  host.append(canvas);
  const caption = document.createElement("div");
  caption.textContent = "Speaking avatar · not sign language";
  caption.style.cssText = "font-size:9px;text-align:center;color:#536b48";
  host.append(caption);
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) {
    caption.textContent =
      "3D preview unavailable. All chat features remain available.";
    return;
  }
  const shader = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      `attribute vec3 position;uniform vec3 center;uniform vec3 scale;uniform float aspect;varying vec3 normal;void main(){normal=position;vec3 p=position*scale+center;gl_Position=vec4(p.x/aspect,p.y,p.z*.25,1.);}`,
    ),
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float;varying vec3 normal;uniform vec3 color;void main(){float light=.65+.35*max(0.,dot(normalize(normal),normalize(vec3(-.5,.8,-1.))));gl_FragColor=vec4(color*light,1.);}`,
    ),
  );
  gl.linkProgram(program);
  gl.useProgram(program);
  const vertices: number[] = [];
  const indices: number[] = [];
  const rows = 18,
    cols = 26;
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c <= cols; c++) {
      const a = (r * Math.PI) / rows,
        b = (c * 2 * Math.PI) / cols;
      vertices.push(
        Math.sin(a) * Math.cos(b),
        Math.cos(a),
        Math.sin(a) * Math.sin(b),
      );
    }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c,
        b = a + cols + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const index = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );
  const attribute = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const center = gl.getUniformLocation(program, "center"),
    scale = gl.getUniformLocation(program, "scale"),
    color = gl.getUniformLocation(program, "color");
  gl.uniform1f(
    gl.getUniformLocation(program, "aspect"),
    canvas.width / canvas.height,
  );
  const sphere = (p: number[], s: number[], c: number[]) => {
    gl.uniform3fv(center, p);
    gl.uniform3fv(scale, s);
    gl.uniform3fv(color, c);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = (time: number) => {
    if (!host.isConnected) {
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(index);
      gl.deleteProgram(program);
      return;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const speaking = window.speechSynthesis?.speaking && !reduced;
    const bob = speaking ? Math.sin(time / 200) * 0.015 : 0;
    sphere([0, -0.74, 0], [0.57, 0.5, 0.25], [0.2, 0.39, 0.28]);
    sphere([0, -0.1, 0], [0.13, 0.24, 0.13], [0.58, 0.34, 0.21]);
    sphere([0, 0.33 + bob, 0.04], [0.32, 0.43, 0.27], [0.12, 0.11, 0.09]);
    sphere([0, 0.22 + bob, -0.08], [0.29, 0.36, 0.23], [0.64, 0.4, 0.27]);
    sphere([-0.29, 0.22 + bob, 0], [0.065, 0.1, 0.065], [0.58, 0.34, 0.21]);
    sphere([0.29, 0.22 + bob, 0], [0.065, 0.1, 0.065], [0.58, 0.34, 0.21]);
    sphere(
      [-0.105, 0.27 + bob, -0.29],
      [0.04, 0.055, 0.025],
      [0.97, 0.95, 0.87],
    );
    sphere(
      [0.105, 0.27 + bob, -0.29],
      [0.04, 0.055, 0.025],
      [0.97, 0.95, 0.87],
    );
    sphere(
      [-0.105, 0.27 + bob, -0.315],
      [0.019, 0.027, 0.014],
      [0.1, 0.12, 0.09],
    );
    sphere(
      [0.105, 0.27 + bob, -0.315],
      [0.019, 0.027, 0.014],
      [0.1, 0.12, 0.09],
    );
    sphere([0, 0.16 + bob, -0.29], [0.045, 0.065, 0.055], [0.58, 0.33, 0.2]);
    sphere(
      [0, 0.025 + bob, -0.285],
      [
        0.075,
        speaking ? 0.025 + Math.abs(Math.sin(time / 110)) * 0.035 : 0.013,
        0.02,
      ],
      [0.25, 0.12, 0.09],
    );
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
