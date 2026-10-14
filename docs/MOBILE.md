# Mobil uygulama (iOS / Android) ve mağaza yayını

## Telefonda hemen kullanım (mağaza gerekmeden)

| Yol | Ne gerekir | Kapsam |
|---|---|---|
| **Tek dosyalık demo** (`npm run build:standalone` → `dist-standalone/index.html`, ~350 KB) | Hiçbir şey: statik bir sayfa olarak her yerde açılır (yayınlanmış özel bağlantı, kendi sunucun, hatta dosya olarak) | Rehber, filtreler, “şu an açık” (24/7 yerler), plan oluşturucu, plan metni/WhatsApp paylaşımı, Google Haritalar'da rota bağlantısı. **Ağ olmadan da çalışır.** Ortak oda, harita, konum, bağlantıyla paylaşım **kapalı** (sunucu/dış kaynak gerektirir) |
| **PWA** (barındırılan Next uygulaması) | Alan adı + barındırma | Tam özellikler; telefonda tarayıcıdan “Ana ekrana ekle” (manifest + simgeler hazır) |
| **Native uygulama** (aşağısı) | Android Studio / Xcode, geliştirici hesapları | Tam özellikler + mağaza |


Mimari: **Capacitor** ile web uygulaması statik olarak paketlenir (`mobile-www/`) ve iOS/Android kabuğunun içine gömülür.
Rehber verisi pakette olduğundan **çevrimdışı açılır**; harita, canlı Google verisi ve **ortak oda** internet ister.

```
npm run build:mobile      # MOBILE_BUILD=1: statik dışa aktarım → mobile-www/ (API rotaları pakete girmez)
npm run mobile:sync       # build:mobile + cap sync (web dosyalarını android/ ve ios/ içine kopyalar)
npm run mobile:android    # sync + Android Studio'yu açar
npm run mobile:ios        # sync + Xcode'u açar (yalnızca macOS)
npm run mobile:assets     # resources/*.png → simgeler + açılış ekranı (iOS/Android)
```

## Durum — ne doğrulandı, ne doğrulanmadı

| | Durum |
|---|---|
| Statik paket (2 MB), tüm şehir/plan sayfaları | ✅ derlendi, farklı kökenden servis edilip tarayıcıda denendi |
| `cap sync` (android + ios) | ✅ çalışıyor |
| Mobil → barındırılan sunucu (ortak oda, CORS) | ✅ ayrı köken + ön kontrol (preflight) ile denendi |
| Yakınımda (konum), paylaşım, kalıcı depolama (web yolları) | ✅ tarayıcıda denendi |
| **Android derleme / APK** | ❌ **bu ortamda yapılamadı** (Android SDK yok) — Android Studio'da ilk derleme sende |
| **iOS derleme / TestFlight** | ❌ **yapılamadı** (macOS/Xcode gerekir) |
| Native eklentiler (Preferences, Share, Geolocation, App, StatusBar, SplashScreen) gerçek cihazda | ❌ denenmedi — kod yolları yazıldı ve tip kontrolünden geçti, cihazda test edilmeli |
| Simge / açılış ekranı | ⚠️ **yer tutucu** ("S" harfi) — gerçek marka tasarımıyla değiştirip `resources/` içinde `mobile:assets` çalıştır |

## Yayın öncesi DEĞİŞTİRİLMESİ gerekenler

1. **`appId`** (`capacitor.config.ts` → şu an `app.selam.gezirehberi`): sahibi olduğun alan adının tersi olmalı; mağazada bir kez seçilir, sonra değişmez. Değiştirirsen `android/app/build.gradle` (`applicationId`, `namespace`), Android paket klasörü ve iOS `PRODUCT_BUNDLE_IDENTIFIER` da değişir (en kolayı: `android/` ve `ios/`'u silip `npx cap add android/ios` ile yeniden üretmek, sonra bu belgedeki manifest/plist eklerini tekrar yapmak).
2. **`YOUR_DOMAIN`** (`android/app/src/main/AndroidManifest.xml`): derin bağlantı alan adı.
3. **Ortam değişkenleri** (derleme zamanında gömülür, `.env.example`):
   - `NEXT_PUBLIC_API_BASE` — barındırılan sunucu (`https://api.…`). Boşsa ortak oda mobilde çalışmaz.
   - `NEXT_PUBLIC_WEB_URL` — paylaşılan bağlantıların kökü (`https://…`). Boşsa `capacitor://localhost` paylaşılır → bozuk bağlantı.
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID` — harita (aşağıya bak).
4. **Sunucu**: `CORS_ORIGINS` varsayılanı `capacitor://localhost,https://localhost,http://localhost` (iOS ve Android WebView kökenleri) — değiştirmen gerekmez; yalnızca farklı bir şema kullanırsan.
5. **Sürüm**: Android `versionCode`/`versionName` (`android/app/build.gradle`), iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` (Xcode). Her mağaza yüklemesinde artır.

## Google Haritalar anahtarı mobilde

Maps JS anahtarı **HTTP referrer** ile kısıtlanır; WebView'ın kökeni `https://localhost` (Android) ve `capacitor://localhost` (iOS) olduğundan bu kökenleri izinli referrer listesine ekle — ya da mobil için **ayrı bir anahtar** üretip yalnızca bunlara kısıtla (önerilen; web anahtarından ayrı bütçe/kota izlenir). Uzun vadede yerel Google Maps SDK eklentisi (`@capacitor/google-maps`) daha sağlam ve hızlıdır; ancak harita/işaretçi/balon kodunun (`src/components/map/`) yeniden yazılmasını gerektirir.

## Derin bağlantılar (davet linki uygulamada açılsın)

`NativeBridge` `appUrlOpen` olayını dinler ve yalnızca `/`, `/sehir/<şehir>`, `/sehir/<şehir>/plan` rotalarına (sorgu parametreleriyle: `?oda=…`) yönlendirir. İşletim sistemi bağlantıyı uygulamaya vermesi için alan adında doğrulama dosyaları yayınlanmalı:

- **Android**: `https://<alan-adı>/.well-known/assetlinks.json` (paket adı + imza sertifikası SHA-256). Manifest'teki `YOUR_DOMAIN`'i doldur.
- **iOS**: `https://<alan-adı>/.well-known/apple-app-site-association` (Team ID + bundle id, yol `/sehir/*`) ve Xcode'da *Associated Domains* → `applinks:<alan-adı>`.

Bu dosyalar olmadan bağlantı tarayıcıda açılır (ortak oda web'de de çalışır) — bozulan bir şey olmaz.

## İmzalama ve yükleme

- **Android**: Android Studio → *Build > Generate Signed Bundle* (AAB). Yükleme anahtarını/keystore'u güvenle yedekle (kaybedersen güncelleme yapılamaz; Play App Signing'i aç). Google Play Console geliştirici hesabı (tek seferlik ücret). Yeni kişisel hesaplarda yayından önce kapalı test koşulu olabilir — güncel kuralı Console'da kontrol et.
- **iOS**: Xcode → *Product > Archive* → App Store Connect/TestFlight. Apple Developer Program (yıllık ücret). `npx cap doctor` hangi Xcode/araç sürümünün gerektiğini söyler.
- Ortak: önce iç test (Play iç test / TestFlight), sonra yayın.

## Mağaza gereklilikleri

- **Apple 4.2 (minimum işlevsellik)**: web sitesini saran uygulamalar reddedilebilir. Bu uygulamada yerel değer katan parçalar: çevrimdışı rehber, konuma göre sıralama, yerel paylaşım menüsü, derin bağlantı, kalıcı yerel depolama. Gönderim notlarında bunları belirt; ileride bildirim ve takvime ekleme güçlü eklemeler olur.
- **Gizlilik politikası (KVKK)** zorunlu: taslak `docs/store/privacy-tr.md` — **hukuki inceleme olmadan yayınlama**.
- **App Privacy / Play Data Safety**: yanıt taslağı `docs/store/listing-tr.md` içinde; Google Haritalar/Places gibi üçüncü taraf SDK'ların veri akışı dahil gözden geçir.
- **Kullanıcı üretimli içerik (Apple 1.2)**: ortak odalarda takma ad ve ortak plan var. Şikâyet/engelleme ve içerik filtresi (ad temizleme dışında) eklenmeli; en azından odadan çıkma/oda silme ve bir iletişim e-postası.
- **Yaş derecesi**: bar/meyhane/alkollü mekân içeriği var → derecelendirme anketinde "alkol referansı" işaretle.
- **Hesap yok** → hesap silme zorunluluğu yok; ileride hesap eklenirse (Apple 5.1.1(v)) uygulama içinden hesap silme gerekir.

## Veri lisansı (özet — ayrıntı `README.md`)

- Google: yalnızca Place ID saklanır; puan/saat canlı ve bellekte (kullanıcı eylemiyle); Google puanı skora girmez. Haritada Google Haritalar kullanılır. Canlı çağrılar faturalanır — bütçe uyarısı kur.
- TripAdvisor: puan/yorum sayısı saklanır (30 gün bayatlık sınırı), kartta bağlantı olarak atıf var; **Content API'nin güncel önbellek süresi ve logo/atıf zorunluluğunu doğrula** (şu an logo yok).
- Yer tutucu simge ve "S" markasını gerçek tasarımla değiştir; mağaza görselleri için telif/marka kontrolü yap.

## Önerilen sıra

1. Alan adı + barındırma (sunucu `data/selam.db` için kalıcı disk — `README.md` "Ortak oda sunucusu") → `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_WEB_URL`.
2. `appId`'yi kesinleştir, `android/` ve `ios/`'u gerekirse yeniden üret; gerçek simge/açılış ekranı.
3. Android Studio'da ilk derleme + gerçek cihazda test (konum izni, paylaşım, geri tuşu, çevrimdışı açılış, ortak oda).
4. macOS'ta Xcode ile iOS derleme + TestFlight.
5. Derin bağlantı dosyaları, gizlilik politikası, mağaza girişleri, iç test → yayın.
