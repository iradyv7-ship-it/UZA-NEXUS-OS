import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { serveAd, recordAdClick } from "@/lib/ads.functions";

type Slot = "rider_home_banner" | "post_trip" | "receipt" | "driver_idle";

type Ad = Awaited<ReturnType<typeof serveAd>>;

/**
 * A single ad slot. Fails silently and renders nothing when no campaign is
 * eligible, so the core product never depends on ads being present.
 */
export function AdSlot({
  placement,
  audience,
  userId,
}: {
  placement: Slot;
  audience: "riders" | "drivers";
  userId?: string | null;
}) {
  const serve = useServerFn(serveAd);
  const click = useServerFn(recordAdClick);
  const [ad, setAd] = useState<Ad>(null);

  useEffect(() => {
    let alive = true;
    serve({ data: { placement, audience, userId: userId ?? null } })
      .then((res) => {
        if (alive) setAd(res);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [placement, audience, userId, serve]);

  if (!ad) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void click({
          data: { campaignId: ad.campaignId, creativeId: ad.creativeId, placement, userId: userId ?? null },
        }).catch(() => undefined);
        if (ad.destinationUrl) window.open(ad.destinationUrl, "_blank", "noopener,noreferrer");
      }}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {ad.sponsored ? "Icyemezo giterwa inkunga" : "Kwamamaza"}
        </span>
        {ad.ctaLabel ? <span className="text-xs font-semibold text-primary">{ad.ctaLabel}</span> : null}
      </div>
      <p className="mt-1 font-semibold text-foreground">{ad.headline}</p>
      {ad.body ? <p className="text-sm text-muted-foreground">{ad.body}</p> : null}
    </button>
  );
}
