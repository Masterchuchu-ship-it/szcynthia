const canvas = document.querySelector("#visualizer");
const ctx = canvas.getContext("2d");
const micToggle = document.querySelector("#mic-toggle");
const shareToggle = document.querySelector("#share-toggle");
const stopAudio = document.querySelector("#stop-audio");
const statusText = document.querySelector("#status");

let audioContext;
let analyser;
let stream;
let source;
let frequencyData;
let bassEnergy = 0;
let melodyEnergy = 0;
let totalEnergy = 0;
let phase = 0;
const layers = {
  left: document.createElement("canvas"),
  right: document.createElement("canvas"),
};

const silhouettes = {
  left: createSilhouette("./assets/left-gradient-cropped.svg"),
  right: createSilhouette("./assets/right-spiky-cropped.svg"),
};

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function createAnalyzer() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
}

async function getMicStream() {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
}

async function getSharedAudioStream() {
  const sharedStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  sharedStream.getVideoTracks().forEach((track) => track.stop());
  if (!sharedStream.getAudioTracks().length) {
    sharedStream.getTracks().forEach((track) => track.stop());
    throw new Error("No shared audio track");
  }

  stream = sharedStream;
}

async function startAudio(mode) {
  stopAudioInput();
  createAnalyzer();

  if (mode === "share") {
    await getSharedAudioStream();
  } else {
    await getMicStream();
  }

  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  stream.getAudioTracks().forEach((track) => {
    track.addEventListener("ended", stopAudioInput);
  });
  await audioContext.resume();
}

function stopAudioInput() {
  if (source) {
    source.disconnect();
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  stream = undefined;
  source = undefined;
  analyser = undefined;
  frequencyData = undefined;
  micToggle.disabled = false;
  shareToggle.disabled = false;
  stopAudio.disabled = true;
}

function averageRange(start, end) {
  if (!frequencyData) return 0;

  let total = 0;
  let count = 0;
  for (let i = start; i < end && i < frequencyData.length; i += 1) {
    total += frequencyData[i];
    count += 1;
  }

  return count ? total / count / 255 : 0;
}

function readAudio() {
  if (!analyser) {
    bassEnergy *= 0.94;
    melodyEnergy = 0.18 + Math.sin(phase * 1.7) * 0.04;
    totalEnergy = 0.16 + Math.sin(phase * 0.8) * 0.04;
    return;
  }

  analyser.getByteFrequencyData(frequencyData);
  const nextBass = averageRange(2, 18);
  const nextMelody = averageRange(46, 190);
  const nextTotal = averageRange(2, 520);

  bassEnergy += (nextBass - bassEnergy) * 0.36;
  melodyEnergy += (nextMelody - melodyEnergy) * 0.18;
  totalEnergy += (nextTotal - totalEnergy) * 0.22;
}

function drawBackground(width, height) {
  const lift = totalEnergy * 34;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${28 + lift}, 96%, ${86 - totalEnergy * 8}%)`);
  gradient.addColorStop(0.46, `hsl(${306 - lift * 0.35}, 86%, ${88 - totalEnergy * 10}%)`);
  gradient.addColorStop(1, `hsl(${190 + lift * 0.8}, 78%, ${92 - totalEnergy * 7}%)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.4 + totalEnergy * 0.25;
  const glow = ctx.createRadialGradient(width * 0.48, height * 0.48, 20, width * 0.48, height * 0.48, width * 0.7);
  glow.addColorStop(0, "rgba(255,255,255,0.85)");
  glow.addColorStop(0.44, "rgba(255,255,255,0.2)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
}

function drawGradientFigure(width, height) {
  const pulse = melodyEnergy;
  const silhouette = silhouettes.left;

  if (!silhouette.ready) {
    return;
  }

  const bounds = getLeftFigureBounds(width, height, silhouette);
  const movement = pulse * Math.min(width, height) * 0.012;

  const fill = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);
  fill.addColorStop(0, `hsl(${22 + pulse * 26}, 96%, 62%)`);
  fill.addColorStop(0.32, `hsl(${42 + pulse * 20}, 98%, 66%)`);
  fill.addColorStop(0.66, `hsl(${292 - pulse * 34}, 84%, 68%)`);
  fill.addColorStop(1, `hsl(${58 + pulse * 18}, 82%, 72%)`);

  const layer = prepareLayer(layers.left, bounds.width, bounds.height);
  const layerCtx = resetLayerContext(layer);
  const layerFill = layerCtx.createLinearGradient(0, 0, bounds.width, bounds.height);
  layerFill.addColorStop(0, `hsl(${22 + pulse * 26}, 96%, 62%)`);
  layerFill.addColorStop(0.32, `hsl(${42 + pulse * 20}, 98%, 66%)`);
  layerFill.addColorStop(0.66, `hsl(${292 - pulse * 34}, 84%, 68%)`);
  layerFill.addColorStop(1, `hsl(${58 + pulse * 18}, 82%, 72%)`);

  layerCtx.fillStyle = layerFill;
  layerCtx.fillRect(0, 0, bounds.width, bounds.height);

  layerCtx.globalCompositeOperation = "screen";
  layerCtx.globalAlpha = 0.42 + pulse * 0.38;
  const shimmer = layerCtx.createRadialGradient(
    bounds.width * 0.62,
    bounds.height * 0.38,
    10,
    bounds.width * 0.62,
    bounds.height * 0.38,
    bounds.width * (0.24 + pulse * 0.08),
  );
  shimmer.addColorStop(0, "rgba(255,255,255,0.72)");
  shimmer.addColorStop(0.34, "rgba(184,76,255,0.42)");
  shimmer.addColorStop(1, "rgba(255,255,255,0)");
  layerCtx.fillStyle = shimmer;
  layerCtx.fillRect(0, 0, bounds.width, bounds.height);

  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.globalAlpha = 1;
  layerCtx.drawImage(silhouette.image, 0, 0, bounds.width, bounds.height);

  ctx.save();
  ctx.translate(movement, 0);
  ctx.drawImage(layer, bounds.x, bounds.y);
  ctx.restore();
}

function drawSpikyFigure(width, height) {
  const silhouette = silhouettes.right;

  if (!silhouette.ready) {
    return;
  }

  const bounds = getRightFigureBounds(width, height, silhouette);
  const bassScale = 1 + bassEnergy * 0.035;
  const scaledWidth = bounds.width * bassScale;
  const scaledHeight = bounds.height * bassScale;
  const scaledX = width - scaledWidth;
  const scaledY = bounds.y + (bounds.height - scaledHeight) * 0.5;
  const layer = prepareLayer(layers.right, scaledWidth, scaledHeight);
  const layerCtx = resetLayerContext(layer);

  layerCtx.fillStyle = "#171713";
  layerCtx.fillRect(0, 0, scaledWidth, scaledHeight);
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(silhouette.image, 0, 0, scaledWidth, scaledHeight);

  ctx.save();
  ctx.shadowColor = `rgba(22,22,17,${0.22 + bassEnergy * 0.32})`;
  ctx.shadowBlur = 8 + bassEnergy * 44;
  ctx.drawImage(layer, scaledX, scaledY);
  ctx.restore();
}

function prepareLayer(layer, width, height) {
  const pixelRatio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.ceil(width * pixelRatio));
  const nextHeight = Math.max(1, Math.ceil(height * pixelRatio));
  if (layer.width !== nextWidth || layer.height !== nextHeight) {
    layer.width = nextWidth;
    layer.height = nextHeight;
  }
  layer.logicalWidth = width;
  layer.logicalHeight = height;
  layer.pixelRatio = pixelRatio;
  return layer;
}

function resetLayerContext(layer) {
  const layerCtx = layer.getContext("2d");
  const pixelRatio = layer.pixelRatio || 1;
  layerCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  layerCtx.globalCompositeOperation = "source-over";
  layerCtx.globalAlpha = 1;
  layerCtx.clearRect(0, 0, layer.logicalWidth, layer.logicalHeight);
  return layerCtx;
}

function createSilhouette(src) {
  const image = new Image();
  const silhouette = {
    image,
    ready: false,
    width: 1,
    height: 1,
  };

  image.addEventListener("load", () => {
    silhouette.width = image.naturalWidth || 1;
    silhouette.height = image.naturalHeight || 1;
    silhouette.ready = true;
  });

  image.addEventListener("error", () => {
    statusText.textContent = "One of the portrait references did not load";
  });

  image.src = src;
  return silhouette;
}

function getFigureScale(width, height, silhouette) {
  return Math.min((height * 0.78) / silhouette.height, (width * 0.38) / silhouette.width);
}

function getLeftFigureBounds(width, height, silhouette) {
  const scale = getFigureScale(width, height, silhouette);
  const figureWidth = silhouette.width * scale;
  const figureHeight = silhouette.height * scale;
  return {
    x: 0,
    y: height - figureHeight,
    width: figureWidth,
    height: figureHeight,
  };
}

function getRightFigureBounds(width, height, silhouette) {
  const scale = getFigureScale(width, height, silhouette);
  const figureWidth = silhouette.width * scale;
  const figureHeight = silhouette.height * scale;
  return {
    x: width - figureWidth,
    y: height - figureHeight,
    width: figureWidth,
    height: figureHeight,
  };
}

function render() {
  phase += 0.012;
  readAudio();

  const { width, height } = canvas.getBoundingClientRect();
  drawBackground(width, height);
  drawGradientFigure(width, height);
  drawSpikyFigure(width, height);

  requestAnimationFrame(render);
}

micToggle.addEventListener("click", async () => {
  try {
    micToggle.disabled = true;
    shareToggle.disabled = true;
    statusText.textContent = "Requesting microphone input";
    await startAudio("mic");
    stopAudio.disabled = false;
    statusText.textContent = "Reacting to microphone or audio-interface input";
  } catch (error) {
    stopAudioInput();
    statusText.textContent = "Microphone input was not available";
  } finally {
    if (!stream) {
      micToggle.disabled = false;
      shareToggle.disabled = false;
    }
  }
});

shareToggle.addEventListener("click", async () => {
  try {
    micToggle.disabled = true;
    shareToggle.disabled = true;
    statusText.textContent = "Choose a tab or screen and include audio";
    await startAudio("share");
    stopAudio.disabled = false;
    statusText.textContent = "Reacting to shared tab or system audio";
  } catch (error) {
    stopAudioInput();
    statusText.textContent = "Shared audio was not available";
  } finally {
    if (!stream) {
      micToggle.disabled = false;
      shareToggle.disabled = false;
    }
  }
});

stopAudio.addEventListener("click", () => {
  stopAudioInput();
  statusText.textContent = "Audio reaction stopped";
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
render();
