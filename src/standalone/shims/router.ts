import { useSyncExternalStore } from "react";

/** Bellek içi mini yönlendirici (tek dosyalık sürüm; çerçeve içinde history/URL'ye güvenilmez). */
let path = "/";
const subs = new Set<() => void>();
const stack: string[] = [];

export const getPath = () => path;
export function navigate(p: string) {
  const next = p.replace(/[?#].*$/, "") || "/";
  if (next === path) return;
  stack.push(path);
  path = next;
  subs.forEach((f) => f());
  try {
    window.scrollTo(0, 0);
  } catch {}
}
export function back() {
  const prev = stack.pop();
  if (prev !== undefined) {
    path = prev;
    subs.forEach((f) => f());
  }
}
export const canGoBack = () => stack.length > 0;
export const usePath = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getPath,
    getPath,
  );
