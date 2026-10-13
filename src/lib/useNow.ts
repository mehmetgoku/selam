"use client";
import { useEffect, useState } from "react";
import { istanbulNow, type Now } from "./hours";

/** İstanbul saatiyle şimdi; SSR'de null (hidrasyon uyuşmazlığı olmasın), dakikada bir güncellenir. */
export function useNow(): Now | null {
  const [now, setNow] = useState<Now | null>(null);
  useEffect(() => {
    setNow(istanbulNow());
    const id = setInterval(() => setNow(istanbulNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
