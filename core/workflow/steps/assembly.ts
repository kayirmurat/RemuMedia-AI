import path from "node:path";
import type { AspectRatio, Renderer } from "../../providers/renderer.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { ArtifactRepository } from "../../repository/types.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";
import { newId } from "../../domain/ids.js";
import { latestBySceneNumber, latestOfType } from "./artifactLookup.js";

export function createAssemblyStep(
  renderer: Renderer,
  storage: StorageProvider,
  artifactRepo: ArtifactRepository,
  workDir: string,
  tempDir: string,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "assembly",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);

      // Yollar için context patch'lerine değil, doğrudan artifact repository'ye
      // güvenilir — bu, workflow'un daha önce başka bir makinede (ör. farklı
      // bir GitHub Actions runner'ında) tamamlanmış adımlarından kalan geçici
      // yerel yolların artık geçersiz olduğu durumlarda da doğru çalışır.
      const artifacts = await artifactRepo.listByWorkflow(workflowId);
      const imageBySceneNumber = latestBySceneNumber(artifacts, "image");
      const voiceBySceneNumber = latestBySceneNumber(artifacts, "voice");

      const renderScenes = await Promise.all(
        scenes.map(async (scene) => {
          const imageArtifact = imageBySceneNumber.get(scene.sceneNumber);
          const voiceArtifact = voiceBySceneNumber.get(scene.sceneNumber);
          if (!imageArtifact || !voiceArtifact) {
            throw new Error(`Sahne ${scene.sceneNumber} için görsel veya ses eksik`);
          }
          const localImagePath = await storage.ensureLocalFile(
            imageArtifact.path,
            path.join(tempDir, `${newId()}${path.extname(imageArtifact.path) || ".png"}`),
          );
          const localAudioPath = await storage.ensureLocalFile(
            voiceArtifact.path,
            path.join(tempDir, `${newId()}${path.extname(voiceArtifact.path) || ".mp3"}`),
          );
          return {
            imagePath: localImagePath,
            audioPath: localAudioPath,
            durationSeconds: voiceArtifact.metadata.durationSeconds as number,
          };
        }),
      );

      const subtitlesArtifact = latestOfType(artifacts, "subtitles");
      if (!subtitlesArtifact) throw new Error("Altyazı artifact'ı bulunamadı");
      const subtitlesPath = await storage.ensureLocalFile(
        subtitlesArtifact.path,
        path.join(tempDir, `${newId()}.srt`),
      );
      const musicPath = (state.context.musicPath as string | null | undefined) ?? null;
      const outputPath = path.join(workDir, `${workflowId}-final.mp4`);
      const { filePath } = await renderer.assemble({
        scenes: renderScenes,
        subtitlesPath,
        outputPath,
        aspectRatio,
        musicPath,
      });

      const artifact = await createFileArtifact({
        storage,
        workflowId,
        type: "final_video",
        localFilePath: filePath,
        costUsd: 0,
        metadata: {
          aspectRatio,
          sceneCount: renderScenes.length,
          musicTrackId: state.context.musicTrackId ?? null,
        },
      });

      return {
        artifacts: [artifact],
        contextPatch: { finalVideoPath: filePath },
        costUsd: 0,
      };
    },
  };
}
