import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

import {
  ASPECT_RATIO_RESOLUTIONS,
  type AspectRatio,
  type RenderResult,
  type RenderScene,
  type Renderer,
} from "../../providers/renderer.js";
import { probeMedia } from "./ffprobe.js";
import { escapeFilterValue } from "./textUtils.js";

const execFileAsync = promisify(execFile);

// Bu statik ffmpeg derlemesinde 'drawtext' filtresi yok (johnvansickle static build'lerinin
// bilinen bir kısıtı), bu yüzden altyazılar libass tabanlı 'subtitles' filtresiyle yakılıyor.
// Bu, hem yakılan altyazıyı hem de ayrı .srt artifact'ını AYNI dosyadan üretmemizi sağlıyor.
const SUBTITLE_FONT_NAME = "Liberation Sans";

const FPS = 30;
// Sahneler arası crossfade süresi. Her sahne bu kadar fazladan render edilip
// geçiş bu "fazlalığı" tükettiği için gerçek anlatım süresi asla kırpılmıyor.
// 0.5s'den 0.7s'ye çıkarıldı — kısa geçişler sert/ani hissettiriyordu.
const TRANSITION_DURATION = 0.7;
// Ken Burns (yavaş yakınlaşma) için kaynak görsel bu oranda büyütülüyor,
// zoompan sırasında piksel bozulması olmasın diye.
const ZOOM_OVERSCAN = 1.3;
const ZOOM_STEP_PER_FRAME = 0.001;
const ZOOM_MAX = 1.15;
// Arka plan müziği seslendirmenin altında, dikkat dağıtmayacak seviyede
// çalsın diye düşük tutuluyor.
const MUSIC_VOLUME = 0.15;

export class FfmpegRenderer implements Renderer {
  private ffmpegBinary: string;
  private fontsDir: string;

  constructor(fontFile: string, private tempDir: string) {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static binary yolu bulunamadı");
    }
    this.ffmpegBinary = ffmpegPath;
    this.fontsDir = path.dirname(fontFile);
  }

  async probe(filePath: string) {
    return probeMedia(filePath);
  }

  async extractThumbnail(videoPath: string, outputPath: string, atSeconds = 1): Promise<void> {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await execFileAsync(this.ffmpegBinary, [
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outputPath,
    ]);
  }

  async assemble(params: {
    scenes: RenderScene[];
    subtitlesPath: string;
    outputPath: string;
    aspectRatio: AspectRatio;
    musicPath?: string | null;
  }): Promise<RenderResult> {
    const { scenes, subtitlesPath, outputPath, aspectRatio, musicPath } = params;
    if (scenes.length === 0) {
      throw new Error("Sahne listesi boş, video birleştirilemez");
    }

    const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const bigWidth = Math.round(width * ZOOM_OVERSCAN);
    const bigHeight = Math.round(height * ZOOM_OVERSCAN);
    const renderDurations = scenes.map((s) => s.durationSeconds + TRANSITION_DURATION);

    const args: string[] = ["-y"];
    scenes.forEach((scene, i) => {
      args.push(
        "-loop",
        "1",
        "-framerate",
        String(FPS),
        "-t",
        renderDurations[i]!.toFixed(3),
        "-i",
        scene.imagePath,
      );
    });
    for (const scene of scenes) {
      args.push("-i", scene.audioPath);
    }
    const musicInputIndex = scenes.length * 2;
    if (musicPath) {
      // -stream_loop -1: müzik videodan kısaysa sonsuz döngüye alınır;
      // aşağıdaki amix'teki duration=first sesi tam olarak seslendirme
      // uzunluğuna kırpar, bu yüzden döngü asla "taşmaz".
      args.push("-stream_loop", "-1", "-i", musicPath);
    }

    const videoChains = scenes.map(
      (_, i) =>
        `[${i}:v]scale=${bigWidth}:${bigHeight}:force_original_aspect_ratio=increase,` +
        `crop=${bigWidth}:${bigHeight},` +
        `zoompan=z='min(zoom+${ZOOM_STEP_PER_FRAME},${ZOOM_MAX})':d=1:` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${FPS},setsar=1[v${i}]`,
    );

    let videoTail = "v0";
    const xfadeParts: string[] = [];
    let cumulative = 0;
    for (let k = 1; k < scenes.length; k++) {
      cumulative += renderDurations[k - 1]!;
      const offset = cumulative - k * TRANSITION_DURATION;
      const outLabel = k === scenes.length - 1 ? "vxfade" : `vx${k}`;
      xfadeParts.push(
        `[${videoTail}][v${k}]xfade=transition=fade:duration=${TRANSITION_DURATION}:` +
          `offset=${offset.toFixed(3)}[${outLabel}]`,
      );
      videoTail = outLabel;
    }

    const audioInputOffset = scenes.length;
    const audioConcatInputs = scenes.map((_, i) => `[${audioInputOffset + i}:a]`).join("");

    const subtitlesPart = escapeFilterValue(subtitlesPath);
    const fontsDirPart = escapeFilterValue(this.fontsDir);
    // MarginV düşürüldü (90 -> 60) — altyazı alt kenara daha yakın, görüntünün
    // ortasına taşmıyor. Metin artık subtitles.ts'de sahne başına tek büyük
    // blok yerine küçük, akan parçalara bölündüğü için de kutu boyutu küçüldü.
    const forceStyle = escapeFilterValue(
      `FontName=${SUBTITLE_FONT_NAME},Bold=1,FontSize=15,PrimaryColour=&H00FFFFFF,` +
        `OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=0,Alignment=2,MarginV=60`,
    );

    const voiceLabel = musicPath ? "avoice" : "aout";
    let filterComplex =
      [...videoChains, ...xfadeParts].join(";") +
      `;[${videoTail}]subtitles='${subtitlesPart}':fontsdir='${fontsDirPart}':force_style='${forceStyle}'[vout]` +
      `;${audioConcatInputs}concat=n=${scenes.length}:v=0:a=1[${voiceLabel}]`;

    if (musicPath) {
      filterComplex +=
        `;[${musicInputIndex}:a]volume=${MUSIC_VOLUME}[amusic]` +
        `;[avoice][amusic]amix=inputs=2:duration=first:dropout_transition=0[aout]`;
    }

    args.push(
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    );

    await execFileAsync(this.ffmpegBinary, args, { maxBuffer: 1024 * 1024 * 64 });

    return { filePath: outputPath };
  }
}
