import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { VoiceProvider, VoiceResult } from "../../providers/voice.js";
import { probeMedia } from "../ffmpeg/ffprobe.js";

// Yaklaşık fiyatlandırma (tts-1) — sadece TAHMİN.
const PRICE_PER_1K_CHARS_USD = 0.015;

export class OpenAIVoiceProvider implements VoiceProvider {
  private client: OpenAI;
  private model: string;
  private outputDir: string;

  constructor(apiKey: string, outputDir: string, model = "tts-1") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.outputDir = outputDir;
  }

  async synthesize(text: string, voice = "alloy"): Promise<VoiceResult> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice,
      input: text,
    });

    fs.mkdirSync(this.outputDir, { recursive: true });
    const filePath = path.join(this.outputDir, `${randomUUID()}.mp3`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const probe = await probeMedia(filePath);
    const costUsd = (text.length / 1000) * PRICE_PER_1K_CHARS_USD;

    return {
      filePath,
      durationSeconds: probe.durationSeconds,
      provider: "openai",
      model: this.model,
      costUsd,
    };
  }
}
