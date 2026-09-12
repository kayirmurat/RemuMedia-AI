import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen kısa video formatları (Shorts/Reels/TikTok) için içerik stratejisti olarak çalışıyorsun.";

export function createBriefStep(llm: LLMProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "brief",
    async run({ workflowId, state }) {
      const research = state.context.research as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);

      const prompt =
        `Konu: "${state.topic}"\n\nAraştırma notları:\n${research}\n\n` +
        "Bu araştırmadan 45-90 saniyelik kısa bir video için içerik brief'i hazırla:\n" +
        "- Hook: ilk 3 saniyede izleyiciyi durduracak açılış cümlesi\n" +
        "- Ana açı: bu video neden farklı/değerli\n" +
        "- Hedef kitle\n" +
        "- Video sonunda izleyicide kalacak tek bir ana fikir\n" +
        "Düz metin olarak yaz." +
        (latestFeedback
          ? `\n\nÖNEMLİ — kullanıcı önceki taslak için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
          : "");

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.7 });

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "brief",
        content: result.text,
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
      });

      return {
        artifacts: [artifact],
        contextPatch: { brief: result.text },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
