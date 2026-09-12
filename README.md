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

- `storage/` — üretilen görseller, ses dosyaları ve final video (git'e girmez)
- `data/` — her üretimin durumu ve artifact kayıtları, JSON olarak (git'e girmez)

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

## Sonraki fazlar

Bu sadece Faz 1 (ilk gerçek video). Yol haritasının tamamı için
`ARCHITECTURE.md` içindeki "Sonraki adım" bölümüne bak — sırayla: tekrarlanabilir
üretim (Supabase'e geçiş), minimal arayüz, ajanlaştırma, süpervizör, analitik/
öğrenme döngüsü, çoklu kanal ve en son Riona AI entegrasyonu.
