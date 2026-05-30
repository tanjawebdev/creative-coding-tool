// ── Creative Coding Tool — Main App ──────────────────────────────────────────
// Orchestrates themes, file handling, preview, presets, and export.

(function () {
  // ── Theme Registry ───────────────────────────────────────────────────────
  const themes = [window.AsciiTheme, window.RasterizeTheme, window.HalftoneTheme, window.ModulatorTheme, window.GradientPlatingTheme];
  let activeTheme = themes[0];

  // ── State ────────────────────────────────────────────────────────────────
  let videoFile = null;
  let videoEl = document.getElementById('hiddenVideo');
  let videoReady = false;
  let totalFrames = 0;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const themeSelect = document.getElementById('themeSelect');
  const themeControls = document.getElementById('themeControls');
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const dzFilename = document.getElementById('dzFilename');
  const resSelect = document.getElementById('resSelect');
  const bgColor = document.getElementById('bgColor');
  const fgColor = document.getElementById('fgColor');
  const previewBtn = document.getElementById('previewBtn');
  const exportBtn = document.getElementById('exportBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const previewCanvas = document.getElementById('preview-canvas');
  const emptyState = document.getElementById('emptyState');
  const scrubberWrap = document.getElementById('scrubberWrap');
  const scrubber = document.getElementById('scrubber');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const scrubberTime = document.getElementById('scrubberTime');

  // ── Adjust Footage DOM refs ──────────────────────────────────────────────
  const brightnessRange = document.getElementById('brightnessRange');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrastRange = document.getElementById('contrastRange');
  const contrastVal = document.getElementById('contrastVal');
  const saturationRange = document.getElementById('saturationRange');
  const saturationVal = document.getElementById('saturationVal');
  const gammaRange = document.getElementById('gammaRange');
  const gammaVal = document.getElementById('gammaVal');
  const scaleRange = document.getElementById('scaleRange');
  const scaleVal = document.getElementById('scaleVal');
  const posXRange = document.getElementById('posXRange');
  const posXVal = document.getElementById('posXVal');
  const posYRange = document.getElementById('posYRange');
  const posYVal = document.getElementById('posYVal');
  const rotRange = document.getElementById('rotRange');
  const rotVal = document.getElementById('rotVal');
  const resetAdjustBtn = document.getElementById('resetAdjustBtn');
  
  const generatorSettings = document.getElementById('generatorSettings');
  const durationRange = document.getElementById('durationRange');
  const durationVal = document.getElementById('durationVal');

  // ── Duration & Ready State ───────────────────────────────────────────────
  let virtualTime = 0;
  
  function getDuration() {
    return videoReady ? videoEl.duration : parseInt(durationRange.value);
  }

  function isGeneratorMode() {
    return activeTheme.isGenerator && !videoReady;
  }

  function canRender() {
    return videoReady || activeTheme.isGenerator;
  }

  function checkReadyState() {
    if (activeTheme.isGenerator && !videoReady) {
      generatorSettings.style.display = 'block';
    } else {
      generatorSettings.style.display = 'none';
    }

    if (canRender()) {
      previewBtn.disabled = false;
      exportBtn.disabled = false;
      emptyState.style.display = 'none';
      previewCanvas.style.display = 'block';
      scrubberWrap.classList.add('visible');
      scrubber.max = Math.max(1, Math.round(getDuration() * 10));
      updateTimeDisplay();
    } else {
      previewBtn.disabled = true;
      exportBtn.disabled = true;
      emptyState.style.display = 'flex';
      previewCanvas.style.display = 'none';
      scrubberWrap.classList.remove('visible');
    }
  }

  durationRange.addEventListener('input', () => {
    durationVal.textContent = durationRange.value + 's';
    if (isGeneratorMode()) checkReadyState();
  });

  // ── Theme setup ──────────────────────────────────────────────────────────
  function populateThemeSelect() {
    themeSelect.innerHTML = '';
    themes.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      themeSelect.appendChild(opt);
    });
    themeSelect.value = activeTheme.id;
  }

  function activateTheme(themeId) {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;
    activeTheme = theme;

    // Render theme-specific controls into the container
    themeControls.innerHTML = theme.getControls();

    // Bind theme-specific events
    theme.bindEvents(autoPreview);
  }

  populateThemeSelect();
  activateTheme(activeTheme.id);

  themeSelect.addEventListener('change', () => {
    activateTheme(themeSelect.value);
    checkReadyState();
    autoPreview();
  });

  // ── Collect all parameters (global + theme-specific) ─────────────────────
  function getFullParams() {
    const [outW, outH] = resSelect.value.split('x').map(Number);

    return {
      ...activeTheme.getParams(),
      outW,
      outH,
      bg: bgColor.value,
      fg: fgColor.value,
    };
  }

  // ── Live labels for global controls ──────────────────────────────────────
  resSelect.addEventListener('change', autoPreview);
  bgColor.addEventListener('input', autoPreview);
  fgColor.addEventListener('input', autoPreview);

  // ── Adjust Footage controls ─────────────────────────────────────────────
  brightnessRange.addEventListener('input', () => {
    brightnessVal.textContent = brightnessRange.value + '%';
    autoPreview();
  });
  contrastRange.addEventListener('input', () => {
    contrastVal.textContent = contrastRange.value + '%';
    autoPreview();
  });
  saturationRange.addEventListener('input', () => {
    saturationVal.textContent = saturationRange.value + '%';
    autoPreview();
  });
  gammaRange.addEventListener('input', () => {
    gammaVal.textContent = parseFloat(gammaRange.value).toFixed(1);
    autoPreview();
  });
  scaleRange.addEventListener('input', () => {
    scaleVal.textContent = parseFloat(scaleRange.value).toFixed(2) + 'x';
    autoPreview();
  });
  posXRange.addEventListener('input', () => {
    posXVal.textContent = posXRange.value + '%';
    autoPreview();
  });
  posYRange.addEventListener('input', () => {
    posYVal.textContent = posYRange.value + '%';
    autoPreview();
  });
  rotRange.addEventListener('input', () => {
    rotVal.textContent = rotRange.value + '°';
    autoPreview();
  });

  resetAdjustBtn.addEventListener('click', () => {
    brightnessRange.value = 100; brightnessVal.textContent = '100%';
    contrastRange.value = 100;   contrastVal.textContent = '100%';
    saturationRange.value = 100; saturationVal.textContent = '100%';
    gammaRange.value = 1.0;      gammaVal.textContent = '1.0';
    scaleRange.value = 1.0;      scaleVal.textContent = '1.0x';
    posXRange.value = 0;         posXVal.textContent = '0%';
    posYRange.value = 0;         posYVal.textContent = '0%';
    rotRange.value = 0;          rotVal.textContent = '0°';
    autoPreview();
  });

  // ── Get current footage adjustment values ────────────────────────────────
  function getAdjustments() {
    return {
      brightness: parseInt(brightnessRange.value),
      contrast: parseInt(contrastRange.value),
      saturation: parseInt(saturationRange.value),
      gamma: parseFloat(gammaRange.value),
      scale: parseFloat(scaleRange.value),
      posX: parseInt(posXRange.value),
      posY: parseInt(posYRange.value),
      rotation: parseInt(rotRange.value),
    };
  }

  // ── Draw Video with Transform ────────────────────────────────────────────
  function drawVideoToCanvas(video, ctx, w, h) {
    const adj = getAdjustments();
    
    ctx.fillStyle = bgColor.value; // Draw background behind transformed video
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    
    // Move to center of canvas
    ctx.translate(w / 2, h / 2);
    
    // Apply position offsets (percentages of width/height)
    ctx.translate((w * adj.posX) / 100, (h * adj.posY) / 100);
    
    // Apply rotation
    if (adj.rotation !== 0) {
      ctx.rotate((adj.rotation * Math.PI) / 180);
    }
    
    // Apply scale
    if (adj.scale !== 1.0) {
      ctx.scale(adj.scale, adj.scale);
    }
    
    // Draw centered
    ctx.drawImage(video, -w / 2, -h / 2, w, h);
    
    ctx.restore();
  }

  // ── Apply footage adjustments to a canvas context via CSS filter ─────────
  function applyFootageFilter(ctx, w, h) {
    const adj = getAdjustments();
    // Only apply if anything differs from defaults
    if (adj.brightness === 100 && adj.contrast === 100 && adj.saturation === 100 && adj.gamma === 1.0) return;

    // Read current pixel data and apply adjustments manually
    // (OffscreenCanvas doesn't support CSS filter in all browsers)
    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    const br = adj.brightness / 100;
    const co = adj.contrast / 100;
    const sa = adj.saturation / 100;
    const ga = 1.0 / adj.gamma;

    for (let i = 0; i < px.length; i += 4) {
      let r = px[i], g = px[i + 1], b = px[i + 2];

      // Brightness
      r *= br; g *= br; b *= br;

      // Contrast (around mid-gray)
      r = ((r / 255 - 0.5) * co + 0.5) * 255;
      g = ((g / 255 - 0.5) * co + 0.5) * 255;
      b = ((b / 255 - 0.5) * co + 0.5) * 255;

      // Saturation (luminance-based)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * sa;
      g = lum + (g - lum) * sa;
      b = lum + (b - lum) * sa;

      // Gamma
      if (ga !== 1.0) {
        r = 255 * Math.pow(Math.max(0, r / 255), ga);
        g = 255 * Math.pow(Math.max(0, g / 255), ga);
        b = 255 * Math.pow(Math.max(0, b / 255), ga);
      }

      px[i]     = Math.max(0, Math.min(255, r));
      px[i + 1] = Math.max(0, Math.min(255, g));
      px[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ── File handling ────────────────────────────────────────────────────────
  fileInput.addEventListener('change', (e) => loadFile(e.target.files[0]));
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  function loadFile(file) {
    if (!file || !file.type.startsWith('video/')) return;
    videoFile = file;
    dzFilename.textContent = file.name;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.addEventListener(
      'loadedmetadata',
      () => {
        videoReady = true;
        totalFrames = Math.round(videoEl.duration * 30); // estimate
        checkReadyState();
        startPlayback();
      },
      { once: true }
    );
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  let previewDebounce = null;
  function autoPreview() {
    if (!canRender()) return;
    clearTimeout(previewDebounce);
    const t = videoReady ? videoEl.currentTime : virtualTime;
    previewDebounce = setTimeout(() => renderPreviewAtTime(t), 80);
  }

  previewBtn.addEventListener('click', () => {
    if (canRender()) renderPreviewAtTime(videoReady ? videoEl.currentTime : virtualTime);
  });

  scrubber.addEventListener('input', () => {
    if (!canRender()) return;
    if (isPlaying) stopPlayback();
    const t = parseFloat(scrubber.value) / 10;
    if (videoReady) {
      videoEl.currentTime = t;
      videoEl.addEventListener('seeked', () => renderPreviewAtTime(t), { once: true });
    } else {
      virtualTime = t;
      renderPreviewAtTime(t);
      updateTimeDisplay();
    }
  });

  // ── Play / Pause ────────────────────────────────────────────────────────
  let isPlaying = false;
  let playRAF = null;
  let lastFrameTime = 0;

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimeDisplay() {
    if (!canRender()) return;
    const current = videoReady ? videoEl.currentTime : virtualTime;
    scrubberTime.textContent = `${formatTime(current)} / ${formatTime(getDuration())}`;
  }

  playPauseBtn.addEventListener('click', () => {
    if (!canRender()) return;
    if (isPlaying) stopPlayback();
    else startPlayback();
  });

  function startPlayback() {
    if (!canRender()) return;
    const current = videoReady ? videoEl.currentTime : virtualTime;
    const dur = getDuration();
    if (current >= dur - 0.1) {
      if (videoReady) videoEl.currentTime = 0;
      else virtualTime = 0;
    }
    if (videoReady) videoEl.play();
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
    playPauseBtn.classList.add('playing');
    lastFrameTime = performance.now();
    playLoop();
  }

  function stopPlayback() {
    if (videoReady) videoEl.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
    playPauseBtn.classList.remove('playing');
    if (playRAF) {
      cancelAnimationFrame(playRAF);
      playRAF = null;
    }
  }

  function playLoop() {
    if (!isPlaying) return;

    const dur = getDuration();
    
    if (videoReady) {
      if (videoEl.ended || videoEl.currentTime >= dur - 0.05) {
        videoEl.currentTime = 0;
        videoEl.play();
      }
    } else {
      const now = performance.now();
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      virtualTime += dt;
      if (virtualTime >= dur) virtualTime = 0; // Loop
    }

    const current = videoReady ? videoEl.currentTime : virtualTime;

    scrubber.value = Math.round(current * 10);
    updateTimeDisplay();
    renderPreviewAtTime(current);

    playRAF = requestAnimationFrame(playLoop);
  }

  async function renderPreviewAtTime(t) {
    if (!canRender()) return;
    const p = getFullParams();
    p.time = t; // Pass current time to theme

    let sourceCanvas = null;

    if (videoReady) {
      const sampleW = 640;
      const sampleH = Math.round((sampleW * videoEl.videoHeight) / videoEl.videoWidth);
      sourceCanvas = new OffscreenCanvas(sampleW, sampleH);
      const sCtx = sourceCanvas.getContext('2d');
      drawVideoToCanvas(videoEl, sCtx, sampleW, sampleH);
      applyFootageFilter(sCtx, sampleW, sampleH);
    }

    previewCanvas.width = p.outW;
    previewCanvas.height = p.outH;
    activeTheme.renderFrame(sourceCanvas, previewCanvas, p);

    emptyState.style.display = 'none';
    previewCanvas.style.display = 'block';
    scrubberWrap.classList.add('visible');
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportBtn.addEventListener('click', startExport);

  // ── Progress helper ──────────────────────────────────────────────────────
  function setProgress(pct, text) {
    progressFill.style.width = pct + '%';
    progressText.textContent = text;
  }

  // ── Preset Import / Export ───────────────────────────────────────────────
  const importPresetBtn = document.getElementById('importPresetBtn');
  const exportPresetBtn = document.getElementById('exportPresetBtn');
  const presetFileInput = document.getElementById('presetFileInput');

  exportPresetBtn.addEventListener('click', () => {
    const preset = {
      version: 1,
      theme: activeTheme.id,
      ...activeTheme.getParams(),
      resolution: resSelect.value,
      bgColor: bgColor.value,
      fgColor: fgColor.value,
      adjust: getAdjustments(),
    };
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${activeTheme.id}-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });

  importPresetBtn.addEventListener('click', () => presetFileInput.click());

  presetFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const preset = JSON.parse(ev.target.result);
        applyPreset(preset);
      } catch (err) {
        alert('Ungültige Preset-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
    presetFileInput.value = ''; // reset so same file can be re-imported
  });

  function applyPreset(p) {
    // Switch theme if specified
    if (p.theme) {
      themeSelect.value = p.theme;
      activateTheme(p.theme);
    }

    // Apply theme-specific params
    activeTheme.applyParams(p);

    // Apply global params
    if (p.resolution !== undefined) {
      resSelect.value = p.resolution;
    }
    if (p.bgColor !== undefined) {
      bgColor.value = p.bgColor;
    }
    if (p.fgColor !== undefined) {
      fgColor.value = p.fgColor;
    }
    // Apply footage adjustments
    if (p.adjust) {
      brightnessRange.value = p.adjust.brightness ?? 100;
      brightnessVal.textContent = brightnessRange.value + '%';
      contrastRange.value = p.adjust.contrast ?? 100;
      contrastVal.textContent = contrastRange.value + '%';
      saturationRange.value = p.adjust.saturation ?? 100;
      saturationVal.textContent = saturationRange.value + '%';
      gammaRange.value = p.adjust.gamma ?? 1.0;
      gammaVal.textContent = parseFloat(gammaRange.value).toFixed(1);
      
      scaleRange.value = p.adjust.scale ?? 1.0;
      scaleVal.textContent = parseFloat(scaleRange.value).toFixed(2) + 'x';
      posXRange.value = p.adjust.posX ?? 0;
      posXVal.textContent = posXRange.value + '%';
      posYRange.value = p.adjust.posY ?? 0;
      posYVal.textContent = posYRange.value + '%';
      rotRange.value = p.adjust.rotation ?? 0;
      rotVal.textContent = rotRange.value + '°';
    }
    // Apply generator params
    if (p.generatorDuration !== undefined) {
      durationRange.value = p.generatorDuration;
      durationVal.textContent = p.generatorDuration + 's';
    }

    autoPreview();
  }

  // ── Initialization ─────────────────────────────────────────────────────────
  checkReadyState();

  // ── Expose shared state for export.js ────────────────────────────────────
  window.App = {
    get videoEl() { return videoEl; },
    get videoReady() { return videoReady; },
    get activeTheme() { return activeTheme; },
    getDuration,
    canRender,
    getFullParams,
    setProgress,
    drawVideoToCanvas,
    applyFootageFilter,
  };
})();
