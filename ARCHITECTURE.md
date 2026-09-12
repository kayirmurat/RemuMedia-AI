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
| Kalıcılık | Yerel JSON (`data/`) varsayılan; Supabase Postgres opsiyonel (Faz 2, bkz. aşağıda) | `WorkflowRepository`/`ArtifactRepository` arayüzü sayesinde geçiş kod değişikliği gerektirmedi |
| Dosya depolama | Yerel disk (`storage/`) varsayılan; Supabase Storage opsiyonel (Faz 2) | Aynı gerekçe; `StorageProvider` arkasında |

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

## Faz 2 — tamamlananlar

Faz 1'in ilk gerçek videosu üretildikten sonra eklendi:

- **Ken Burns + crossfade** (`core/adapters/ffmpeg/ffmpegRenderer.ts`): statik
  sahne görselleri artık yavaşça yakınlaşıyor (zoompan) ve aralarında sert kesim
  yerine crossfade (xfade) var. Her sahne geçiş süresi kadar fazladan render
  edilip bu fazlalık geçişte tüketildiği için gerçek anlatım süresi kırpılmıyor.
- **Maliyet limiti** (`MAX_COST_PER_VIDEO`, `--max-cost`): workflow engine her
  adımdan sonra toplam maliyeti kontrol eder, limit aşılırsa bir sonraki
  (muhtemelen daha pahalı) adımı hiç başlatmadan durur.
- **Otomatik retry** (`core/util/retry.ts`): OpenAI çağrılarında geçici hatalar
  (429/5xx/bağlantı kopması) exponential backoff ile otomatik tekrar denenir;
  kalıcı hatalar (401 gibi) hemen fırlatılır.
- **Supabase'e geçiş** (opsiyonel, `core/adapters/supabase/*`):
  `WorkflowRepository`/`ArtifactRepository`/`StorageProvider` arayüzlerinin
  Supabase implementasyonları. `.env`'de `SUPABASE_URL`+`SUPABASE_SECRET_KEY`
  varsa otomatik kullanılır, yoksa Faz 1'deki yerel JSON/disk moduna sessizce
  düşer — provider soyutlaması sayesinde `produce-video.ts` dışında hiçbir
  workflow adımı bu değişiklikten haberdar değil. Şema: `supabase/schema.sql`.

## Faz 3 — tamamlananlar

Minimal, fonksiyonel bir arayüz (`dashboard/` — ayrı bir Next.js uygulaması,
kendi `package.json`/`tsconfig.json`'ı var; CLI'ın NodeNext modülleriyle
çakışmasın diye bilinçli olarak ayrı bir alt proje. Vercel'de "Root
Directory" = `dashboard` olarak deploy edilir):

- **Konu → araştırma → senaryo → sahne planı hazır olunca üretim otomatik
  durur** (`--stop-after visualPlan`). Dashboard bu noktada script'i ve
  sahne sahne görsel planını gösterir; kullanıcı ya **"Onayla ve Devam Et"**
  der (görsel/ses/montaj/qc çalışır — asıl maliyetli kısım) ya da bir geri
  bildirim yazıp **"Yeniden Yaz"** der (brief+senaryo+sahne planı sıfırlanıp
  geri bildirimle yeniden üretilir, araştırma tekrar yapılmaz). Bu, madde
  9'un "insan onayı" ilkesinin üretim öncesi bir versiyonu — henüz
  yayınlama yok, ama pahalı adımlardan önce insan onayı var.
- **Üretimi tetikleme**: dashboard'daki "Yeni Video Üret" butonu GitHub
  Actions'ı (`.github/workflows/produce-video.yml`, `workflow_dispatch`)
  tetikler — Vercel'in saniyeler süren istek limiti bir video üretiminin
  10-20 dakikasını karşılayamayacağı için (aynı yöntem riona-ai'nin toplantı
  botunda da kullanılıyor). İş GitHub'ın kendi runner'ında `npm run produce`
  çalıştırır, ilerlemeyi zaten Supabase'e yazdığı için dashboard ayrıca bir
  "iş durumu" takip mekanizmasına ihtiyaç duymadan sadece tabloyu okuyarak
  anlık ilerlemeyi gösterir.
- **Basit tek şifreli erişim koruması** (`DASHBOARD_PASSWORD`, opsiyonel):
  madde 33 "sofistike izin sistemi kurma" diyor, bu yüzden gerçek
  kullanıcı/rol sistemi yok — sadece dashboard'ın tamamen açık olmasını
  önleyen tek bir paylaşılan şifre.
- **Final video için onay butonu**: artifact'ın `metadata.approved`
  alanına yazar (yeni bir tablo/kolon gerekmedi).

Kapsam dışı bırakılan (bilinçli): üretimi doğrudan bir web isteğinden
çalıştırmak (Vercel süre limiti nedeniyle imkansız, bu yüzden GitHub
Actions'a devredildi), gerçek kullanıcı hesapları/roller.

## Sonraki adım (Faz 4 önizlemesi)

Kanıtlanmış workflow sorumluluklarını uzmanlaşmış ajanlara dönüştürmek
(sadece uzmanlaşmanın ölçülebilir fayda sağladığı yerlerde).
