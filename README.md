# Selam — Türkiye gezi rehberi

Google Maps'in “mekân listesi”nin ötesinde: şehir bazlı, kategorilere ayrılmış, **neden iyi olduğu yazan** ve
**tek tıkla saat saat gezi planı** çıkaran bir rehber (hedef kitle: 15–40 yaş).

## Neler var (MVP)

- **Şehir rehberleri** (İstanbul, İzmir, Antalya, Gaziantep): Yemek, Kültür & Tarih, Doğa & Manzara, Eğlence, Pub & Bar, Alışveriş.
- **Yemekte alt kategoriler + “şehrin en'leri”**: Kahvaltı, Kebap, Balık, Lokanta, Sokak lezzeti, Meyhane, Tatlı, Kahve… her tür için en iyi 3.
- **“Neden iyi?”**: her mekânda somut gerekçeler, “mutlaka dene”, en iyi zaman, süre.
- **Filtreler**: ortam (öğrenci dostu, romantik, gece hayatı, bütçe dostu…) ve bütçe.
- **Gezi planlayıcı**: gün/tempo/ilgi/bütçeye göre otomatik plan (kahvaltı → gezi → öğle → … → gece; yakınlık + puan
  optimizasyonu, yürüme/seyahat süreleri, yemek saatleri), sonra elle düzenleme. Plan tarayıcıda saklanır.
- **Harita görünümü**: şehir sayfasında Liste/Harita geçişi (filtreler haritaya da uygulanır, işaretçiden plana ekle); planda her günün rotası numaralı duraklar ve çizgiyle haritada. Leaflet + OpenStreetMap, API anahtarı gerekmez (yoğun trafikte kendi tile sağlayıcınıza geçin).
- **Selam skoru**: Bayes düzeltmeli Google + TripAdvisor puanları ile editoryal puanın harmanı (az yorumlu “5.0”
  yerler şişmez). İki kaynak varsa “yerel mi turist mi” göstergesi (`localness`) hesaplanır.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # sıralama, plan, ingest eşleşme testleri
npm run build
```

## Veri: Google Maps & TripAdvisor

Veri **resmi API'lerle** çekilir (scraping kullanılmaz; Google ve TripAdvisor kullanım şartları bunu yasaklar):

```bash
GOOGLE_MAPS_API_KEY=... TRIPADVISOR_API_KEY=... npm run ingest            # tüm şehirler
GOOGLE_MAPS_API_KEY=... npm run ingest -- istanbul                        # tek şehir
```

`scripts/ingest.ts`, `data/cities/*.json` içindeki her mekânı Google Places API (New) ve TripAdvisor Content API ile
eşler (seed koordinatından 1.5 km'den uzak sonuçlar reddedilir) ve `data/signals/<şehir>.json` dosyasına yazar.
Uygulama bu dosyayı otomatik birleştirir; yoksa editoryal puana düşer.

> **Not:** `data/cities/*.json` editoryal seed verisidir (gerekçeler, kategori, tahmini koordinatlar). Koordinatlar ve
> mekân adları ingest ile doğrulanmalı; bazı kayıtlar (örn. “Alsancak köftecileri”) bölge/yemek bazlı genel girdilerdir.
> Google/TripAdvisor şartları puan/yorum verisinin uzun süreli önbelleğini sınırlar ve kaynak atfı ister; üretimde
> `fetchedAt` ile yenileme ve atıf (logo/bağlantı) eklenmelidir. `data/signals/` bu yüzden `.gitignore`'dadır.

## Yapı

```
data/cities/*.json     editoryal seed (şehir + mekân + “neden iyi”)
scripts/ingest.ts      Google Places + TripAdvisor çekici
src/lib/rank.ts        skor (Bayes + editoryal), localness
src/lib/itinerary.ts   otomatik plan + saatlendirme
src/components/        CityExplorer, PlaceCard, Planner
src/app/               Next.js App Router sayfaları
```

## Yol haritası

Hesap + plan paylaşma/ortak plan · “şu an açık” (çalışma saatleri) · hava/mevsim bazlı öneri ·
kullanıcı oyları (“neden iyi” gerekçelerine) · gerçek yürüme/toplu taşıma süreleri · 81 ile genişleme · EN/DE.
