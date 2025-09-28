function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function createShaderProgram(gl, vs, fs) {
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

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_frequencyTexture;
    uniform float u_barCount;
    uniform float u_time;
    uniform int u_visualMode;

    float getAmplitude(float index) {
      return texture2D(u_frequencyTexture, vec2((index + 0.5) / u_barCount, 0.5)).r;
    }

    float drawWave() {
      float xIndex = floor(v_uv.x * u_barCount);
      float signal = getAmplitude(xIndex);
      float normalized = signal * 2.0 - 1.0;
      float distance = abs(normalized - (v_uv.y * 2.0 - 1.0));
      return 1.0 - smoothstep(${visualizerVariables.edge_softness_inner ?? 0.02},
                              ${visualizerVariables.edge_softness_outer ?? 0.021},
                              distance);
    }

    void main() {
      vec3 waveColor = vec3(drawWave()) * vec3(
        ${parseInt(visualizerVariables.base_color_high.slice(1, 3), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(3, 5), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(5, 7), 16) / 255.0}
      );
      gl_FragColor = vec4(pow(waveColor, vec3(${visualizerVariables.intensity_gamma ?? 1.0})), 1.0);
    }
  `;

  // === Compile & link shaders ===
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(shaderProgram);

  const positionAttribute = gl.getAttribLocation(shaderProgram, "a_position");
  const frequencyTextureUniform = gl.getUniformLocation(shaderProgram, "u_frequencyTexture");
  const barCountUniform = gl.getUniformLocation(shaderProgram, "u_barCount");
  const timeUniform = gl.getUniformLocation(shaderProgram, "u_time");
  const visualModeUniform = gl.getUniformLocation(shaderProgram, "u_visualMode");

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttribute);
  gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

  const frequencyTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, frequencyTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.LUMINANCE,
    visualizerVariables.bar_count, 1, 0,
    gl.LUMINANCE, gl.UNSIGNED_BYTE, null
  );

  gl.uniform1i(frequencyTextureUniform, 0);
  gl.uniform1f(barCountUniform, visualizerVariables.bar_count);
  gl.uniform1i(visualModeUniform, 0);

  // === Audio setup ===
  const audioElement = document.getElementById("audio");
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const mediaSource = audioContext.createMediaElementSource(audioElement);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = visualizerVariables.bar_count * 2;

  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  mediaSource.connect(analyser);
  analyser.connect(audioContext.destination);

  let startTime = performance.now();

  function renderFrame(currentTime) {
    analyser.getByteTimeDomainData(frequencyData);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      visualizerVariables.bar_count, 1, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      frequencyData.subarray(0, visualizerVariables.bar_count)
    );
    gl.uniform1f(
      timeUniform,
      ((currentTime - startTime) / 1000) * (visualizerVariables.time_scale ?? 1.0)
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
