import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { pingLocation } from "@/lib/identity.functions";

/**
 * Keeps the driver's live position fresh while they are online.
 * Throttled so a cheap phone on weak data sends at most one ping every 12s.
 */
export function useDriverPing(enabled: boolean, intervalMs = 12000) {
  const ping = useServerFn(pingLocation);
  const last = useRef(0);
  const pingRef = useRef(ping);
  pingRef.current = ping;

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - last.current < intervalMs) return;
      last.current = now;
      void pingRef
        .current({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
        .catch(() => {});
    };

    navigator.geolocation.getCurrentPosition(send, () => {}, { timeout: 8000 });
    const watchId = navigator.geolocation.watchPosition(send, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, intervalMs]);
}
