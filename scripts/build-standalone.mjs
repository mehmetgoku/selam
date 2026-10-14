/**
 * Tek dosyalık, sunucusuz sürüm: uygulamayı (React + şehir verisi + CSS) tek bir HTML'e paketler.
 *   node scripts/build-standalone.mjs   →  dist-standalone/index.html
 * Ortak oda, harita, konum ve bağlantı paylaşımı bu sürümde kapalıdır (NEXT_PUBLIC_STANDALONE=1).
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.resolve(import.meta.dirname, "..");
const shim = (f) => path.join(root, "src/standalone/shims", f);

const cityDir = path.join(root, "data/cities");
const citiesJs = `export default [${fs
  .readdirSync(cityDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => fs.readFileSync(path.join(cityDir, f), "utf8").trim())
  .join(",")}];`;

const plugin = {
  name: "selam-standalone",
  setup(b) {
    b.onResolve({ filter: /^virtual:cities$/ }, () => ({ path: "virtual:cities", namespace: "virtual" }));
    b.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({ contents: citiesJs, loader: "js" }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: shim("link.tsx") }));
    b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: shim("dynamic.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: shim("navigation.ts") }));
    b.onResolve({ filter: /(^|\/)MapLoader$/ }, () => ({ path: shim("MapLoader.tsx") }));
  },
};

const js = await build({
  entryPoints: [path.join(root, "src/standalone/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  plugins: [plugin],
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx", paths: { "@/*": [path.join(root, "src/*")] }, baseUrl: root } },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_STANDALONE": '"1"',
    "process.env.NEXT_PUBLIC_API_BASE": '""',
    "process.env.NEXT_PUBLIC_WEB_URL": '""',
    "process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": '""',
    "process.env.NEXT_PUBLIC_GOOGLE_MAP_ID": '""',
    "process.env.SIGNAL_MAX_AGE_DAYS": '"30"',
  },
  logLevel: "warning",
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const cssIn = path.join(root, "src/standalone/styles.css");
const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssIn, "utf8"), { from: cssIn })).css;

const html = `<title>Selam Gezi Rehberi</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
fs.mkdirSync(path.join(root, "dist-standalone"), { recursive: true });
fs.writeFileSync(path.join(root, "dist-standalone/index.html"), html);
console.log(`dist-standalone/index.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(code.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
