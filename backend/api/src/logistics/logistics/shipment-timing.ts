/**
 * `departureDate` and `transitTimeDays` (item 1 of the 2026-09-14 gap-closure audit) derive
 * CLEANLY from the planned/actual etd/eta pair, so — per the audit's own instruction — they
 * are NOT persisted columns. Storing them would risk drifting from the source dates the
 * moment either is corrected; deriving them on every read makes that structurally
 * impossible. `departureDate` prefers the ACTUAL date once known, falling back to planned
 * (never the reverse — the planned/actual discipline this whole module runs on).
 */
export interface ShipmentTimingInput {
  readonly etdPlanned: string;
  readonly etdActual: string | null;
  readonly etaPlanned: string;
  readonly etaActual: string | null;
}

export interface ShipmentTiming {
  readonly departureDate: string;
  readonly arrivalDate: string;
  /** Whether `departureDate`/`arrivalDate` are confirmed actuals or still the plan. */
  readonly departureConfirmed: boolean;
  readonly arrivalConfirmed: boolean;
  /** Null when either date fails to parse — never a misleading number. */
  readonly transitTimeDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const shipmentTiming = (s: ShipmentTimingInput): ShipmentTiming => {
  const departureDate = s.etdActual ?? s.etdPlanned;
  const arrivalDate = s.etaActual ?? s.etaPlanned;
  const dep = new Date(departureDate);
  const arr = new Date(arrivalDate);
  const valid = !Number.isNaN(dep.getTime()) && !Number.isNaN(arr.getTime());
  return {
    departureDate,
    arrivalDate,
    departureConfirmed: s.etdActual !== null,
    arrivalConfirmed: s.etaActual !== null,
    transitTimeDays: valid ? Math.round((arr.getTime() - dep.getTime()) / DAY_MS) : null,
  };
};
