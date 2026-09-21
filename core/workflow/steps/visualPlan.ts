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

// Gerçek üretimlerden kalibre edilmiş ortalama Türkçe TTS hızı (karakter/saniye).
// Sahne sayısı kullanıcı tarafından belirtilmemişse, senaryonun tahmini konuşma
// süresinden otomatik bir hedef sahne sayısı hesaplamak için kullanılıyor —
// sabit "6-9 sahne" yerine, sahne başına düşen konuşma süresi ne kadar uzun
// olursa görsel o kadar ekranda sabit kalır ve bu izleyicinin ilgisini dağıtır.
const CHARS_PER_SECOND_ESTIMATE = 13;
// Hedef: her sahne ortalama bu kadar saniyelik konuşmaya karşılık gelsin —
// görsel sık değişsin diye kısa tutuluyor (bkz. kullanıcı geri bildirimi).
const TARGET_SECONDS_PER_SCENE = 3.5;
const MIN_AUTO_SCENE_COUNT = 6;
// Çok uzun senaryolarda sahne (=görsel) sayısının kontrolsüz artıp maliyeti
// patlatmasına karşı bir üst sınır — MAX_COST_PER_VIDEO zaten genel bir
// güvence ama bu, workflow'un daha başlamadan makul bir aralıkta kalmasını sağlar.
const MAX_AUTO_SCENE_COUNT = 40;

function estimateAutoSceneCount(script: string): number {
  const estimatedSeconds = script.replace(/\s+/g, " ").trim().length / CHARS_PER_SECOND_ESTIMATE;
  const target = Math.round(estimatedSeconds / TARGET_SECONDS_PER_SCENE);
  return Math.min(MAX_AUTO_SCENE_COUNT, Math.max(MIN_AUTO_SCENE_COUNT, target));
}

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
      const sceneCountText = sceneCount
        ? `TAM OLARAK ${sceneCount} sahneye`
        : `YAKLAŞIK ${estimateAutoSceneCount(script)} sahneye (her sahne ortalama ${TARGET_SECONDS_PER_SCENE} ` +
          "saniyelik konuşmaya karşılık gelecek şekilde — görsel çok uzun süre ekranda sabit kalırsa izleyicinin " +
          "ilgisi dağılır, bu yüzden kısa tutulmalı)";
      const prompt =
        `Video konusu: "${state.topic}"\n\n` +
        `Anlatım senaryosu:\n${script}\n\n` +
        `Bu senaryoyu ${sceneCountText} böl. Her sahne için:\n` +
        '- "narration": o sahnede seslendirilecek metnin senaryodan BİREBİR alınan parçası (tüm parçalar birleşince senaryonun tamamını oluşturmalı)\n' +
        '- "imagePrompt": bu sahneyi görselleştirecek, İngilizce, detaylı bir görsel üretim promptu (temiz, fotogerçekçi veya editoryal illüstrasyon stili)\n\n' +
        "Bölme kuralları:\n" +
        "- Sahneleri mümkün olduğunca DENGELİ uzunlukta böl — en uzun sahnenin narration'ı en kısa sahnenin " +
        "2 katından uzun olmasın. Tek bir sahne birden fazla cümleyi/fikri yutup senaryonun büyük bir kısmını " +
        "üstlenmesin.\n" +
        "- ÖNEMLİ: Senaryo farklı, ayrı isimlere/konulara sahip öğelerden oluşuyorsa (ör. birden fazla yer, " +
        "kişi, olay, nesne), HER ÖĞE kendi sahnesini alsın. İki farklı öğeyi (ör. iki farklı mekan) AYNI " +
        "sahnede birleştirme — bir görsel tek bir şeyi net şekilde resmedebilir, iki farklı konuyu aynı anda " +
        "göstermeye çalışmak görseli anlamsız/karışık hale getirir. Bu kural, yukarıdaki uzunluk dengesi " +
        "kuralından ve hedef sahne sayısından ÖNCELİKLİDİR — gerekirse hedef sayıdan daha fazla sahne kullan.\n" +
        "- İlk sahne SADECE açılış/hook cümlesini içersin — hook'u bir sonraki cümleyle birleştirip " +
        "uzatma.\n\n" +
        "imagePrompt yazarken şu iki kurala KESİNLİKLE uy:\n" +
        "1. GÖRSEL, VİDEONUN KONUSUNA AÇIKÇA BAĞLI OLMALI. Özellikle hook/giriş ve soyut/genel geçiş " +
        "cümlelerinde (ör. \"biliyor muydunuz\", \"hikaye burada bitmiyor\" gibi yer adı GEÇMEYEN " +
        "cümlelerde) imagePrompt'a videonun konusuyla ilgili somut, tanınabilir görsel/mimari/coğrafi " +
        "unsurlar (şehir, ülke, dönem, yapı tarzı vb.) EKLE — jenerik/kimliksiz bir görsel üretme (ör. " +
        "İstanbul'la ilgili bir videoda \"a park in a city\" değil, \"a park in Istanbul with Ottoman-era " +
        "architecture/Bosphorus view\" gibi somut ol).\n" +
        "2. Görsel üretim modelleri OKUNABİLİR METNİ GÜVENİLİR ÇİZEMİYOR — pankart, tabela, gazete " +
        "manşeti gibi üzerinde yazı olması beklenen nesnelerin İMAGEPROMPT'TA HİÇ GEÇMEMESİNİ sağla " +
        "(\"holding banners/signs\" gibi ifadeler bile modele metin yazdırmaya itiyor ve neredeyse her " +
        "zaman anlamsız/bozuk karakterlerle sonuçlanıyor — bir sahnede TEK bir pankart istesen bile arka " +
        "plandaki figürler kendiliğinden ek, bozuk yazılı pankartlarla doluyor). Protesto/kalabalık " +
        "sahnelerinde pankart/tabela nesnesinden TAMAMEN kaçın, bunun yerine sahneyi yazısız unsurlarla " +
        "anlat (kalabalık, yumruklar, " +
        "bayraklar, mimari, ışık/atmosfer). Görselde hiçbir YAZI/METİN olmasın.\n\n" +
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
