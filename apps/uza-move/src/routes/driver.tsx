import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AdSlot } from "@/components/AdSlot";
import { EarningsWaterfall } from "@/components/EarningsWaterfall";
import { DocUpload } from "@/components/DocUpload";
import { useT } from "@/lib/i18n";
import { rwf } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import { useTripRealtime } from "@/hooks/useTripRealtime";
import { useDriverPing } from "@/hooks/useDriverPing";
import { supabase } from "@/integrations/supabase/client";
import { getMe, setOnline, submitDriverKyc, chooseRole } from "@/lib/identity.functions";
import { listOpenTrips, acceptTrip, startTrip, completeTrip, getTrip, setTripStatus } from "@/lib/trips.functions";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Navigation } from "lucide-react";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Driver — UZA Move" },
      {
        name: "description",
        content: "Driver home on UZA Move: trips, earnings, you keep 92%, and MoMo payments verified in-app.",
      },
      { property: "og:title", content: "Driver — UZA Move" },
      { property: "og:description", content: "Driver home: trips, earnings, verified MoMo payments, 92% kept." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const qc = useQueryClient();

  const meFn = useServerFn(getMe);
  const openFn = useServerFn(listOpenTrips);
  const onlineFn = useServerFn(setOnline);
  const acceptFn = useServerFn(acceptTrip);
  const getTripFn = useServerFn(getTrip);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  const me = useQuery({ queryKey: ["me"], enabled: Boolean(user), queryFn: () => meFn({}) });
  const driver = me.data?.driver;

  // Live GPS: the rider sees the driver move as soon as they are online.
  useDriverPing(Boolean(driver?.is_online));

  // Push-style alerts: the driver is told about a job even while the phone is idle.
  useTripRealtime({
    enabled: Boolean(driver?.is_online),
    notifyOnNewRequests: true,
    onChange: () => {
      void qc.invalidateQueries({ queryKey: ["open-trips"] });
      void qc.invalidateQueries({ queryKey: ["trip"] });
    },
  });

  const open = useQuery({
    queryKey: ["open-trips"],
    enabled: Boolean(driver?.is_online),
    refetchInterval: 6000,
    queryFn: () => openFn({}),
  });

  const active = useQuery({
    queryKey: ["trip", activeId],
    enabled: Boolean(activeId),
    refetchInterval: 5000,
    queryFn: () => getTripFn({ data: { id: activeId! } }),
  });

  useEffect(() => {
    if (!driver?.is_online) return;
    const channel = supabase
      .channel("driver-open-trips")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trips" }, () =>
        qc.invalidateQueries({ queryKey: ["open-trips"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver?.is_online, qc]);

  const toggle = useMutation({
    mutationFn: async (online: boolean) => {
      const pos = await new Promise<GeolocationPosition | null>((res) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 6000 })
          : res(null),
      );
      return onlineFn({
        data: {
          online,
          ...(pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {}),
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  if (me.isLoading) return <AppShell>{null}</AppShell>;

  if (!driver || !driver.national_id) return <KycForm userId={user?.id ?? ""} onDone={() => qc.invalidateQueries({ queryKey: ["me"] })} />;

  if (driver.status !== "approved") {
    return (
      <AppShell>
        <div className="card-uza m-4 flex gap-3 p-4">
          <Clock className="mt-0.5 size-5 text-accent" />
          <div>
            <p className="font-semibold">{driver.status === "pending" ? "Turi gusuzuma umwirondoro wawe." : t("driver.notpaid")}</p>
            <p className="text-xs text-muted-foreground">{driver.plate_number} · {driver.vehicle_type}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <button
          onClick={() => toggle.mutate(!driver.is_online)}
          className={`w-full rounded-2xl px-4 py-5 text-lg font-bold ${
            driver.is_online ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
          }`}
        >
          {driver.is_online ? t("driver.online") : t("driver.offline")}
        </button>

        <div className="card-uza p-4">
          <p className="text-xs font-semibold text-muted-foreground">{t("eco.score")}</p>
          <p className="font-display text-2xl font-bold">{driver.uza_score}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ★ {driver.rating_avg} · {driver.plate_number}
          </p>
        </div>

        <EarningsWaterfall />

        {activeId && active.data?.trip ? (
          <ActiveJob data={active.data} onDone={() => setActiveId(null)} />
        ) : driver.is_online ? (
          <>
            <h2 className="font-display text-lg font-bold">{t("driver.newtrip")}</h2>
            {(open.data ?? []).length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{t("driver.idle")}</p>
                <AdSlot placement="driver_idle" audience="drivers" userId={user?.id ?? null} />
              </>
            ) : null}
            {(open.data ?? []).map((trip) => (
              <div
                key={trip.id}
                className={`card-uza space-y-2 p-4 ${trip.is_offered_to_me ? "ring-2 ring-primary" : ""}`}
              >
                {trip.is_offered_to_me ? (
                  <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    Offered to you first — you are closest
                  </span>
                ) : null}
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold">{rwf(trip.driver_earnings ?? 0)}</span>
                  <span className="text-xs text-muted-foreground">{t("driver.youearn")}</span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {trip.distance_km} {t("common.km")} · {trip.duration_min} {t("common.min")}
                  {trip.pickup_distance_km != null ? ` · ${trip.pickup_distance_km} km ${t("rider.pickup")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("driver.commission")}: {rwf(trip.commission_amount ?? 0)} · {t("driver.keeps")}
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await acceptFn({ data: { trip_id: trip.id } });
                      setActiveId(res.id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                      qc.invalidateQueries({ queryKey: ["open-trips"] });
                    }
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
                >
                  {t("driver.accept")}
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveJob({ data, onDone }: { data: any; onDone: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const trip = data.trip;
  const [pin, setPin] = useState("");

  const startFn = useServerFn(startTrip);
  const endFn = useServerFn(completeTrip);
  const statusFn = useServerFn(setTripStatus);

  const paid = trip.pay_status === "paid" || trip.pay_status === "cash_collected";

  return (
    <div className="card-uza space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl font-bold">{rwf(trip.driver_earnings ?? 0)}</span>
        <span className="text-xs text-muted-foreground">{t("driver.youearn")}</span>
      </div>

      <a
        href={
          trip.status === "started"
            ? `https://www.google.com/maps/dir/?api=1&destination=${trip.dropoff_lat},${trip.dropoff_lng}`
            : `https://www.google.com/maps/dir/?api=1&destination=${trip.pickup_lat},${trip.pickup_lng}`
        }
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
      >
        <Navigation className="size-4" />
        {trip.status === "started" ? "Navigate to drop-off" : "Navigate to pick-up"}
      </a>

      {trip.status === "accepted" ? (
        <button
          onClick={async () => {
            await statusFn({ data: { trip_id: trip.id, status: "arriving" } });
            qc.invalidateQueries({ queryKey: ["trip", trip.id] });
          }}
          className="w-full rounded-xl border border-border px-4 py-3 font-semibold"
        >
          {t("driver.arrived")}
        </button>
      ) : null}

      {["accepted", "arriving"].includes(trip.status) ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("driver.enterpin")}</p>
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-center font-display text-3xl tracking-[0.4em]"
          />
          <button
            disabled={pin.length !== 4}
            onClick={async () => {
              const res = await startFn({ data: { trip_id: trip.id, pin } });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              qc.invalidateQueries({ queryKey: ["trip", trip.id] });
            }}
            className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {t("driver.startrip")}
          </button>
        </div>
      ) : null}

      {trip.status === "started" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={async () => {
              await endFn({ data: { trip_id: trip.id, pay_method: "cash" } });
              qc.invalidateQueries({ queryKey: ["trip", trip.id] });
              qc.invalidateQueries({ queryKey: ["wallet"] });
            }}
            className="rounded-xl border border-border px-3 py-3 text-sm font-semibold"
          >
            {t("driver.cashcollected")}
          </button>
          <button
            onClick={async () => {
              await endFn({ data: { trip_id: trip.id, pay_method: "momo" } });
              qc.invalidateQueries({ queryKey: ["trip", trip.id] });
            }}
            className="rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground"
          >
            {t("rider.paymomo")}
          </button>
        </div>
      ) : null}

      {["accepted", "arriving"].includes(trip.status) ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <button
            onClick={async () => {
              try {
                await statusFn({ data: { trip_id: trip.id, status: "no_show", reason: "Rider did not show up" } });
                toast.success("Reported as a no-show.");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              }
            }}
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
          >
            Rider no-show
          </button>
          <button
            onClick={async () => {
              try {
                await statusFn({ data: { trip_id: trip.id, status: "cancelled_by_driver", reason: "Driver cancelled" } });
                toast.success("Trip cancelled.");
                onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              }
            }}
            className="rounded-xl border border-destructive px-3 py-2 text-xs font-semibold text-destructive"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : null}

      {trip.status === "completed" ? (
        <>
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${
              paid ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
            }`}
          >
            {paid ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
            {paid ? t("driver.paid") : t("driver.waitmomo")}
          </div>
          <p className="text-xs text-muted-foreground">{t("driver.scamwarn")}</p>
          <button onClick={onDone} className="w-full py-2 text-sm underline text-muted-foreground">
            {t("common.close")}
          </button>
        </>
      ) : null}
    </div>
  );
}

function KycForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { t } = useT();
  const roleFn = useServerFn(chooseRole);
  const kycFn = useServerFn(submitDriverKyc);
  const [form, setForm] = useState({
    national_id: "",
    licence_number: "",
    vehicle_type: "moto" as "moto" | "cab" | "e_moto" | "delivery",
    plate_number: "",
    insurance_expiry: "",
    id_photo_url: "",
    licence_photo_url: "",
    insurance_photo_url: "",
    vehicle_photo_url: "",
    photo_url: "",
  });
  const [busy, setBusy] = useState(false);

  const missing = !form.id_photo_url || !form.licence_photo_url || !form.insurance_photo_url || !form.vehicle_photo_url;

  return (
    <AppShell title={t("nav.driver")}>
      <form
        className="space-y-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing) {
            toast.error("Please add the ID, licence, insurance and vehicle photos.");
            return;
          }
          setBusy(true);
          try {
            await roleFn({ data: { role: "driver" } });
            await kycFn({ data: form });
            toast.success("Documents sent for review.");
            onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text label="National ID number" value={form.national_id} onChange={(v) => setForm({ ...form, national_id: v })} />
        <Text label="Driving licence number" value={form.licence_number} onChange={(v) => setForm({ ...form, licence_number: v })} required={false} />
        <Text label="Plate number" value={form.plate_number} onChange={(v) => setForm({ ...form, plate_number: v })} />
        <div className="grid grid-cols-4 gap-2">
          {(["moto", "e_moto", "cab", "delivery"] as const).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setForm({ ...form, vehicle_type: v })}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                form.vehicle_type === v ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <p className="pt-2 text-sm font-bold">Documents</p>
        <p className="-mt-2 text-xs text-muted-foreground">
          Photos stay private — only you and the UZA review team can open them.
        </p>
        <DocUpload label="National ID photo" userId={userId} slot="id" value={form.id_photo_url} onChange={(p) => setForm({ ...form, id_photo_url: p })} />
        <DocUpload label="Driving licence photo" userId={userId} slot="licence" value={form.licence_photo_url} onChange={(p) => setForm({ ...form, licence_photo_url: p })} />
        <DocUpload label="Insurance certificate" userId={userId} slot="insurance" value={form.insurance_photo_url} onChange={(p) => setForm({ ...form, insurance_photo_url: p })} />
        <DocUpload label="Vehicle photo (plate visible)" userId={userId} slot="vehicle" value={form.vehicle_photo_url} onChange={(p) => setForm({ ...form, vehicle_photo_url: p })} />
        <DocUpload label="Your photo" hint="A clear face photo riders will see" userId={userId} slot="portrait" value={form.photo_url} onChange={(p) => setForm({ ...form, photo_url: p })} />

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Insurance expiry</span>
          <input
            type="date"
            value={form.insurance_expiry}
            onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
          />
        </label>

        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : t("common.continue")}
        </button>
      </form>
    </AppShell>
  );
}


function Text({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
      />
    </label>
  );
}
