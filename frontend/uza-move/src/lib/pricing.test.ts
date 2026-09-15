import { describe, expect, it } from "vitest";
import {
  COMMISSION_BPS,
  DRIVER_SHARE_BPS,
  MIN_CLIENT_CONTRIBUTION,
  TARIFFS,
  COMMISSION_OWED_LIMIT,
} from "@/config/policy";
import {
  applyBps,
  cancellationFee,
  deductionWaterfall,
  estimateDurationMin,
  formatMoney,
  quoteFare,
  reconcileCashTrip,
  roundFare,
  save2OwnProgress,
  savingsForFare,
  settleableCommission,
  splitFare,
} from "./pricing";

describe("formatting", () => {
  it("renders RWF with grouped thousands and no decimals", () => {
    expect(formatMoney(3500)).toBe("RWF 3,500");
    expect(formatMoney(22500000)).toBe("RWF 22,500,000");
    expect(formatMoney(0)).toBe("RWF 0");
  });
});

describe("the 8/92 split", () => {
  it("takes exactly 8% and leaves 92%", () => {
    const { commission, driverEarnings } = splitFare(10_000);
    expect(commission).toBe(800);
    expect(driverEarnings).toBe(9_200);
  });

  it("never loses a franc: commission + driver earnings === fare", () => {
    for (const fare of [500, 550, 733, 1_250, 4_999, 15_000, 60_000]) {
      const s = splitFare(fare);
      expect(s.commission + s.driverEarnings).toBe(fare);
    }
  });

  it("matches the policy basis points", () => {
    expect(COMMISSION_BPS + DRIVER_SHARE_BPS).toBe(10_000);
    expect(applyBps(10_000, COMMISSION_BPS)).toBe(800);
  });

  it("returns integers only", () => {
    const s = splitFare(1_337);
    expect(Number.isInteger(s.commission)).toBe(true);
    expect(Number.isInteger(s.driverEarnings)).toBe(true);
  });
});

describe("the upfront fare quote", () => {
  it("is distance and time based and rounded to the fare step", () => {
    const q = quoteFare(5, 12, "moto");
    const t = TARIFFS.moto;
    expect(q.fare).toBe(roundFare(t.baseFare + t.perKm * 5 + t.perMinute * 12));
    expect(q.fare % 50).toBe(0);
  });

  it("never quotes below the tariff minimum", () => {
    expect(quoteFare(0, 0, "moto").fare).toBeGreaterThanOrEqual(TARIFFS.moto.minFare);
  });

  it("never exceeds the RURA-regulated ceiling", () => {
    const q = quoteFare(500, 900, "cab");
    expect(q.fare).toBeLessThanOrEqual(TARIFFS.cab.maxFare);
    expect(q.cappedByRegulator).toBe(true);
  });

  it("is deterministic — the same inputs always quote the same fare", () => {
    expect(quoteFare(7.3, 21, "cab")).toEqual(quoteFare(7.3, 21, "cab"));
  });

  it("never applies surge", () => {
    expect(quoteFare(5, 12, "moto").surgeApplied).toBe(false);
  });

  it("carries the driver's share on the quote so both sides see one number", () => {
    const q = quoteFare(5, 12, "moto");
    expect(q.commission + q.driverEarnings).toBe(q.fare);
  });

  it("estimates a sane duration", () => {
    expect(estimateDurationMin(0, "moto")).toBe(2);
    expect(estimateDurationMin(25, "moto")).toBeCloseTo(60, 5);
  });
});

describe("cash-trip commission reconciliation", () => {
  it("turns UZA's 8% into a debt because the driver holds the cash", () => {
    const r = reconcileCashTrip(5_000);
    expect(r.owedDelta).toBe(400);
    expect(r.walletDelta).toBe(0);
    expect(r.driverHolds).toBe(5_000);
  });

  it("settles only as much as the wallet can cover", () => {
    expect(settleableCommission(1_200, 500)).toBe(500);
    expect(settleableCommission(1_200, 5_000)).toBe(1_200);
    expect(settleableCommission(0, 5_000)).toBe(0);
    expect(settleableCommission(1_200, -50)).toBe(0);
  });

  it("accumulates toward the policy blocking limit", () => {
    const trips = Array.from({ length: 20 }, () => reconcileCashTrip(5_000).owedDelta);
    const owed = trips.reduce((a, b) => a + b, 0);
    expect(owed).toBe(8_000);
    expect(owed).toBeGreaterThan(COMMISSION_OWED_LIMIT);
  });
});

describe("savings sweep", () => {
  it("is absent when the driver has no rule", () => {
    expect(savingsForFare(5_000, null)).toBe(0);
    expect(
      savingsForFare(5_000, { ruleType: "none", fixedDaily: 0, percent: 0, roundTo: 100 }),
    ).toBe(0);
  });

  it("takes a percentage of the fare", () => {
    expect(
      savingsForFare(5_000, { ruleType: "percent_trip", fixedDaily: 0, percent: 10, roundTo: 100 }),
    ).toBe(500);
  });

  it("rounds the fare up to the next step", () => {
    expect(
      savingsForFare(4_850, { ruleType: "round_up", fixedDaily: 0, percent: 0, roundTo: 100 }),
    ).toBe(50);
  });

  it("is capped so a sweep can never swallow the fare", () => {
    expect(
      savingsForFare(1_000, { ruleType: "fixed_daily", fixedDaily: 900, percent: 0, roundTo: 100 }),
    ).toBe(250);
    expect(
      savingsForFare(1_000, { ruleType: "percent_trip", fixedDaily: 0, percent: 50, roundTo: 100 }),
    ).toBe(250);
  });
});

describe("the deduction waterfall", () => {
  it("shows every stage from gross fare to net on MoMo", () => {
    const w = deductionWaterfall({
      grossFare: 10_000,
      loanDue: 2_000,
      savingsRule: { ruleType: "percent_trip", fixedDaily: 0, percent: 10, roundTo: 100 },
    });
    expect(w.commission).toBe(800);
    expect(w.loanDeduction).toBe(2_000);
    expect(w.savingsDeduction).toBe(1_000);
    expect(w.netToMomo).toBe(6_200);
    expect(w.grossFare - w.commission - w.loanDeduction - w.savingsDeduction).toBe(w.netToMomo);
  });

  it("omits deduction steps entirely when the driver has no financing", () => {
    const w = deductionWaterfall({ grossFare: 10_000 });
    expect(w.hasFinancing).toBe(false);
    expect(w.steps.map((s) => s.key)).toEqual(["gross", "commission", "net"]);
    expect(w.netToMomo).toBe(9_200);
  });

  it("recovers cash commission owed before loan and savings", () => {
    const w = deductionWaterfall({
      grossFare: 10_000,
      commissionOwed: 3_000,
      loanDue: 2_000,
      savingsRule: { ruleType: "percent_trip", fixedDaily: 0, percent: 10, roundTo: 100 },
    });
    expect(w.commissionOwedRecovered).toBe(3_000);
    expect(w.netToMomo).toBe(3_200);
  });

  it("never drives the payout negative", () => {
    const w = deductionWaterfall({ grossFare: 1_000, loanDue: 50_000, commissionOwed: 50_000 });
    expect(w.netToMomo).toBe(0);
    expect(w.commissionOwedRecovered + w.loanDeduction).toBe(920);
  });

  it("keeps ad earnings visible as their own line", () => {
    const w = deductionWaterfall({ grossFare: 10_000, adEarnings: 1_500 });
    expect(w.adEarnings).toBe(1_500);
    expect(w.netToMomo).toBe(10_700);
    expect(w.steps.some((s) => s.key === "ad_earnings")).toBe(true);
  });
});

describe("cancellation", () => {
  const now = Date.UTC(2026, 8, 2, 10, 0, 0);
  it("is free before a driver is dispatched", () => {
    expect(
      cancellationFee({ vehicleType: "moto", status: "requested", acceptedAt: null, now }),
    ).toBe(0);
  });
  it("is free inside the grace window", () => {
    const acceptedAt = new Date(now - 30_000).toISOString();
    expect(cancellationFee({ vehicleType: "moto", status: "accepted", acceptedAt, now })).toBe(0);
  });
  it("charges once the driver is on the way", () => {
    const acceptedAt = new Date(now - 600_000).toISOString();
    expect(cancellationFee({ vehicleType: "cab", status: "accepted", acceptedAt, now })).toBe(
      1_000,
    );
  });
  it("charges immediately once the driver has arrived", () => {
    const acceptedAt = new Date(now - 10_000).toISOString();
    expect(cancellationFee({ vehicleType: "moto", status: "arriving", acceptedAt, now })).toBe(500);
  });
});

describe("Save2Own progress", () => {
  it("tracks locked savings against the minimum client contribution", () => {
    expect(save2OwnProgress(0, MIN_CLIENT_CONTRIBUTION)).toBe(0);
    expect(save2OwnProgress(125_000, MIN_CLIENT_CONTRIBUTION)).toBe(25);
    expect(save2OwnProgress(900_000, MIN_CLIENT_CONTRIBUTION)).toBe(100);
  });
});
