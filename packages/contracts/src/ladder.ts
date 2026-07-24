/**
 * Cost ladder arithmetic.
 *
 * This lives in contracts and not in trade-flow because finance recomputes
 * realized margin from the same ladder. If the two modules each implement
 * "margin at DAP", they will differ by a rounding rule within a month and
 * nobody will be able to say which P&L is right.
 */
import type { Minor } from './money.ts';
import { sum } from './money.ts';
import { LADDER, INCOTERMS, type Incoterm, type CostRung } from './policy.ts';
import type { CostLadder, CostLine } from './types.ts';

export const emptyLine = (): CostLine => ({ estMinor: 0 as Minor, actMinor: null });

export const emptyLadder = (): CostLadder =>
  Object.fromEntries(LADDER.map(([rung]) => [rung, emptyLine()])) as CostLadder;

/** Actual when known, estimate otherwise. */
export const lineValue = (l: CostLine): Minor => l.actMinor ?? l.estMinor;

/** Cumulative unit cost up to and including an incoterm. */
export const ladderAt = (ladder: CostLadder, incoterm: Incoterm): Minor => {
  const ceiling = INCOTERMS.indexOf(incoterm);
  return sum(
    ...LADDER.filter(([, rung]) => INCOTERMS.indexOf(rung) <= ceiling)
             .map(([key]) => lineValue(ladder[key])),
  );
};

/** Margin as a fraction of sell price, at a given incoterm. */
export const marginAt = (
  ladder: CostLadder, sellPriceMinor: Minor, incoterm: Incoterm,
): number => {
  if (sellPriceMinor <= 0) return 0;
  const cost = ladderAt(ladder, incoterm);
  return Math.round(((sellPriceMinor - cost) / sellPriceMinor) * 10_000) / 10_000;
};

/**
 * The number that tells the truth regardless of the incoterm sold at.
 * Quotation screens must show this next to the quoted margin.
 */
export const dapMargin = (ladder: CostLadder, sellPriceMinor: Minor): number =>
  marginAt(ladder, sellPriceMinor, 'DAP');

export const hasAllActuals = (ladder: CostLadder): boolean =>
  LADDER.every(([key]) => ladder[key].actMinor !== null);

export const missingActuals = (ladder: CostLadder): CostRung[] =>
  LADDER.filter(([key]) => ladder[key].actMinor === null).map(([key]) => key);
