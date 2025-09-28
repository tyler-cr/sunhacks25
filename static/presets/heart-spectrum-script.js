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

  // Fragment Shader (Heart Spectrum)
  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_spectrumTexture;
    uniform float u_binCount;

    float getAmplitude(float index) {
      return texture2D(u_spectrumTexture, vec2((index + 0.5) / u_binCount, 0.5)).r;
    }

    float heartImplicit(vec2 p) {
      p.x *= 1.6;
      p.y *= 1.6;
      float x = p.x;
      float y = p.y;
      return pow(x*x + y*y - 1.0, 3.0) - x*x*y*y*y;
    }

    void main() {
      vec2 p = v_uv * 2.0 - 1.0;
      float angle = atan(p.y, p.x);
      float t = (angle + 3.14159265) / 6.2831853;
      float binIndex = clamp(floor(t * u_binCount), 0.0, u_binCount - 1.0);
      float amplitude = getAmplitude(binIndex);

      float h = heartImplicit(p);
      float dist = abs(h) * 3.0 - amplitude * 0.5;

      float intensity = 1.0 - smoothstep(0.0, 0.05, dist);

      vec3 baseColor = vec3(
        ${parseInt(visualizerVariables.base_color_high.slice(1, 3), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(3, 5), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(5, 7), 16) / 255.0}
      );
      gl_FragColor = vec4(pow(baseColor, vec3(${visualizerVariables.intensity_gamma ?? 1.0})) * intensity, 1.0);
    }
  `;

  // === Compile & link shaders ===
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vs, fs);
  gl.useProgram(program);

  const posAttrib = gl.getAttribLocation(program, "a_position");
  const binCountUniform = gl.getUniformLocation(program, "u_binCount");
  const textureUniform = gl.getUniformLocation(program, "u_spectrumTexture");

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posAttrib);
  gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

  const spectrumTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
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
  gl.uniform1f(binCountUniform, visualizerVariables.bar_count);

  // === Audio setup ===
  const audioElement = document.getElementById("audio");
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const mediaSource = audioContext.createMediaElementSource(audioElement);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = visualizerVariables.bar_count * 2;

  const spectrumData = new Uint8Array(analyser.frequencyBinCount);
  mediaSource.connect(analyser);
  analyser.connect(audioContext.destination);

  function renderFrame() {
    analyser.getByteFrequencyData(spectrumData);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      visualizerVariables.bar_count, 1, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      spectrumData.subarray(0, visualizerVariables.bar_count)
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
