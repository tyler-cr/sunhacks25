function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

export async function startPreset(varsModule) {
  const visualizerVariables = varsModule.visualizerVariables;

  const canvas = document.getElementById("gl");
  const gl = canvas.getContext("webgl");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Vertex Shader
  const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment Shader (Radial Waveform)
  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_waveformTexture;
    uniform float u_sampleCount;

    float getAmplitude(float index) {
      return texture2D(u_waveformTexture, vec2((index + 0.5) / u_sampleCount, 0.5)).r;
    }

    void main() {
      vec2 centered = v_uv * 2.0 - 1.0;
      float radius = length(centered);
      float angle = atan(centered.y, centered.x);
      float t = (angle + 3.14159265) / 6.2831853;
      float sampleIndex = floor(t * u_sampleCount);
      float signal = getAmplitude(sampleIndex);
      float normalized = signal * 2.0 - 1.0;

      float baseRadius = ${visualizerVariables.base_radius ?? 0.4};
      float targetRadius = baseRadius + normalized * ${visualizerVariables.radius_scale ?? 0.2};

      float dist = abs(radius - targetRadius);
      float brightness = 1.0 - smoothstep(0.01, 0.03, dist);

      vec3 color = vec3(
        ${parseInt(visualizerVariables.base_color_high.slice(1, 3), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(3, 5), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(5, 7), 16) / 255.0}
      );

      gl_FragColor = vec4(pow(color, vec3(${visualizerVariables.intensity_gamma ?? 1.0})) * brightness, 1.0);
    }
  `;

  // Compile & Link
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vs, fs);
  gl.useProgram(program);

  const posAttrib = gl.getAttribLocation(program, "a_position");
  const sampleCountUniform = gl.getUniformLocation(program, "u_sampleCount");
  const textureUniform = gl.getUniformLocation(program, "u_waveformTexture");

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posAttrib);
  gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

  const waveformTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.LUMINANCE,
    visualizerVariables.bar_count, 1, 0,
    gl.LUMINANCE, gl.UNSIGNED_BYTE, null
  );

  gl.uniform1i(textureUniform, 0);
  gl.uniform1f(sampleCountUniform, visualizerVariables.bar_count);

  // Audio Setup
  const audioElement = document.getElementById("audio");
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const mediaSource = audioContext.createMediaElementSource(audioElement);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = visualizerVariables.bar_count * 2;

  const waveformData = new Uint8Array(analyser.frequencyBinCount);
  mediaSource.connect(analyser);
  analyser.connect(audioContext.destination);

  function renderFrame() {
    analyser.getByteTimeDomainData(waveformData);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      visualizerVariables.bar_count, 1, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      waveformData.subarray(0, visualizerVariables.bar_count)
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(renderFrame);
  }

  // === Start audio + rendering ===
  if (audioContext.state === "suspended") await audioContext.resume();
  if (audioElement.paused) {
    await audioElement.play();
    requestAnimationFrame(renderFrame);
  } else {
    audioElement.pause();
  }
}
