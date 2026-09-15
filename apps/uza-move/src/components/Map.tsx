import { useEffect, useRef } from "react";

export type LatLng = { lat: number; lng: number };

type Props = {
  center: LatLng;
  pickup?: LatLng | null | undefined;
  dropoff?: LatLng | null | undefined;
  driver?: LatLng | null | undefined;
  onPick?: ((p: LatLng) => void) | undefined;
  className?: string | undefined;
};

/**
 * Leaflet + OpenStreetMap. Loaded only in the browser and only when rendered,
 * so a cheap Android phone on weak data never downloads it on other screens.
 */
export default function Map({ center, pickup, dropoff, driver, onPick, className }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, { zoomControl: false, attributionControl: false }).setView(
        [center.lat, center.lng],
        13,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(m);
      m.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      setTimeout(() => m.invalidateSize(), 120);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();

      const dot = (color: string, label: string) =>
        L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 4px rgba(255,255,255,.85);display:block"></span><span style="background:#fff;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:600">${label}</span></div>`,
          iconAnchor: [7, 7],
        });

      const pts: [number, number][] = [];
      if (pickup) {
        L.marker([pickup.lat, pickup.lng], { icon: dot("#1f7a4d", "A") }).addTo(layer.current);
        pts.push([pickup.lat, pickup.lng]);
      }
      if (dropoff) {
        L.marker([dropoff.lat, dropoff.lng], { icon: dot("#c9962c", "B") }).addTo(layer.current);
        pts.push([dropoff.lat, dropoff.lng]);
      }
      if (driver) {
        L.marker([driver.lat, driver.lng], { icon: dot("#1c1c1c", "•") }).addTo(layer.current);
        pts.push([driver.lat, driver.lng]);
      }
      if (pickup && dropoff) {
        L.polyline(
          [
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ],
          { color: "#1f7a4d", weight: 4, opacity: 0.7, dashArray: "6 8" },
        ).addTo(layer.current);
      }
      if (pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length === 1) map.current.setView(pts[0], 15);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, driver]);

  return <div ref={el} className={className ?? "h-full w-full"} />;
}
