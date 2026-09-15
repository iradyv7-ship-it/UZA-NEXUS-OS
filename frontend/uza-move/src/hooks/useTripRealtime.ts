import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Ask once, quietly. A refused prompt just means we fall back to sound only. */
function ensurePermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") void Notification.requestPermission();
}

function alertUser(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: "uza-trip", renotify: true } as NotificationOptions);
    }
  } catch {
    /* notifications are a bonus, never a requirement */
  }
  try {
    // Short beep, generated in the browser so there is no audio file to download
    // on a weak connection.
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* no audio available */
  }
}

/**
 * Live trip updates over the database socket. This replaces slow polling so a
 * driver hears about a job within the 25-second offer window, and a rider sees
 * "driver accepted" the moment it happens.
 */
export function useTripRealtime(opts: {
  enabled: boolean;
  /** Fires on any relevant trip change; use it to invalidate queries. */
  onChange: () => void;
  /** Driver mode: alert on brand-new ride requests. */
  notifyOnNewRequests?: boolean;
  /** Rider mode: alert when this trip's status changes. */
  watchTripId?: string | null;
}) {
  const { enabled, onChange, notifyOnNewRequests, watchTripId } = opts;
  const cb = useRef(onChange);
  cb.current = onChange;
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    ensurePermission();

    const channel = supabase
      .channel("uza-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload) => {
        const row = payload.new as { id?: string; status?: string } | null;
        cb.current();

        if (notifyOnNewRequests && payload.eventType === "INSERT" && row?.status === "requested") {
          alertUser("New ride request", "A rider nearby is waiting. Open UZA Move to accept.");
        }

        if (
          watchTripId &&
          row?.id === watchTripId &&
          row.status &&
          row.status !== lastStatus.current
        ) {
          const previous = lastStatus.current;
          lastStatus.current = row.status;
          if (previous && row.status === "accepted")
            alertUser("Driver on the way", "Your driver accepted the trip.");
          if (previous && row.status === "arriving")
            alertUser("Your driver has arrived", "Share your Start PIN to begin.");
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, notifyOnNewRequests, watchTripId]);
}
