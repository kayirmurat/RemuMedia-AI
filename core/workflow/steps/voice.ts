import type { VoiceProvider } from "../../providers/voice.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";

export interface VoiceScene {
  sceneNumber: number;
  audioPath: string;
  durationSeconds: number;
}

export function createVoiceStep(voice: VoiceProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "voice",
    async run({ workflowId, state }) {
      const scenes = state.context.scenes as Scene[];
      const voiceScenes: VoiceScene[] = [];
      const artifacts = [];
      let totalCost = 0;
      let provider: string | undefined;
      let model: string | undefined;

      for (const scene of scenes) {
        const result = await voice.synthesize(scene.narration);
        totalCost += result.costUsd;
        provider = result.provider;
        model = result.model;

        const artifact = await createFileArtifact({
          storage,
          workflowId,
          type: "voice",
          localFilePath: result.filePath,
          provider: result.provider,
          model: result.model,
          costUsd: result.costUsd,
          metadata: { sceneNumber: scene.sceneNumber, durationSeconds: result.durationSeconds },
        });
        artifacts.push(artifact);
        voiceScenes.push({
          sceneNumber: scene.sceneNumber,
          audioPath: result.filePath,
          durationSeconds: result.durationSeconds,
        });
      }

      return { artifacts, contextPatch: { voiceScenes }, costUsd: totalCost, provider, model };
    },
  };
}
