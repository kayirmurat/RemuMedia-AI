import fs from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import type { VoiceScene } from "./voice.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";
import { newId } from "../../domain/ids.js";
import { wrapText } from "../../text/wrapText.js";

function formatSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

export function createSubtitlesStep(storage: StorageProvider, tempDir: string): StepDefinition {
  return {
    name: "subtitles",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const voiceScenes = state.context.voiceScenes as VoiceScene[];
      const durationBySceneNumber = new Map(voiceScenes.map((v) => [v.sceneNumber, v.durationSeconds]));

      let cursor = 0;
      const entries: string[] = [];
      scenes.forEach((scene, index) => {
        const duration = durationBySceneNumber.get(scene.sceneNumber) ?? 0;
        const start = cursor;
        const end = cursor + duration;
        cursor = end;
        entries.push(
          `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${wrapText(scene.narration)}\n`,
        );
      });

      const srtContent = entries.join("\n");

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "subtitles",
        content: srtContent,
        extension: ".srt",
        costUsd: 0,
      });

      // ffmpeg'in "subtitles" filtresi yerel bir dosya yolu bekler; storage
      // sağlayıcısının döndürdüğü yol (ör. Supabase modunda "supabase://...")
      // ffmpeg için okunabilir değil, bu yüzden ayrıca yerel bir kopya yazılır.
      await fs.mkdir(tempDir, { recursive: true });
      const localSrtPath = path.join(tempDir, `${newId()}.srt`);
      await fs.writeFile(localSrtPath, srtContent, "utf8");

      return { artifacts: [artifact], contextPatch: { subtitlesPath: localSrtPath }, costUsd: 0 };
    },
  };
}
