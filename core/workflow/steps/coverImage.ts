import path from "node:path";
import type { LLMProvider } from "../../providers/llm.js";
import type { ImageProvider } from "../../providers/image.js";
import type { AspectRatio, Renderer } from "../../providers/renderer.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createFileArtifact } from "../../artifacts/artifactFactory.js";
import { newId } from "../../domain/ids.js";
import { extractJson } from "../../text/extractJson.js";

const SYSTEM_PROMPT =
  "Sen video kapak fotoğrafları (thumbnail) tasarlayan bir editörsün. Kapak, videonun HİÇBİR sahnesinin " +
  "birebir tekrarı DEĞİL — bağımsız, tıklanmaya davet eden, parlak ve yüksek kontrastlı bir tasarımdır. " +
  "Yalnızca istenen formatta yanıt verirsin.";

const IMAGE_SIZE_BY_ASPECT: Record<AspectRatio, "1024x1536" | "1536x1024" | "1024x1024"> = {
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "1:1": "1024x1024",
};

interface CoverPlan {
  coverText: string;
  coverImagePrompt: string;
}

function parseCoverPlan(text: string): CoverPlan {
  const raw = JSON.parse(extractJson(text)) as Partial<CoverPlan>;
  if (!raw.coverText || !raw.coverImagePrompt) throw new Error("coverText/coverImagePrompt eksik");
  return { coverText: raw.coverText.trim(), coverImagePrompt: raw.coverImagePrompt.trim() };
}

// Kapak, videonun sahnelerinden BAĞIMSIZ üretilir — sahne görselleri o
// sahnenin anlatımına uygun (ör. karanlık/loş bir "dehşet" sahnesi) olabilir,
// ama bu bir kapak fotoğrafı için kötü bir seçim: parlak, yüksek kontrastlı,
// tıklanmaya davet eden bir görsel gerekir. Bu yüzden kapak için AYRI bir
// görsel üretiliyor (küçük bir ek maliyetle, ~1 sahne görseli kadar).
// assembly.ts'den de kasıtlı olarak ayrı bir adım: kullanıcı sadece kapağı
// beğenmeyip geri bildirimle değiştirmek istediğinde, videonun geri kalanını
// (ses/görsel/montaj) yeniden oluşturmadan SADECE bu adım tekrar çalışır.
export function createCoverImageStep(
  llm: LLMProvider,
  image: ImageProvider,
  renderer: Renderer,
  storage: StorageProvider,
  tempDir: string,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "coverImage",
    async run({ workflowId, state }) {
      const scenes = [...(state.context.scenes as Scene[])].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const hookNarration = scenes[0]?.narration ?? state.topic;
      const feedback = state.context.coverFeedback as string | undefined;
      const existingText = state.context.coverText as string | undefined;
      const existingImagePrompt = state.context.coverImagePrompt as string | undefined;

      const prompt =
        feedback && feedback.trim() && existingText && existingImagePrompt
          ? `Mevcut kapak metni: "${existingText}"\nMevcut kapak görsel promptu: "${existingImagePrompt}"\n\n` +
            `Kullanıcının değişiklik isteği: "${feedback}"\n\n` +
            "Bu isteğe göre kapağı güncelle — istek sadece metinle ilgiliyse görsel promptunu ANLAMCA aynı " +
            "tut (küçük ifade farkları olabilir), sadece görselle ilgiliyse metni AYNEN koru.\n\n" +
            'SADECE şu JSON formatında yanıt ver, başka hiçbir açıklama ekleme:\n' +
            '{"coverText": "...", "coverImagePrompt": "..."}'
          : `Video konusu: "${state.topic}"\nHook cümlesi: "${hookNarration}"\n\n` +
            "Bu video için bir kapak fotoğrafı (thumbnail) tasarla:\n" +
            '- "coverText": kapakta büyük/kalın yazıyla gösterilecek kısa, çarpıcı metin (hook cümlesinin ' +
            "kendisi ya da kısaltılmış/güçlendirilmiş bir hali olabilir)\n" +
            '- "coverImagePrompt": arka plan görseli için İngilizce, detaylı bir görsel üretim promptu — ' +
            "PARLAK, yüksek kontrastlı, dikkat çekici olsun (videonun kendi sahnelerinin aksine karanlık/loş " +
            "OLMASIN), kompozisyon sade olsun ki üzerine yazı bindiğinde okunaklı kalsın, görselde YAZI/METİN " +
            "olmasın.\n\n" +
            'SADECE şu JSON formatında yanıt ver, başka hiçbir açıklama ekleme:\n' +
            '{"coverText": "...", "coverImagePrompt": "..."}';

      const llmResult = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.8 });
      let plan: CoverPlan;
      try {
        plan = parseCoverPlan(llmResult.text);
      } catch (error) {
        throw new Error(
          `Kapak planı ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const imageResult = await image.generate(plan.coverImagePrompt, {
        size: IMAGE_SIZE_BY_ASPECT[aspectRatio],
      });

      const thumbnailPath = path.join(tempDir, `${newId()}.jpg`);
      await renderer.renderCoverImage({
        imagePath: imageResult.filePath,
        hookText: plan.coverText,
        aspectRatio,
        outputPath: thumbnailPath,
      });

      const costUsd = llmResult.costUsd + imageResult.costUsd;
      const artifact = await createFileArtifact({
        storage,
        workflowId,
        type: "thumbnail",
        localFilePath: thumbnailPath,
        costUsd,
        provider: imageResult.provider,
        model: imageResult.model,
        metadata: { hookText: plan.coverText, coverImagePrompt: plan.coverImagePrompt },
      });

      return {
        artifacts: [artifact],
        contextPatch: {
          coverText: plan.coverText,
          coverImagePrompt: plan.coverImagePrompt,
          coverFeedback: undefined,
        },
        costUsd,
        provider: imageResult.provider,
        model: imageResult.model,
      };
    },
  };
}
