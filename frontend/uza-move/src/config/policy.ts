/**
 * UZA — single source of truth for every commercial constant.
 *
 * RULES (non-negotiable):
 *  - No business number may appear as a literal anywhere else in the codebase.
 *  - Every constant is tagged CONFIRMED (signed off by the business) or
 *    ASSUMED (placeholder pending confirmation).
 *  - Money is stored and computed as INTEGER MINOR UNITS. The Rwandan franc has
 *    no circulating subunit, so 1 minor unit === RWF 1. Never use floats.
 *  - Percentages are expressed in BASIS POINTS (bps) so all maths stays integer.
 *    800 bps = 8%.
 *  - Changing any value here is a code change; end users can never edit them.
 */

/** RWF amount expressed in integer minor units (1 unit = RWF 1). */
export type Rwf = number;

/** Hundredths of a percent. 800 bps = 8.00%. */
export type Bps = number;

export const BPS_DENOMINATOR = 10_000;

/** CONFIRMED — group currency. Rwanda first, model allows other markets later. */
export const CURRENCY = "RWF" as const;

/** CONFIRMED — default market. Expansion markets are added, never hardcoded away. */
export const DEFAULT_COUNTRY = "RW" as const;
export const SUPPORTED_COUNTRIES = ["RW", "UG", "KE", "TZ", "CD"] as const;

/* ------------------------------------------------------------------ */
/* Ride-hailing — UZA Move / Drive & Earn                              */
/* ------------------------------------------------------------------ */

/** CONFIRMED (workspace formula 3.3) — platform commission per trip. */
export const COMMISSION_BPS: Bps = 800;

/** CONFIRMED — the driver keeps the remainder of every fare. */
export const DRIVER_SHARE_BPS: Bps = BPS_DENOMINATOR - COMMISSION_BPS;

/** CONFIRMED — fares are fixed and shown upfront. Surge never breaks the quote. */
export const SURGE_ENABLED = false;

/** ASSUMED — fares are rounded to the nearest RWF 50 for cash practicality. */
export const FARE_ROUNDING_RWF: Rwf = 50;

export type VehicleType = "moto" | "cab" | "e_moto" | "delivery";

export const VEHICLE_TYPES: readonly VehicleType[] = ["moto", "cab", "e_moto", "delivery"];

export type Tariff = {
  vehicleType: VehicleType;
  /** RWF charged on every trip before distance and time. */
  baseFare: Rwf;
  perKm: Rwf;
  perMinute: Rwf;
  minFare: Rwf;
  waitingPerMinute: Rwf;
  /** RURA-regulated ceiling for a single trip on this vehicle class. */
  maxFare: Rwf;
  /** Average urban speed used for the time component of an upfront quote. */
  avgSpeedKmh: number;
};

/**
 * ASSUMED — indicative Kigali tariffs pending the signed RURA schedule.
 * `maxFare` is the regulated ceiling; a quote may never exceed it.
 */
export const TARIFFS: Record<VehicleType, Tariff> = {
  moto: {
    vehicleType: "moto",
    baseFare: 300,
    perKm: 250,
    perMinute: 20,
    minFare: 500,
    waitingPerMinute: 15,
    maxFare: 15_000,
    avgSpeedKmh: 25,
  },
  e_moto: {
    vehicleType: "e_moto",
    baseFare: 300,
    perKm: 220,
    perMinute: 20,
    minFare: 500,
    waitingPerMinute: 15,
    maxFare: 15_000,
    avgSpeedKmh: 25,
  },
  cab: {
    vehicleType: "cab",
    baseFare: 700,
    perKm: 500,
    perMinute: 40,
    minFare: 1_200,
    waitingPerMinute: 30,
    maxFare: 60_000,
    avgSpeedKmh: 20,
  },
  delivery: {
    vehicleType: "delivery",
    baseFare: 500,
    perKm: 300,
    perMinute: 20,
    minFare: 800,
    waitingPerMinute: 20,
    maxFare: 40_000,
    avgSpeedKmh: 22,
  },
};

/** ASSUMED — straight-line distance is inflated to approximate road distance. */
export const ROAD_DISTANCE_FACTOR = 1.25;

/** ASSUMED — shortest billable trip duration, in minutes. */
export const MIN_TRIP_MINUTES = 2;

/* ---- Cancellation ------------------------------------------------- */

/** ASSUMED — grace window after a driver accepts, during which cancelling is free. */
export const FREE_CANCEL_SECONDS = 120;

/** ASSUMED — late-cancellation fee. Paid 100% to the driver, UZA takes nothing. */
export const CANCELLATION_FEE: Record<VehicleType, Rwf> = {
  moto: 500,
  e_moto: 500,
  cab: 1_000,
  delivery: 700,
};

/* ---- Cash trips ---------------------------------------------------- */

/**
 * ASSUMED — on a cash trip the driver holds UZA's commission. Past this much
 * unsettled commission the driver must pay in before taking more jobs.
 */
export const COMMISSION_OWED_LIMIT: Rwf = 5_000;

/* ------------------------------------------------------------------ */
/* Savings, loans, Save2Own -> Drive2Own                               */
/* ------------------------------------------------------------------ */

export type SavingsRuleType = "none" | "fixed_daily" | "percent_trip" | "round_up";

/** ASSUMED — a per-trip savings sweep may never exceed this share of the fare. */
export const SAVINGS_MAX_SHARE_OF_FARE_BPS: Bps = 2_500;

/** ASSUMED — default round-up granularity for the round_up savings rule. */
export const SAVINGS_DEFAULT_ROUND_TO: Rwf = 100;

/** ASSUMED — ceiling on the percent_trip savings rule. */
export const SAVINGS_MAX_PERCENT_BPS: Bps = 5_000;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED (workspace formula 3.2)" with no traceable sign-off behind that tag.
/** Minimum client contribution to own a vehicle. */
export const MIN_CLIENT_CONTRIBUTION: Rwf = 500_000;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** UZA selling price per vehicle, fixed regardless of contribution. */
export const UZA_VEHICLE_SELLING_PRICE: Rwf = 22_500_000;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** Total price at 0% client contribution (UZA fronts the difference). */
export const UZA_VEHICLE_PRICE_AT_ZERO_CONTRIBUTION: Rwf = 25_000_000;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** The bank must always see a full 10% deposit. */
export const BANK_DEPOSIT_BPS: Bps = 1_000;

/* ------------------------------------------------------------------ */
/* Investor / container economics (shared group formula 3.1)           */
/* ------------------------------------------------------------------ */

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** Landing cost is 13.33% below the UZA-fixed selling price. */
export const LANDING_COST_DISCOUNT_BPS: Bps = 1_333;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** Investor takes 65% of margin, UZA retains 35%. */
export const INVESTOR_MARGIN_SHARE_BPS: Bps = 6_500;

// UNVERIFIED — invented by the Lovable build agent, not a real founder decision. Do not treat as settled.
// Originally tagged "CONFIRMED" with no traceable sign-off behind that tag.
/** Acceptance band on the investor return: 10.00%-10.40% inclusive. */
export const INVESTOR_RETURN_MIN_BPS: Bps = 1_000;
export const INVESTOR_RETURN_MAX_BPS: Bps = 1_040;

/* ------------------------------------------------------------------ */
/* Advertising                                                          */
/* ------------------------------------------------------------------ */

/** ASSUMED — share of ad revenue paid to the driver whose screen served it. */
export const AD_DRIVER_REVENUE_SHARE_BPS: Bps = 3_000;

/** Decision log — every change to a constant above records its date here. */
export const POLICY_VERSION = "2026-09-02" as const;
