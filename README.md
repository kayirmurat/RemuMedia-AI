# RemuMedia AI

AI-native bir medya üretim hattının Faz 1'i: bir konu ver, sistem araştırma
yapsın, senaryo yazsın, sahne görselleri ve seslendirme üretsin, hepsini
birleştirip **gerçek bir `.mp4` video dosyası** üretsin.

Mimari kararların gerekçesi için bkz. [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Kurulum

1. Bağımlılıkları kur:
   ```
   npm install
   ```
2. `.env.example` dosyasını `.env` olarak kopyala ve kendi OpenAI API anahtarını gir:
   ```
   cp .env.example .env
   ```
   `OPENAI_API_KEY` değerini platform.openai.com/api-keys adresinden alıp `.env`
   dosyasına yapıştır. Bu anahtarı asla bir sohbete veya git'e commit etme.

## Çalıştırma

Yeni bir video üretmek için:

```
npm run produce -- --topic "Konunu buraya yaz"
```

Terminalde her adım ilerledikçe log görürsün (araştırma → brief → senaryo →
sahne planı → görseller → seslendirme → altyazı → montaj → kalite kontrolü).
Sonunda toplam tahmini maliyet ve final video dosyasının yolu yazdırılır
(örn. `storage/<workflow-id>-final.mp4`).

Bir adım hata verirse workflow durur ve sana bir `workflow-id` verir. Aynı
üretime kaldığı yerden devam etmek için:

```
npm run produce -- --id <workflow-id>
```

(Zaten tamamlanmış adımlar tekrar çalıştırılmaz, para/zaman kaybı olmaz.)

## Üretilen dosyalar nerede?

**Supabase ayarlanmadıysa (varsayılan):**
- `storage/` — üretilen görseller, ses dosyaları ve final video (git'e girmez)
- `data/` — her üretimin durumu ve artifact kayıtları, JSON olarak (git'e girmez)

**Supabase ayarlandıysa** (bkz. aşağıdaki "Supabase kurulumu"): workflow/artifact
durumu Supabase Postgres'te (`workflows`, `artifacts` tabloları), üretilen
dosyalar Supabase Storage'da (`remumedia` bucket'ı) tutulur. Final video yine
de terminaldeki özette yerel bir dosya yolu olarak gösterilir (render sırasında
oraya yazılır, sonra Supabase'e de yüklenir).

## Supabase kurulumu (opsiyonel — Faz 2)

Bu adım olmadan da sistem tam çalışır (yerel JSON + yerel disk kullanır).
Supabase eklemek, üretimleri kalıcı bir veritabanında/bulut depoda tutmak
içindir.

1. supabase.com'da bir proje oluştur.
2. **Project Settings > Data API** (veya **API Keys**) sayfasından **Project URL**
   ve **secret key** (service_role) değerlerini al.
3. `.env` dosyana ekle:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
4. [`supabase/schema.sql`](./supabase/schema.sql) dosyasının içeriğini kopyala,
   Supabase Dashboard'da **SQL Editor**'e yapıştır, **Run**'a bas. (`workflows`
   ve `artifacts` tablolarını oluşturur.)
5. Storage bucket'ı (`remumedia`) elle oluşturmana gerek yok — program ilk
   çalıştığında yoksa otomatik oluşturur.

Bu iki değer `.env`'de dolu olduğu sürece program otomatik olarak Supabase'i
kullanır; boşsa sessizce yerel moda döner.

## Maliyet

Her adımın tahmini maliyeti (OpenAI fiyatlandırmasına göre yaklaşık) workflow
JSON'ında (`data/workflows/<id>.json`) ve çalışma sonundaki özet çıktısında
görünür. Bir video şu an yaklaşık birkaç on sent civarında (sahne sayısına göre
değişir).

**Maliyet limiti**: toplam tahmini maliyet `.env`'deki `MAX_COST_PER_VIDEO`
değerini (varsayılan $2.00) aşarsa üretim otomatik durur, tamamlanan adımlar
korunur. Tek seferlik farklı bir limit için:
```
npm run produce -- --topic "konu" --max-cost 5
```

## Dashboard kurulumu (Faz 3)

`dashboard/` klasöründe ayrı bir Next.js uygulaması var: konuları/üretimleri
görmeni, senaryo+sahne planını incelemeni, geri bildirim verip yeniden
yazdırmanı, üretimi devam ettirmeni ve final videoyu onaylamanı sağlar.

### 1. GitHub Personal Access Token oluştur

Dashboard'daki "Yeni Video Üret" butonu, gerçek üretimi GitHub Actions
üzerinde tetikler (Vercel'in istek süresi bir videonun 10-20 dakikasını
karşılayamıyor). Bunun için:

1. github.com → sağ üstteki profil fotoğrafı → **Settings** → en alttaki
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
   → **Generate new token**.
2. **Repository access**: "Only select repositories" → `remumedia-ai` seç.
3. **Permissions** → **Repository permissions** → **Actions**: **Read and write**
   yap.
4. Oluştur, verilen token'ı (bir daha gösterilmez) kopyala — bu `GITHUB_PAT`
   değeri olacak.

### 2. GitHub repo secrets'ı ekle

GitHub'da `remumedia-ai` reposu → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret** ile şu üçünü ekle (değerleri kendi
`.env` dosyandan kopyala):
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

(Bunlar GitHub Actions runner'ının `npm run produce`'u çalıştırabilmesi için
gerekli — dashboard'un kendi env değişkenlerinden ayrı bir yerdir.)

### 3. Vercel'e deploy et

1. vercel.com → **Add New... → Project** → `remumedia-ai` reposunu seç.
2. **Root Directory** alanını `dashboard` olarak ayarla (kritik — bunu
   atlarsan build başarısız olur).
3. **Environment Variables** bölümüne ekle:
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Supabase kurulumundaki aynı değerler)
   - `GITHUB_PAT` (1. adımda aldığın token)
   - `DASHBOARD_PASSWORD` (opsiyonel — dashboard'a girerken istenecek şifre;
     boş bırakırsan dashboard herkese açık olur)
4. **Deploy**'a bas. Birkaç dakika içinde bir URL verecek.

Bu URL'i açtığında (şifre koyduysan önce login ekranı) konu üretimlerini
görebilir, yeni video başlatabilir, senaryo+sahne planını inceleyip
onaylayabilir/geri bildirimle yeniden yazdırabilirsin.

## Sonraki fazlar

Faz 1-3 tamamlandı: ilk gerçek video, tekrarlanabilir/dayanıklı üretim
(Supabase, maliyet limiti, retry, Ken Burns/crossfade), ve bu minimal
dashboard. Yol haritasının tamamı için `ARCHITECTURE.md`'ye bak — sırada:
ajanlaştırma, süpervizör, analitik/öğrenme döngüsü, çoklu kanal ve en son
Riona AI entegrasyonu.
