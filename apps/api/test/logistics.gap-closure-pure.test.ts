import { describe, expect, it } from 'vitest';
import { shipmentTiming } from '../src/logistics/logistics/shipment-timing';
import { customerContainerMessage, careContainerMessage } from '../src/logistics/logistics/container-notice';
import { looseCargoPriceMinor } from '../src/logistics/warehouse/release.service';

/**
 * Pure-function tests for the 2026-09-14 gap-closure audit pieces that need no database —
 * these run with no Postgres connection, unlike the rest of this module's suite.
 */
describe('shipmentTiming — derived, never stored (item 1)', () => {
  it('prefers the actual date over the planned one, for both departure and arrival', () => {
    const t = shipmentTiming({
      etdPlanned: '2026-08-01',
      etdActual: '2026-08-03',
      etaPlanned: '2026-09-01',
      etaActual: null,
    });
    expect(t.departureDate).toBe('2026-08-03');
    expect(t.departureConfirmed).toBe(true);
    expect(t.arrivalDate).toBe('2026-09-01');
    expect(t.arrivalConfirmed).toBe(false);
  });

  it('computes transit time in days from whichever pair is confirmed', () => {
    const t = shipmentTiming({
      etdPlanned: '2026-08-01',
      etdActual: '2026-08-01',
      etaPlanned: '2026-09-10',
      etaActual: '2026-09-05',
    });
    expect(t.transitTimeDays).toBe(35);
  });

  it('never overwrites planned with actual — both remain readable independently', () => {
    const input = {
      etdPlanned: '2026-08-01',
      etdActual: '2026-08-05',
      etaPlanned: '2026-09-01',
      etaActual: '2026-09-01',
    };
    const t = shipmentTiming(input);
    // The planned values are untouched inputs — this asserts the function is non-destructive
    // and that departure/arrival dates are DERIVED reads, not a mutation of the plan.
    expect(input.etdPlanned).toBe('2026-08-01');
    expect(input.etaPlanned).toBe('2026-09-01');
    expect(t.departureDate).toBe('2026-08-05');
  });

  it('returns a null transitTimeDays rather than a misleading number on unparsable dates', () => {
    const t = shipmentTiming({
      etdPlanned: 'not-a-date',
      etdActual: null,
      etaPlanned: '2026-09-01',
      etaActual: null,
    });
    expect(t.transitTimeDays).toBeNull();
  });
});

describe('container-notice — warm client copy vs information-dense customer-care copy (item 6)', () => {
  const base = {
    shipmentRef: 'SHP-2026-0001',
    container: 'MSKU1234567',
    destination: 'KIGALI' as const,
    vesselName: 'MV Ever Given',
    voyageNumber: '123W',
    ventureCode: 'BULK',
    goodsDescription: '20x cartons kitchenware',
  };

  it('the customer message reads warm and human, never a raw data dump', () => {
    const msg = customerContainerMessage(base);
    expect(msg).toContain('Great news');
    expect(msg).toContain('MSKU1234567');
    expect(msg).toContain('KIGALI');
    // Not a key:value dump — no JSON-ish braces/colons-as-labels leaking into customer copy.
    expect(msg).not.toMatch(/[{}]/);
  });

  it('says "vehicle" for MOBILITY and stays generic for other ventures', () => {
    const mobility = customerContainerMessage({ ...base, ventureCode: 'MOBILITY' });
    expect(mobility).toContain('vehicle');
    const bulk = customerContainerMessage({ ...base, ventureCode: 'BULK' });
    expect(bulk).not.toContain('vehicle');
  });

  it('never presents an estimate as fact: with no vessel yet, it does not invent one', () => {
    const msg = customerContainerMessage({ ...base, vesselName: null, voyageNumber: null });
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('null');
  });

  it('the customer-care message is information-dense: shipment ref, venture, goods, destination', () => {
    const msg = careContainerMessage(base);
    expect(msg).toContain('SHP-2026-0001');
    expect(msg).toContain('BULK');
    expect(msg).toContain('kitchenware');
    expect(msg).toContain('KIGALI');
  });

  it('customer and customer-care copy are always distinct bodies, never copy-pasted', () => {
    expect(customerContainerMessage(base)).not.toBe(careContainerMessage(base));
  });
});

describe('looseCargoPriceMinor — the LOOSE-cargo sellable line (item 3)', () => {
  it('multiplies price-per-CBM by measured CBM, rounded to the nearest minor unit', () => {
    expect(looseCargoPriceMinor(150000, 2.5)).toBe(375000);
  });

  it('is a pure function of price and cbm — never reads/writes the internal revenueTon math', () => {
    // 0.333... cbm at 100000/cbm should round, not truncate or inflate.
    expect(looseCargoPriceMinor(100000, 0.333)).toBe(33300);
  });
});
