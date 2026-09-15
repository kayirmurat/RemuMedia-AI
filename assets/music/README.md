# Arka plan müziği kütüphanesi

Bu klasöre telifsiz (royalty-free) mp3 dosyaları koy ve `manifest.json`'a
ekle. Sistem her video için `manifest.json`'daki ruh hali (mood)
etiketlerine bakıp senaryoya en uygun parçayı otomatik seçer.

`manifest.json` formatı:

```json
[
  {
    "id": "upbeat-1",
    "filename": "upbeat-1.mp3",
    "moods": ["neşeli", "enerjik", "eğlenceli"],
    "license": "Pixabay License (telifsiz, atıf gerekmez)",
    "source": "https://pixabay.com/music/..."
  }
]
```

- `id`: benzersiz bir kısa isim.
- `filename`: bu klasördeki dosya adı.
- `moods`: Türkçe, birkaç kelimelik ruh hali/tür etiketi (ör. "gizemli",
  "duygusal", "maceracı", "sakin/bilgilendirici").
- `license`/`source`: hangi kaynaktan alındığı, telif notu (kayıt amaçlı).

Manifest boşsa (`[]`) sistem müziksiz devam eder, hiçbir hata vermez.

**Nereden ücretsiz/telifsiz parça bulabilirsin**: YouTube Audio
Kütüphanesi (studio.youtube.com → Ses kütüphanesi) veya Pixabay Music
(pixabay.com/music) — ikisi de ticari kullanım için ücretsiz. Birkaç
farklı ruh halinden (neşeli, gizemli, duygusal, sakin/bilgilendirici,
maceracı) 1-2 dakikalık kısa parçalar yeterli.
