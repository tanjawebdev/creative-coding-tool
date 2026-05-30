// ── MP4 Export ───────────────────────────────────────────────────────────────
// Handles encoding video frames via WebCodecs + mp4-muxer and triggering download.
// Depends on: window.App (for getFullParams, activeTheme, videoEl, videoReady, setProgress)

// Pick correct AVC codec string for a given resolution
// avc1.PPCCLL — PP=profile(42=baseline), CC=constraints, LL=level
function getCodecString(w, h) {
  const pixels = w * h;
  if (pixels <= 409600) return 'avc1.42001e';   // Level 3.0  — up to 720×576
  if (pixels <= 921600) return 'avc1.420028';    // Level 4.0  — up to 1920×1080
  if (pixels <= 2073600) return 'avc1.640032';   // Level 5.0  High profile — up to 1920×1080
  return 'avc1.640033';                           // Level 5.1  High profile — 4K
}

async function startExport() {
  const app = window.App;
  if (!app.videoReady) return;
  if (!window.VideoEncoder) {
    alert('Dein Browser unterstützt die WebCodecs API nicht.\nBitte Chrome 94+ oder Edge 94+ verwenden.');
    return;
  }

  const exportBtn = document.getElementById('exportBtn');
  const previewBtn = document.getElementById('previewBtn');
  const progressWrap = document.getElementById('progressWrap');

  exportBtn.disabled = true;
  previewBtn.disabled = true;
  progressWrap.classList.add('active');

  const p = app.getFullParams();
  const fps = 30;
  const videoEl = app.videoEl;
  const duration = videoEl.duration;
  const frameCount = Math.round(duration * fps);
  const codec = getCodecString(p.outW, p.outH);

  app.setProgress(0, `Vorbereitung... (${frameCount} Frames)`);

  // ── Use mp4-muxer for reliable MP4 output ──────────────────────────────
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: p.outW,
      height: p.outH,
    },
    fastStart: 'in-memory',
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e; console.error('Encoder error:', e); },
  });

  // Check if codec is supported before configuring
  const support = await VideoEncoder.isConfigSupported({
    codec,
    width: p.outW,
    height: p.outH,
    bitrate: 40_000_000,
    framerate: fps,
  });

  if (!support.supported) {
    alert(`Codec nicht unterstützt für ${p.outW}×${p.outH}.\nBitte eine niedrigere Auflösung wählen.`);
    exportBtn.disabled = false;
    previewBtn.disabled = false;
    progressWrap.classList.remove('active');
    return;
  }

  encoder.configure({
    codec,
    width: p.outW,
    height: p.outH,
    bitrate: 40_000_000,
    framerate: fps,
    avc: { format: 'avc' }, // AVCC format (not Annex B) — required by mp4-muxer
  });

  // Sample canvas (small, for pixel reading)
  const sampleW = Math.min(640, videoEl.videoWidth);
  const sampleH = Math.round(sampleW * videoEl.videoHeight / videoEl.videoWidth);
  const sampleCanvas = new OffscreenCanvas(sampleW, sampleH);
  const sampleCtx = sampleCanvas.getContext('2d');

  // Output canvas (full resolution)
  const outCanvas = new OffscreenCanvas(p.outW, p.outH);

  for (let f = 0; f < frameCount; f++) {
    if (encoderError) break;

    const t = f / fps;
    videoEl.currentTime = t;
    await new Promise(res => videoEl.addEventListener('seeked', res, { once: true }));

    sampleCtx.drawImage(videoEl, 0, 0, sampleW, sampleH);
    app.activeTheme.renderFrame(sampleCanvas, outCanvas, p);

    const bitmap = await createImageBitmap(outCanvas);
    const vf = new VideoFrame(bitmap, {
      timestamp: Math.round(t * 1_000_000),
      duration: Math.round(1_000_000 / fps),
    });

    const isKey = f % 30 === 0;
    encoder.encode(vf, { keyFrame: isKey });
    vf.close();
    bitmap.close();

    // Keep encoder queue from growing unbounded
    if (encoder.encodeQueueSize > 10) {
      await new Promise(res => { encoder.ondequeue = () => { if (encoder.encodeQueueSize <= 5) res(); }; });
    }

    const pct = ((f + 1) / frameCount) * 88;
    app.setProgress(pct, `Rendere Frame ${f + 1} / ${frameCount}`);

    // Yield to browser every few frames
    if (f % 3 === 0) await new Promise(r => setTimeout(r, 0));
  }

  if (encoderError) {
    alert('Encoder-Fehler: ' + encoderError.message);
    exportBtn.disabled = false;
    previewBtn.disabled = false;
    progressWrap.classList.remove('active');
    return;
  }

  app.setProgress(90, 'Encoder flushen...');
  await encoder.flush();
  encoder.close();

  app.setProgress(96, 'MP4 finalisieren...');
  muxer.finalize();

  app.setProgress(100, 'Fertig! Download startet...');
  const { buffer } = muxer.target;
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ascii-video.mp4';
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);

  setTimeout(() => {
    progressWrap.classList.remove('active');
    exportBtn.disabled = false;
    previewBtn.disabled = false;
    app.setProgress(0, '');
  }, 3000);
}
