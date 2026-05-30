// ── Modulator Theme (Generativ) ──────────────────────────────────────────────
// Generates abstract, mathematical patterns (Waves, Grid, Blobs/Plasma)
// purely based on time and coordinates. Can optionally be modulated by video.

window.ModulatorTheme = {
  id: 'modulator',
  name: 'Modulator (Generativ)',
  isGenerator: true, // App knows it can render without a video

  getControls() {
    return `
      <div class="control-row">
        <label>Modus</label>
        <select id="modModeSelect">
          <option value="waves" selected>Warped Waves</option>
          <option value="grid">Liquid Grid</option>
          <option value="blobs">Interference Blobs</option>
        </select>
      </div>
      <div class="control-row">
        <label>Zellengröße / Dichte <span class="val" id="modDensityVal">10</span></label>
        <input type="range" id="modDensityRange" min="2" max="100" value="10" step="1">
      </div>
      <div class="control-row">
        <label>Distortion <span class="val" id="modDistortVal">50</span></label>
        <input type="range" id="modDistortRange" min="0" max="200" value="50" step="1">
      </div>
      <div class="control-row">
        <label>Frequenz <span class="val" id="modFreqVal">1.0</span></label>
        <input type="range" id="modFreqRange" min="0.1" max="10.0" value="1.0" step="0.1">
      </div>
      <div class="control-row">
        <label>Speed <span class="val" id="modSpeedVal">1.0</span></label>
        <input type="range" id="modSpeedRange" min="0.0" max="5.0" value="1.0" step="0.1">
      </div>
      <div class="control-row" style="flex-direction:row; justify-content:space-between; align-items:center;">
        <label for="modUseVideo">Video-Helligkeit einmischen</label>
        <input type="checkbox" id="modUseVideo" style="width:auto;">
      </div>
    `;
  },

  bindEvents(autoPreview) {
    const bindSlider = (id, valId, suffix = '') => {
      const el = document.getElementById(id);
      const val = document.getElementById(valId);
      el.addEventListener('input', () => {
        val.textContent = parseFloat(el.value).toFixed(el.step.includes('.') ? 1 : 0) + suffix;
        autoPreview();
      });
    };

    bindSlider('modDensityRange', 'modDensityVal');
    bindSlider('modDistortRange', 'modDistortVal');
    bindSlider('modFreqRange', 'modFreqVal');
    bindSlider('modSpeedRange', 'modSpeedVal');

    document.getElementById('modModeSelect').addEventListener('change', autoPreview);
    document.getElementById('modUseVideo').addEventListener('change', autoPreview);
  },

  getParams() {
    return {
      mode: document.getElementById('modModeSelect').value,
      density: parseInt(document.getElementById('modDensityRange').value),
      distortion: parseInt(document.getElementById('modDistortRange').value),
      freq: parseFloat(document.getElementById('modFreqRange').value),
      speed: parseFloat(document.getElementById('modSpeedRange').value),
      useVideo: document.getElementById('modUseVideo').checked,
    };
  },

  applyParams(p) {
    const setVal = (id, valId, value, suffix = '', float = false) => {
      if (value !== undefined) {
        document.getElementById(id).value = value;
        document.getElementById(valId).textContent = (float ? parseFloat(value).toFixed(1) : value) + suffix;
      }
    };

    setVal('modDensityRange', 'modDensityVal', p.density);
    setVal('modDistortRange', 'modDistortVal', p.distortion);
    setVal('modFreqRange', 'modFreqVal', p.freq, '', true);
    setVal('modSpeedRange', 'modSpeedVal', p.speed, '', true);

    if (p.mode !== undefined) document.getElementById('modModeSelect').value = p.mode;
    if (p.useVideo !== undefined) document.getElementById('modUseVideo').checked = p.useVideo;
  },

  renderFrame(srcCanvas, dstCanvas, params) {
    const { mode, density, distortion, freq, speed, useVideo, outW, outH, bg, fg, time } = params;
    const ctx = dstCanvas.getContext('2d');
    
    // Hintergrund
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
    
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(1, density * 0.2);

    const t = (time || 0) * speed;
    
    // Pixel-Daten vom Video lesen, wenn gewünscht & vorhanden
    let srcPx = null;
    let srcW = 0, srcH = 0;
    if (useVideo && srcCanvas) {
      srcW = srcCanvas.width;
      srcH = srcCanvas.height;
      const srcCtx = srcCanvas.getContext('2d');
      srcPx = srcCtx.getImageData(0, 0, srcW, srcH).data;
    }

    const getBrightness = (x, y) => {
      if (!srcPx) return 1.0;
      const sx = Math.floor((x / outW) * srcW);
      const sy = Math.floor((y / outH) * srcH);
      const safeSx = Math.min(Math.max(sx, 0), srcW - 1);
      const safeSy = Math.min(Math.max(sy, 0), srcH - 1);
      const i = (safeSy * srcW + safeSx) * 4;
      return (0.299 * srcPx[i] + 0.587 * srcPx[i+1] + 0.114 * srcPx[i+2]) / 255;
    };

    if (mode === 'waves') {
      ctx.beginPath();
      // Y loop
      for (let y = -distortion; y < outH + distortion * 2; y += density) {
        let first = true;
        // X loop
        for (let x = 0; x <= outW; x += density) {
          const v = getBrightness(x, y);
          // Complex sine wave distortion
          const wave1 = Math.sin((x * 0.005 * freq) + t) * distortion * v;
          const wave2 = Math.cos((x * 0.01 * freq) - t * 0.5) * (distortion * 0.5) * v;
          
          const dy = y + wave1 + wave2;
          
          if (first) {
            ctx.moveTo(x, dy);
            first = false;
          } else {
            ctx.lineTo(x, dy);
          }
        }
      }
      ctx.stroke();

    } else if (mode === 'grid') {
      for (let x = -distortion; x < outW + distortion; x += density) {
        for (let y = -distortion; y < outH + distortion; y += density) {
          const v = getBrightness(x, y);
          
          // 2D sine field displacement
          const dx = Math.sin((y * 0.01 * freq) + t) * distortion * v;
          const dy = Math.cos((x * 0.01 * freq) - t) * distortion * v;
          
          const finalX = x + dx;
          const finalY = y + dy;
          
          ctx.fillRect(finalX, finalY, density * 0.6, density * 0.6);
        }
      }

    } else if (mode === 'blobs') {
      // Contour lines of a plasma field
      for (let x = 0; x < outW; x += density) {
        for (let y = 0; y < outH; y += density) {
          const v = getBrightness(x, y);
          
          const cx = (x - outW/2) * 0.005 * freq;
          const cy = (y - outH/2) * 0.005 * freq;
          
          // Generate a plasma field
          const val1 = Math.sin(cx + t);
          const val2 = Math.sin(cy - t);
          const val3 = Math.sin(Math.sqrt(cx*cx + cy*cy) - t * 1.5);
          
          // Amplify field by distortion
          const field = (val1 + val2 + val3) * (distortion * 0.1); 
          
          // Create contour lines by applying sin to the field
          const contour = Math.sin(field);
          
          // Draw where contour is near 0
          if (Math.abs(contour) < 0.2 * v) {
            ctx.fillRect(x, y, density, density);
          }
        }
      }
    }
  }
};
