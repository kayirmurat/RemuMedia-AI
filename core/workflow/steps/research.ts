import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen deneyimli bir içerik araştırmacısısın. Verilen konu hakkında kısa, doğru ve ilginç bilgiler " +
  "topluyorsun. Uydurma bilgi verme; emin olmadığın noktaları belirt.";

export function createResearchStep(llm: LLMProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "research",
    async run({ workflowId, state }) {
      const prompt =
        `Konu: "${state.topic}"\n\n` +
        "Bu konu hakkında kısa bir video için araştırma notu hazırla:\n" +
        "- 5-8 önemli veya ilginç gerçek/nokta\n" +
        "- Konunun neden ilgi çekici olduğuna dair 1-2 cümle\n" +
        "- Varsa yaygın bir yanlış bilinen nokta\n" +
        "Düz metin, madde işaretleriyle yaz.";

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.6 });

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "research",
        content: result.text,
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
      });

      return {
        artifacts: [artifact],
        contextPatch: { research: result.text },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
