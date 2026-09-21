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

**Konu opsiyoneldir** — `--topic` vermezsen sistem bir editör gibi kendi
ilginç ve daha önce işlenmemiş bir konu seçer (bkz. `topicSelection` adımı).
Böylece "12 sahneli, ilginç bir video yap" gibi bir FORMAT talimatını yanlışlıkla
konu sanıp o talimat hakkında video üretmez — format isteklerini ayrı
bayraklarla ver:

```
npm run produce -- --scenes 12 --production-note "eğlenceli bir tonda olsun"
```

`--production-note`, konuyu değiştirmeden sadece ton/stile yansıtılan ek bir
istektir (dashboard'da "Prodüksiyon notu" alanına karşılık gelir).

Terminalde her adım ilerledikçe log görürsün (konu seçimi → araştırma → brief →
senaryo → sahne planı → içerik incelemesi → müzik seçimi → görseller →
seslendirme → altyazı → montaj → kalite kontrolü).
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
görünür. Bir video şu an sahne sayısına göre yaklaşık **$0.6-1.0** civarında
(maliyetin büyük kısmı görsel üretiminden geliyor). Gerçek harcamayı periyodik
olarak platform.openai.com/usage üzerinden kontrol etmen önerilir — buradaki
tahminler OpenAI'nin token bazlı fiyatlandırmasına dayanan yaklaşık
değerlerdir, kesin fatura değildir.

**Maliyet limiti**: toplam tahmini maliyet `.env`'deki `MAX_COST_PER_VIDEO`
değerini (varsayılan $2.00) aşarsa üretim otomatik durur, tamamlanan adımlar
korunur. Tek seferlik farklı bir limit için:
```
npm run produce -- --topic "konu" --max-cost 5
```

**Ucuz test üretimi**: `--scenes` ile sahne sayısını (dolayısıyla görsel/ses
sayısını ve süreyi) sınırlayarak çok daha düşük maliyetli bir deneme
yapabilirsin — kod değişikliklerini doğrulamak için idealdir:
```
npm run produce -- --topic "test konusu" --scenes 5
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

## Platform bağlama ve yayınlama (Faz 7)

Bitmiş bir videoyu dashboard'dan doğrudan YouTube/Instagram/TikTok'a
yayınlayabilmek için önce her platformda bir "geliştirici uygulaması"
oluşturup Vercel'e birkaç env değişkeni eklemen gerekiyor. Bu tek
seferlik bir kurulum.

### 0. Veritabanını güncelle

[`supabase/schema.sql`](./supabase/schema.sql) dosyasının GÜNCEL içeriğini
kopyala, Supabase Dashboard → **SQL Editor**'e yapıştır, **Run**'a bas.
(`platform_connections` ve `publications` tablolarını ekler, mevcut
tablolara dokunmaz.)

### 1. YouTube

1. [console.cloud.google.com](https://console.cloud.google.com) → üstten
   **Yeni Proje** oluştur (ör. "RemuMedia").
2. Sol menü → **APIs & Services → Library** → "YouTube Data API v3" ara →
   **Enable**.
3. Sol menü → **APIs & Services → OAuth consent screen** → **User Type:
   External** → oluştur. Uygulama adı: "RemuMedia AI", kendi e-postanı gir.
   **Test users** adımında kendi Google hesabını ekle (bu sayede Google'ın
   haftalar süren onay sürecini beklemeden hemen kullanabilirsin).
4. Sol menü → **APIs & Services → Credentials** → **Create Credentials →
   OAuth client ID** → Application type: **Web application**.
   **Authorized redirect URIs**'a şunu ekle:
   `https://<vercel-domain-adresin>/api/auth/youtube/callback`
5. Oluşturulan **Client ID** ve **Client Secret**'ı kopyala.
6. Vercel projenin **Settings → Environment Variables**'a ekle:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 2. Instagram

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps
   → Create App** → tür: **Business**.
2. Uygulama panelinde **Add Product** → **Instagram Graph API** ve
   **Facebook Login** ürünlerini ekle.
3. **Facebook Login → Settings**'te **Valid OAuth Redirect URIs**'a şunu
   ekle: `https://<vercel-domain-adresin>/api/auth/instagram/callback`
4. **App roles → Roles**'ten kendini (ve test edecek kişileri) ekle —
   Meta'nın haftalar süren app review'ünü beklemeden test edebilirsin.
5. Instagram hesabının **Business veya Creator** türünde olduğundan ve bir
   **Facebook Sayfası'na bağlı** olduğundan emin ol (Instagram uygulaması
   → Ayarlar → Hesap türü / Bağlı hesaplar).
6. **App Settings → Basic**'ten **App ID** ve **App Secret**'ı kopyala,
   Vercel'e ekle: `META_APP_ID`, `META_APP_SECRET`.

**Not**: Meta'nın app review'ü onaylanana kadar sadece 4. adımda eklediğin
test kullanıcıları bağlanıp yayınlayabilir — herkese açık kullanım için
review şart (2-4 hafta sürebiliyor).

### 3. TikTok

1. [developers.tiktok.com](https://developers.tiktok.com) → **Manage
   apps → Create an app**.
2. Uygulama panelinde **Add products → Content Posting API**.
3. **Redirect URI**'a şunu ekle:
   `https://<vercel-domain-adresin>/api/auth/tiktok/callback`
4. **Client key** ve **Client secret**'ı kopyala, Vercel'e ekle:
   `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.

**Not**: Uygulaman TikTok'un **audit** sürecinden geçene kadar yayınlar
sadece sana özel (gizli/taslak) olarak paylaşılabilir — herkese açık
paylaşım için audit onayı gerekiyor (~1-2+ hafta). Audit onaylandıktan
sonra Vercel'e `TIKTOK_AUDITED=true` ekle, o andan itibaren yayınlar
herkese açık olur.

**Kapak fotoğrafı sınırlaması**: TikTok'un Content Posting API'si özel bir
görseli kapak olarak yüklemeyi desteklemiyor (sadece videonun içinden bir
kare/zaman damgası seçilebiliyor) — bu yüzden aşağıdaki hook kapağı
sadece YouTube ve Instagram'da kullanılabiliyor, TikTok kendi varsayılan
kare seçimini yapıyor.

### 4. Kapak fotoğrafı

Her video için, ilk (hook) sahnenin görseline o sahnenin anlatım metni
büyük/kalın bir başlık olarak bindirilerek otomatik bir kapak fotoğrafı
üretiliyor (video tamamlandığında `thumbnail` artifact'ı olarak kaydedilir,
dashboard'da video kütüphanesinde de önizleme olarak görünür). Yayınlarken:

- **YouTube**: video yüklendikten sonra bu görsel özel kapak fotoğrafı
  olarak ayarlanır. Bu, YouTube kanalının **telefonla doğrulanmış**
  olmasını gerektiriyor — doğrulanmamış kanallarda video yine de yayınlanır
  ama kapak ayarlama adımı başarısız olur ve bunu bir uyarı olarak görürsün.
- **Instagram**: Reels yayınlanırken bu görsel `cover_url` olarak gönderilir.
- **TikTok**: yukarıdaki nota bak.

### 5. Bağlan ve yayınla

Env değişkenlerini ekledikten sonra Vercel'de projeyi yeniden deploy et
(Settings → Deployments → son deploy → **Redeploy**), sonra dashboard'da
üst menüden **Bağlı Hesaplar**'a gidip her platformu **Bağlan**'a tıklayarak
bağla. Bağlandıktan sonra tamamlanmış her videonun sayfasında platforma
özel **"Yayınla"** butonları görünür.

## Sonraki fazlar

Faz 1-3 tamamlandı: ilk gerçek video, tekrarlanabilir/dayanıklı üretim
(Supabase, maliyet limiti, retry, Ken Burns/crossfade), ve bu minimal
dashboard. Yol haritasının tamamı için `ARCHITECTURE.md`'ye bak — sırada:
ajanlaştırma, süpervizör, analitik/öğrenme döngüsü, çoklu kanal ve en son
Riona AI entegrasyonu.
