import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getEarningsStatement } from "@/lib/wallet.functions";
import { formatMoney } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { shortDate, shortTime } from "@/lib/format";
import { ArrowDownRight, Banknote, PiggyBank, Receipt, Target } from "lucide-react";

type Period = "today" | "week" | "month";

/**
 * The driver's payout statement. Never a single opaque number: gross fare ->
 * 8% commission -> loan deduction -> savings deduction -> net to MoMo.
 * Deduction lines are absent (not zeroed) when the driver has no financing.
 */
export function EarningsWaterfall() {
  const { t } = useT();
  const fn = useServerFn(getEarningsStatement);
  const [period, setPeriod] = useState<Period>("today");

  const q = useQuery({
    queryKey: ["earnings-statement"],
    queryFn: () => fn({}),
    refetchInterval: 30_000,
  });
  const data = q.data;

  const p = useMemo(() => data?.periods[period] ?? null, [data, period]);

  if (q.isLoading) {
    return <div className="card-uza m-4 h-48 animate-pulse bg-muted/40" aria-hidden />;
  }
  if (!data || !p) return null;

  const net = p.net;

  return (
    <section className="space-y-4">
      <div className="card-uza p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("earn.title")}</h2>
          <div className="flex rounded-full border border-border p-0.5">
            {(["today", "week", "month"] as Period[]).map((k) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t(`earn.${k}`)}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("earn.net")}</p>
        <p className="font-display text-4xl font-bold tabular-nums">{formatMoney(net)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {p.trips} {t("earn.trips")}
        </p>

        <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          <Row icon={Banknote} label={t("earn.gross")} value={p.gross} />
          <Row icon={ArrowDownRight} label={t("earn.commission")} value={-p.commission} negative />
          {data.financing ? (
            <Row
              icon={Receipt}
              label={t("earn.loan")}
              value={-data.financing.paid_last_30_days}
              negative
              sub={t("earn.loan30")}
            />
          ) : null}
          {p.savings > 0 || data.savingsRule ? (
            <Row icon={PiggyBank} label={t("earn.savings")} value={-p.savings} negative />
          ) : null}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-bold">{t("earn.net")}</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{formatMoney(net)}</dd>
          </div>
        </dl>

        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
          {t("driver.keeps")} · {t("earn.adpending")}
        </p>
      </div>

      {data.financing ? (
        <div className="card-uza p-4">
          <p className="text-xs font-semibold text-muted-foreground">{t("savings.loan")}</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatMoney(data.financing.outstanding)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("savings.next")}: {formatMoney(data.financing.installment_amount)} ·{" "}
            {data.financing.installment_period}
          </p>
        </div>
      ) : null}

      <div className="card-uza p-4">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <p className="text-sm font-bold">{t("earn.save2own")}</p>
        </div>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums">
          {formatMoney(data.save2own.locked)}
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${data.save2own.progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {data.save2own.progress}% {t("earn.save2owntarget")} {formatMoney(data.save2own.target)}
        </p>
      </div>

      <div className="card-uza p-4">
        <p className="text-sm font-bold">{t("earn.pertrip")}</p>
        {data.rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("earn.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.rows.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{r.to ?? t("earn.trip")}</span>
                  <span className="font-display text-sm font-bold tabular-nums">
                    {formatMoney(r.net)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {shortDate(r.completed_at)} {shortTime(r.completed_at)} · {t("earn.gross")}{" "}
                  {formatMoney(r.gross)} · {t("earn.commission")} −{formatMoney(r.commission)}
                  {r.savings > 0 ? ` · ${t("earn.savings")} −${formatMoney(r.savings)}` : ""} ·{" "}
                  {r.pay_method === "cash" ? t("rider.paycash") : t("rider.paymomo")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  negative,
  sub,
}: {
  icon: typeof Banknote;
  label: string;
  value: number;
  negative?: boolean;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span>
          {label}
          {sub ? <span className="block text-[11px]">{sub}</span> : null}
        </span>
      </dt>
      <dd
        className={`tabular-nums font-semibold ${negative ? "text-destructive" : "text-foreground"}`}
      >
        {negative ? "−" : ""}
        {formatMoney(Math.abs(value))}
      </dd>
    </div>
  );
}
