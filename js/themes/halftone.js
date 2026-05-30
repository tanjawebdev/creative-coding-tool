// ── Halftone Raster Theme ────────────────────────────────────────────────────
// Renders video frames using a halftone pattern with variable dot sizes.
// Implements the standard Theme interface.

window.HalftoneTheme = {
  id: 'halftone',
  name: 'Halftone Raster',

  // ── Returns the HTML for theme-specific sidebar controls ──────────────────
  getControls() {
    return `
      <div class="control-row">
        <label>Raster Größe <span class="val" id="htGridSizeVal">10</span></label>
        <input type="range" id="htGridSizeRange" min="4" max="100" value="10" step="1">
      </div>
      <div class="control-row">
        <label>Dot Skalierung <span class="val" id="htDotScaleVal">1.0</span></label>
        <input type="range" id="htDotScaleRange" min="0.5" max="3.0" value="1.0" step="0.1">
      </div>
      <div class="control-row">
        <label>Rotation (Grad) <span class="val" id="htRotationVal">45°</span></label>
        <input type="range" id="htRotationRange" min="0" max="90" value="45" step="1">
      </div>
      <div class="control-row">
        <label>Dot Form</label>
        <select id="htShapeSelect">
          <option value="circle" selected>Kreis</option>
          <option value="square">Viereck</option>
        </select>
      </div>
      <div class="control-row">
        <label>Mapping</label>
        <select id="htInvertSelect">
          <option value="false" selected>Hell = Groß</option>
          <option value="true">Hell = Klein (Invertiert)</option>
        </select>
      </div>
    `;
  },

  // ── Bind live-update events for this theme's controls ─────────────────────
  bindEvents(autoPreview) {
    const bindSlider = (id, valId, suffix = '') => {
      const el = document.getElementById(id);
      const val = document.getElementById(valId);
      el.addEventListener('input', () => {
        val.textContent = parseFloat(el.value).toFixed(el.step.includes('.') ? 1 : 0) + suffix;
        autoPreview();
      });
    };

    bindSlider('htGridSizeRange', 'htGridSizeVal');
    bindSlider('htDotScaleRange', 'htDotScaleVal');
    bindSlider('htRotationRange', 'htRotationVal', '°');

    document.getElementById('htShapeSelect').addEventListener('change', autoPreview);
    document.getElementById('htInvertSelect').addEventListener('change', autoPreview);
  },

  // ── Read current theme-specific parameters from the DOM ───────────────────
  getParams() {
    return {
      gridSize: parseInt(document.getElementById('htGridSizeRange').value),
      dotScale: parseFloat(document.getElementById('htDotScaleRange').value),
      rotation: parseInt(document.getElementById('htRotationRange').value),
      dotShape: document.getElementById('htShapeSelect').value,
      invert: document.getElementById('htInvertSelect').value === 'true',
    };
  },

  // ── Apply saved parameters back to the DOM (preset import) ────────────────
  applyParams(p) {
    const setVal = (id, valId, value, suffix = '', float = false) => {
      if (value !== undefined) {
        document.getElementById(id).value = value;
        document.getElementById(valId).textContent = (float ? parseFloat(value).toFixed(1) : value) + suffix;
      }
    };

    setVal('htGridSizeRange', 'htGridSizeVal', p.gridSize);
    setVal('htDotScaleRange', 'htDotScaleVal', p.dotScale, '', true);
    setVal('htRotationRange', 'htRotationVal', p.rotation, '°');

    if (p.dotShape !== undefined) document.getElementById('htShapeSelect').value = p.dotShape;
    if (p.invert !== undefined) document.getElementById('htInvertSelect').value = p.invert ? 'true' : 'false';
  },

  // ── Core render: draw halftone representation of a video frame ────────────
  renderFrame(srcCanvas, dstCanvas, params) {
    const { gridSize, dotScale, rotation, dotShape, invert, outW, outH, bg, fg } = params;
    const ctx = dstCanvas.getContext('2d');

    // Hintergrund füllen
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
    ctx.fillStyle = fg;

    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d');
    const imgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const px = imgData.data;

    const cx = outW / 2;
    const cy = outH / 2;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const diag = Math.sqrt(outW * outW + outH * outH);
    const halfDiag = diag / 2;

    const minGrid = -Math.ceil(halfDiag / gridSize);
    const maxGrid = Math.ceil(halfDiag / gridSize);

    // 1.415 factor allows shapes to overlap fully to create solid areas
    const maxDotSize = gridSize * 1.415 * dotScale;

    for (let u = minGrid; u <= maxGrid; u++) {
      for (let v = minGrid; v <= maxGrid; v++) {
        // Grid center in unrotated space (relative to center)
        const gx = u * gridSize;
        const gy = v * gridSize;

        // Rotate to get output canvas coordinates (relative to center)
        const rx = gx * cos - gy * sin;
        const ry = gx * sin + gy * cos;

        // Output coordinates (absolute)
        const ox = cx + rx;
        const oy = cy + ry;

        // Skip if outside canvas
        if (ox < -gridSize || ox > outW + gridSize || oy < -gridSize || oy > outH + gridSize) {
          continue;
        }

        // Map to source image coordinates
        const sx = Math.floor((ox / outW) * srcW);
        const sy = Math.floor((oy / outH) * srcH);

        // Clamp to source bounds
        const safeSx = Math.min(Math.max(sx, 0), srcW - 1);
        const safeSy = Math.min(Math.max(sy, 0), srcH - 1);

        const i = (safeSy * srcW + safeSx) * 4;
        let brightness = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;

        if (invert) {
          brightness = 1.0 - brightness;
        }

        // Calculate final dot size
        const size = brightness * maxDotSize;
        if (size < 0.5) continue;

        if (dotShape === 'circle') {
          ctx.beginPath();
          ctx.arc(ox, oy, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotShape === 'square') {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(rad);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
    }
  }
};
