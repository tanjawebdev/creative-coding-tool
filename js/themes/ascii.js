// ── ASCII Art Theme ──────────────────────────────────────────────────────────
// Renders video frames as monochrome ASCII characters on a canvas.
// Implements the standard Theme interface so it can be swapped with other themes.

window.AsciiTheme = {
  id: 'ascii',
  name: 'ASCII Art',

  // ── Returns the HTML for theme-specific sidebar controls ──────────────────
  getControls() {
    return `
      <div class="control-row">
        <label>Spalten (Columns) <span class="val" id="colsVal">160</span></label>
        <input type="range" id="colsRange" min="40" max="400" value="160" step="10">
      </div>

      <div class="control-row">
        <label>Char-Aspekt (Höhe/Breite) <span class="val" id="aspectVal">2.0</span></label>
        <input type="range" id="aspectRange" min="1.0" max="3.0" value="2.0" step="0.1">
      </div>

      <div class="control-row">
        <label>Font</label>
        <select id="fontSelect">
          <option value="'Courier New', monospace">Courier New</option>
          <option value="'Lucida Console', monospace">Lucida Console</option>
          <option value="'Share Tech Mono', monospace">Share Tech Mono</option>
          <option value="'VT323', monospace">VT323</option>
          <option value="monospace">System Monospace</option>
        </select>
      </div>

      <div class="control-row">
        <label>Font-Größe (px) <span class="val" id="fontSizeVal">auto</span></label>
        <input type="range" id="fontSizeRange" min="0" max="60" value="0" step="1">
        <div style="font-size:10px;color:#444;margin-top:3px">0 = automatisch</div>
      </div>

      <div class="control-row">
        <label>ASCII Chars</label>
        <textarea id="charsInput" rows="2"> .\`-_':,;^=+/"|)\\<>iv%xclrs{*}I?!][1taeo7zjLunT#JCwfy325Vb6mqkdWM8&0@$</textarea>
        <div class="chars-preview" id="charsPreview"></div>
      </div>
    `;
  },

  // ── Bind live-update events for this theme's controls ─────────────────────
  bindEvents(autoPreview) {
    const colsRange = document.getElementById('colsRange');
    const colsVal = document.getElementById('colsVal');
    const aspectRange = document.getElementById('aspectRange');
    const aspectVal = document.getElementById('aspectVal');
    const fontSelect = document.getElementById('fontSelect');
    const fontSizeRange = document.getElementById('fontSizeRange');
    const fontSizeVal = document.getElementById('fontSizeVal');
    const charsInput = document.getElementById('charsInput');
    const charsPreview = document.getElementById('charsPreview');

    const updateCharsPreview = () => {
      charsPreview.textContent = `${charsInput.value.length} Zeichen`;
    };
    updateCharsPreview();

    colsRange.addEventListener('input', () => {
      colsVal.textContent = colsRange.value;
      autoPreview();
    });

    aspectRange.addEventListener('input', () => {
      aspectVal.textContent = parseFloat(aspectRange.value).toFixed(1);
      autoPreview();
    });

    fontSelect.addEventListener('change', autoPreview);

    fontSizeRange.addEventListener('input', () => {
      const v = parseInt(fontSizeRange.value);
      fontSizeVal.textContent = v === 0 ? 'auto' : v + 'px';
      autoPreview();
    });

    charsInput.addEventListener('input', () => {
      updateCharsPreview();
      autoPreview();
    });
  },

  // ── Read current theme-specific parameters from the DOM ───────────────────
  getParams() {
    return {
      cols: parseInt(document.getElementById('colsRange').value),
      aspect: parseFloat(document.getElementById('aspectRange').value),
      font: document.getElementById('fontSelect').value,
      fontSize: parseInt(document.getElementById('fontSizeRange').value),
      chars: document.getElementById('charsInput').value || ' .:-=+*#@',
    };
  },

  // ── Apply saved parameters back to the DOM (preset import) ────────────────
  applyParams(p) {
    if (p.cols !== undefined) {
      document.getElementById('colsRange').value = p.cols;
      document.getElementById('colsVal').textContent = p.cols;
    }
    if (p.aspect !== undefined) {
      document.getElementById('aspectRange').value = p.aspect;
      document.getElementById('aspectVal').textContent = parseFloat(p.aspect).toFixed(1);
    }
    if (p.font !== undefined) {
      document.getElementById('fontSelect').value = p.font;
    }
    if (p.fontSize !== undefined) {
      document.getElementById('fontSizeRange').value = p.fontSize;
      document.getElementById('fontSizeVal').textContent = p.fontSize === 0 ? 'auto' : p.fontSize + 'px';
    }
    if (p.chars !== undefined) {
      document.getElementById('charsInput').value = p.chars;
      document.getElementById('charsPreview').textContent = `${p.chars.length} Zeichen`;
    }
  },

  // ── Core render: draw ASCII representation of a video frame ───────────────
  renderFrame(srcCanvas, dstCanvas, params) {
    const { cols, aspect, font, chars, outW, outH, bg, fg } = params;
    const ctx = dstCanvas.getContext('2d');

    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;

    const cellW = srcW / cols;
    const cellH = cellW * aspect;
    const rows = Math.ceil(srcH / cellH);

    // Font size: auto = fill output width by cols
    const manualFontSize = params.fontSize || 0;
    const fontSize = manualFontSize > 0 ? manualFontSize : outW / cols;
    ctx.font = `${fontSize}px ${font}`;
    const charW = ctx.measureText('M').width;
    const charH = fontSize * 1.2;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'top';

    const srcCtx = srcCanvas.getContext('2d');
    const imgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const px = imgData.data;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = Math.min(Math.floor((col + 0.5) * cellW), srcW - 1);
        const sy = Math.min(Math.floor((row + 0.5) * cellH), srcH - 1);
        const i = (sy * srcW + sx) * 4;
        const brightness = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const ci = Math.floor((brightness / 255) * (chars.length - 1));
        const ch = chars[ci];
        if (ch !== ' ') ctx.fillText(ch, col * charW, row * charH);
      }
    }
  },
};
