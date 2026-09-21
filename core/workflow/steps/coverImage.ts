import path from "node:path";
import type { LLMProvider } from "../../providers/llm.js";
import type { AspectRatio, Renderer } from "../../providers/renderer.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { ArtifactRepository } from "../../repository/types.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";
import { newId } from "../../domain/ids.js";
import { latestBySceneNumber } from "./artifactLookup.js";

const SYSTEM_PROMPT =
  "Sen kısa videolar için kapak fotoğrafı metni yazan bir editörsün. Yazdığın metin videonun kapağında " +
  "büyük, kalın yazıyla gösterilecek — kısa ve çarpıcı olmalı.";

// assembly.ts'den kasıtlı olarak AYRI bir adım: kullanıcı sadece kapak
// fotoğrafını beğenmeyip geri bildirimle değiştirmek istediğinde, tüm
// videoyu (ses/görsel/montaj) yeniden oluşturmadan SADECE bu adım tekrar
// çalıştırılabilsin diye (bkz. dashboard'daki "cover" revize kapsamı).
export function createCoverImageStep(
  llm: LLMProvider,
  renderer: Renderer,
  storage: StorageProvider,
  artifactRepo: ArtifactRepository,
  tempDir: string,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "coverImage",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const hookScene = scenes[0]!;

      const feedback = state.context.coverFeedback as string | undefined;
      let hookText = (state.context.coverText as string | undefined) ?? hookScene.narration;
      let costUsd = 0;
      let provider: string | undefined;
      let model: string | undefined;

      if (feedback && feedback.trim()) {
        const prompt =
          `Mevcut kapak metni: "${hookText}"\n\n` +
          `Kullanıcının değişiklik isteği: "${feedback}"\n\n` +
          "Bu isteğe göre YENİ kapak metnini üret. SADECE yeni metni yaz, başka hiçbir açıklama, " +
          "tırnak işareti veya madde işareti ekleme.";
        const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.7 });
        hookText = result.text.trim().replace(/^["']|["']$/g, "");
        costUsd = result.costUsd;
        provider = result.provider;
        model = result.model;
      }

      const artifacts = await artifactRepo.listByWorkflow(workflowId);
      const hookImageArtifact = latestBySceneNumber(artifacts, "image").get(hookScene.sceneNumber);
      if (!hookImageArtifact) throw new Error("İlk sahne için görsel bulunamadı (kapak fotoğrafı)");
      const hookImagePath = await storage.ensureLocalFile(
        hookImageArtifact.path,
        path.join(tempDir, `${newId()}${path.extname(hookImageArtifact.path) || ".png"}`),
      );

      const thumbnailPath = path.join(tempDir, `${newId()}.jpg`);
      await renderer.renderCoverImage({
        imagePath: hookImagePath,
        hookText,
        aspectRatio,
        outputPath: thumbnailPath,
      });
      const thumbnailArtifact = await createFileArtifact({
        storage,
        workflowId,
        type: "thumbnail",
        localFilePath: thumbnailPath,
        costUsd,
        provider,
        model,
        metadata: { hookText },
      });

      return {
        artifacts: [thumbnailArtifact],
        contextPatch: { coverText: hookText, coverFeedback: undefined },
        costUsd,
        provider,
        model,
      };
    },
  };
}
