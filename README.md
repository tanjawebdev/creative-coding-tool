# ascii-video

Converts any video into a **4K ASCII art video** (3840×2160, 16:9).  
Black background, white characters, no audio.

---

## Voraussetzungen

| Tool | Installation |
|------|-------------|
| Node.js 18+ | https://nodejs.org |
| ffmpeg | `brew install ffmpeg` (Mac) · `sudo apt install ffmpeg` (Linux) |

---

## Setup

```bash
# 1. In den Projektordner wechseln
cd ascii-video

# 2. Abhängigkeiten installieren
npm install

# 3. Input-Ordner anlegen (falls nicht vorhanden)
mkdir -p input output
```

---

## Benutzung

```bash
node convert.js input/meinvideo.mp4 output/ascii.mp4
```

Das war's. Das Skript erledigt alles automatisch:

1. **Frames extrahieren** — ffmpeg zieht alle Frames aus deinem Video
2. **ASCII rendern** — jeder Frame wird in ein 4K ASCII-Bild umgewandelt
3. **Enkodieren** — alle ASCII-Frames werden zu einer MP4-Datei zusammengesetzt

---

## Konfiguration (in `convert.js`)

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `ASCII_COLS` | `220` | Anzahl ASCII-Spalten (mehr = feiner, langsamer) |
| `ASCII_CHARS` | Ramp von ` ` bis `@` | Zeichensatz für Helligkeit |
| `FONT_NAME` | `Courier New` | Monospace-Font |
| `OUTPUT_WIDTH/HEIGHT` | `3840×2160` | 4K 16:9 Ausgabe |

---

## Performance-Tipps

- Für **schnelle Tests** `ASCII_COLS` auf `120` reduzieren
- Kurze Clips (< 30s) zuerst ausprobieren
- Ein langer Film kann **Stunden** dauern — das ist normal bei 4K Frame-für-Frame-Rendering

---

## Ausgabe-Qualität

Das Video wird mit **H.264, CRF 18** enkodiert — sehr hohe Qualität, geringe Dateigröße.
