import fs from "node:fs";
import path from "node:path";
import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { MusicTrack } from "../../domain/types.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";
import { extractJson } from "../../text/extractJson.js";

const SYSTEM_PROMPT =
  "Sen kısa videolar için müzik direktörüsün. Yalnızca istenen formatta yanıt verirsin.";

function loadManifest(manifestPath: string): MusicTrack[] {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Manifest boşsa (henüz müzik parçası eklenmediyse) sessizce müziksiz devam
// eder — bu adım hiçbir zaman workflow'u durdurmaz.
export function createMusicSelectionStep(
  llm: LLMProvider,
  storage: StorageProvider,
  manifestPath: string,
): StepDefinition {
  return {
    name: "musicSelection",
    async run({ workflowId, state }) {
      const tracks = loadManifest(manifestPath);
      if (tracks.length === 0) {
        return { contextPatch: { musicPath: null, musicTrackId: null }, costUsd: 0 };
      }

      const script = state.context.script as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);
      const trackList = tracks
        .map((t) => `- id:"${t.id}" ruh_halleri:[${t.moods.join(", ")}]`)
        .join("\n");
      const prompt =
        `Video senaryosu:\n${script}\n\nKullanılabilir müzik parçaları:\n${trackList}\n\n` +
        "Bu videonun tonuna/ruh haline en uygun TEK bir parçayı seç.\n" +
        'SADECE şu JSON formatında yanıt ver, başka hiçbir açıklama yazma: {"trackId": "..."}' +
        (latestFeedback ? `\n\nÖNEMLİ — kullanıcı geri bildirimi: "${latestFeedback}"` : "");

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.3 });

      let trackId = tracks[0]!.id;
      try {
        const parsed = JSON.parse(extractJson(result.text)) as { trackId?: string };
        if (parsed.trackId && tracks.some((t) => t.id === parsed.trackId)) {
          trackId = parsed.trackId;
        }
      } catch {
        // ayrıştırma başarısız olursa ilk parça varsayılan olarak kullanılır
      }

      const track = tracks.find((t) => t.id === trackId)!;
      const musicPath = path.join(path.dirname(manifestPath), track.filename);

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "music_selection",
        content: JSON.stringify({ trackId, filename: track.filename }, null, 2),
        extension: ".json",
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
      });

      return {
        artifacts: [artifact],
        contextPatch: { musicPath, musicTrackId: trackId },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
