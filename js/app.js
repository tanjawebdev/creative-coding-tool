// ── Creative Coding Tool — Main App ──────────────────────────────────────────
// Orchestrates themes, file handling, preview, presets, and export.

(function () {
  // ── Theme Registry ───────────────────────────────────────────────────────
  const themes = [window.AsciiTheme];
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
  const fontSizeRange = document.getElementById('fontSizeRange');
  const fontSizeVal = document.getElementById('fontSizeVal');
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
    autoPreview();
  });

  // ── Collect all parameters (global + theme-specific) ─────────────────────
  function getFullParams() {
    const [outW, outH] = resSelect.value.split('x').map(Number);
    const manualFontSize = parseInt(fontSizeRange.value);
    const fontSize = manualFontSize > 0 ? manualFontSize : null; // null = auto

    return {
      ...activeTheme.getParams(),
      fontSize,
      outW,
      outH,
      bg: bgColor.value,
      fg: fgColor.value,
    };
  }

  // ── Live labels for global controls ──────────────────────────────────────
  fontSizeRange.addEventListener('input', () => {
    const v = parseInt(fontSizeRange.value);
    fontSizeVal.textContent = v === 0 ? 'auto' : v + 'px';
    autoPreview();
  });
  resSelect.addEventListener('change', autoPreview);
  bgColor.addEventListener('input', autoPreview);
  fgColor.addEventListener('input', autoPreview);

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
        scrubber.max = Math.max(1, Math.round(videoEl.duration * 10));
        previewBtn.disabled = false;
        exportBtn.disabled = false;
        renderPreviewAtTime(0);
      },
      { once: true }
    );
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  let previewDebounce = null;
  function autoPreview() {
    if (!videoReady) return;
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => renderPreviewAtTime(videoEl.currentTime), 80);
  }

  previewBtn.addEventListener('click', () => {
    if (videoReady) renderPreviewAtTime(videoEl.currentTime);
  });

  scrubber.addEventListener('input', () => {
    if (!videoReady) return;
    const t = parseFloat(scrubber.value) / 10;
    videoEl.currentTime = t;
    videoEl.addEventListener('seeked', () => renderPreviewAtTime(t), { once: true });
  });

  async function renderPreviewAtTime(t) {
    if (!videoReady) return;
    const p = getFullParams();

    // Draw video frame to small offscreen canvas for sampling
    const sampleW = 640;
    const sampleH = Math.round((sampleW * videoEl.videoHeight) / videoEl.videoWidth);
    const sampleCanvas = new OffscreenCanvas(sampleW, sampleH);
    const sCtx = sampleCanvas.getContext('2d');
    sCtx.drawImage(videoEl, 0, 0, sampleW, sampleH);

    // Render via active theme
    previewCanvas.width = p.outW;
    previewCanvas.height = p.outH;
    activeTheme.renderFrame(sampleCanvas, previewCanvas, p);

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
      fontSize: parseInt(fontSizeRange.value),
      bgColor: bgColor.value,
      fgColor: fgColor.value,
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
    if (p.fontSize !== undefined) {
      fontSizeRange.value = p.fontSize;
      fontSizeVal.textContent = p.fontSize === 0 ? 'auto' : p.fontSize + 'px';
    }
    if (p.bgColor !== undefined) {
      bgColor.value = p.bgColor;
    }
    if (p.fgColor !== undefined) {
      fgColor.value = p.fgColor;
    }
    autoPreview();
  }

  // ── Expose shared state for export.js ────────────────────────────────────
  window.App = {
    get videoEl() { return videoEl; },
    get videoReady() { return videoReady; },
    get activeTheme() { return activeTheme; },
    getFullParams,
    setProgress,
  };
})();
