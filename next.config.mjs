const mobile = process.env.MOBILE_BUILD === "1";

/** @type {import('next').NextConfig} */
export default mobile
  ? {
      // Mobil paket: sunucusuz statik dışa aktarım (Capacitor bu klasörü uygulamanın içine gömer).
      // API rotaları (route.ts) pageExtensions dışında bırakılarak pakete alınmaz; mobil uygulama
      // ortak oda için NEXT_PUBLIC_API_BASE'deki barındırılan sunucuyu kullanır.
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
      pageExtensions: ["tsx"],
      distDir: "mobile-www",
    }
  : {};
