// ── Rasterize Theme (Bayer Dither) ──────────────────────────────────────────
// Renders video frames using ordered dithering with a 4x4 Bayer matrix.
// Implements the standard Theme interface.

window.RasterizeTheme = {
  id: 'rasterize',
  name: 'Rasterize (Bayer 4x4)',

  // ── Returns the HTML for theme-specific sidebar controls ──────────────────
  getControls() {
    return `
      <div class="control-row">
        <label>Pixel Größe <span class="val" id="pixelSizeVal">8</span></label>
        <input type="range" id="pixelSizeRange" min="2" max="64" value="8" step="1">
      </div>

      <div class="control-row">
        <label>Dot Style</label>
        <select id="dotStyleSelect">
          <option value="square" selected>Square (Klassisch)</option>
          <option value="circle">Circle (Punkte)</option>
        </select>
      </div>
    `;
  },

  // ── Bind live-update events for this theme's controls ─────────────────────
  bindEvents(autoPreview) {
    const pixelSizeRange = document.getElementById('pixelSizeRange');
    const pixelSizeVal = document.getElementById('pixelSizeVal');
    const dotStyleSelect = document.getElementById('dotStyleSelect');

    pixelSizeRange.addEventListener('input', () => {
      pixelSizeVal.textContent = pixelSizeRange.value;
      autoPreview();
    });

    dotStyleSelect.addEventListener('change', autoPreview);
  },

  // ── Read current theme-specific parameters from the DOM ───────────────────
  getParams() {
    return {
      pixelSize: parseInt(document.getElementById('pixelSizeRange').value),
      dotStyle: document.getElementById('dotStyleSelect').value,
    };
  },

  // ── Apply saved parameters back to the DOM (preset import) ────────────────
  applyParams(p) {
    if (p.pixelSize !== undefined) {
      document.getElementById('pixelSizeRange').value = p.pixelSize;
      document.getElementById('pixelSizeVal').textContent = p.pixelSize;
    }
    if (p.dotStyle !== undefined) {
      document.getElementById('dotStyleSelect').value = p.dotStyle;
    }
  },

  // ── Core render: draw ordered dither representation of a video frame ──────
  renderFrame(srcCanvas, dstCanvas, params) {
    const { pixelSize, dotStyle, outW, outH, bg, fg } = params;
    const ctx = dstCanvas.getContext('2d');

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
    ctx.fillStyle = fg;

    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d');
    const imgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const px = imgData.data;

    // Standard 4x4 Bayer Matrix
    const bayer = [
      0, 8, 2, 10,
      12, 4, 14, 6,
      3, 11, 1, 9,
      15, 7, 13, 5
    ];

    const cols = Math.ceil(outW / pixelSize);
    const rows = Math.ceil(outH / pixelSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Map output block coordinate to source pixel
        const sx = Math.floor((col / cols) * srcW);
        const sy = Math.floor((row / rows) * srcH);
        
        // Safety bounds
        const safeSx = Math.min(Math.max(sx, 0), srcW - 1);
        const safeSy = Math.min(Math.max(sy, 0), srcH - 1);

        const i = (safeSy * srcW + safeSx) * 4;
        const brightness = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

        // Bayer threshold
        // bayer matrix is 0-15, scale to 0-255
        const bayerIdx = (row % 4) * 4 + (col % 4);
        const threshold = (bayer[bayerIdx] + 0.5) / 16 * 255;

        // If brightness is greater than threshold, paint the foreground color
        if (brightness > threshold) {
          if (dotStyle === 'square') {
            ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
          } else {
            ctx.beginPath();
            const radius = pixelSize / 2;
            ctx.arc(col * pixelSize + radius, row * pixelSize + radius, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
};
