/**
 * Contract-level conformance. These assertions are testable without a database,
 * so they run in milliseconds and catch drift before any module work lands.
 *
 *   node --experimental-strip-types tests/conformance/contracts.test.ts
 *
 * The remaining assertions in SPEC.md need the API and are covered by the
 * integration suite once platform-core lands.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  minor, revenueTon, scheduleFor, splitInstallments,
  emptyLadder, ladderAt, marginAt, dapMargin,
  maskFields, can, inScope, MASK,
  CBM_TOLERANCE, CBM_HARD_STOP, MIN_DEPOSIT, COMMISSION_RATE,
  EVENT_OWNERS, EVENT_NAMES,
  type Actor, type Minor,
} from '../../packages/contracts/src/index.ts';

// --- CF-002 / CF-003: cost ladder and the two margins ----------------------
test('CF-002/003: quoted margin holds at sell incoterm, DAP margin is lower and visible', () => {
  const l = emptyLadder();
  l.exw.estMinor = minor(41.00);
  l.inlandCn.estMinor = minor(1.20);
  l.exportDocs.estMinor = minor(0.35);
  l.originThc.estMinor = minor(0.60);
  l.ocean.estMinor = minor(7.09);       // 6.50 + 9% contingency
  l.insurance.estMinor = minor(0.30);
  l.destCharges.estMinor = minor(1.80);
  l.dutyVat.estMinor = minor(4.90);
  l.inlandDest.estMinor = minor(3.71);

  const cif = ladderAt(l, 'CIF');
  const sell = Math.round(cif / (1 - 0.18)) as Minor;

  assert.ok(Math.abs(marginAt(l, sell, 'CIF') - 0.18) < 0.001, 'quoted CIF margin is 18%');
  assert.ok(dapMargin(l, sell) < marginAt(l, sell, 'CIF') - 0.10,
    'DAP margin is materially lower — this is the number that tells the truth');
  assert.ok(ladderAt(l, 'EXW') < ladderAt(l, 'FOB'), 'ladder accumulates');
  assert.ok(ladderAt(l, 'FOB') < ladderAt(l, 'CIF'));
  assert.ok(ladderAt(l, 'CIF') < ladderAt(l, 'DAP'));
});

test('CF-029: actuals override estimates without touching the quoted figure', () => {
  const l = emptyLadder();
  l.exw.estMinor = minor(41.00);
  l.dutyVat.estMinor = minor(4.90);
  const quoted = marginAt(l, minor(61.63), 'DAP');
  l.dutyVat.actMinor = minor(5.60);
  const realized = marginAt(l, minor(61.63), 'DAP');
  assert.ok(realized < quoted, 'a higher actual duty lowers realized margin');
});

// --- CF-005 / CF-006: payment schedules ------------------------------------
test('CF-005/006: tier drives the schedule, deposit never below policy floor', () => {
  assert.equal(scheduleFor(0).tier, 'new');
  assert.equal(scheduleFor(0).schedule.length, 2);
  assert.equal(scheduleFor(3).tier, 'established');
  assert.equal(scheduleFor(3).schedule.length, 3);
  for (const { schedule } of [scheduleFor(0), scheduleFor(3)]) {
    assert.ok(schedule[0]![1] >= MIN_DEPOSIT, 'first installment meets the deposit floor');
    const total = schedule.reduce((a, [, p]) => a + p, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, 'schedule sums to 100%');
  }
});

test('installment split reconciles to the cent on an awkward total', () => {
  // 30/40/30 of $1,844.31 does not divide cleanly.
  const total = minor(1844.31);
  const parts = splitInstallments(total, scheduleFor(3).schedule);
  const sum = parts.reduce((a, p) => a + p.amountMinor, 0);
  assert.equal(sum, total, 'parts sum EXACTLY to the total, or the last one never settles');
});

// --- CF-021: revenue ton ----------------------------------------------------
test('CF-021: freight bills on the greater of volume or weight', () => {
  assert.equal(revenueTon(18.6, 3450), 18.6, 'volumetric cargo bills on CBM');
  assert.equal(revenueTon(2.0, 8000), 8.0, 'dense cargo bills on weight');
});

// --- CF-025 / CF-026: field masking ----------------------------------------
const agent: Actor = { userId: 'AGT-GOM-0021', role: 'sales_agent', office: 'GOM', scope: { customerIds: ['CUS-CD-000001'] } };
const partner: Actor = { userId: 'imari', role: 'logistics_partner', office: 'GOM', scope: { shipmentRefs: ['SHP-2026-0001'] } };
const kagabo: Actor = { userId: 'kagabo', role: 'finance', office: 'RW', scope: {} };

test('CF-025: an agent sees the customer price and nothing behind it', () => {
  const view = maskFields(agent, {
    customerUnitPriceMinor: minor(61.63),
    supplierUnitCost: minor(41.0),
    marginPct: 0.18,
  });
  assert.equal(view.supplierUnitCost, MASK);
  assert.equal(view.marginPct, MASK);
  assert.notEqual(view.customerUnitPriceMinor, MASK);
});

test('CF-026: a partner sees volumetrics and never cost', () => {
  const view = maskFields(partner, { cbm: 1.55, kg: 287.5, supplierUnitCost: minor(41.0) });
  assert.equal(view.supplierUnitCost, MASK);
  assert.equal(view.cbm, 1.55);
});

test('finance sees what it needs to reconcile', () => {
  const view = maskFields(kagabo, { supplierUnitCost: minor(41.0), marginPct: 0.18 });
  assert.notEqual(view.supplierUnitCost, MASK);
});

// --- CF-024 / CF-027: role grants and object scope -------------------------
test('CF-024: a sales agent cannot read supplier records', () => {
  assert.equal(can(agent, 'supplier', 'read'), false);
  assert.equal(can(kagabo, 'supplier', 'read'), true);
});

test('CF-027: a customer cannot reach another customer’s project', () => {
  const mine: Actor = { userId: 'c1', role: 'customer', office: 'CD', scope: { customerId: 'CUS-CD-000001' } };
  assert.equal(inScope(mine, { customerId: 'CUS-CD-000001' }), true);
  assert.equal(inScope(mine, { customerId: 'CUS-RW-000999' }), false);
});

test('a partner reaches a shipment by ref, and a delivery by its shipmentRef', () => {
  assert.equal(inScope(partner, { kind: 'shipment', ref: 'SHP-2026-0001' }), true);
  assert.equal(inScope(partner, { shipmentRef: 'SHP-2026-0001' }), true, 'delivery hangs off a shipment');
  assert.equal(inScope(partner, { kind: 'shipment', ref: 'SHP-2026-0002' }), false);
});

// --- structural guards ------------------------------------------------------
test('every declared event has exactly one owning module', () => {
  for (const name of EVENT_NAMES) {
    assert.ok(EVENT_OWNERS[name], `${name} has no owner — two modules will fight over it`);
  }
  assert.equal(Object.keys(EVENT_OWNERS).length, EVENT_NAMES.length);
});

test('policy thresholds are ordered sensibly', () => {
  assert.ok(CBM_TOLERANCE < CBM_HARD_STOP, 'tolerance must sit below the hard stop');
  assert.ok(COMMISSION_RATE > 0 && COMMISSION_RATE < 0.1);
});
