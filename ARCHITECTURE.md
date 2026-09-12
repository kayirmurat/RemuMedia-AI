# RemuMedia AI — Mimari Karar Dokümanı (Faz 0)

Bu doküman, `MEDIA AI — MASTER BUILD PROMPT v3` talimatına göre yapılan Faz 0
(mimari doğrulama) değerlendirmesinin sonucudur. Amaç uzun bir araştırma değil,
Faz 1'i ("tek gerçek video") en hızlı ve güvenilir şekilde üretecek, ileride
değiştirilebilir bir temel kurmaktır.

## Ortam tespiti

- Bu ortamda Node.js 22 ve npm mevcut, sistemde `ffmpeg` kurulu değil.
- Herhangi bir video/görsel/ses AI sağlayıcısına ait API anahtarı ortamda
  bulunamadı — bunlar kullanıcıdan (`.env`) sağlanacak.
- Kardeş proje `riona-ai` (bu hesaptaki mevcut Riona AI reposu) Next.js +
  Supabase + OpenAI yığınını kullanıyor ve zaten çalışır durumda.

## Seçilen yığın ve gerekçesi

| Katman | Seçim | Gerekçe |
|---|---|---|
| Çalışma zamanı | Node.js 22 + TypeScript | Tip güvenliği, riona-ai ile aynı ekosistem |
| Faz 1 arayüzü | CLI script (`npm run produce`) | Web arayüzü Faz 3'e ait; en hızlı doğrulama yolu budur |
| LLM (araştırma/senaryo) | OpenAI (`gpt-4o-mini`), `LLMProvider` arkasında | Zaten bilinen sağlayıcı, ucuz, hızlı; değiştirilebilir |
| Görsel üretim | OpenAI Images (`gpt-image-1`), `ImageProvider` arkasında | Ayrı bir sağlayıcı entegre etmeden tek vendor ile başlamak en hızlı yol |
| Seslendirme (TTS) | OpenAI TTS (`tts-1`), `VoiceProvider` arkasında | Aynı gerekçe |
| Video render/birleştirme | `ffmpeg` (statik binary, npm üzerinden) | Deterministik montaj; AI üretimi ile render katmanı kesin olarak ayrılıyor (bkz. madde 24 — "AI generates assets, renderer assembles deterministically"). Not: bu statik derlemede `drawtext` filtresi yok (bilinen bir kısıt), bu yüzden altyazılar libass tabanlı `subtitles` filtresiyle yakılıyor — bu ayrıca "subtitles" artifact'ı ile yakılan altyazının aynı dosya olmasını sağlıyor. |
| Kalıcılık (Faz 1) | Yerel JSON dosyaları (`data/`) | Gerçek video üretimini kanıtlamadan veritabanı kurulumuna zaman harcamamak; `WorkflowRepository`/`ArtifactRepository` arayüzü sayesinde Faz 2/3'te Supabase'e geçiş kod değişikliği gerektirmez |
| Dosya depolama (Faz 1) | Yerel disk (`storage/`) | Aynı gerekçe; `StorageProvider` arkasında |

**Not:** Sağlayıcı seçimleri doküman madde 6/7 gereği soyutlama arkasında —
`core/providers/*` arayüzlerini karşılayan yeni bir adaptör yazılarak (örn.
ElevenLabs, Runway, Supabase Storage) iş mantığına dokunmadan değiştirilebilir.

## İlk video formatı kararı

Metinden-video (text-to-video) modelleri şu anda pahalı, yavaş ve kalite/tutarlılık
riski yüksek. Faz 1 için daha hızlı ve ucuz, kanıtlanmış bir format seçildi:
**AI ile üretilmiş sahne görselleri + AI seslendirme + yakılmış altyazı**
("faceless" açıklayıcı video stili — YouTube Shorts/Reels'te yaygın kullanılan bir
format). Bu, madde 8'deki "gerçek, kullanılabilir bir video dosyası, mockup değil"
kriterini karşılıyor ve maliyeti bir videoda birkaç sente indiriyor.

## Modüler monolit klasör haritası

```
core/
  domain/       — paylaşılan tipler (WorkflowState, Artifact, Scene)
  providers/    — sağlayıcı ARAYÜZLERİ (LLM, Image, Voice, Renderer, Storage)
  adapters/     — sağlayıcı ARAYÜZLERİNİN somut implementasyonları
    openai/     — LLM, görsel, ses
    ffmpeg/     — render + probe (kalite kontrol için)
    storage/    — yerel dosya sistemi
  artifacts/    — artifact oluşturma yardımcıları
  repository/   — workflow/artifact kalıcılığı (şu an JSON dosya tabanlı)
  registry/     — içerik kaydı (konu tekrarını önleme)
  workflow/
    engine.ts   — resumable workflow çalıştırıcı
    steps/      — research → brief → script → visualPlan → visualAssets →
                  voice → subtitles → assembly → qc
scripts/
  produce-video.ts — Faz 1 giriş noktası (CLI)
assets/fonts/   — altyazı yakma için bundlenmiş font (lisans: SIL/Liberation)
data/           — (git'e girmez) workflow/artifact JSON durumu
storage/        — (git'e girmez) üretilen görsel/ses/video dosyaları
```

Hiçbir katman doğrudan `openai` paketini veya `ffmpeg`'i değil, `core/providers/*`
arayüzlerini import eder — tek istisna `scripts/produce-video.ts` (composition root).

## Faz 1 kapsamı ve bilinçli olarak ERTELENENLER

Dahil: konu → araştırma → brief → senaryo → sahne planı → görseller → seslendirme
→ altyazı → montaj → kalite kontrolü → gerçek `.mp4` dosyası. Resumable: bir adım
patlarsa `--id <workflowId>` ile kaldığı yerden devam eder.

Ertelenen (doküman madde 33 gereği bilinçli olarak yapılmadı): web arayüzü,
Supabase/gerçek veritabanı, çoklu ajan mimarisi, insan onay UI'ı, çoklu platform
dönüşümü, çoklu kanal, Riona entegrasyonu, gelişmiş maliyet limitleri/bütçe kontrolü.
Bunlar Faz 2+'da, ilk video kanıtlandıktan sonra eklenecek.

## Sonraki adım (Faz 2 önizlemesi)

Faz 1 gerçek bir video ürettikten sonra: Supabase'e geçiş (`WorkflowRepository`/
`ArtifactRepository`/`StorageProvider`'ın Supabase implementasyonları), daha
sağlam retry/hata raporlama, basit bir onay adımı ve maliyet limiti.
