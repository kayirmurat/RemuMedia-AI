import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

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
// Arka plan müziği seslendirmenin çok altında, adeta derinden/belli belirsiz
// çalsın diye düşük tutuluyor (kullanıcı geri bildirimi: hâlâ çok yüksek
// geliyordu, taban seviye ve ducking daha da agresifleştirildi). Bu taban
// seviyeye ek olarak, konuşma sırasında müziği daha da kısan "ducking"
// (sidechaincompress) uygulanıyor — bkz. aşağıdaki filtre zinciri.
const MUSIC_VOLUME = 0.05;
// Ducking (sidechaincompress) ayarları: seslendirme belirli bir eşiğin
// üzerine çıktığında müzik hızla kısılır (attack), konuşma bitince yavaşça
// eski seviyesine döner (release) — böylece müzik konuşmayı bastırmaz ama
// sessiz anlarda tamamen kaybolmaz. threshold düşürüldü (daha kısık
// konuşma anlarını da yakalasın), ratio yükseltildi (konuşma sırasında
// müzik neredeyse duyulmaz hale gelsin).
const DUCK_THRESHOLD = 0.03;
const DUCK_RATIO = 20;
const DUCK_ATTACK_MS = 5;
const DUCK_RELEASE_MS = 400;

// Kapak fotoğrafındaki hook metni, altyazıdan çok daha büyük ve göz alıcı
// olmalı (küçük ekranda/feed'de akarken dikkat çekmesi gerekiyor). Boyut
// çıktı genişliğine oranla hesaplanıyor ki 9:16/16:9/1:1 hepsinde tutarlı
// görünsün. Değer, 1080 genişlikte görsel olarak denenip iyi görünen
// FontSize=24'ten türetildi — libass'ın FontSize'ı doğrudan piksel olarak
// yorumlamadığını, PlayRes tabanlı bir ölçekleme uyguladığını unutma.
const COVER_FONT_SIZE_RATIO = 24 / 1080;

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

  async renderCoverImage(params: {
    imagePath: string;
    hookText: string;
    aspectRatio: AspectRatio;
    outputPath: string;
  }): Promise<void> {
    const { imagePath, hookText, aspectRatio, outputPath } = params;
    const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });

    const fontSize = Math.round(width * COVER_FONT_SIZE_RATIO);

    // Metni kendimiz satırlara bölmüyoruz — 'subtitles' filtresi (libass)
    // tek bir uzun satırı verilen FontSize'a göre çerçeve genişliğine
    // otomatik sarıyor, bu da her en-boy oranında (9:16/16:9/1:1) manuel
    // karakter/genişlik hesabından çok daha güvenilir sonuç veriyor.
    const srtPath = path.join(this.tempDir, `cover-${randomUUID()}.srt`);
    fs.writeFileSync(srtPath, `1\n00:00:00,000 --> 00:00:01,000\n${hookText}\n`);

    const srtPart = escapeFilterValue(srtPath);
    const fontsDirPart = escapeFilterValue(this.fontsDir);
    // BorderStyle=3: arkada opak bir kutu çizer — fotoğraf ne kadar
    // karmaşık/parlak olursa olsun metin okunur kalır (sadece dış çizgiyle
    // yetinen altyazı stilinden farklı olarak). Alignment=2 (alt-orta)
    // bilinçli seçildi — bu force_style'da denenen üst hizalama (7-9)
    // değerleri bu ffmpeg/libass sürümünde beklendiği gibi çalışmadı.
    const forceStyle = escapeFilterValue(
      `FontName=${SUBTITLE_FONT_NAME},Bold=1,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,` +
        `BorderStyle=3,BackColour=&H99000000,Outline=8,Shadow=0,Alignment=2,MarginV=${Math.round(height * 0.06)}`,
    );

    await execFileAsync(this.ffmpegBinary, [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
        `subtitles='${srtPart}':fontsdir='${fontsDirPart}':force_style='${forceStyle}'`,
      "-frames:v",
      "1",
      "-q:v",
      "2",
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
      if (scene.videoPath) {
        // Akan video klip: kendi kare hızıyla girer, -t klibi tam olarak
        // ihtiyaç duyulan süreye kırpar (klip her zaman bu süreden uzun
        // üretilir, bkz. videoAssets.ts DURATION_BUFFER_SECONDS).
        args.push("-t", renderDurations[i]!.toFixed(3), "-i", scene.videoPath);
      } else {
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
      }
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

    const videoChains = scenes.map((scene, i) =>
      scene.videoPath
        ? // Akan video klip: kaynakta zaten hareket var, ek olarak sadece
          // hedef çözünürlüğe ölçekle/kırp ve kare hızını sabitle.
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
          `crop=${width}:${height},fps=${FPS},setsar=1[v${i}]`
        : `[${i}:v]scale=${bigWidth}:${bigHeight}:force_original_aspect_ratio=increase,` +
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
        // ffmpeg filtergraph'ında bir link etiketi yalnızca TEK bir filtreye
        // girdi olabilir — aynı sesi (avoice) hem ducking tetikleyicisi hem
        // de son mix'e girdi olarak kullanmak için asplit ile çoğaltılıyor.
        `;[avoice]asplit=2[avoice_sc][avoice_mix]` +
        `;[${musicInputIndex}:a]volume=${MUSIC_VOLUME}[amusicvol]` +
        // Sidechaincompress: ana giriş (amusicvol) konuşma (avoice_sc) yüksek
        // sesle çaldığında otomatik kısılır — "duck" edilir.
        `;[amusicvol][avoice_sc]sidechaincompress=threshold=${DUCK_THRESHOLD}:ratio=${DUCK_RATIO}:` +
        `attack=${DUCK_ATTACK_MS}:release=${DUCK_RELEASE_MS}[amusicducked]` +
        // normalize=0: amix'in giriş sayısına göre otomatik ses kısma
        // davranışı seslendirmeyi de kısıyordu, kapatılıyor.
        `;[avoice_mix][amusicducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;
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
