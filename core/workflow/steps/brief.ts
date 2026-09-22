import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen kısa video formatları (Shorts/Reels/TikTok) için içerik stratejisti olarak çalışıyorsun.";

const SERIES_SYSTEM_PROMPT =
  "Sen tekrarlayan bölümlerden oluşan bir anlatı dizisi için hikaye editörü olarak çalışıyorsun. " +
  "Amacın viral 'bilgi videosu' değil, sıcak ve sürükleyici bir bölüm hazırlamak.";

export function createBriefStep(
  llm: LLMProvider,
  storage: StorageProvider,
  characterSeriesMode?: boolean,
): StepDefinition {
  return {
    name: "brief",
    async run({ workflowId, state }) {
      const research = state.context.research as string;
      const revisionNotes = state.context.revisionNotes as string[] | undefined;
      const latestFeedback = revisionNotes?.at(-1);
      const productionNote = state.context.productionNote as string | undefined;

      const prompt = characterSeriesMode
        ? `Konu/varış noktası: "${state.topic}"\n\nAraştırma notları:\n${research}\n\n` +
          "Bu araştırmadan, tekrarlayan bir karakter dizisinin (bir ailenin dünyayı gezdiği bir anlatı " +
          "dizisi) bir bölümü için içerik brief'i hazırla:\n" +
          "- Açılış: ailenin bu yeni yere VARDIĞI, meraklandığı bir an — 'biliyor muydunuz' ya da soğuk " +
          "bilgi sunumu DEĞİL, ailenin kendi deneyimi/tepkisi üzerinden başlasın\n" +
          "- Ana açı: ailenin bu yerde ne keşfettiği, ne hissettiği, hangi 2-3 ilginç şeyi öğrendiği " +
          "(araştırmadaki gerçekler ailenin ağzından/deneyiminden aktarılsın, kuru bir liste olmasın)\n" +
          "- Kapanış hissi: aile bir sonraki durağa merak içinde ayrılıyor izlenimi\n" +
          "- Video sonunda izleyicide kalacak tek bir ana fikir/duygu\n" +
          "Düz metin olarak yaz." +
          (productionNote ? `\n\nSeri talimatı: "${productionNote}"` : "") +
          (latestFeedback
            ? `\n\nÖNEMLİ — kullanıcı önceki taslak için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
            : "")
        : `Konu: "${state.topic}"\n\nAraştırma notları:\n${research}\n\n` +
          "Bu araştırmadan 45-90 saniyelik kısa bir video için içerik brief'i hazırla:\n" +
          "- Hook: ilk 3 saniyede izleyiciyi durduracak açılış cümlesi. Şu tekniklerden birini kullan: " +
          "şaşırtıcı/az bilinen somut bir gerçek, merak uyandıran açık uçlu bir soru, ya da cesur/çelişkili " +
          "bir iddia. \"Bugün size ... hakkında bahsedeceğim\" veya \"... biliyor muydunuz\" gibi klişe, " +
          "jenerik girişlerden KESİNLİKLE kaçın — doğrudan çarpıcı bilgiyle aç.\n" +
          "- Ana açı: bu video neden farklı/değerli\n" +
          "- Hedef kitle\n" +
          "- Video sonunda izleyicide kalacak tek bir ana fikir\n" +
          "Düz metin olarak yaz." +
          (productionNote
            ? `\n\nKullanıcının ton/stil için ek isteği (konuyu değiştirme, sadece üsluba yansıt): "${productionNote}"`
            : "") +
          (latestFeedback
            ? `\n\nÖNEMLİ — kullanıcı önceki taslak için şu geri bildirimi verdi, bunu mutlaka dikkate al:\n"${latestFeedback}"`
            : "");

      const result = await llm.generate(prompt, {
        system: characterSeriesMode ? SERIES_SYSTEM_PROMPT : SYSTEM_PROMPT,
        temperature: 0.7,
      });

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
