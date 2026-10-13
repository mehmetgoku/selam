export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Şehir içi tahmini seyahat süresi (dk): kuş uçuşu x1.35 yol katsayısı, ~18 km/s ortalama */
export function travelMinutes(km: number) {
  if (km < 0.4) return Math.max(2, Math.round((km * 1.35 * 60) / 4.5)); // yürüyüş
  return Math.max(5, Math.round(((km * 1.35) / 18) * 60));
}

export function mapsUrl(p: { name: string; lat: number; lng: number; google?: { id?: string } }) {
  const q = encodeURIComponent(p.name);
  return p.google?.id
    ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${p.google.id}`
    : `https://www.google.com/maps/search/?api=1&query=${q}%20${p.lat},${p.lng}`;
}
