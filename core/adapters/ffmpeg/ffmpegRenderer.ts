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

  async assemble(params: {
    scenes: RenderScene[];
    subtitlesPath: string;
    outputPath: string;
    aspectRatio: AspectRatio;
  }): Promise<RenderResult> {
    const { scenes, subtitlesPath, outputPath, aspectRatio } = params;
    if (scenes.length === 0) {
      throw new Error("Sahne listesi boş, video birleştirilemez");
    }

    const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const args: string[] = ["-y"];
    for (const scene of scenes) {
      args.push("-loop", "1", "-t", scene.durationSeconds.toFixed(3), "-i", scene.imagePath);
    }
    for (const scene of scenes) {
      args.push("-i", scene.audioPath);
    }

    const videoChains = scenes.map(
      (_, i) =>
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1,fps=30[v${i}]`,
    );

    const audioInputOffset = scenes.length;
    const videoConcatInputs = scenes.map((_, i) => `[v${i}]`).join("");
    const audioConcatInputs = scenes.map((_, i) => `[${audioInputOffset + i}:a]`).join("");

    const subtitlesPart = escapeFilterValue(subtitlesPath);
    const fontsDirPart = escapeFilterValue(this.fontsDir);
    const forceStyle = escapeFilterValue(
      `FontName=${SUBTITLE_FONT_NAME},Bold=1,FontSize=15,PrimaryColour=&H00FFFFFF,` +
        `OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=0,Alignment=2,MarginV=90`,
    );

    const filterComplex =
      videoChains.join(";") +
      `;${videoConcatInputs}concat=n=${scenes.length}:v=1:a=0[vcat]` +
      `;[vcat]subtitles='${subtitlesPart}':fontsdir='${fontsDirPart}':force_style='${forceStyle}'[vout]` +
      `;${audioConcatInputs}concat=n=${scenes.length}:v=0:a=1[aout]`;

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
      "30",
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
