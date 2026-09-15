/**
 * Logistics policy. The founder-tunable container revenue-ton capacity now lives in
 * @uza/contracts (policy.ts, `CONTAINER_RT_CAPACITY`), accepted from
 * the container capacity contract request (2026-07-26) — re-exported here for the
 * module's call sites. It is used only to report container utilisation
 * (`totalRevenueTon / CONTAINER_RT_CAPACITY`); it never gates anything.
 */
export { CONTAINER_RT_CAPACITY } from '@uza/contracts';

/** A fully-paid order for the release gate: cumulative paid fraction has reached 1.0. */
export const FULLY_PAID_FRACTION = 1.0;
