import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { savingsForFare as savingsForFarePure } from "./pricing";
import type { SavingsRuleType } from "@/config/policy";

/**
 * Server-only money engine for UZA Move.
 * One wallet per person, shared by trips, charging rewards and loan repayment.
 */

export function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { COMMISSION_BPS } from "@/config/policy";

export async function getOrCreateWallet(db: SupabaseClient, ownerId: string) {
  const { data } = await db.from("wallets").select("*").eq("owner_id", ownerId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await db
    .from("wallets")
    .insert({ owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

type LedgerType = Database["public"]["Enums"]["wallet_tx_type"];

/**
 * Post a ledger row. `delta` moves spendable balance, `savingsDelta` moves the
 * locked savings sub-wallet, `owedDelta` moves the commission the driver owes UZA.
 */
export async function post(
  db: SupabaseClient,
  ownerId: string,
  type: LedgerType,
  amount: number,
  opts: {
    delta?: number;
    savingsDelta?: number;
    owedDelta?: number;
    ref?: string;
    note?: string;
  } = {},
) {
  // Single atomic, row-locked, idempotent statement in Postgres: two callbacks
  // or two tabs racing on the same wallet can never double-credit or drift.
  const { data, error } = await db.rpc("wallet_post", {
    _owner: ownerId,
    _type: type,
    _amount: amount,
    _delta: opts.delta ?? 0,
    _savings_delta: opts.savingsDelta ?? 0,
    _owed_delta: opts.owedDelta ?? 0,
    _ref: opts.ref ?? null,
    _note: opts.note ?? null,
  });
  if (error) throw error;
  return data as { id: string; balance: number; locked_savings: number; commission_owed: number };
}

/** Adapter: DB savings_rules row -> the pure pricing rule shape. */
export function savingsForFare(
  fare: number,
  rule: { rule_type: string; fixed_daily: number; percent: number; round_to: number } | null,
) {
  if (!rule) return savingsForFarePure(fare, null);
  return savingsForFarePure(fare, {
    ruleType: rule.rule_type as SavingsRuleType,
    fixedDaily: Number(rule.fixed_daily),
    percent: Number(rule.percent),
    roundTo: Number(rule.round_to),
  });
}

/** Settle any commission the driver owes UZA out of a fresh MoMo inflow. */
export async function settleOwed(db: SupabaseClient, ownerId: string, ref: string) {
  const wallet = await getOrCreateWallet(db, ownerId);
  const owed = Number(wallet.commission_owed);
  if (owed <= 0) return 0;
  const take = Math.min(owed, Number(wallet.balance));
  if (take <= 0) return 0;
  await post(db, ownerId, "commission_settled", take, {
    delta: -take,
    owedDelta: -take,
    ref,
    note: "Ikigega cya UZA cyishyuwe / commission settled",
  });
  return take;
}

/**
 * Apply the full money flow of a completed trip:
 * gross fare -> 8% commission -> driver wallet -> savings sweep -> owed settlement.
 */
export async function applyTripLedger(
  db: SupabaseClient,
  trip: { id: string; final_fare: number; commission_amount: number; pay_method: string },
  driver: { id: string; user_id: string },
) {
  const fare = Number(trip.final_fare);
  const commission = Number(trip.commission_amount);
  const net = fare - commission;
  const ref = `trip:${trip.id}`;

  if (trip.pay_method === "momo") {
    await post(db, driver.user_id, "trip_credit", fare, {
      delta: fare,
      ref,
      note: "Urugendo (MoMo)",
    });
    await post(db, driver.user_id, "commission", commission, {
      delta: -commission,
      ref,
      note: "Ikigega cya UZA 8%",
    });
  } else {
    // Cash: the driver already holds the full fare, so UZA is owed the 8%.
    await post(db, driver.user_id, "trip_credit", fare, {
      ref,
      note: "Urugendo (amafaranga y'intoki)",
    });
    await post(db, driver.user_id, "commission_owed", commission, {
      owedDelta: commission,
      ref,
      note: "Ikigega cya UZA 8% usigaje kwishyura",
    });
  }

  // Savings sweep into the locked sub-wallet.
  const { data: rule } = await db
    .from("savings_rules")
    .select("*")
    .eq("driver_id", driver.id)
    .maybeSingle();
  let swept = 0;
  if (rule?.active) {
    const want = savingsForFare(fare, rule);
    const wallet = await getOrCreateWallet(db, driver.user_id);
    swept = Math.min(want, Math.max(0, Number(wallet.balance)));
    if (swept > 0) {
      await post(db, driver.user_id, "savings_sweep", swept, {
        delta: -swept,
        savingsDelta: swept,
        ref,
        note: "Ubwizigame",
      });
    }
  }

  let settled = 0;
  if (trip.pay_method === "momo") settled = await settleOwed(db, driver.user_id, ref);

  return { fare, commission, net, swept, settled };
}

/** Pay any due loan installments out of locked savings. */
export async function autoRepayLoan(db: SupabaseClient, driver: { id: string; user_id: string }) {
  const { data: loan } = await db
    .from("loan_accounts")
    .select("*")
    .eq("driver_id", driver.id)
    .eq("status", "active")
    .maybeSingle();
  if (!loan) return { paid: 0 };

  const { data: due } = await db
    .from("loan_installments")
    .select("*")
    .eq("loan_id", loan.id)
    .neq("status", "paid")
    .lte("due_date", new Date().toISOString().slice(0, 10))
    .order("due_date");
  if (!due?.length) return { paid: 0 };

  let wallet = await getOrCreateWallet(db, driver.user_id);
  let paid = 0;
  for (const inst of due) {
    const remaining = Number(inst.amount) - Number(inst.paid_amount);
    const take = Math.min(remaining, Number(wallet.locked_savings));
    if (take <= 0) break;
    wallet = await post(db, driver.user_id, "loan_installment", take, {
      savingsDelta: -take,
      ref: `loan:${loan.id}:${inst.id}`,
      note: "Kwishyura inguzanyo ya UZA Access",
    });
    await db
      .from("loan_installments")
      .update({
        paid_amount: Number(inst.paid_amount) + take,
        status: Number(inst.paid_amount) + take >= Number(inst.amount) ? "paid" : "partial",
        paid_at: new Date().toISOString(),
      })
      .eq("id", inst.id);
    await db
      .from("loan_accounts")
      .update({ outstanding: Math.max(0, Number(loan.outstanding) - take) })
      .eq("id", loan.id);
    paid += take;
  }
  return { paid };
}

/**
 * "Days ahead / days behind" — the single most motivating number in the app.
 * Positive means the driver's locked savings already cover future installments.
 */
export function loanPace(
  loan: { installment_amount: number; installment_period: string } | null,
  lockedSavings: number,
  overdueAmount: number,
) {
  if (!loan) return 0;
  const periodDays =
    loan.installment_period === "monthly" ? 30 : loan.installment_period === "daily" ? 1 : 7;
  const perDay = Number(loan.installment_amount) / periodDays;
  if (perDay <= 0) return 0;
  return Math.round((lockedSavings - overdueAmount) / perDay);
}

/** Recomputes the single UZA reputation number that unlocks better financing. */
export function computeUzaScore(input: {
  completedTrips: number;
  ratingAvg: number;
  savingsStreakDays: number;
  onTimeInstallments: number;
  missedInstallments: number;
  trainingCertified: boolean;
}) {
  let score = 400;
  score += Math.min(150, input.completedTrips * 2);
  score += Math.round((input.ratingAvg - 3) * 60);
  score += Math.min(100, input.savingsStreakDays * 3);
  score += Math.min(150, input.onTimeInstallments * 10);
  score -= input.missedInstallments * 40;
  if (input.trainingCertified) score += 50;
  return Math.max(300, Math.min(900, score));
}

export function makePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * MoMo adapter. Live MTN "Request to Pay" and Airtel collections run as soon as
 * credentials exist; otherwise we simulate the prompt. Either way the app only
 * ever trusts the callback that lands in momo_transactions.
 */
export function momoConfigured(provider?: "mtn" | "airtel") {
  const mtn = Boolean(
    process.env["MTN_MOMO_SUBSCRIPTION_KEY"] &&
    process.env["MTN_MOMO_API_USER"] &&
    process.env["MTN_MOMO_API_KEY"],
  );
  const airtel = Boolean(
    process.env["AIRTEL_MONEY_CLIENT_ID"] && process.env["AIRTEL_MONEY_CLIENT_SECRET"],
  );
  if (provider === "mtn") return mtn;
  if (provider === "airtel") return airtel;
  return mtn || airtel;
}

function callbackUrl() {
  const base = process.env["PUBLIC_SITE_URL"] ?? "";
  return base ? `${base.replace(/\/$/, "")}/api/public/momo/callback` : undefined;
}

/** MSISDN in the form the providers expect: 2507XXXXXXXX, no plus, no spaces. */
function msisdn(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250")) return digits;
  return `250${digits.replace(/^0+/, "")}`;
}

async function mtnRequestToPay(args: { phone: string; amount: number; reference: string }) {
  const base = process.env["MTN_MOMO_BASE_URL"] ?? "https://sandbox.momodeveloper.mtn.com";
  const env = process.env["MTN_MOMO_TARGET_ENV"] ?? "sandbox";
  const sub = process.env["MTN_MOMO_SUBSCRIPTION_KEY"]!;
  const basic = Buffer.from(
    `${process.env["MTN_MOMO_API_USER"]}:${process.env["MTN_MOMO_API_KEY"]}`,
  ).toString("base64");

  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Ocp-Apim-Subscription-Key": sub },
  });
  if (!tokenRes.ok)
    throw new Error(`MTN token failed [${tokenRes.status}]: ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const externalRef = crypto.randomUUID();
  const cb = callbackUrl();
  const res = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Ocp-Apim-Subscription-Key": sub,
      "X-Reference-Id": externalRef,
      "X-Target-Environment": env,
      "Content-Type": "application/json",
      ...(cb ? { "X-Callback-Url": cb } : {}),
    },
    body: JSON.stringify({
      amount: String(Math.round(args.amount)),
      currency: env === "sandbox" ? "EUR" : "RWF",
      externalId: args.reference,
      payer: { partyIdType: "MSISDN", partyId: msisdn(args.phone) },
      payerMessage: "UZA Move trip",
      payeeNote: `Trip ${args.reference}`,
    }),
  });
  if (!res.ok) throw new Error(`MTN request-to-pay failed [${res.status}]: ${await res.text()}`);
  return { externalRef, simulated: false as const };
}

async function airtelRequestToPay(args: { phone: string; amount: number; reference: string }) {
  const base = process.env["AIRTEL_MONEY_BASE_URL"] ?? "https://openapiuat.airtel.africa";
  const tokenRes = await fetch(`${base}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env["AIRTEL_MONEY_CLIENT_ID"],
      client_secret: process.env["AIRTEL_MONEY_CLIENT_SECRET"],
      grant_type: "client_credentials",
    }),
  });
  if (!tokenRes.ok)
    throw new Error(`Airtel token failed [${tokenRes.status}]: ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const externalRef = `AIRTEL-${args.reference}-${Date.now().toString(36)}`;
  const res = await fetch(`${base}/merchant/v1/payments/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Country": "RW",
      "X-Currency": "RWF",
    },
    body: JSON.stringify({
      reference: args.reference,
      subscriber: {
        country: "RW",
        currency: "RWF",
        msisdn: msisdn(args.phone).replace(/^250/, ""),
      },
      transaction: {
        amount: Math.round(args.amount),
        country: "RW",
        currency: "RWF",
        id: externalRef,
      },
    }),
  });
  if (!res.ok) throw new Error(`Airtel payment failed [${res.status}]: ${await res.text()}`);
  return { externalRef, simulated: false as const };
}

export async function requestToPay(args: {
  provider: "mtn" | "airtel";
  phone: string;
  amount: number;
  reference: string;
}) {
  if (!momoConfigured(args.provider)) {
    // Sandbox: the prompt is "sent"; confirmation must still arrive by callback.
    return {
      externalRef: `SIM-${args.reference}-${Date.now().toString(36)}`,
      simulated: true as const,
    };
  }
  return args.provider === "mtn" ? mtnRequestToPay(args) : airtelRequestToPay(args);
}

/** Throws unless the user holds an admin or ops role. Server-side only. */
export async function requireOps(db: SupabaseClient, userId: string) {
  const { data, error } = await db.rpc("is_ops", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ntufite uburenganzira (ops only).");
  return true;
}
