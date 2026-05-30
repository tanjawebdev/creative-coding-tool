/**
 * ascii-video — convert.js
 *
 * Usage:
 *   node convert.js <input-video> [output.mp4]
 *
 * Example:
 *   node convert.js input/myvideo.mp4 output/ascii.mp4
 *
 * Requirements:
 *   - Node.js 18+
 *   - ffmpeg installed (brew install ffmpeg / apt install ffmpeg)
 *   - npm install
 */

const { createCanvas } = require("canvas");
const ffmpeg = require("fluent-ffmpeg");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const OUTPUT_WIDTH = 3840;   // 4K 16:9
const OUTPUT_HEIGHT = 2160;

// ASCII character ramp — darkest → brightest
const ASCII_CHARS = " .`-_':,;^=+/\"|)\\<>)iv%xclrs{*}I?!][1taeo7zjLunT#JCwfy325Vb6mqkdWM8&0@$";

// How many ASCII columns to use (higher = more detail, smaller chars)
const ASCII_COLS = 220;

// Font settings — monospace is critical
const FONT_NAME = "Courier New";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getVideoDuration(inputPath) {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
  );
  return parseFloat(result.toString().trim());
}

function getVideoFPS(inputPath) {
  const result = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
  );
  const raw = result.toString().trim(); // e.g. "30000/1001"
  const [num, den] = raw.split("/").map(Number);
  return Math.round((num / den) * 100) / 100;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function brightnessToChar(brightness) {
  const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
  return ASCII_CHARS[index];
}

// ─── CORE: render one frame to a 4K canvas ───────────────────────────────────

function renderAsciiFrame(sourceCanvas, outputCanvas) {
  const srcCtx = sourceCanvas.getContext("2d");
  const outCtx = outputCanvas.getContext("2d");

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  // Derive char grid size
  const cols = ASCII_COLS;
  const cellW = srcW / cols;
  // ASCII chars are roughly 2x taller than wide in most monospace fonts
  const charAspect = 2.0;
  const cellH = cellW * charAspect;
  const rows = Math.ceil(srcH / cellH);

  // Font size to fill 4K canvas
  const fontSize = OUTPUT_WIDTH / cols;
  outCtx.font = `${fontSize}px "${FONT_NAME}"`;

  // Measure actual char width to center the grid
  const charW = outCtx.measureText("M").width;
  const charH = fontSize * 1.2; // line-height factor

  // Black background
  outCtx.fillStyle = "#000000";
  outCtx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  // White text
  outCtx.fillStyle = "#FFFFFF";
  outCtx.textBaseline = "top";

  const imageData = srcCtx.getImageData(0, 0, srcW, srcH);
  const pixels = imageData.data;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Sample pixel from center of each cell
      const px = Math.min(Math.floor((col + 0.5) * cellW), srcW - 1);
      const py = Math.min(Math.floor((row + 0.5) * cellH), srcH - 1);
      const i = (py * srcW + px) * 4;

      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Perceived brightness (luminance)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const char = brightnessToChar(brightness);

      if (char !== " ") {
        const x = col * charW;
        const y = row * charH;
        outCtx.fillText(char, x, y);
      }
    }
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || "output/ascii.mp4";

  if (!inputPath) {
    console.error("Usage: node convert.js <input-video> [output.mp4]");
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  ensureDir(path.dirname(outputPath));

  const fps = getVideoFPS(inputPath);
  const duration = getVideoDuration(inputPath);
  const totalFrames = Math.floor(fps * duration);

  console.log(`\n🎬 ascii-video converter`);
  console.log(`   Input:    ${inputPath}`);
  console.log(`   Output:   ${outputPath}`);
  console.log(`   FPS:      ${fps}`);
  console.log(`   Duration: ${duration.toFixed(2)}s`);
  console.log(`   Frames:   ~${totalFrames}`);
  console.log(`   Output:   ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (4K)\n`);

  // Temp directory for raw frames from ffmpeg
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ascii-video-"));
  console.log(`   Temp dir: ${tmpDir}\n`);

  // ── Step 1: Extract frames from input video ──────────────────────────────
  console.log("Step 1/3 — Extracting frames from input video...");

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-vf", `scale=640:-1`, "-q:v", "3"])
      .output(path.join(tmpDir, "frame_%06d.jpg"))
      .on("progress", (p) => {
        if (p.frames) process.stdout.write(`\r   Extracted ${p.frames} frames...`);
      })
      .on("end", () => { console.log("\n   Done.\n"); resolve(); })
      .on("error", reject)
      .run();
  });

  // ── Step 2: Render ASCII frames ──────────────────────────────────────────
  console.log("Step 2/3 — Rendering ASCII frames...");

  const frameFiles = fs
    .readdirSync(tmpDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort();

  const asciiDir = path.join(tmpDir, "ascii");
  ensureDir(asciiDir);

  // Source canvas (small — just for pixel sampling)
  const srcCanvas = createCanvas(640, 360);
  const srcCtx = srcCanvas.getContext("2d");

  // Output canvas (4K)
  const outCanvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const { loadImage } = require("canvas");

  for (let i = 0; i < frameFiles.length; i++) {
    const framePath = path.join(tmpDir, frameFiles[i]);
    const img = await loadImage(framePath);

    // Draw source frame scaled to sampling canvas
    srcCtx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);

    // Render ASCII to 4K output canvas
    renderAsciiFrame(srcCanvas, outCanvas);

    // Save as PNG
    const outFramePath = path.join(asciiDir, frameFiles[i].replace(".jpg", ".png"));
    const buf = outCanvas.toBuffer("image/png");
    fs.writeFileSync(outFramePath, buf);

    if ((i + 1) % 10 === 0 || i === frameFiles.length - 1) {
      const pct = (((i + 1) / frameFiles.length) * 100).toFixed(1);
      process.stdout.write(`\r   ${i + 1}/${frameFiles.length} frames rendered (${pct}%)`);
    }
  }
  console.log("\n   Done.\n");

  // ── Step 3: Encode ASCII frames → MP4 ───────────────────────────────────
  console.log("Step 3/3 — Encoding ASCII frames to MP4...");

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(asciiDir, "frame_%06d.png"))
      .inputFPS(fps)
      .videoCodec("libx264")
      .outputOptions([
        "-crf", "18",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("progress", (p) => {
        if (p.frames) process.stdout.write(`\r   Encoded ${p.frames} frames...`);
      })
      .on("end", () => { console.log("\n   Done.\n"); resolve(); })
      .on("error", reject)
      .run();
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`✅ Done! Output saved to: ${outputPath}\n`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
