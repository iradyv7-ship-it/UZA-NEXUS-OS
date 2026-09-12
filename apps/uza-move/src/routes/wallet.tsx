import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";
import { rwf, shortDate } from "@/lib/format";
import { formatMoney } from "@/lib/pricing";
import { COMMISSION_OWED_LIMIT, COMMISSION_BPS, BPS_DENOMINATOR } from "@/config/policy";
import { EarningsWaterfall } from "@/components/EarningsWaterfall";
import { useSession } from "@/hooks/useSession";
import { getWalletOverview, setSavingsRule, topUpWallet, cashOut, logChargingSession, returnBattery , settleCommission } from "@/lib/wallet.functions";
import { simulateMomoCallback } from "@/lib/trips.functions";
import { toast } from "sonner";
import { Lock, PiggyBank, Zap } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & savings — UZA Move" },
      {
        name: "description",
        content: "One UZA wallet: trip earnings, locked savings, loan pace and charging rewards.",
      },
      { property: "og:title", content: "Wallet & savings — UZA Move" },
      { property: "og:description", content: "One UZA wallet: trip earnings, locked savings, loan pace and charging rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const qc = useQueryClient();

  const overviewFn = useServerFn(getWalletOverview);
  const ruleFn = useServerFn(setSavingsRule);
  const settleFn = useServerFn(settleCommission);
  const topUpFn = useServerFn(topUpWallet);
  const cashOutFn = useServerFn(cashOut);
  const chargeFn = useServerFn(logChargingSession);
  const batteryFn = useServerFn(returnBattery);
  const simFn = useServerFn(simulateMomoCallback);

  const [amount, setAmount] = useState("5000");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  const wallet = useQuery({ queryKey: ["wallet"], enabled: Boolean(user), queryFn: () => overviewFn({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["wallet"] });

  const settle = useMutation({
    mutationFn: () => settleFn({}),
    onSuccess: (res) => {
      toast.success(`Settled ${res.paid.toLocaleString()} RWF`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const topUp = useMutation({
    mutationFn: async () => {
      const res = await topUpFn({ data: { amount: Number(amount), phone, provider: "mtn" } });
      await simFn({ data: { external_ref: res.momo.external_ref, outcome: "successful" } });
    },
    onSuccess: () => {
      toast.success(t("wallet.topup"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const out = useMutation({
    mutationFn: () => cashOutFn({ data: { amount: Number(amount), phone, provider: "mtn" } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("wallet.cashout"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = wallet.data;
  if (!d) return <AppShell title={t("wallet.title")}>{null}</AppShell>;

  return (
    <AppShell title={t("wallet.title")}>
      <div className="space-y-4 p-4">
        <div className="card-uza surface-hero p-5 text-primary-foreground">
          <p className="text-xs opacity-80">{t("wallet.balance")}</p>
          <p className="font-display text-4xl font-bold">{rwf(d.wallet.balance)}</p>
          <p className="mt-2 text-xs opacity-80">{t("wallet.one")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Lock} label={t("wallet.locked")} value={rwf(d.wallet.locked_savings)} />
          <Stat icon={PiggyBank} label={t("wallet.owed")} value={rwf(d.wallet.commission_owed)} />
        </div>

        {Number(d.wallet.commission_owed) > 0 ? (
          <div className="card-uza border-destructive/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              {Number(d.wallet.commission_owed) > COMMISSION_OWED_LIMIT
                ? "You cannot go online until this is settled"
                : "Commission owed from cash trips"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cash trips leave UZA&rsquo;s {(COMMISSION_BPS / BPS_DENOMINATOR) * 100}% in your pocket. Pay it back here to
              keep driving. The limit is {formatMoney(COMMISSION_OWED_LIMIT)}.
            </p>
            <button
              onClick={() => settle.mutate()}
              disabled={settle.isPending}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Settle {rwf(d.wallet.commission_owed)} now
            </button>
          </div>
        ) : null}

        {d.driver ? <EarningsWaterfall /> : null}

        {d.driver ? (
          <div className="card-uza p-4">
            <p className="text-xs font-semibold text-muted-foreground">{t("savings.daysahead")}</p>
            <p className="font-display text-2xl font-bold">{d.pace}</p>
            {d.loan ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("savings.outstanding")}: {rwf(d.loan.outstanding)}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {t("driver.today")}: {rwf(d.stats.earnedToday)} · {t("eco.score")} {d.driver.uza_score}
            </p>
          </div>
        ) : null}

        <div className="card-uza space-y-3 p-4">
          <p className="text-sm font-semibold">MTN MoMo</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl border border-input bg-card px-3 py-3 text-base"
            />
            <input
              value={phone}
              placeholder="078…"
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-3 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={topUp.isPending || phone.length < 9}
              onClick={() => topUp.mutate()}
              className="rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t("wallet.topup")}
            </button>
            <button
              disabled={out.isPending || phone.length < 9}
              onClick={() => out.mutate()}
              className="rounded-xl border border-border px-3 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {t("wallet.cashout")}
            </button>
          </div>
        </div>

        {d.driver ? (
          <>
            <SavingsCard
              rule={d.rule}
              onSave={async (payload) => {
                await ruleFn({ data: payload });
                toast.success(t("common.save"));
                refresh();
              }}
            />

            <div className="card-uza space-y-2 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="size-4 text-accent" /> {t("eco.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("eco.charging")}: {d.eco.kwh.toFixed(1)} kWh
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    const res = await chargeFn({ data: { station_name: "UZA Kigali", kwh: 4, cost: 1200 } });
                    toast.success(`+${rwf(res.reward)}`);
                    refresh();
                  }}
                  className="rounded-xl border border-border px-3 py-3 text-xs font-semibold"
                >
                  {t("eco.charging")}
                </button>
                <button
                  onClick={async () => {
                    await batteryFn({ data: { battery_ref: `BAT-${Date.now().toString().slice(-6)}` } });
                    toast.success(t("eco.battery"));
                    refresh();
                  }}
                  className="rounded-xl border border-border px-3 py-3 text-xs font-semibold"
                >
                  {t("eco.battery")}
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="card-uza p-4">
          <p className="mb-2 text-sm font-semibold">{t("wallet.history")}</p>
          <ul className="divide-y divide-border">
            {d.transactions.slice(0, 20).map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="block font-medium">{tx.note ?? tx.type}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(tx.created_at)}</span>
                </span>
                <span className={Number(tx.amount) < 0 ? "text-destructive" : "text-primary"}>{rwf(tx.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Lock;
  label: string;
  value: string;
}) {
  return (
    <div className="card-uza p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

type RulePayload = { rule_type: "fixed_daily" | "percent_trip" | "round_up" | "none"; fixed_daily: number; percent: number; round_to: number };

function SavingsCard({
  rule,
  onSave,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rule: any;
  onSave: (p: RulePayload) => Promise<void>;
}) {
  const { t } = useT();
  const [state, setState] = useState<RulePayload>({
    rule_type: (rule?.rule_type ?? "round_up") as RulePayload["rule_type"],
    fixed_daily: Number(rule?.fixed_daily ?? 500),
    percent: Number(rule?.percent ?? 5),
    round_to: Number(rule?.round_to ?? 100),
  });

  const options: [RulePayload["rule_type"], string][] = [
    ["fixed_daily", t("savings.fixed")],
    ["percent_trip", t("savings.percent")],
    ["round_up", t("savings.roundup")],
    ["none", t("savings.none")],
  ];

  return (
    <div className="card-uza space-y-3 p-4">
      <p className="text-sm font-semibold">{t("savings.rule")}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setState({ ...state, rule_type: value })}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              state.rule_type === value ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSave(state)}
        className="w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground"
      >
        {t("savings.save")}
      </button>
    </div>
  );
}
