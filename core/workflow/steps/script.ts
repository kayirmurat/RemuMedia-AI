import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen kısa video (Shorts/Reels/TikTok) anlatım metinleri yazan bir senaristsin. " +
  "Yazdığın metin doğrudan sesli anlatım (voice-over) olarak okunacak.";

const SERIES_SYSTEM_PROMPT =
  "Sen tekrarlayan bölümlerden oluşan bir anlatı dizisi için senaristsin. Yazdığın metin doğrudan " +
  "sesli anlatım (voice-over) olarak okunacak — sıcak, hikaye anlatan bir üslup kullanırsın, bilgi " +
  "videosu değil bir dizi bölümü yazıyorsun.";

export function createScriptStep(
  llm: LLMProvider,
  storage: StorageProvider,
  targetDurationSeconds?: number,
  characterSeriesMode?: boolean,
): StepDefinition {
  return {
    name: "script",
    async run({ workflowId, state }) {
      // Kullanıcı dashboard'da metni doğrudan kendisi düzenleyip kaydetmiş
      // olabilir — bu durumda LLM'e hiç gitmeden (maliyet $0) onu aynen kullan.
      const manualOverride = state.context.scriptOverride as string | undefined;
      if (manualOverride && manualOverride.trim()) {
        const script = manualOverride.trim();
        const artifact = await createTextArtifact({
          storage,
          workflowId,
          type: "script",
          content: script,
          provider: "manual",
          model: "manual",
          costUsd: 0,
        });
        return {
          artifacts: [artifact],
          contextPatch: { script, scriptOverride: undefined },
          costUsd: 0,
          provider: "manual",
          model: "manual",
        };
      }

      const research = state.context.research as string;
      const brief = state.context.brief as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);
      const durationText = targetDurationSeconds
        ? `yaklaşık ${targetDurationSeconds} saniyelik (kısa, test amaçlı)`
        : "45-90 saniyelik";

      const characterRules = characterSeriesMode
        ? "- Metni ailenin kendi bakış açısından, birlikte deneyimliyormuş gibi anlat — 'biliyor muydunuz' " +
          "ya da soğuk bilgi sunumu OLMASIN. Sanki bir gezi günlüğü/hikaye anlatıcısı yazıyormuş gibi " +
          "sıcak, meraklı bir üslup kullan.\n" +
          "- İlk cümle ailenin bu yere VARDIĞI/karşılaştığı bir an olsun, çarpıcı istatistik/gerçek " +
          "sıralamasıyla AÇMA.\n"
        : "- Brief'teki hook ile başla — ilk cümle jenerik/klişe olmasın, doğrudan çarpıcı/merak uyandırıcı " +
          "bilgiyle açılsın, izleyiciyi ilk 3 saniyede durdurmalı.\n";

      const prompt =
        `Konu: "${state.topic}"\n\nAraştırma:\n${research}\n\nBrief:\n${brief}\n\n` +
        `Yukarıdakilere dayanarak ${durationText} bir anlatım (voice-over) senaryosu yaz.\n` +
        "Kurallar:\n" +
        "- SADECE seslendirilecek metni yaz. Sahne numarası, yönerge, parantez içi not YAZMA.\n" +
        "- Akıcı, konuşma diline yakın, kısa cümleler kullan.\n" +
        characterRules +
        "- Sahneler arasında merak/gerilim koru (bir sonraki cümleyi merak ettirecek şekilde ilerle), " +
        "ana fikirle bitir.\n" +
        '- Sayı/birim/sembol içeren ifadeleri SESLİ OKUNACAĞI GİBİ yaz, sembol kullanma ' +
        '(ör. "30°C" değil "30 derece", "%50" değil "yüzde elli" yaz).' +
        (latestFeedback
          ? `\n\nÖNEMLİ — kullanıcı önceki taslak için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
          : "");

      const result = await llm.generate(prompt, {
        system: characterSeriesMode ? SERIES_SYSTEM_PROMPT : SYSTEM_PROMPT,
        temperature: 0.7,
      });
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
