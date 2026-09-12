import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { rwf, shortDate } from "@/lib/format";
import {
  opsOverview,
  setDriverStatus,
  saveTariff,
  resolveIncident,
  forceCancelTrip,
} from "@/lib/ops.functions";
import { getDriverDocs } from "@/lib/identity.functions";
import { toast } from "sonner";
import { ShieldCheck, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Ops console — UZA Move" },
      {
        name: "description",
        content:
          "Kwemeza abashoferi, gucunga ibiciro bya RURA, gukurikirana ingendo n'ibibazo byatanzwe.",
      },
      { property: "og:title", content: "Ops console — UZA Move" },
      {
        property: "og:description",
        content: "Driver approval, RURA tariffs, live trips and incident handling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpsPage,
});

function OpsPage() {
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const qc = useQueryClient();

  const overviewFn = useServerFn(opsOverview);
  const driverFn = useServerFn(setDriverStatus);
  const tariffFn = useServerFn(saveTariff);
  const incidentFn = useServerFn(resolveIncident);
  const cancelFn = useServerFn(forceCancelTrip);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  const data = useQuery({
    queryKey: ["ops"],
    enabled: Boolean(user),
    retry: false,
    queryFn: () => overviewFn({}),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ops"] });

  const forceCancel = useMutation({
    mutationFn: (tripId: string) => cancelFn({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Trip closed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (v: { driverId: string; status: "approved" | "suspended" | "rejected" }) =>
      driverFn({ data: v }),
    onSuccess: () => {
      toast.success("Byahinduwe");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: (incidentId: string) => incidentFn({ data: { incidentId } }),
    onSuccess: () => {
      toast.success("Ikibazo gifunze");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data.isError) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">Ops only</p>
          <p className="text-sm text-muted-foreground">
            Iyi paje ni iy'abakozi ba UZA bafite uburenganzira.
          </p>
        </div>
      </AppShell>
    );
  }

  const s = data.data?.stats;

  return (
    <AppShell>
      <h1 className="text-xl font-bold">Ops console</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Abashoferi bategereje" value={String(s?.pendingDrivers ?? 0)} />
        <Stat label="Bari online" value={String(s?.onlineDrivers ?? 0)} />
        <Stat label="Ingendo zikomeje" value={String(s?.liveTrips ?? 0)} />
        <Stat label="Ikigega (8%)" value={rwf(s?.commissionRecent ?? 0)} />
      </div>

      <Section title="Kwemeza abashoferi">
        {(data.data?.drivers ?? []).slice(0, 20).map((d) => (
          <div key={d.id} className="border-b border-border py-3 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {d.plate_number ?? "—"} · {d.vehicle_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.status} · UZA {d.uza_score} · {d.national_id ?? "nta ID"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {d.status !== "approved" && (
                  <button
                    onClick={() => approve.mutate({ driverId: d.id, status: "approved" })}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Emeza
                  </button>
                )}
                {d.status !== "suspended" && (
                  <button
                    onClick={() => approve.mutate({ driverId: d.id, status: "suspended" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    Hagarika
                  </button>
                )}
              </div>
            </div>
            <DriverDocs driverId={d.id} />
          </div>
        ))}

        {!(data.data?.drivers ?? []).length && <Empty />}
      </Section>

      <Section title="Ibiciro (RURA)">
        {(data.data?.tariffs ?? []).map((t) => (
          <TariffRow
            key={t.id}
            tariff={t}
            onSave={async (patch) => {
              await tariffFn({ data: patch });
              toast.success("Igiciro cyabitswe");
              refresh();
            }}
          />
        ))}
      </Section>

      <Section title="Ibibazo (SOS / raporo)">
        {(data.data?.incidents ?? []).map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <TriangleAlert className="h-4 w-4 text-destructive" /> {i.kind}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {i.description ?? "—"} · {shortDate(i.created_at)}
              </p>
            </div>
            <button
              onClick={() => close.mutate(i.id)}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
            >
              Funga
            </button>
          </div>
        ))}
        {!(data.data?.incidents ?? []).length && <Empty />}
      </Section>

      <Section title="Ingendo za vuba">
        {(data.data?.trips ?? []).slice(0, 15).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">{rwf(Number(t.final_fare ?? t.quoted_fare))}</p>
              <p className="text-xs text-muted-foreground">
                {t.vehicle_type} · {t.status} · {t.pay_method ?? "—"} / {t.pay_status}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{shortDate(t.created_at)}</span>
              {["requested", "accepted", "arriving", "started"].includes(t.status) && (
                <button
                  onClick={() => forceCancel.mutate(t.id)}
                  disabled={forceCancel.isPending}
                  className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive"
                >
                  Force cancel
                </button>
              )}
            </div>
          </div>
        ))}
        {!(data.data?.trips ?? []).length && <Empty />}
      </Section>
    </AppShell>
  );
}

function TariffRow({
  tariff,
  onSave,
}: {
  tariff: {
    id: string;
    vehicle_type: string;
    base_fare: number;
    per_km: number;
    per_minute: number;
    min_fare: number;
    waiting_per_minute: number;
    surge_enabled: boolean;
  };
  onSave: (patch: {
    id: string;
    base_fare: number;
    per_km: number;
    per_minute: number;
    min_fare: number;
    waiting_per_minute: number;
    surge_enabled: boolean;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    base_fare: String(tariff.base_fare),
    per_km: String(tariff.per_km),
    per_minute: String(tariff.per_minute),
    min_fare: String(tariff.min_fare),
    waiting_per_minute: String(tariff.waiting_per_minute),
    surge_enabled: tariff.surge_enabled,
  });

  const field = (key: keyof typeof form, label: string) => (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );

  return (
    <div className="border-b border-border py-3 last:border-0">
      <p className="mb-2 text-sm font-semibold uppercase">{tariff.vehicle_type}</p>
      <div className="grid grid-cols-3 gap-2">
        {field("base_fare", "Base")}
        {field("per_km", "/km")}
        {field("per_minute", "/min")}
        {field("min_fare", "Min")}
        {field("waiting_per_minute", "Gutegereza")}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.surge_enabled}
            onChange={(e) => setForm({ ...form, surge_enabled: e.target.checked })}
          />
          Surge (ntabwo ikoreshwa)
        </label>
        <button
          onClick={() =>
            void onSave({
              id: tariff.id,
              base_fare: Number(form.base_fare),
              per_km: Number(form.per_km),
              per_minute: Number(form.per_minute),
              min_fare: Number(form.min_fare),
              waiting_per_minute: Number(form.waiting_per_minute),
              surge_enabled: form.surge_enabled,
            })
          }
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Bika
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-3 text-sm text-muted-foreground">Nta kintu kirimo.</p>;
}

/** Signed, short-lived links so ops can actually inspect the driver's papers. */
function DriverDocs({ driverId }: { driverId: string }) {
  const docsFn = useServerFn(getDriverDocs);
  const [open, setOpen] = useState(false);
  const docs = useQuery({
    queryKey: ["driver-docs", driverId],
    enabled: open,
    queryFn: () => docsFn({ data: { driver_id: driverId } }),
  });

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold underline text-muted-foreground"
      >
        {open ? "Hide documents" : "Review documents"}
      </button>
      {open ? (
        docs.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
        ) : (docs.data?.docs ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(docs.data?.docs ?? []).map((doc) => (
              <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={doc.url}
                  alt={doc.label}
                  loading="lazy"
                  className="h-20 w-full rounded-lg object-cover"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">{doc.label}</span>
              </a>
            ))}
            {docs.data?.insurance_expiry ? (
              <p className="col-span-3 text-[11px] text-muted-foreground">
                Insurance expires {docs.data.insurance_expiry}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
