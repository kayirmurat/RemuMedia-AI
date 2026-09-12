import path from "node:path";
import type { AspectRatio, Renderer } from "../../providers/renderer.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import type { ImageScene } from "./visualAssets.js";
import type { VoiceScene } from "./voice.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";

export function createAssemblyStep(
  renderer: Renderer,
  storage: StorageProvider,
  workDir: string,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "assembly",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const imageScenes = state.context.imageScenes as ImageScene[];
      const voiceScenes = state.context.voiceScenes as VoiceScene[];

      const imageBySceneNumber = new Map(imageScenes.map((s) => [s.sceneNumber, s.imagePath]));
      const voiceBySceneNumber = new Map(voiceScenes.map((s) => [s.sceneNumber, s]));

      const renderScenes = scenes.map((scene) => {
        const imagePath = imageBySceneNumber.get(scene.sceneNumber);
        const voiceEntry = voiceBySceneNumber.get(scene.sceneNumber);
        if (!imagePath || !voiceEntry) {
          throw new Error(`Sahne ${scene.sceneNumber} için görsel veya ses eksik`);
        }
        return {
          imagePath,
          audioPath: voiceEntry.audioPath,
          durationSeconds: voiceEntry.durationSeconds,
        };
      });

      const subtitlesPath = state.context.subtitlesPath as string;
      const outputPath = path.join(workDir, `${workflowId}-final.mp4`);
      const { filePath } = await renderer.assemble({
        scenes: renderScenes,
        subtitlesPath,
        outputPath,
        aspectRatio,
      });

      const artifact = await createFileArtifact({
        storage,
        workflowId,
        type: "final_video",
        localFilePath: filePath,
        costUsd: 0,
        metadata: { aspectRatio, sceneCount: renderScenes.length },
      });

      return { artifacts: [artifact], contextPatch: { finalVideoPath: filePath }, costUsd: 0 };
    },
  };
}
