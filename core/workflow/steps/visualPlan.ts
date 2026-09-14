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

function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Sahneler senaryoyu "birebir" parçalara bölmeli — bu sadece prompt'ta
// istenen bir kural, LLM buna tam uymayabilir (kelime ekleyip çıkarabilir).
// Bu sessizce olursa video süresi istenmeden uzayıp kısalabilir, bu yüzden
// toplam uzunluk senaryoyla karşılaştırılıp önemli bir sapma varsa adım
// hata verir (kullanıcı tekrar deneyebilir) — sessizce geçmez.
const NARRATION_LENGTH_TOLERANCE = 0.15;

export function createVisualPlanStep(
  llm: LLMProvider,
  storage: StorageProvider,
  sceneCount?: number,
): StepDefinition {
  return {
    name: "visualPlan",
    async run({ workflowId, state }) {
      const script = state.context.script as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);
      const sceneCountText = sceneCount ? `TAM OLARAK ${sceneCount} sahneye` : "6-9 sahneye";
      const prompt =
        `Anlatım senaryosu:\n${script}\n\n` +
        `Bu senaryoyu ${sceneCountText} böl. Her sahne için:\n` +
        '- "narration": o sahnede seslendirilecek metnin senaryodan BİREBİR alınan parçası (tüm parçalar birleşince senaryonun tamamını oluşturmalı)\n' +
        '- "imagePrompt": bu sahneyi görselleştirecek, İngilizce, detaylı bir görsel üretim promptu (temiz, fotogerçekçi veya editoryal illüstrasyon stili; görselde YAZI/METİN olmasın)\n\n' +
        "Bölme kuralları:\n" +
        "- Sahneleri mümkün olduğunca DENGELİ uzunlukta böl — en uzun sahnenin narration'ı en kısa sahnenin " +
        "2 katından uzun olmasın. Tek bir sahne birden fazla cümleyi/fikri yutup senaryonun büyük bir kısmını " +
        "üstlenmesin.\n" +
        "- İlk sahne SADECE açılış/hook cümlesini içersin — hook'u bir sonraki cümleyle birleştirip " +
        "uzatma.\n\n" +
        "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama yazma:\n" +
        '[{"narration": "...", "imagePrompt": "..."}]' +
        (latestFeedback
          ? `\n\nÖNEMLİ — kullanıcı sahne planı için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
          : "");

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

      const scriptChars = normalizeForComparison(script).length;
      const narrationChars = normalizeForComparison(scenes.map((s) => s.narration).join(" ")).length;
      const lengthDiffRatio = Math.abs(narrationChars - scriptChars) / scriptChars;
      if (lengthDiffRatio > NARRATION_LENGTH_TOLERANCE) {
        throw new Error(
          `Sahne planı senaryonun toplam uzunluğunu önemli ölçüde değiştirdi (senaryo: ${scriptChars} karakter, ` +
            `sahnelerin toplamı: ${narrationChars} karakter) — bu video süresini istenmeden uzatıp kısaltabilir. ` +
            "Lütfen aynı değişikliği tekrar dene.",
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
        metadata: { sceneCount: scenes.length, narrationChars, scriptChars },
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
