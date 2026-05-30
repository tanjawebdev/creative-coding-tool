// ── Gradient Plating Theme (Generativ) ───────────────────────────────────
// Inspired by node-based displacement flows. 
// Uses a grid to sample a displaced background (video or radial gradient).

window.GradientPlatingTheme = {
  id: 'plating',
  name: 'Gradient Plating',
  isGenerator: true, // Can run without a video using a generated radial gradient

  getControls() {
    return `
      <div class="control-row">
        <label>Grid Cells X <span class="val" id="gpCellsXVal">13</span></label>
        <input type="range" id="gpCellsXRange" min="2" max="100" value="13" step="1">
      </div>
      <div class="control-row">
        <label>Grid Cells Y <span class="val" id="gpCellsYVal">13</span></label>
        <input type="range" id="gpCellsYRange" min="2" max="100" value="13" step="1">
      </div>
      <div class="control-row">
        <label>Grid Scale <span class="val" id="gpScaleVal">1.14</span></label>
        <input type="range" id="gpScaleRange" min="0.1" max="3.0" value="1.14" step="0.01">
      </div>
      <div class="control-row">
        <label>Noise Amplify <span class="val" id="gpAmplifyVal">32</span></label>
        <input type="range" id="gpAmplifyRange" min="0" max="200" value="32" step="1">
      </div>
      <div class="control-row">
        <label>Noise Frequenz <span class="val" id="gpFreqVal">2.0</span></label>
        <input type="range" id="gpFreqRange" min="0.1" max="10.0" value="2.0" step="0.1">
      </div>
      <div class="control-row">
        <label>Animation Speed <span class="val" id="gpSpeedVal">1.0</span></label>
        <input type="range" id="gpSpeedRange" min="0.0" max="10.0" value="1.0" step="0.1">
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
      <div class="control-row">
        <label>Blur (Weichzeichner) <span class="val" id="gpBlurVal">0px</span></label>
        <input type="range" id="gpBlurRange" min="0" max="100" value="0" step="1">
      </div>
      <div class="control-row">
        <label>Film Grain <span class="val" id="gpGrainVal">0%</span></label>
        <input type="range" id="gpGrainRange" min="0" max="100" value="0" step="1">
      </div>
    `;
  },

  bindEvents(autoPreview) {
    const bindSlider = (id, valId, suffix = '') => {
      const el = document.getElementById(id);
      const val = document.getElementById(valId);
      el.addEventListener('input', () => {
        val.textContent = parseFloat(el.value).toFixed(el.step.includes('.') ? 2 : 0) + suffix;
        autoPreview();
      });
    };

    bindSlider('gpCellsXRange', 'gpCellsXVal');
    bindSlider('gpCellsYRange', 'gpCellsYVal');
    bindSlider('gpScaleRange', 'gpScaleVal');
    bindSlider('gpAmplifyRange', 'gpAmplifyVal');
    bindSlider('gpFreqRange', 'gpFreqVal');
    bindSlider('gpSpeedRange', 'gpSpeedVal');
    bindSlider('gpBlurRange', 'gpBlurVal', 'px');
    bindSlider('gpGrainRange', 'gpGrainVal', '%');
  },

  getParams() {
    return {
      cellsX: parseInt(document.getElementById('gpCellsXRange').value),
      cellsY: parseInt(document.getElementById('gpCellsYRange').value),
      scale: parseFloat(document.getElementById('gpScaleRange').value),
      amplify: parseInt(document.getElementById('gpAmplifyRange').value),
      freq: parseFloat(document.getElementById('gpFreqRange').value),
      speed: parseFloat(document.getElementById('gpSpeedRange').value),
      blur: parseInt(document.getElementById('gpBlurRange').value),
      grain: parseInt(document.getElementById('gpGrainRange').value),
    };
  },

  applyParams(p) {
    const setVal = (id, valId, value, suffix = '', decimals = 0) => {
      if (value !== undefined) {
        document.getElementById(id).value = value;
        document.getElementById(valId).textContent = parseFloat(value).toFixed(decimals) + suffix;
      }
    };

    setVal('gpCellsXRange', 'gpCellsXVal', p.cellsX, '', 0);
    setVal('gpCellsYRange', 'gpCellsYVal', p.cellsY, '', 0);
    setVal('gpScaleRange', 'gpScaleVal', p.scale, '', 2);
    setVal('gpAmplifyRange', 'gpAmplifyVal', p.amplify, '', 0);
    setVal('gpFreqRange', 'gpFreqVal', p.freq, '', 1);
    setVal('gpSpeedRange', 'gpSpeedVal', p.speed, '', 1);
    setVal('gpBlurRange', 'gpBlurVal', p.blur, 'px', 0);
    setVal('gpGrainRange', 'gpGrainVal', p.grain, '%', 0);
  },

  renderFrame(srcCanvas, dstCanvas, params) {
    const { cellsX, cellsY, scale, amplify, freq, speed, blur, grain, outW, outH, bg, fg, time } = params;
    const ctx = dstCanvas.getContext('2d');
    
    const t = (time || 0) * speed;
    let source = srcCanvas;
    
    // Fallback: If no video is present, generate a pulsing radial gradient base
    if (!source || source.width === 0) {
      source = new OffscreenCanvas(outW, outH);
      const sCtx = source.getContext('2d');
      
      const cx = outW / 2 + Math.sin(t * 0.5) * (outW * 0.1);
      const cy = outH / 2 + Math.cos(t * 0.4) * (outH * 0.1);
      
      const pulse = Math.sin(t * 2) * 0.1;
      const radius = Math.max(outW, outH) * (0.6 + pulse);
      
      const gradient = sCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, fg);
      gradient.addColorStop(1, bg);
      
      sCtx.fillStyle = gradient;
      sCtx.fillRect(0, 0, outW, outH);
    }
    
    const srcW = source.width;
    const srcH = source.height;

    // Background fill (safety)
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);

    // Apply blur if requested
    if (blur > 0) {
      ctx.filter = `blur(${blur}px)`;
    } else {
      ctx.filter = 'none';
    }

    // Calculate grid dimensions
    const Sx = outW / cellsX;
    const Sy = outH / cellsY;

    for (let c = 0; c < cellsX; c++) {
      for (let r = 0; r < cellsY; r++) {
        // Destination cell rect (snapped to pixels to prevent sub-pixel background cracks/stripes)
        const dx = Math.floor(c * Sx);
        const dy = Math.floor(r * Sy);
        const dw = Math.ceil(Sx) + 1; // +1 prevents cracks between cells
        const dh = Math.ceil(Sy) + 1;
        
        // Center coordinate of this cell
        const ccx = dx + Sx / 2;
        const ccy = dy + Sy / 2;
        
        // Synthetic 2D noise for displacement based on cell center
        const nx = (ccx / outW) * freq * 10.0;
        const ny = (ccy / outH) * freq * 10.0;
        
        const noiseX = Math.sin(nx + t) + Math.cos(ny * 0.8 - t * 1.2);
        const noiseY = Math.sin(ny * 1.1 + t * 0.9) + Math.cos(nx * 0.9 + t);
        
        // Displaced center for sampling
        const dcx = ccx + noiseX * amplify;
        const dcy = ccy + noiseY * amplify;
        
        // Source window dimensions based on scale
        const sw = Sx * scale;
        const sh = Sy * scale;
        
        // Source window top-left
        let sx = dcx - sw / 2;
        let sy = dcy - sh / 2;
        
        // Map output coordinates back to source canvas dimensions (important if source is video and different aspect)
        const ratioX = srcW / outW;
        const ratioY = srcH / outH;
        
        sx *= ratioX;
        sy *= ratioY;
        const finalSw = sw * ratioX;
        const finalSh = sh * ratioY;
        
        // CLAMP Wrapping Mode: Ensure source coordinates don't exceed boundaries
        if (sx < 0) sx = 0;
        if (sy < 0) sy = 0;
        if (sx + finalSw > srcW) sx = Math.max(0, srcW - finalSw);
        if (sy + finalSh > srcH) sy = Math.max(0, srcH - finalSh);

        if (finalSw <= 0 || finalSh <= 0) continue;

        try {
          ctx.drawImage(source, sx, sy, finalSw, finalSh, dx, dy, dw, dh);
        } catch(e) {
          // Ignore occasional bounds errors due to float precision
        }
      }
    }

    // Reset filter
    ctx.filter = 'none';

    // Apply Film Grain if requested
    if (grain > 0) {
      if (!this._grainCanvas) {
        this._grainCanvas = new OffscreenCanvas(256, 256);
        const gCtx = this._grainCanvas.getContext('2d');
        const imgData = gCtx.createImageData(256, 256);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.random() * 255;
          d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
        }
        gCtx.putImageData(imgData, 0, 0);
      }
      
      ctx.save();
      ctx.globalAlpha = grain / 100;
      ctx.globalCompositeOperation = 'overlay';
      
      // Animated offset
      const ox = (Math.random() * 256) | 0;
      const oy = (Math.random() * 256) | 0;
      
      const pat = ctx.createPattern(this._grainCanvas, 'repeat');
      ctx.fillStyle = pat;
      ctx.translate(-ox, -oy);
      ctx.fillRect(ox, oy, outW + ox, outH + oy);
      ctx.restore();
    }
  }
};
