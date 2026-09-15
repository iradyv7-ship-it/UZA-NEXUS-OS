import {
  emptyLadder,
  ladderAt,
  marginAt,
  FREIGHT_CONTINGENCY,
  INCOTERMS,
  TARGET_PRICE_FACTOR,
  WALKAWAY_FACTOR,
  type CostLadder,
  type CostRung,
  type Incoterm,
  type Minor,
} from '@uza/contracts';

/**
 * Quotation pricing. Every quotation is built on a full CostLadder, priced at the sell
 * incoterm, with the DAP margin computed alongside (see QuotationService.read).
 *
 * The negotiation floor (`target`) and walk-away ceiling (`walkaway`) are derived from
 * the supplier unit cost by TARGET_PRICE_FACTOR / WALKAWAY_FACTOR, founder-tunable
 * commercial policy imported from @uza/contracts.
 */
/**
 * The rungs that carry the freight contingency uplift at quotation time (CF-004):
 * ocean freight and inland-to-destination, matching the reference oracle. The uplift
 * RATE is policy.FREIGHT_CONTINGENCY — only the choice of which rungs are "freight" is
 * a structural fact of the corridor, not a founder-tunable number.
 */
export const FREIGHT_RUNGS: readonly CostRung[] = ['ocean', 'inlandDest'];

const asMinor = (n: number): Minor => Math.round(n) as Minor;

export interface PricingInputs {
  /** Per-unit supplier cost (EXW rung). */
  readonly supplierUnitCostMinor: Minor;
  /** Per-unit estimates for the remaining rungs (exw excluded). */
  readonly estCostsMinor: Partial<Record<CostRung, Minor>>;
  /** Target gross margin as a fraction of sell price, at the sell incoterm. */
  readonly requiredMargin: number;
  readonly sellIncoterm: Incoterm;
}

export interface PricedQuotation {
  readonly ladder: CostLadder;
  readonly customerUnitPriceMinor: Minor;
  /** Quoted margin at the sell incoterm — this is the number that locks at approval. */
  readonly marginPct: number;
  readonly targetPriceMinor: Minor;
  readonly walkawayPriceMinor: Minor;
}

export function priceQuotation(input: PricingInputs): PricedQuotation {
  if (!INCOTERMS.includes(input.sellIncoterm)) {
    throw new Error(`unknown sell incoterm: ${input.sellIncoterm}`);
  }
  if (input.requiredMargin < 0 || input.requiredMargin >= 1) {
    throw new Error(`required margin must be in [0, 1): ${input.requiredMargin}`);
  }

  const ladder = emptyLadder();
  ladder.exw.estMinor = input.supplierUnitCostMinor;
  for (const [rung, val] of Object.entries(input.estCostsMinor) as [
    CostRung,
    Minor | undefined,
  ][]) {
    if (val !== undefined) ladder[rung].estMinor = val;
  }

  // Freight contingency protects against the CBM overage that always comes.
  for (const rung of FREIGHT_RUNGS) {
    ladder[rung].estMinor = asMinor(ladder[rung].estMinor * (1 + FREIGHT_CONTINGENCY));
  }

  const sellCost = ladderAt(ladder, input.sellIncoterm);
  const customerUnitPriceMinor = asMinor(sellCost / (1 - input.requiredMargin));
  const marginPct = marginAt(ladder, customerUnitPriceMinor, input.sellIncoterm);

  return {
    ladder,
    customerUnitPriceMinor,
    marginPct,
    targetPriceMinor: asMinor(input.supplierUnitCostMinor * TARGET_PRICE_FACTOR),
    walkawayPriceMinor: asMinor(input.supplierUnitCostMinor * WALKAWAY_FACTOR),
  };
}
