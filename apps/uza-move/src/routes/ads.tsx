import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { rwf } from "@/lib/format";
import { getAdvertiserDashboard, createAdvertiser, createCampaign, setCampaignStatus } from "@/lib/ads.functions";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/ads")({
  head: () => ({
    meta: [
      { title: "Advertise on UZA Move" },
      {
        name: "description",
        content:
          "Advertise your business to UZA riders and drivers: choose placement, timing and budget.",
      },
      { property: "og:title", content: "Advertise on UZA Move" },
      { property: "og:description", content: "Self-serve advertising to UZA riders and drivers across Rwanda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdsPage,
});

const PLACEMENTS = [
  { id: "rider_home_banner", label: "Ahabanza h'umugenzi" },
  { id: "post_trip", label: "Nyuma y'urugendo" },
  { id: "receipt", label: "Ku nyemezabwishyu" },
  { id: "driver_idle", label: "Umushoferi ategereje" },
] as const;

function AdsPage() {
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const qc = useQueryClient();

  const dashFn = useServerFn(getAdvertiserDashboard);
  const signUpFn = useServerFn(createAdvertiser);
  const campaignFn = useServerFn(createCampaign);
  const statusFn = useServerFn(setCampaignStatus);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  const dash = useQuery({ queryKey: ["ads"], enabled: Boolean(user), queryFn: () => dashFn({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ads"] });

  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const register = useMutation({
    mutationFn: () => signUpFn({ data: { company_name: company, contact_phone: contact } }),
    onSuccess: () => {
      toast.success("Konti y'ubucuruzi yafunguwe");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    name: "",
    placement: "rider_home_banner" as (typeof PLACEMENTS)[number]["id"],
    audience: "riders" as "riders" | "drivers" | "both",
    hour_start: "6",
    hour_end: "21",
    budget: "50000",
    bill_model: "cpm" as "cpm" | "cpc",
    cpm: "3000",
    cpc: "150",
    headline: "",
    body: "",
    cta_label: "Reba",
    destination_url: "",
  });

  const launch = useMutation({
    mutationFn: () =>
      campaignFn({
        data: {
          name: form.name,
          placement: form.placement,
          audience: form.audience,
          hour_start: Number(form.hour_start),
          hour_end: Number(form.hour_end),
          budget: Number(form.budget),
          bill_model: form.bill_model,
          cpm: Number(form.cpm),
          cpc: Number(form.cpc),
          headline: form.headline,
          body: form.body || undefined,
          cta_label: form.cta_label || undefined,
          destination_url: form.destination_url || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Kwamamaza kwoherejwe gusuzumwa");
      setForm({ ...form, name: "", headline: "", body: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { campaignId: string; status: "running" | "paused" }) => statusFn({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  if (dash.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Turimo gufungura…</p>
      </AppShell>
    );
  }

  if (!dash.data?.advertiser) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Megaphone className="h-7 w-7 text-primary" />
          <h1 className="mt-2 text-lg font-bold">Amamaza kuri UZA</h1>
          <p className="text-sm text-muted-foreground">
            Gera ku bagenzi n'abashoferi ku giciro gito. Wishyura ukurikije abareba (CPM) cyangwa abakanda (CPC).
          </p>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Izina ry'ubucuruzi"
            className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Telefone (07…)"
            inputMode="tel"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
          <button
            disabled={company.length < 2 || contact.length < 9 || register.isPending}
            onClick={() => register.mutate()}
            className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Fungura konti
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-lg font-bold">{dash.data.advertiser.company_name}</h1>
        <p className="text-sm text-muted-foreground">
          Amafaranga asigaye: {rwf(Number(dash.data.advertiser.balance))}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Kwamamaza gushya</h2>
        <div className="space-y-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Izina rya campaign"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
          <input
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="Umutwe (uzagaragara)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
          <input
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Ubutumwa bugufi"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
          <input
            value={form.destination_url}
            onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
            placeholder="https://… (aho bajya bakanze)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value as typeof form.placement })}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              {PLACEMENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as typeof form.audience })}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="riders">Abagenzi</option>
              <option value="drivers">Abashoferi</option>
              <option value="both">Bombi</option>
            </select>
            <Num label="Isaha itangira" value={form.hour_start} onChange={(v) => setForm({ ...form, hour_start: v })} />
            <Num label="Isaha irangira" value={form.hour_end} onChange={(v) => setForm({ ...form, hour_end: v })} />
            <Num label="Ingengo y'imari (RWF)" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} />
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Uburyo bwo kwishyura</span>
              <select
                value={form.bill_model}
                onChange={(e) => setForm({ ...form, bill_model: e.target.value as "cpm" | "cpc" })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="cpm">CPM (abareba 1000)</option>
                <option value="cpc">CPC (bakanda)</option>
              </select>
            </label>
            <Num label="CPM (RWF)" value={form.cpm} onChange={(v) => setForm({ ...form, cpm: v })} />
            <Num label="CPC (RWF)" value={form.cpc} onChange={(v) => setForm({ ...form, cpc: v })} />
          </div>

          <button
            disabled={form.name.length < 2 || form.headline.length < 2 || launch.isPending}
            onClick={() => launch.mutate()}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Ohereza gusuzumwa
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">Campaigns zawe</h2>
        {dash.data.campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.status} · {c.impressions} bareba · {c.clicks} bakanze · {rwf(Number(c.spent))} /{" "}
                {rwf(Number(c.budget))}
              </p>
            </div>
            {(c.status === "running" || c.status === "paused" || c.status === "approved") && (
              <button
                onClick={() =>
                  toggle.mutate({ campaignId: c.id, status: c.status === "running" ? "paused" : "running" })
                }
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              >
                {c.status === "running" ? "Hagarika" : "Tangira"}
              </button>
            )}
          </div>
        ))}
        {!dash.data.campaigns.length && <p className="py-3 text-sm text-muted-foreground">Nta campaign irahaba.</p>}
      </section>
    </AppShell>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
