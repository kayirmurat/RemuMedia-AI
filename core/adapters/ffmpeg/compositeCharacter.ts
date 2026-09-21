import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;
const execFileAsync = promisify(execFile);

// Karakter görseli, arka planın genişliğinin bu oranı kadar büyüklükte,
// altta ortalanmış şekilde bindirilir — "Dünya Turunda Bir Aile" serisi
// için: AI SADECE mekanı üretir (bkz. visualPlan.ts'deki "no people" kuralı),
// aile ise hep AYNI, önceden üretilmiş sabit görselden bindirilir. Bu, AI'nin
// her sahnede farklı/tutarsız insanlar üretmesi sorununu da tamamen ortadan
// kaldırır (karakterler AI tarafından hiç üretilmiyor).
const CHARACTER_WIDTH_RATIO = 0.68;
const BOTTOM_MARGIN_PX = 30;

export async function compositeCharacterOntoBackground(params: {
  backgroundPath: string;
  characterPath: string;
  outputPath: string;
}): Promise<void> {
  if (!ffmpegPath) throw new Error("ffmpeg-static binary yolu bulunamadı");
  const { backgroundPath, characterPath, outputPath } = params;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const charWidth = `iw*${CHARACTER_WIDTH_RATIO}`;
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    backgroundPath,
    "-i",
    characterPath,
    "-filter_complex",
    `[1:v]scale=${charWidth}:-1[fam];[0:v][fam]overlay=(W-w)/2:H-h-${BOTTOM_MARGIN_PX}`,
    "-frames:v",
    "1",
    "-update",
    "1",
    outputPath,
  ]);
}
