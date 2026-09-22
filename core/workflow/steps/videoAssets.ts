import path from "node:path";
import type { VideoProvider } from "../../providers/video.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { ArtifactRepository } from "../../repository/types.js";
import type { AspectRatio } from "../../providers/renderer.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";
import { newId } from "../../domain/ids.js";
import { latestBySceneNumber } from "./artifactLookup.js";

// Sahne geçişi (renderer'daki TRANSITION_DURATION) klip süresinin bir kısmını
// "yiyor" — bu yüzden istenen video, seslendirmeden biraz daha uzun istenir,
// render sırasında fazlalık kırpılır (bkz. ffmpegRenderer.ts assemble()).
const DURATION_BUFFER_SECONDS = 1.5;

// visualAssets'in ürettiği (gerekirse sabit karakter bindirilmiş) sahne
// görselini başlangıç karesi olarak kullanıp, image-to-video ile kısa, akan
// bir video klibe dönüştürür. "İstediğim gibi olmadı, sabit görsel değil
// AKAN bir video istiyorum" geri bildirimi üzerine eklendi — statik
// görsel + Ken Burns yerine gerçek hareketli sahneler.
export function createVideoAssetsStep(
  video: VideoProvider,
  storage: StorageProvider,
  artifactRepo: ArtifactRepository,
  tempDir: string,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "videoAssets",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);

      const artifacts = await artifactRepo.listByWorkflow(workflowId);
      const imageBySceneNumber = latestBySceneNumber(artifacts, "image");
      const voiceBySceneNumber = latestBySceneNumber(artifacts, "voice");

      const resultArtifacts = [];
      let totalCost = 0;
      let provider: string | undefined;
      let model: string | undefined;

      for (const scene of scenes) {
        const imageArtifact = imageBySceneNumber.get(scene.sceneNumber);
        const voiceArtifact = voiceBySceneNumber.get(scene.sceneNumber);
        if (!imageArtifact || !voiceArtifact) {
          throw new Error(`Sahne ${scene.sceneNumber} için görsel veya ses eksik (videoAssets)`);
        }

        const localImagePath = await storage.ensureLocalFile(
          imageArtifact.path,
          path.join(tempDir, `${newId()}${path.extname(imageArtifact.path) || ".png"}`),
        );
        const narrationDuration = voiceArtifact.metadata.durationSeconds as number;
        const motionPrompt =
          `${scene.imagePrompt}. Smooth, subtle cinematic camera movement (gentle pan or slow push-in) ` +
          "and natural ambient motion within the scene — no new objects or people appearing, no text.";

        let result;
        try {
          result = await video.generateFromImage(localImagePath, motionPrompt, {
            durationSeconds: narrationDuration + DURATION_BUFFER_SECONDS,
            aspectRatio,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Sahne ${scene.sceneNumber} için akan video üretilemedi: ${message}`);
        }
        totalCost += result.costUsd;
        provider = result.provider;
        model = result.model;

        const artifact = await createFileArtifact({
          storage,
          workflowId,
          type: "video",
          localFilePath: result.filePath,
          provider: result.provider,
          model: result.model,
          costUsd: result.costUsd,
          metadata: { sceneNumber: scene.sceneNumber, durationSeconds: result.durationSeconds },
        });
        resultArtifacts.push(artifact);
      }

      return { artifacts: resultArtifacts, costUsd: totalCost, provider, model };
    },
  };
}
