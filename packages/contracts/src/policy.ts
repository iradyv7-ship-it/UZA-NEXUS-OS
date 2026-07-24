/**
 * Commercial policy. Every number a founder should be able to change without a
 * developer lives here. Modules must read these constants, never inline them.
 */

// ---------- payment ----------
export type InstallmentTrigger = 'confirmation' | 'pre_loading' | 'pre_release';
export type ClientTier = 'new' | 'established';

export const PAYMENT_SCHEDULES: Record<ClientTier, ReadonlyArray<readonly [InstallmentTrigger, number]>> = {
  new:         [['confirmation', 0.50], ['pre_loading', 0.50]],
  established: [['confirmation', 0.30], ['pre_loading', 0.40], ['pre_release', 0.30]],
};

export const MIN_DEPOSIT = 0.30;
export const ESTABLISHED_AFTER_ORDERS = 3;

export const scheduleFor = (completedOrders: number) => {
  const tier: ClientTier = completedOrders >= ESTABLISHED_AFTER_ORDERS ? 'established' : 'new';
  return { tier, schedule: PAYMENT_SCHEDULES[tier] };
};

// ---------- volumetrics ----------
export const CBM_TOLERANCE = 0.05;   // declared vs measured, normal factory drift
export const CBM_HARD_STOP = 0.10;   // beyond this, loading stops until a human decides
export const FREIGHT_CONTINGENCY = 0.09;
export const BILLING_CLAIM_THRESHOLD = 0.02; // billed over measured before we claim

export type VarianceDecision = 'client_pays' | 'uza_absorbs' | 'reduce_qty';

// ---------- commission ----------
export const COMMISSION_RATE = 0.02;       // on confirmed orders (deposit verified)
export const LEAD_DECAY_RATE = 0.01;       // repeat orders, same client
export const LEAD_OWNERSHIP_MONTHS = 12;
export const CLAIMS_WINDOW_DAYS = 14;

// ---------- cost ladder ----------
export const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

/** Each rung accumulates into the incoterm it is listed against. */
export const LADDER: ReadonlyArray<readonly [CostRung, Incoterm]> = [
  ['exw', 'EXW'],
  ['inlandCn', 'FOB'], ['exportDocs', 'FOB'], ['originThc', 'FOB'],
  ['ocean', 'CIF'], ['insurance', 'CIF'],
  ['destCharges', 'DAP'], ['dutyVat', 'DAP'], ['inlandDest', 'DAP'],
];

export type CostRung =
  | 'exw' | 'inlandCn' | 'exportDocs' | 'originThc'
  | 'ocean' | 'insurance' | 'destCharges' | 'dutyVat' | 'inlandDest';

/**
 * Split a total into installments whose parts sum EXACTLY to the total.
 *
 * Naive rounding of 30/40/30 leaves cents unaccounted for, and the last
 * installment then never marks itself paid. The remainder goes to the final
 * installment deliberately.
 */
export const splitInstallments = (
  totalMinor: number,
  schedule: ReadonlyArray<readonly [InstallmentTrigger, number]>,
): ReadonlyArray<{ trigger: InstallmentTrigger; pct: number; amountMinor: number }> => {
  const parts = schedule.map(([trigger, p]) => ({
    trigger, pct: p, amountMinor: Math.floor(totalMinor * p),
  }));
  const allocated = parts.reduce((a, p) => a + p.amountMinor, 0);
  const last = parts[parts.length - 1];
  if (last) last.amountMinor += totalMinor - allocated;
  return parts;
};
