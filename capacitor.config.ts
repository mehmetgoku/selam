import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Mobil kabuk (iOS/Android). Web uygulaması `npm run build:mobile` ile statik olarak `mobile-www/` içine
 * derlenir ve uygulamanın içine gömülür → rehber çevrimdışı açılır. Ortak oda için NEXT_PUBLIC_API_BASE'deki
 * barındırılan sunucu gerekir. Ayrıntı: docs/MOBILE.md
 */
const config: CapacitorConfig = {
  // DEĞİŞTİR: sahibi olduğun alan adının tersi (mağazada bir kez seçilir, sonradan değişmez). "com.example.*" Google Play'de kabul edilmez.
  appId: "app.selam.gezirehberi",
  appName: "Selam",
  webDir: "mobile-www",
  server: {
    androidScheme: "https", // WebView kökeni https://localhost (sunucu CORS_ORIGINS ile eşleşir)
  },
  ios: {
    contentInset: "always",
    scheme: "Selam",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // NativeBridge ilk çizimden sonra gizler
      backgroundColor: "#faf7f2",
      showSpinner: false,
    },
  },
};

export default config;
