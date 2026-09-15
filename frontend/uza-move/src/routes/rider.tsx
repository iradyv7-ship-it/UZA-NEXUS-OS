import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { useTripRealtime } from "@/hooks/useTripRealtime";
import Map from "@/components/Map";
import { useT } from "@/lib/i18n";
import { rwf } from "@/lib/format";
import { cancellationFee, roadDistanceKm } from "@/lib/pricing";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import {
  quoteTrip,
  requestTrip,
  getTrip,
  requestMomoPayment,
  simulateMomoCallback,
  setTripStatus,
  rateTrip,
  raiseIncident,
} from "@/lib/trips.functions";
import { toast } from "sonner";
import { ShieldCheck, Siren, Star } from "lucide-react";

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "Book a trip — UZA Move" },
      {
        name: "description",
        content:
          "Book a moto or cab on UZA Move. The fare is shown upfront and you pay by MoMo or cash.",
      },
      { property: "og:title", content: "Book a trip — UZA Move" },
      { property: "og:description", content: "Book a moto or cab with an upfront regulated fare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderPage,
});

const KIGALI = { lat: -1.9441, lng: 30.0619 };

function RiderPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const qc = useQueryClient();

  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [picking, setPicking] = useState<"pickup" | "dropoff">("pickup");
  const [vehicle, setVehicle] = useState<"moto" | "cab" | "e_moto">("moto");
  const [tripId, setTripId] = useState<string | null>(null);

  const quoteFn = useServerFn(quoteTrip);
  const requestFn = useServerFn(requestTrip);
  const getTripFn = useServerFn(getTrip);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPickup({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPickup(KIGALI),
      { timeout: 8000 },
    );
  }, []);

  const quote = useQuery({
    queryKey: ["quote", pickup, dropoff, vehicle],
    enabled: Boolean(pickup && dropoff && user),
    queryFn: () => quoteFn({ data: { pickup: pickup!, dropoff: dropoff!, vehicle_type: vehicle } }),
  });

  useTripRealtime({
    enabled: Boolean(tripId),
    watchTripId: tripId,
    onChange: () => void qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });

  const trip = useQuery({
    queryKey: ["trip", tripId],
    enabled: Boolean(tripId),
    refetchInterval: 4000,
    queryFn: () => getTripFn({ data: { id: tripId! } }),
  });

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`rider-trip-${tripId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, qc]);

  const book = useMutation({
    mutationFn: () =>
      requestFn({ data: { pickup: pickup!, dropoff: dropoff!, vehicle_type: vehicle } }),
    onSuccess: (trip) => setTripId(trip.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const active = trip.data?.trip;

  return (
    <AppShell>
      <div className="h-[38vh] w-full overflow-hidden border-b border-border">
        <Map
          center={pickup ?? KIGALI}
          pickup={pickup}
          dropoff={dropoff}
          driver={
            trip.data?.driver?.current_lat != null
              ? { lat: trip.data.driver.current_lat, lng: trip.data.driver.current_lng! }
              : null
          }
          onPick={active ? undefined : (p) => (picking === "pickup" ? setPickup(p) : setDropoff(p))}
        />
      </div>

      <div className="space-y-4 p-4">
        {!active ? (
          <BookingPanel
            t={t}
            picking={picking}
            setPicking={setPicking}
            pickup={pickup}
            dropoff={dropoff}
            vehicle={vehicle}
            setVehicle={setVehicle}
            quote={quote.data}
            loading={quote.isFetching}
            onBook={() => book.mutate()}
            booking={book.isPending}
          />
        ) : (
          <ActiveTrip tripId={tripId!} data={trip.data!} onDone={() => setTripId(null)} />
        )}
        {!active ? (
          <AdSlot placement="rider_home_banner" audience="riders" userId={user?.id ?? null} />
        ) : null}
      </div>
    </AppShell>
  );
}

type QuoteShape = {
  fare: number;
  distanceKm: number;
  durationMin: number;
  commission: number;
  driverEarnings: number;
};

function BookingPanel(props: {
  t: (k: string) => string;
  picking: "pickup" | "dropoff";
  setPicking: (v: "pickup" | "dropoff") => void;
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  vehicle: "moto" | "cab" | "e_moto";
  setVehicle: (v: "moto" | "cab" | "e_moto") => void;
  quote?: QuoteShape | undefined;
  loading: boolean;
  onBook: () => void;
  booking: boolean;
}) {
  const { t } = props;
  return (
    <>
      <h2 className="font-display text-xl font-bold">{t("rider.where")}</h2>

      <div className="grid grid-cols-2 gap-2">
        {(["pickup", "dropoff"] as const).map((k) => (
          <button
            key={k}
            onClick={() => props.setPicking(k)}
            className={`rounded-xl border px-3 py-3 text-left text-xs ${
              props.picking === k ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span className="block font-semibold text-foreground">
              {k === "pickup" ? t("rider.pickup") : t("rider.dropoff")}
            </span>
            <span className="text-muted-foreground">
              {(k === "pickup" ? props.pickup : props.dropoff)
                ? `${(k === "pickup" ? props.pickup : props.dropoff)!.lat.toFixed(4)}, ${(k === "pickup" ? props.pickup : props.dropoff)!.lng.toFixed(4)}`
                : t("rider.pinmap")}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["moto", t("rider.moto")],
            ["e_moto", "E-Moto"],
            ["cab", t("rider.cab")],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => props.setVehicle(v)}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              props.vehicle === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {props.quote ? (
        <div className="card-uza p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-3xl font-bold text-foreground">
              {rwf(props.quote.fare)}
            </span>
            <span className="text-xs text-muted-foreground">
              {props.quote.distanceKm} {t("common.km")} · {props.quote.durationMin}{" "}
              {t("common.min")}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="size-4" /> {t("rider.fixedfare")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {props.loading ? t("common.loading") : t("rider.pinmap")}
        </p>
      )}

      <button
        disabled={!props.quote || props.booking}
        onClick={props.onBook}
        className="w-full rounded-xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground disabled:opacity-50"
      >
        {props.booking ? t("rider.searching") : t("rider.book")}
      </button>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveTrip({ tripId, data, onDone }: { tripId: string; data: any; onDone: () => void }) {
  const { t } = useT();
  const trip = data.trip;
  const driver = data.driver;
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<"mtn" | "airtel">("mtn");
  const [stars, setStars] = useState(0);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const qc = useQueryClient();

  const payFn = useServerFn(requestMomoPayment);
  const simFn = useServerFn(simulateMomoCallback);
  const cancelFn = useServerFn(setTripStatus);
  // Mirror of the server-side policy so the rider always sees the real cost first.
  const pendingFee = cancellationFee({
    vehicleType: trip.vehicle_type,
    status: trip.status,
    acceptedAt: trip.accepted_at,
  });
  const rateFn = useServerFn(rateTrip);
  const sosFn = useServerFn(raiseIncident);

  // Live distance/ETA from the driver's last GPS ping to the next waypoint.
  const live = useMemo(() => {
    if (driver?.current_lat == null || driver?.current_lng == null) return null;
    if (["completed", "cancelled_by_rider", "cancelled_by_driver", "no_show"].includes(trip.status))
      return null;
    const target =
      trip.status === "started"
        ? { lat: trip.dropoff_lat, lng: trip.dropoff_lng }
        : { lat: trip.pickup_lat, lng: trip.pickup_lng };
    const km = roadDistanceKm({ lat: driver.current_lat, lng: driver.current_lng }, target);
    return { km: Math.round(km * 10) / 10, min: Math.max(1, Math.round((km / 22) * 60)) };
  }, [
    driver?.current_lat,
    driver?.current_lng,
    trip.status,
    trip.pickup_lat,
    trip.pickup_lng,
    trip.dropoff_lat,
    trip.dropoff_lng,
  ]);

  const shareUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/rider?share=${trip.share_token}`,
    [trip.share_token],
  );

  const pay = useMutation({
    mutationFn: async () => {
      const res = await payFn({ data: { trip_id: tripId, phone, provider } });
      // Sandbox: stand in for the provider callback so the flow is testable.
      await simFn({ data: { external_ref: res.momo.external_ref, outcome: "successful" } });
      return res;
    },
    onSuccess: () => {
      toast.success(t("driver.paid"));
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel: Record<string, string> = {
    requested: t("rider.searching"),
    accepted: t("rider.driveron"),
    arriving: t("rider.driveron"),
    started: t("rider.ontrip"),
    completed: t("rider.receipt"),
  };

  return (
    <>
      <div className="card-uza p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {statusLabel[trip.status] ?? trip.status}
        </p>
        <p className="mt-1 font-display text-3xl font-bold">
          {rwf(trip.final_fare ?? trip.quoted_fare)}
        </p>
        <p className="text-xs text-muted-foreground">{t("rider.fixedfare")}</p>

        {driver ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-semibold">{driver.profile?.full_name ?? "UZA"}</p>
            <p className="text-xs text-muted-foreground">
              {driver.plate_number} · ★ {driver.rating_avg} · UZA {driver.uza_score}
            </p>
            {live ? (
              <p className="mt-2 text-xs font-semibold text-primary">
                {live.km} km away · about {live.min} min{" "}
                {trip.status === "started" ? "to your drop-off" : "to your pick-up"}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Waiting for the driver's location…
              </p>
            )}
            {driver.profile?.phone ? (
              <a
                href={`tel:${driver.profile.phone}`}
                className="mt-3 block rounded-xl border border-border px-3 py-2 text-center text-sm font-semibold"
              >
                Call driver
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {["accepted", "arriving"].includes(trip.status) && trip.start_pin ? (
        <div className="card-uza bg-accent/10 p-4 text-center">
          <p className="text-xs font-semibold text-muted-foreground">{t("rider.givepin")}</p>
          <p className="font-display text-5xl font-bold tracking-[0.3em] text-foreground">
            {trip.start_pin}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.pinhelp")}</p>
        </div>
      ) : null}

      {trip.status === "completed" && trip.pay_status !== "paid" && trip.pay_method !== "cash" ? (
        <div className="card-uza space-y-3 p-4">
          <p className="text-sm font-semibold">{t("rider.paynow")}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["mtn", "airtel"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  provider === p ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {p === "mtn" ? "MTN MoMo" : "Airtel Money"}
              </button>
            ))}
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="078…"
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
          />
          <button
            disabled={phone.length < 9 || pay.isPending}
            onClick={() => pay.mutate()}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("rider.paymomo")}
          </button>
        </div>
      ) : null}

      {trip.status === "completed" ? <AdSlot placement="post_trip" audience="riders" /> : null}

      {trip.status === "completed" ? (
        <div className="card-uza space-y-3 p-4">
          <p className="text-sm font-semibold">{t("rider.rate")}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setStars(s)}>
                <Star
                  className={`size-7 ${s <= stars ? "fill-accent text-accent" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          <button
            disabled={!stars}
            onClick={async () => {
              await rateFn({ data: { trip_id: tripId, stars } });
              toast.success("Murakoze!");
              onDone();
            }}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("common.save")}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            toast.success(t("rider.share"));
          }}
          className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold"
        >
          {t("rider.share")}
        </button>
        <button
          onClick={async () => {
            const pos = await new Promise<GeolocationPosition | null>((res) =>
              navigator.geolocation
                ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 6000 })
                : res(null),
            );
            await sosFn({
              data: {
                trip_id: tripId,
                kind: "sos",
                description: `Rider SOS during trip ${tripId.slice(0, 8)}`,
                ...(pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {}),
              },
            });
            toast.success("SOS sent to UZA operations with your location.");
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-3 py-3 text-sm font-bold text-destructive-foreground"
        >
          <Siren className="size-4" /> {t("rider.sos")}
        </button>
      </div>

      {["requested", "accepted", "arriving"].includes(trip.status) ? (
        <div className="card-uza space-y-2 p-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {pendingFee > 0
              ? `Your driver is already on the way. Cancelling now costs ${rwf(pendingFee)}, paid to the driver in full.`
              : "Cancelling now is free. A fee only applies once your driver has been travelling to you for two minutes."}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {["Driver is too far", "I no longer need it", "Wrong pick-up point", "Other"].map(
              (r) => (
                <button
                  key={r}
                  onClick={() => setCancelReason(r)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    cancelReason === r ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {r}
                </button>
              ),
            )}
          </div>
          <button
            disabled={!cancelReason || cancelling}
            onClick={async () => {
              setCancelling(true);
              try {
                await cancelFn({
                  data: { trip_id: tripId, status: "cancelled_by_rider", reason: cancelReason },
                });
                toast.success(
                  pendingFee > 0
                    ? `Trip cancelled. ${rwf(pendingFee)} was charged.`
                    : "Trip cancelled. Nothing was charged.",
                );
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              } finally {
                setCancelling(false);
              }
            }}
            className="w-full rounded-xl border border-destructive px-3 py-3 text-sm font-bold text-destructive disabled:opacity-50"
          >
            {t("rider.cancel")}
          </button>
        </div>
      ) : null}

      <a href="tel:112" className="block py-2 text-center text-xs text-muted-foreground underline">
        Emergency services · 112
      </a>
    </>
  );
}
