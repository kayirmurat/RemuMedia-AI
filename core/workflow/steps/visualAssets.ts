import type { ImageProvider } from "../../providers/image.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";

export interface ImageScene {
  sceneNumber: number;
  imagePath: string;
}

export function createVisualAssetsStep(image: ImageProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "visualAssets",
    async run({ workflowId, state }) {
      const scenes = state.context.scenes as Scene[];
      const imageScenes: ImageScene[] = [];
      const artifacts = [];
      let totalCost = 0;
      let provider: string | undefined;
      let model: string | undefined;

      for (const scene of scenes) {
        let result;
        try {
          result = await image.generate(scene.imagePrompt, { size: "1024x1536" });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Sahne ${scene.sceneNumber} için görsel üretilemedi: ${message}\n` +
              `Görsel promptu: "${scene.imagePrompt}"`,
          );
        }
        totalCost += result.costUsd;
        provider = result.provider;
        model = result.model;

        const artifact = await createFileArtifact({
          storage,
          workflowId,
          type: "image",
          localFilePath: result.filePath,
          provider: result.provider,
          model: result.model,
          costUsd: result.costUsd,
          metadata: { sceneNumber: scene.sceneNumber },
        });
        artifacts.push(artifact);
        // result.filePath yerel/geçici bir dosyadır (workflow farklı bir
        // makinede devam ederse artık mevcut olmayabilir) — bu yüzden
        // context'e artifact'ın kalıcı storage yolu (artifact.path) yazılır.
        imageScenes.push({ sceneNumber: scene.sceneNumber, imagePath: artifact.path });
      }

      return { artifacts, contextPatch: { imageScenes }, costUsd: totalCost, provider, model };
    },
  };
}
