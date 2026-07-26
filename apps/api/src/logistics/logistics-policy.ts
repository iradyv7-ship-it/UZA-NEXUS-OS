/**
 * Logistics-local policy constants that are NOT (yet) in @uza/contracts policy.ts.
 *
 * A founder should be able to change these without a developer, so they belong in
 * contracts. A contract-request is filed (docs/contract-requests/2026-07-25-container-
 * capacity.md); rendered locally meanwhile, marked pending.
 */

/**
 * Nominal revenue-ton capacity of a standard container. Used only to report container
 * utilisation (`totalRevenueTon / CONTAINER_RT_CAPACITY`) alongside the per-container
 * freight P&L — it never gates anything. The reference used 28.0.
 *
 * TODO: pending contract-request 2026-07-25-container-capacity.md.
 */
export const CONTAINER_RT_CAPACITY = 28.0;

/** A fully-paid order for the release gate: cumulative paid fraction has reached 1.0. */
export const FULLY_PAID_FRACTION = 1.0;
