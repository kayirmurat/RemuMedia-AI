import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { ContentRegistry } from "../../registry/contentRegistry.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";
import { extractJson } from "../../text/extractJson.js";

const SYSTEM_PROMPT =
  "Sen kısa video içerikleri için kalite kontrol uzmanısın. Nesnel, dürüst ve kısa değerlendirme yaparsın. " +
  "Sadece istenen JSON formatında yanıt verirsin.";

interface ContentReviewResult {
  passed: boolean;
  concerns: string[];
  hookAssessment: string;
  pacingAssessment: string;
}

export function createContentReviewStep(
  llm: LLMProvider,
  storage: StorageProvider,
  registry: ContentRegistry,
): StepDefinition {
  return {
    name: "contentReview",
    async run({ workflowId, state }) {
      const script = state.context.script as string;
      const research = state.context.research as string;

      const others = await registry.list();
      const otherTopics = others.map((w) => w.topic).filter((topic) => topic !== state.topic);

      const prompt =
        `Senaryo:\n${script}\n\nAraştırma notları:\n${research}\n\n` +
        `Daha önce işlenmiş diğer konular: ${otherTopics.length ? otherTopics.join(", ") : "(yok)"}\n\n` +
        "Bu senaryoyu değerlendir:\n" +
        "1. Hook (ilk cümleler) ilgi çekiyor mu?\n" +
        "2. Tempo/akış makul mü?\n" +
        "3. Araştırma notlarıyla çelişen veya araştırmada hiç yer almayan, uydurulmuş görünen somut bir iddia var mı?\n" +
        "4. Daha önce işlenmiş konulardan biriyle neredeyse birebir aynı mı (gerçek bir tekrar mı)?\n" +
        "5. Açık bir telif hakkı veya yasak içerik sorunu var mı?\n\n" +
        "SADECE şu JSON formatında yanıt ver, başka hiçbir açıklama yazma:\n" +
        '{"passed": true, "concerns": ["..."], "hookAssessment": "...", "pacingAssessment": "..."}\n\n' +
        '"passed" değerini SADECE 3, 4 ya da 5. maddede GERÇEK ve CİDDİ bir sorun varsa false yap. ' +
        "Zayıf ama kabul edilebilir bir hook veya tempo için false yapma, sadece concerns'e not düş.";

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.3 });

      let review: ContentReviewResult;
      try {
        review = JSON.parse(extractJson(result.text)) as ContentReviewResult;
        if (typeof review.passed !== "boolean" || !Array.isArray(review.concerns)) {
          throw new Error("beklenen alanlar eksik");
        }
      } catch (error) {
        throw new Error(
          `İçerik incelemesi JSON olarak ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "content_review",
        content: JSON.stringify(review, null, 2),
        extension: ".json",
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
        metadata: { passed: review.passed },
      });

      if (!review.passed) {
        throw new Error(`İçerik incelemesi başarısız: ${review.concerns.join("; ")}`);
      }

      return {
        artifacts: [artifact],
        contextPatch: { contentReview: review },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
