import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen kısa video (Shorts/Reels/TikTok) anlatım metinleri yazan bir senaristsin. " +
  "Yazdığın metin doğrudan sesli anlatım (voice-over) olarak okunacak.";

export function createScriptStep(llm: LLMProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "script",
    async run({ workflowId, state }) {
      const research = state.context.research as string;
      const brief = state.context.brief as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);

      const prompt =
        `Konu: "${state.topic}"\n\nAraştırma:\n${research}\n\nBrief:\n${brief}\n\n` +
        "Yukarıdakilere dayanarak 45-90 saniyelik bir anlatım (voice-over) senaryosu yaz.\n" +
        "Kurallar:\n" +
        "- SADECE seslendirilecek metni yaz. Sahne numarası, yönerge, parantez içi not YAZMA.\n" +
        "- Akıcı, konuşma diline yakın, kısa cümleler kullan.\n" +
        "- Brief'teki hook ile başla, ana fikirle bitir." +
        (latestFeedback
          ? `\n\nÖNEMLİ — kullanıcı önceki taslak için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
          : "");

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.7 });
      const script = result.text.trim();

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "script",
        content: script,
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
      });

      return {
        artifacts: [artifact],
        contextPatch: { script },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
