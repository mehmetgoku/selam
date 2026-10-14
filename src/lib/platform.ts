import { Capacitor } from "@capacitor/core";

/** Capacitor (iOS/Android) içinde mi çalışıyoruz? Web'de her zaman false. */
export const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

/**
 * Sunucu API tabanı. Web'de boş (aynı kök); mobil pakette barındırılan sunucu (NEXT_PUBLIC_API_BASE).
 * Mobil paket statik olduğundan ortak oda (/api/rooms) bu sunucuya gider.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_BASE}${path}`;

/** Paylaşılan bağlantıların kökü: mobilde uygulamanın kendi adresi (capacitor://localhost) paylaşılamaz, gerçek web adresi kullanılır. */
export const webOrigin = () =>
  (process.env.NEXT_PUBLIC_WEB_URL ?? "").replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");

/**
 * Kalıcı anahtar-değer deposu. Native'de Preferences (iOS WKWebView `localStorage`'ı bellek baskısında silebilir),
 * web'de localStorage. Hata durumunda sessizce null/yok sayar.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isNative()) {
        const { Preferences } = await import("@capacitor/preferences");
        return (await Preferences.get({ key })).value;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isNative()) {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
};

/** Konumu yalnızca cihazda kullanırız (sıralama/mesafe); sunucuya gönderilmez. */
export async function getPosition(): Promise<{ lat: number; lng: number }> {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Konum desteklenmiyor"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.message || "Konum alınamadı")),
      { timeout: 10_000 },
    );
  });
}

/** Yerel paylaşım menüsü (native) → Web Share → panoya kopyala. Dönüş: "shared" | "copied". */
export async function shareLink(opts: { title: string; text?: string; url: string }): Promise<"shared" | "copied"> {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
    return "shared";
  }
  if (typeof navigator.share === "function") {
    await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
    return "shared";
  }
  await navigator.clipboard.writeText(opts.url);
  return "copied";
}
