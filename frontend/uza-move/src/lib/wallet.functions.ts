import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Wallet, savings, loan pace and ecosystem rewards — one screen's worth of truth. */
export const getWalletOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, getOrCreateWallet, loanPace, computeUzaScore } = await import("./uza.server");
    const db = admin();
    const uid = context.userId;
    const wallet = await getOrCreateWallet(db, uid);

    const { data: transactions } = await db
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: driver } = await db.from("drivers").select("*").eq("user_id", uid).maybeSingle();
    if (!driver) {
      return {
        wallet,
        transactions: transactions ?? [],
        driver: null as never,
        rule: null as never,
        loan: null as never,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        installments: [] as any[],
        pace: 0,
        overdue: 0,
        eco: null as never,
        stats: { completedTrips: 0, earnedToday: 0 },
      };
    }

    const [
      { data: rule },
      { data: loan },
      { data: charging },
      { data: training },
      { data: parts },
      { data: batteries },
      { data: trips },
    ] = await Promise.all([
      db.from("savings_rules").select("*").eq("driver_id", driver.id).maybeSingle(),
      db
        .from("loan_accounts")
        .select("*")
        .eq("driver_id", driver.id)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("charging_sessions")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false })
        .limit(10),
      db.from("training_records").select("*").eq("driver_id", driver.id),
      db.from("parts_redemptions").select("*").eq("driver_id", driver.id).limit(10),
      db.from("battery_returns").select("*").eq("driver_id", driver.id).limit(10),
      db
        .from("trips")
        .select("id, completed_at, driver_earnings, status")
        .eq("driver_id", driver.id)
        .eq("status", "completed"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let installments: any[] = [];
    let overdue = 0;
    if (loan) {
      const { data: rows } = await db
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("due_date")
        .limit(12);
      installments = rows ?? [];
      const today = new Date().toISOString().slice(0, 10);
      overdue = (rows ?? [])
        .filter((i) => i.status !== "paid" && String(i.due_date) <= today)
        .reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
    }

    const pace = loanPace(loan, Number(wallet.locked_savings), overdue);
    const onTime = installments.filter((i) => i.status === "paid").length;

    const score = computeUzaScore({
      completedTrips: trips?.length ?? 0,
      ratingAvg: Number(driver.rating_avg),
      savingsStreakDays: Math.min(30, Math.floor(Number(wallet.locked_savings) / 2000)),
      onTimeInstallments: onTime,
      missedInstallments: overdue > 0 ? 1 : 0,
      trainingCertified: driver.training_certified,
    });
    if (score !== driver.uza_score)
      await db.from("drivers").update({ uza_score: score }).eq("id", driver.id);

    const todayKey = new Date().toISOString().slice(0, 10);
    const earnedToday = (trips ?? [])
      .filter((t) => String(t.completed_at ?? "").slice(0, 10) === todayKey)
      .reduce((s, t) => s + Number(t.driver_earnings ?? 0), 0);

    return {
      wallet,
      transactions: transactions ?? [],
      driver: { ...driver, uza_score: score },
      rule,
      loan,
      installments,
      pace,
      overdue,
      eco: {
        charging: charging ?? [],
        training: training ?? [],
        parts: parts ?? [],
        batteries: batteries ?? [],
        kwh: (charging ?? []).reduce((s, c) => s + Number(c.kwh), 0),
      },
      stats: { completedTrips: trips?.length ?? 0, earnedToday },
    };
  });

export const setSavingsRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rule_type: z.enum(["fixed_daily", "percent_trip", "round_up", "none"]),
        fixed_daily: z.number().min(0).max(100000),
        percent: z.number().min(0).max(50),
        round_to: z.number().min(50).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Nta mwirondoro w'umushoferi.");
    await db.from("savings_rules").upsert(
      {
        driver_id: driver.id,
        ...data,
        active: data.rule_type !== "none",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    return { ok: true };
  });

export const topUpWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().min(100).max(1000000),
        phone: z.string().min(9).max(15),
        provider: z.enum(["mtn", "airtel"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requestToPay } = await import("./uza.server");
    const db = admin();
    const { externalRef, simulated } = await requestToPay({
      provider: data.provider,
      phone: data.phone,
      amount: data.amount,
      reference: `topup-${context.userId.slice(0, 6)}`,
    });
    const { data: momo, error } = await db
      .from("momo_transactions")
      .insert({
        provider: data.provider,
        direction: "collection",
        phone: data.phone,
        amount: data.amount,
        external_ref: externalRef,
        initiated_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { momo, simulated };
  });

/** Cash out to MoMo, minus any commission still owed. Never blocks a shift. */
export const cashOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().min(500).max(1000000),
        phone: z.string().min(9).max(15),
        provider: z.enum(["mtn", "airtel"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, getOrCreateWallet, settleOwed, post, requestToPay } =
      await import("./uza.server");
    const db = admin();
    await settleOwed(db, context.userId, "cashout");
    const wallet = await getOrCreateWallet(db, context.userId);
    if (Number(wallet.balance) < data.amount) {
      return { ok: false as const, error: "Nta mafaranga ahagije uhari." };
    }
    const { externalRef } = await requestToPay({
      provider: data.provider,
      phone: data.phone,
      amount: data.amount,
      reference: `payout-${context.userId.slice(0, 6)}`,
    });
    await db.from("momo_transactions").insert({
      provider: data.provider,
      direction: "disbursement",
      phone: data.phone,
      amount: data.amount,
      external_ref: externalRef,
      initiated_by: context.userId,
      status: "successful",
    });
    await post(db, context.userId, "payout", data.amount, {
      delta: -data.amount,
      ref: `momo:${externalRef}`,
      note: "Gukura amafaranga (MoMo)",
    });
    return { ok: true as const, externalRef };
  });

/** Ecosystem reward: charging at a UZA or partner station credits the wallet. */
export const logChargingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        station_name: z.string().min(2).max(80),
        kwh: z.number().min(0.1).max(200),
        cost: z.number().min(0).max(200000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, post } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Nta mwirondoro w'umushoferi.");
    const reward = Math.round(data.kwh * 30); // RWF 30 per kWh back into the wallet
    await db
      .from("charging_sessions")
      .insert({ driver_id: driver.id, ...data, reward_amount: reward });
    await post(db, context.userId, "charging_reward", reward, {
      delta: reward,
      ref: `charge:${data.station_name}`,
      note: "Inyungu yo kwishyuza amashanyarazi",
    });
    return { ok: true, reward };
  });

export const returnBattery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ battery_ref: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, post } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Nta mwirondoro w'umushoferi.");
    const credit = 15000;
    await db
      .from("battery_returns")
      .insert({ driver_id: driver.id, battery_ref: data.battery_ref, credit_amount: credit });
    await post(db, context.userId, "recycling_credit", credit, {
      delta: credit,
      ref: `battery:${data.battery_ref}`,
      note: "Kugarura bateri ishaje",
    });
    return { ok: true, credit };
  });

/**
 * Pay UZA the commission owed from cash trips, straight out of wallet balance.
 * This is what un-blocks a driver who has hit the cash-commission ceiling.
 */
export const settleCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, getOrCreateWallet, settleOwed } = await import("./uza.server");
    const db = admin();
    const before = await getOrCreateWallet(db, context.userId);
    const owed = Number(before.commission_owed);
    if (owed <= 0) return { ok: true as const, paid: 0, remaining: 0 };
    if (Number(before.balance) <= 0)
      throw new Error("Top up your wallet first — there is no balance to settle from.");

    const paid = await settleOwed(db, context.userId, `settle:${Date.now()}`);
    return { ok: true as const, paid, remaining: Math.max(0, owed - paid) };
  });

/**
 * The earnings statement — the differentiator screen.
 * Every payout is shown as a full waterfall: gross fare -> 8% commission ->
 * loan deduction -> savings deduction -> net to MoMo. Never one opaque number.
 */
export const getEarningsStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, getOrCreateWallet } = await import("./uza.server");
    const { splitFare, save2OwnProgress } = await import("./pricing");
    const { MIN_CLIENT_CONTRIBUTION, COMMISSION_BPS } = await import("@/config/policy");
    const db = admin();
    const uid = context.userId;

    const { data: driver } = await db.from("drivers").select("*").eq("user_id", uid).maybeSingle();
    if (!driver) return null;

    const wallet = await getOrCreateWallet(db, uid);
    const since = new Date(Date.now() - 30 * 864e5).toISOString();

    const [{ data: trips }, { data: txs }, { data: loan }, { data: rule }] = await Promise.all([
      db
        .from("trips")
        .select(
          "id, completed_at, final_fare, commission_amount, driver_earnings, pay_method, vehicle_type, pickup_address, dropoff_address",
        )
        .eq("driver_id", driver.id)
        .eq("status", "completed")
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(200),
      db
        .from("wallet_transactions")
        .select("type, amount, ref, created_at")
        .eq("wallet_id", wallet.id)
        .gte("created_at", since),
      db
        .from("loan_accounts")
        .select("*")
        .eq("driver_id", driver.id)
        .eq("status", "active")
        .maybeSingle(),
      db.from("savings_rules").select("*").eq("driver_id", driver.id).maybeSingle(),
    ]);

    const savingsByTrip = new Map<string, number>();
    let loanPaid30 = 0;
    for (const tx of txs ?? []) {
      if (tx.type === "savings_sweep" && tx.ref?.startsWith("trip:")) {
        const id = tx.ref.slice(5);
        savingsByTrip.set(id, (savingsByTrip.get(id) ?? 0) + Number(tx.amount));
      }
      if (tx.type === "loan_installment") loanPaid30 += Number(tx.amount);
    }

    const rows = (trips ?? []).map((t) => {
      const gross = Number(t.final_fare ?? 0);
      const commission = Number(t.commission_amount ?? splitFare(gross).commission);
      const savings = savingsByTrip.get(t.id) ?? 0;
      return {
        id: t.id,
        completed_at: t.completed_at,
        vehicle_type: t.vehicle_type,
        pay_method: t.pay_method,
        from: t.pickup_address,
        to: t.dropoff_address,
        gross,
        commission,
        savings,
        net: gross - commission - savings,
      };
    });

    const sum = (from: number) => {
      const cut = Date.now() - from;
      const set = rows.filter((r) => new Date(String(r.completed_at)).getTime() >= cut);
      const gross = set.reduce((s, r) => s + r.gross, 0);
      const commission = set.reduce((s, r) => s + r.commission, 0);
      const savings = set.reduce((s, r) => s + r.savings, 0);
      return { trips: set.length, gross, commission, savings, net: gross - commission - savings };
    };

    return {
      commissionBps: COMMISSION_BPS,
      periods: { today: sum(864e5), week: sum(7 * 864e5), month: sum(30 * 864e5) },
      rows: rows.slice(0, 40),
      // Ad revenue share is not yet paid out; the screen must not invent a number.
      adEarnings: null as number | null,
      financing: loan
        ? {
            outstanding: Number(loan.outstanding),
            installment_amount: Number(loan.installment_amount),
            installment_period: loan.installment_period,
            paid_last_30_days: loanPaid30,
          }
        : null,
      savingsRule: rule?.active ? rule : null,
      save2own: {
        locked: Number(wallet.locked_savings),
        target: MIN_CLIENT_CONTRIBUTION,
        progress: save2OwnProgress(Number(wallet.locked_savings), MIN_CLIENT_CONTRIBUTION),
      },
    };
  });
