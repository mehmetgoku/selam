"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isNative } from "@/lib/platform";

/**
 * Yalnızca native uygulamada çalışır (web'de hiçbir şey yapmaz):
 *  - açılışta açılış ekranını kapatır, durum çubuğunu ayarlar
 *  - Android geri tuşu: önce uygulama içinde geri, ana ekranda çıkış
 *  - derin bağlantı (Universal/App Links): https://<alan-adı>/sehir/x/plan?oda=… → uygulamada aynı sayfa
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;
    const cleanups: (() => void)[] = [];
    let cancelled = false;

    (async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);
      if (cancelled) return;
      StatusBar.setStyle({ style: Style.Light }).catch(() => {}); // açık arka plan → koyu simgeler
      SplashScreen.hide().catch(() => {});

      const link = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          // yalnızca uygulama içi rotalara izin ver (rastgele yola yönlendirme yok)
          if (/^\/(sehir\/[a-z0-9-]+(\/plan)?)?\/?$/.test(u.pathname)) router.push(u.pathname + u.search);
        } catch {}
      });
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      cleanups.push(() => link.remove(), () => back.remove());
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((f) => f());
    };
  }, [router]);

  return null;
}
