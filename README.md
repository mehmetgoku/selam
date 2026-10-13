# Selam — Türkiye gezi rehberi

Google Maps'in “mekân listesi”nin ötesinde: şehir bazlı, kategorilere ayrılmış, **neden iyi olduğu yazan** ve
**tek tıkla saat saat gezi planı** çıkaran bir rehber (hedef kitle: 15–40 yaş).

## Neler var (MVP)

- **Şehir rehberleri** (İstanbul, İzmir, Antalya, Gaziantep, Kapadokya, Bodrum, Trabzon): Yemek, Kültür & Tarih, Doğa & Manzara, Eğlence, Pub & Bar, Alışveriş.
- **Yemekte alt kategoriler + “şehrin en'leri”**: Kahvaltı, Kebap, Balık, Lokanta, Sokak lezzeti, Meyhane, Tatlı, Kahve… her tür için en iyi 3.
- **“Neden iyi?”**: her mekânda somut gerekçeler, “mutlaka dene”, en iyi zaman, süre.
- **Filtreler**: ortam (öğrenci dostu, romantik, gece hayatı, bütçe dostu…) ve bütçe.
- **Gezi planlayıcı**: gün/tempo/ilgi/bütçeye göre otomatik plan (kahvaltı → gezi → öğle → … → gece; yakınlık + puan
  optimizasyonu, yürüme/seyahat süreleri, yemek saatleri), sonra elle düzenleme. Plan tarayıcıda saklanır. Gün batımı yerleri kendi dilimine (≥17:30) konur, gündoğumu deneyimleri (balon) otomatik plana girmez, tam gün aktiviteler (tekne turu, Ihlara) sabahı kaplar ve o günün öğle yemeğini atlar; plan 02:00'yi aşmaz.
- **Harita görünümü**: şehir sayfasında Liste/Harita geçişi (filtreler haritaya da uygulanır, işaretçiden plana ekle); planda her günün rotası numaralı duraklar ve çizgiyle haritada. Leaflet + OpenStreetMap, API anahtarı gerekmez (yoğun trafikte kendi tile sağlayıcınıza geçin).
- **“Şu an açık”**: kartlarda canlı durum (İstanbul saatiyle: açık/yakında kapanıyor/kapalı + açılış zamanı), listede “Şu an açık”
  filtresi, haritada kapalı mekânlar soluk. Planda gün seçince (ya da “Başlangıç günü”) kapalı mekânlar otomatik plana
  alınmaz, elle eklenenlerde ⚠ uyarısı çıkar. Saatler Google Places'ten `npm run ingest` ile gelir; **saati bilinmeyen
  mekân “bilinmiyor” sayılır, tahmin edilmez** (yalnız sahil/köprü/cadde gibi açık alanlar seed'de `"hours": "24/7"`).
- **Plan paylaşma**: plan bağlantının içine gömülür (hesap/sunucu yok, ~300 karakter); alıcı “Bu planı kullan” ile kendi planına alır
  (mevcut planı sessizce ezmez). WhatsApp için saatli metin özeti de hazırlanır. Gelen bağlantı güvenilmez sayılır:
  bilinmeyen mekân/slot atılır, boyut sınırlıdır. Bağlantı anlık görüntüdür; canlı ortak düzenleme sunucu gerektirir (yol haritasında).
- **Arkadaşlarla ortak planlama**: “Ortak oda aç” ile plan bir odaya taşınır; davet bağlantısını açan herkes (hesapsız, sadece ad girerek)
  aynı planı **canlı** düzenler (2 sn'de bir senkron), mekânlara 👍 oy verir, kimlerin odada olduğunu ve son hareketleri görür.
  Değişiklikler tüm planı değil küçük **işlemler** (ekle/çıkar/taşı/oy…) olarak sunucuda sırayla uygulanır; iki kişi aynı anda
  farklı mekân eklerse ikisi de kalır. Sunucu her girdiyi doğrular (şekil, mekân kimliği, boyut sınırı, ad temizliği).
- **Selam skoru**: Bayes düzeltmeli Google + TripAdvisor puanları ile editoryal puanın harmanı (az yorumlu “5.0”
  yerler şişmez). İki kaynak varsa “yerel mi turist mi” göstergesi (`localness`) hesaplanır.

> **Mağaza yayını:** bkz. [`docs/MOBILE.md`](docs/MOBILE.md) — özellikle Google Places verisinin Google dışı haritada gösterilemeyeceği lisans kısıtı yayın öncesi çözülmelidir.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # sıralama, plan, ingest eşleşme testleri
npm run build
```

## Ortak oda sunucusu

Odalar `data/selam.db` (SQLite, Node'un yerleşik `node:sqlite`'ı — deneysel uyarı verir) dosyasında tutulur; yol `SELAM_DB` ile değişir.
Bu, **tek sunuculu/kalıcı diskli** kurulum (VM, Fly.io, Railway…) içindir. Vercel gibi sunucusuz/salt-okunur diskli ortamlarda
çalışmaz: `src/server/rooms.ts` içindeki depoyu paylaşımlı bir veritabanıyla (Postgres/Redis) değiştirin; mantık (`src/lib/collab.ts`) aynı kalır.
Güvenlik modeli “bağlantı = yetki”dir (oda kimliği 72 bit rastgele); oda 120 gün hareketsiz kalınca silinir, saatte en fazla 500 oda açılır.
Hesap/kimlik doğrulama yoktur — kötüye kullanım gerekirse IP bazlı hız sınırı ve oda sahibi/salt-okunur bağlantı eklenmelidir.

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

Hesaplar · oda sahibi/salt-okunur bağlantı · ortak aday havuzu (öner → oyla → plana al) · SSE ile anlık senkron · resmî tatil / özel gün saatleri · hava/mevsim bazlı öneri ·
kullanıcı oyları (“neden iyi” gerekçelerine) · gerçek yürüme/toplu taşıma süreleri · 81 ile genişleme · EN/DE.
