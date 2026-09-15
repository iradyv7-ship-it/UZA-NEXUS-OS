/**
 * Pure, unit-tested money maths for UZA Move.
 *
 * Everything here is a pure function over integer RWF minor units. No I/O, no
 * dates, no randomness — so every result is reproducible and auditable.
 * All commercial numbers come from src/config/policy.ts; none are literals here.
 */

import {
  BPS_DENOMINATOR,
  CANCELLATION_FEE,
  COMMISSION_BPS,
  CURRENCY,
  FARE_ROUNDING_RWF,
  FREE_CANCEL_SECONDS,
  MIN_TRIP_MINUTES,
  ROAD_DISTANCE_FACTOR,
  SAVINGS_DEFAULT_ROUND_TO,
  SAVINGS_MAX_SHARE_OF_FARE_BPS,
  SURGE_ENABLED,
  TARIFFS,
  type Bps,
  type Rwf,
  type SavingsRuleType,
  type Tariff,
  type VehicleType,
} from "@/config/policy";

/* ---------------- primitives ---------------- */

/** Apply a basis-point rate to an integer amount, rounding half up. */
export function applyBps(amount: Rwf, bps: Bps): Rwf {
  return Math.round((amount * bps) / BPS_DENOMINATOR);
}

/** Round an amount to the nearest configured fare step, never below zero. */
export function roundFare(amount: number): Rwf {
  return Math.max(0, Math.round(amount / FARE_ROUNDING_RWF) * FARE_ROUNDING_RWF);
}

/** `RWF 3,500` — tabular, no decimals, grouped thousands. */
export function formatMoney(amount: Rwf | string | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return `${CURRENCY} ${new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(n)}`;
}

/** Bare number, for use where the currency label is already on screen. */
export function formatAmount(amount: Rwf | string | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(n);
}

/** Great-circle distance in km between two coordinates. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line distance inflated to an approximate road distance. */
export function roadDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return haversineKm(a, b) * ROAD_DISTANCE_FACTOR;
}

/** Expected trip duration in minutes for a distance on a given vehicle class. */
export function estimateDurationMin(distanceKm: number, vehicleType: VehicleType): number {
  const tariff = TARIFFS[vehicleType];
  return Math.max(MIN_TRIP_MINUTES, (distanceKm / tariff.avgSpeedKmh) * 60);
}

/* ---------------- the fare quote ---------------- */

export type FareQuote = {
  vehicleType: VehicleType;
  distanceKm: number;
  durationMin: number;
  /** The fixed, upfront fare. What is quoted is what is charged. */
  fare: Rwf;
  commission: Rwf;
  driverEarnings: Rwf;
  commissionBps: Bps;
  /** True when the raw fare hit the RURA-regulated ceiling and was capped. */
  cappedByRegulator: boolean;
  surgeApplied: false;
};

/**
 * Quote a trip. Distance + time based, clamped to the tariff's minimum and to
 * the RURA-regulated ceiling. Surge is off by design and cannot inflate a quote.
 */
export function quoteFare(
  distanceKm: number,
  durationMin: number,
  vehicleType: VehicleType,
  tariffOverride?: Partial<Tariff>,
): FareQuote {
  const tariff: Tariff = { ...TARIFFS[vehicleType], ...tariffOverride };
  const km = Math.max(0, distanceKm);
  const min = Math.max(MIN_TRIP_MINUTES, durationMin);

  const raw = tariff.baseFare + tariff.perKm * km + tariff.perMinute * min;
  const floored = Math.max(raw, tariff.minFare);
  const capped = Math.min(floored, tariff.maxFare);
  const fare = roundFare(capped);

  const { commission, driverEarnings } = splitFare(fare);

  return {
    vehicleType,
    distanceKm: Math.round(km * 100) / 100,
    durationMin: Math.round(min),
    fare,
    commission,
    driverEarnings,
    commissionBps: COMMISSION_BPS,
    cappedByRegulator: floored > tariff.maxFare,
    surgeApplied: SURGE_ENABLED as false,
  };
}

/** The whole promise: UZA takes 8%, the driver keeps 92%. Always exact. */
export function splitFare(fare: Rwf): { fare: Rwf; commission: Rwf; driverEarnings: Rwf } {
  const gross = Math.max(0, Math.round(fare));
  const commission = applyBps(gross, COMMISSION_BPS);
  return { fare: gross, commission, driverEarnings: gross - commission };
}

/** Waiting-time charge, billed only for minutes the driver actually waited. */
export function waitingCharge(waitedMinutes: number, vehicleType: VehicleType): Rwf {
  return Math.max(0, Math.round(waitedMinutes)) * TARIFFS[vehicleType].waitingPerMinute;
}

/* ---------------- cash trips ---------------- */

export type CashReconciliation = {
  /** Commission UZA is owed because the driver pocketed the full cash fare. */
  owedDelta: Rwf;
  /** Spendable wallet movement (nil on cash — the money never touched UZA). */
  walletDelta: Rwf;
  driverHolds: Rwf;
};

/**
 * A cash trip pays the driver directly, so UZA's 8% becomes a debt on the
 * driver's wallet rather than a deduction from it.
 */
export function reconcileCashTrip(fare: Rwf): CashReconciliation {
  const { commission, driverEarnings } = splitFare(fare);
  return { owedDelta: commission, walletDelta: 0, driverHolds: driverEarnings + commission };
}

/** How much of an owed commission balance a given wallet balance can clear. */
export function settleableCommission(owed: Rwf, walletBalance: Rwf): Rwf {
  return Math.max(0, Math.min(Math.round(owed), Math.round(walletBalance)));
}

/* ---------------- savings ---------------- */

export type SavingsRule = {
  ruleType: SavingsRuleType;
  fixedDaily: Rwf;
  /** Percent of the fare, as a whole percent (validated against policy ceiling). */
  percent: number;
  roundTo: Rwf;
};

/** How much of one fare is swept into locked savings. Capped by policy. */
export function savingsForFare(fare: Rwf, rule: SavingsRule | null): Rwf {
  if (!rule || rule.ruleType === "none") return 0;
  const gross = Math.max(0, Math.round(fare));
  const ceiling = applyBps(gross, SAVINGS_MAX_SHARE_OF_FARE_BPS);

  let want = 0;
  if (rule.ruleType === "percent_trip") want = applyBps(gross, Math.round(rule.percent * 100));
  else if (rule.ruleType === "round_up") {
    const to = rule.roundTo > 0 ? rule.roundTo : SAVINGS_DEFAULT_ROUND_TO;
    want = Math.ceil(gross / to) * to - gross;
  } else if (rule.ruleType === "fixed_daily") want = rule.fixedDaily;

  return Math.max(0, Math.min(want, ceiling));
}

/* ---------------- the deduction waterfall ---------------- */

export type WaterfallInput = {
  grossFare: Rwf;
  /** Loan installment due on this payout. Omit/0 when the driver has no loan. */
  loanDue?: Rwf;
  savingsRule?: SavingsRule | null;
  /** Commission still owed from earlier cash trips, recovered from this payout. */
  commissionOwed?: Rwf;
  /** Ad revenue earned by this driver, kept visibly separate from trip earnings. */
  adEarnings?: Rwf;
};

export type WaterfallStep = {
  key: "gross" | "ad_earnings" | "commission" | "commission_owed" | "loan" | "savings" | "net";
  /** Signed amount: negative values are deductions. */
  amount: Rwf;
};

export type Waterfall = {
  grossFare: Rwf;
  adEarnings: Rwf;
  commission: Rwf;
  commissionOwedRecovered: Rwf;
  loanDeduction: Rwf;
  savingsDeduction: Rwf;
  /** What actually lands on the driver's MoMo. Never negative. */
  netToMomo: Rwf;
  hasFinancing: boolean;
  steps: WaterfallStep[];
};

/**
 * gross fare -> 8% commission -> cash commission owed -> loan -> savings -> net.
 * Each stage can only take what is still available, so net is never negative.
 */
export function deductionWaterfall(input: WaterfallInput): Waterfall {
  const grossFare = Math.max(0, Math.round(input.grossFare));
  const adEarnings = Math.max(0, Math.round(input.adEarnings ?? 0));
  const { commission } = splitFare(grossFare);

  let available = grossFare - commission + adEarnings;

  const commissionOwedRecovered = Math.min(
    Math.max(0, Math.round(input.commissionOwed ?? 0)),
    available,
  );
  available -= commissionOwedRecovered;

  const loanDeduction = Math.min(Math.max(0, Math.round(input.loanDue ?? 0)), available);
  available -= loanDeduction;

  const savingsDeduction = Math.min(
    savingsForFare(grossFare, input.savingsRule ?? null),
    available,
  );
  available -= savingsDeduction;

  const steps: WaterfallStep[] = [
    { key: "gross", amount: grossFare },
    ...(adEarnings > 0 ? ([{ key: "ad_earnings", amount: adEarnings }] as WaterfallStep[]) : []),
    { key: "commission", amount: -commission },
    ...(commissionOwedRecovered > 0
      ? ([{ key: "commission_owed", amount: -commissionOwedRecovered }] as WaterfallStep[])
      : []),
    ...(loanDeduction > 0 ? ([{ key: "loan", amount: -loanDeduction }] as WaterfallStep[]) : []),
    ...(savingsDeduction > 0
      ? ([{ key: "savings", amount: -savingsDeduction }] as WaterfallStep[])
      : []),
    { key: "net", amount: available },
  ];

  return {
    grossFare,
    adEarnings,
    commission,
    commissionOwedRecovered,
    loanDeduction,
    savingsDeduction,
    netToMomo: available,
    hasFinancing: (input.loanDue ?? 0) > 0,
    steps,
  };
}

/* ---------------- cancellation ---------------- */

/**
 * What a rider owes for cancelling right now. Free before dispatch and inside
 * the grace window; otherwise the driver — who already burned fuel — is paid
 * the full fee, with no UZA commission taken on it.
 */
export function cancellationFee(args: {
  vehicleType: VehicleType;
  status: string;
  acceptedAt: string | null;
  now?: number;
  freeCancelSeconds?: number;
}): Rwf {
  if (!args.acceptedAt || args.status === "requested") return 0;
  const elapsed = ((args.now ?? Date.now()) - new Date(args.acceptedAt).getTime()) / 1000;
  const grace = args.freeCancelSeconds ?? FREE_CANCEL_SECONDS;
  if (elapsed < grace && args.status !== "arriving") return 0;
  return CANCELLATION_FEE[args.vehicleType as VehicleType] ?? CANCELLATION_FEE.moto;
}

/* ---------------- Save2Own progress ---------------- */

/** Progress toward the minimum client contribution, as a 0–100 integer percent. */
export function save2OwnProgress(lockedSavings: Rwf, target: Rwf): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((lockedSavings / target) * 100)));
}
