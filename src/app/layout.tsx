import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NativeBridge } from "@/components/NativeBridge";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // çentikli ekranlarda tam ekran; güvenli alanlar CSS ile
  themeColor: "#faf7f2",
};

export const metadata: Metadata = {
  title: "Selam — Türkiye gezi rehberi",
  description: "Şehre göre kürasyonlu mekânlar, 'neden iyi?' açıklamaları ve tek tıkla gezi planı.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Selam", statusBarStyle: "default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <NativeBridge />
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-brand">
              Selam<span className="text-ink"> · Türkiye</span>
            </Link>
            <span className="text-xs text-stone-500 hidden sm:block">Mekân listesi değil, karar rehberi</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
