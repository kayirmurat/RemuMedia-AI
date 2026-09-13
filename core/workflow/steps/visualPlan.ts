import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { Scene } from "../../domain/types.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";
import { extractJson } from "../../text/extractJson.js";

const SYSTEM_PROMPT =
  "Sen kısa videolar için görsel yönetmen olarak çalışıyorsun. Yalnızca istenen formatta yanıt verirsin.";

interface RawScene {
  narration: string;
  imagePrompt: string;
}

export function createVisualPlanStep(llm: LLMProvider, storage: StorageProvider): StepDefinition {
  return {
    name: "visualPlan",
    async run({ workflowId, state }) {
      const script = state.context.script as string;
      const prompt =
        `Anlatım senaryosu:\n${script}\n\n` +
        "Bu senaryoyu 6-9 sahneye böl. Her sahne için:\n" +
        '- "narration": o sahnede seslendirilecek metnin senaryodan BİREBİR alınan parçası (tüm parçalar birleşince senaryonun tamamını oluşturmalı)\n' +
        '- "imagePrompt": bu sahneyi görselleştirecek, İngilizce, detaylı bir görsel üretim promptu (temiz, fotogerçekçi veya editoryal illüstrasyon stili; görselde YAZI/METİN olmasın)\n\n' +
        "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama yazma:\n" +
        '[{"narration": "...", "imagePrompt": "..."}]';

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.6 });

      let scenes: Scene[];
      try {
        const raw = JSON.parse(extractJson(result.text)) as RawScene[];
        if (!Array.isArray(raw) || raw.length === 0) throw new Error("boş dizi");
        scenes = raw.map((s, i) => ({
          sceneNumber: i + 1,
          narration: s.narration.trim(),
          imagePrompt: s.imagePrompt.trim(),
        }));
      } catch (error) {
        throw new Error(
          `Görsel plan JSON olarak ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "visual_plan",
        content: JSON.stringify(scenes, null, 2),
        extension: ".json",
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
        metadata: { sceneCount: scenes.length },
      });

      return {
        artifacts: [artifact],
        contextPatch: { scenes },
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
