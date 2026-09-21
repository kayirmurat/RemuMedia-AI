import type { LLMProvider } from "../../providers/llm.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import type { ContentRegistry } from "../../registry/contentRegistry.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

const SYSTEM_PROMPT =
  "Sen kısa video (Shorts/Reels/TikTok) içerikleri için editörsün. Görevin izleyicinin ilgisini " +
  "çekecek, somut ve dar kapsamlı BİR konu seçmek — soyut/genel bir başlık değil.";

// Kullanıcı "12 sahne, 5 sn'lik ilginç bir video yap" gibi sadece bir FORMAT/
// PRODÜKSİYON talimatı verip konuyu boş bıraktığında, sistemin bu talimatın
// kendisini konu sanmaması için: konu boşsa gerçek bir editör gibi davranıp
// kendi ilginç ve daha önce işlenmemiş bir konu seçer. Konu zaten verilmişse
// bu adım hiçbir şey yapmadan (maliyetsiz) geçer.
export function createTopicSelectionStep(
  llm: LLMProvider,
  storage: StorageProvider,
  registry: ContentRegistry,
  productionNote?: string,
): StepDefinition {
  return {
    name: "topicSelection",
    async run({ workflowId, state }) {
      if (state.topic && state.topic.trim()) {
        return { costUsd: 0 };
      }

      const past = await registry.list();
      const pastTopics = past.map((w) => w.topic).filter(Boolean);

      const prompt =
        "Kısa, bilgilendirici/merak uyandırıcı bir video için TEK bir konu öner.\n" +
        "Konu somut ve dar kapsamlı olsun (ör. \"İstanbul Boğazı hakkında ilginç gerçekler\" gibi), " +
        'genel/soyut olmasın (ör. "ilginç bilgiler" gibi OLMASIN).\n' +
        (pastTopics.length
          ? `Daha önce şu konular işlendi, bunları TEKRARLAMA:\n${pastTopics.join("; ")}\n\n`
          : "\n") +
        (productionNote
          ? `Kullanıcının konuyla ilgili ek isteği/ipucu (bir üretim/format talimatı olabilir, konu ` +
            `seçerken dikkate al ama bunu OLDUĞU GİBİ konu yapma): "${productionNote}"\n\n`
          : "") +
        "SADECE konunun kendisini yaz, başka hiçbir açıklama, tırnak işareti veya madde işareti ekleme.";

      const result = await llm.generate(prompt, { system: SYSTEM_PROMPT, temperature: 0.9 });
      const topic = result.text.trim().replace(/^["']|["']$/g, "");

      // WorkflowEngine bu adımın çıktısını işledikten sonra state'i kaydeder;
      // topic'i burada doğrudan güncellemek bir sonraki kayıtta kalıcı olur.
      state.topic = topic;

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "topic_selection",
        content: topic,
        provider: result.provider,
        model: result.model,
        costUsd: result.costUsd,
      });

      return {
        artifacts: [artifact],
        costUsd: result.costUsd,
        provider: result.provider,
        model: result.model,
      };
    },
  };
}
