import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import type { VoiceScene } from "./voice.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";
import { wrapText } from "../../text/wrapText.js";

function formatSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

// Bir sahnenin anlatımını cümle bazında (uzun cümleleri kelime sınırından)
// küçük parçalara böler. Tüm ses süresi boyunca tek bir büyük blok göstermek
// yerine bu parçalar sahnenin gerçek konuşma süresine karakter oranına göre
// dağıtılır — altyazı böylece konuşmayla akan bir metin gibi ilerler, ekranın
// ortasını kaplayan tek bir kalabalık blok olarak durmaz.
function splitIntoCaptionChunks(text: string, maxChars = 42): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) => {
      if (sentence.length <= maxChars) return [sentence];
      const words = sentence.split(/\s+/);
      const chunks: string[] = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
          chunks.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) chunks.push(current);
      return chunks;
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [text.trim()];
}

export function createSubtitlesStep(storage: StorageProvider): StepDefinition {
  return {
    name: "subtitles",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const voiceScenes = state.context.voiceScenes as VoiceScene[];
      const durationBySceneNumber = new Map(voiceScenes.map((v) => [v.sceneNumber, v.durationSeconds]));

      let cursor = 0;
      let entryNumber = 0;
      const entries: string[] = [];
      scenes.forEach((scene) => {
        const duration = durationBySceneNumber.get(scene.sceneNumber) ?? 0;
        const chunks = splitIntoCaptionChunks(scene.narration);
        const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;

        let sceneCursor = cursor;
        for (const chunk of chunks) {
          const chunkDuration = (chunk.length / totalChars) * duration;
          const start = sceneCursor;
          const end = sceneCursor + chunkDuration;
          sceneCursor = end;
          entryNumber += 1;
          entries.push(`${entryNumber}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${wrapText(chunk)}\n`);
        }
        cursor += duration;
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
      // ffmpeg için doğrudan okunabilir değil. assembly adımı, workflow'un
      // farklı bir makinede (ör. yeni bir GitHub Actions runner'ında) devam
      // ettiği durumlarda da çalışabilmesi için bu kalıcı yolu ihtiyaç
      // anında storage.ensureLocalFile() ile yerel bir dosyaya indirir.
      return { artifacts: [artifact], contextPatch: { subtitlesPath: artifact.path }, costUsd: 0 };
    },
  };
}
