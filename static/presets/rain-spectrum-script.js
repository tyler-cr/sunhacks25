function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  console.log(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  console.log(gl.getProgramInfoLog(program));
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
    uniform sampler2D u_spectrumTexture;
    uniform float u_binCount;
    uniform float u_time;

    float hash(float n) {
      return fract(sin(n * 91.3458) * 43758.5453);
    }

    float getAmplitude(float index) {
      return texture2D(u_spectrumTexture, vec2((index + 0.5) / u_binCount, 0.5)).r;
    }

    void main() {
      float column = floor(v_uv.x * u_binCount);
      float amplitude = getAmplitude(column);

      if (column < 0.5) amplitude = max(amplitude - 0.05, 0.0);

      float activationChance = hash(column * 7.123);
      if (activationChance > amplitude * ${visualizerVariables.activation_threshold ?? 1.2}) {
        discard;
      }

      float dropSpacing = mix(${visualizerVariables.drop_spacing_min ?? 0.05},
                              ${visualizerVariables.drop_spacing_max ?? 0.2}, amplitude);
      float speed = mix(${visualizerVariables.fall_speed_min ?? 0.5},
                        ${visualizerVariables.fall_speed_max ?? 4.0}, amplitude);

      float randomOffset = hash(column + 1.0);
      float yPos = fract(v_uv.y + u_time * speed + randomOffset);

      float dropHeight = mix(${visualizerVariables.drop_height_min ?? 0.05},
                             ${visualizerVariables.drop_height_max ?? 0.3}, hash(column * 11.5));

      float dropTop = fract(yPos / dropSpacing);
      float distToCenter = abs(dropTop - 0.5);
      float dropShape = smoothstep(dropHeight, dropHeight * 0.7, distToCenter);

      vec3 baseColorLow = vec3(
        ${parseInt(visualizerVariables.base_color_low.slice(1, 3), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_low.slice(3, 5), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_low.slice(5, 7), 16) / 255.0}
      );
      vec3 baseColorHigh = vec3(
        ${parseInt(visualizerVariables.base_color_high.slice(1, 3), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(3, 5), 16) / 255.0},
        ${parseInt(visualizerVariables.base_color_high.slice(5, 7), 16) / 255.0}
      );

      vec3 dropColor = mix(baseColorLow, baseColorHigh, column / u_binCount);
      gl_FragColor = vec4(pow(dropColor, vec3(${visualizerVariables.intensity_gamma ?? 1.0})) * dropShape, 1.0);
    }
  `;

  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vs, fs);
  gl.useProgram(program);

  const posAttrib = gl.getAttribLocation(program, "a_position");
  const binCountUniform = gl.getUniformLocation(program, "u_binCount");
  const textureUniform = gl.getUniformLocation(program, "u_spectrumTexture");
  const timeUniform = gl.getUniformLocation(program, "u_time");

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

  let startTime = performance.now();

  function renderFrame(currentTime) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    analyser.getByteFrequencyData(spectrumData);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      visualizerVariables.bar_count, 1, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      spectrumData.subarray(0, visualizerVariables.bar_count)
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
