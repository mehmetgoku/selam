# Mağaza yayını (App Store / Google Play) — yol haritası ve riskler

Durum: web uygulaması (Next.js) hazır; mobil paketleme **henüz yapılmadı**. Aşağıdakiler yayın öncesi kararlar ve engellerdir.

## 1. Paketleme yaklaşımı

| Seçenek | Artı | Eksi |
|---|---|---|
| **Capacitor** ile mevcut web uygulamasını sarmak (önerilen başlangıç) | Tek kod tabanı, hızlı; push, paylaşım, konum, takvim gibi yerel eklentiler | Saf web sarmalayıcı Apple 4.2 ("minimum işlevsellik") kapsamında reddedilebilir → yerel özellik şart |
| React Native / Expo ile yeniden yazım | En yerel his, çevrimdışı güçlü | Arayüzün yeniden yazılması; `src/lib/*` (sıralama, plan, saatler, ortak işlemler) olduğu gibi paylaşılır |

**Sunucu bağımlılığı:** Ortak oda API'leri (`/api/rooms`) bir sunucu ister; uygulama yayınlanmış bir sunucuya (`https://…`) bağlanmalı, statik `export` olarak tamamen pakete gömülemez. Kalıcı diskli sunucu ya da `src/server/rooms.ts`'in paylaşımlı veritabanına taşınması gerekir (README).

**Mağaza onayı için önerilen yerel özellikler:** çevrimdışı plan/rehber önbelleği, "yakınımda" (konum), plan paylaşım menüsü (yerel share sheet), plan için takvime ekleme, bildirim (ortak odada değişiklik).

## 2. Veri lisansı — YAYIN ÖNCESİ ÇÖZÜLMELİ

- **Google Places verisi (puan, saatler, yorum sayısı) Google dışı haritada gösterilemez.** Google Maps Platform şartları Places içeriğini yalnızca Google Haritası üzerinde (ya da haritasız) göstermeye izin verir. Uygulamamız OpenStreetMap/Leaflet kullanıyor; harita popup'ında Google kaynaklı puan/saat **göstermiyoruz** (yalnızca "Selam skoru" ve editoryal metin), ama kartlarda Google puanı ve saatleri var. Yayın öncesi ya Google Maps SDK/JS'e geçilmeli, ya Google verisi harita katmanından ayrı tutulmalı, ya da hukuki görüş alınmalı.
- **Önbellek:** Google, Place ID dışında verinin uzun süreli saklanmasını kısıtlar. Şu an ingest çıktısı `data/signals/` içinde (repoya girmez). Üretimde TTL ile yenileme ve şartlara uygun saklama tasarlanmalı.
- **TripAdvisor:** Content API'de TripAdvisor logosu/atfı ve ilgili sayfaya bağlantı zorunlu; puanları TripAdvisor puanı olarak etiketlemeden birleştirmek ("Selam skoru") şartlar açısından gözden geçirilmeli.
- **OpenStreetMap karoları (tile.openstreetmap.org)** yoğun/ticari uygulama kullanımına uygun değil; Mapbox/MapTiler vb. sağlayıcıya geçilmeli, OSM atıfı korunmalı.

## 3. Mağaza gereklilikleri

- **Gizlilik politikası** (KVKK uyumlu) ve **App Privacy / Play Data Safety** formları: toplanan veri = ortak odada girilen takma ad, rastgele istemci kimliği, (varsa) konum. Hesap yok → hesap silme zorunluluğu şu an yok; hesap eklenirse zorunlu olur.
- **Kullanıcı üretimli içerik (Apple 1.2):** ortak odalarda takma ad ve paylaşılan plan var. Şikâyet/engelleme mekanizması ve içerik filtresi planlanmalı (şu an ad temizleme dışında yok).
- **Mağaza varlıkları:** simge, ekran görüntüleri, açıklama (TR; mümkünse EN), yaş derecesi (bar/alkol içeriği → yaş sınırı beyanı gerekir).
- **Hesaplar:** Apple Developer Program (yıllık ücretli), Google Play Console (tek seferlik ücret); yeni kişisel Play hesaplarında yayın öncesi kapalı test şartı olabilir — güncel kuralları kontrol edin.

## 4. Önerilen sıra

1. Veri lisansı kararı (Google Maps SDK'ya geçiş **ya da** Google verisini ayırma) ve TripAdvisor atıfı.
2. Barındırma: ortak oda sunucusu için kalıcı depo.
3. Capacitor iskeleti + 2–3 yerel özellik (çevrimdışı, konum, paylaşım).
4. TestFlight / Play iç test → kapalı test → yayın.
