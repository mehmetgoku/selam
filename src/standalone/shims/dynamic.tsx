import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

/** next/dynamic yerine React.lazy (tek dosyada yükleyici hemen çözülür). */
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  opts?: { loading?: () => ReactNode },
) {
  const L = lazy(async () => {
    const m = await loader();
    return { default: ("default" in (m as object) ? (m as { default: ComponentType<P> }).default : m) as ComponentType<P> };
  });
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <L {...(props as object as P)} />
      </Suspense>
    );
  };
}
