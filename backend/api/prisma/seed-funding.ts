/**
 * What UZA is raising, from whom, and what it releases.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-funding.ts
 *
 * Run last — every track names initiatives created by the earlier seeds.
 *
 * The `unlocks` field on each track is the point. The founder's strategy is that each
 * venture stands alone to a funder and whichever closes first pushes the others forward.
 * That only works if the push is recorded BEFORE the money arrives; afterwards everyone has
 * an opinion about where it should go, and the strategy becomes whatever was loudest.
 *
 * Amounts are whole RWF unless the currency says otherwise. They are UZA's own inputs from
 * the capital model and should be re-set the moment the bank gives its twelve-month ceiling
 * — that number sizes almost everything here.
 */
import { PrismaClient, type FundingInstrument, type FundingStage } from '@prisma/client';

const prisma = new PrismaClient();

const YVES = 'CEO-KGL-0001';
const SCORAH = 'EMP-KGL-0002';
const BADIANE = 'EMP-KGL-0003';
const UNASSIGNED = 'UNASSIGNED';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface Track {
  ref: string;
  name: string;
  instrument: FundingInstrument;
  funder: string;
  amount: number;
  currency?: string;
  venture: string | null;
  owner: string;
  stage: FundingStage;
  unlocks: string[];
  evidence: string;
  blocker?: string;
  decisionBy?: Date;
}

const TRACKS: Track[] = [
  {
    ref: 'FUND-2026-0001',
    name: 'Letter of credit line for vehicle sourcing',
    instrument: 'facility',
    funder: 'Unguka / a commercial bank — to be chosen',
    amount: 430_000_000,
    venture: 'MOBILITY',
    owner: YVES,
    stage: 'identified',
    unlocks: ['INIT-2026-0010', 'INIT-2026-0204'],
    evidence:
      'An executed supply agreement with 40/20/40 terms, a landed-cost history, and a named waiting list of drivers. The corridor has been run before, not modelled.',
    blocker:
      'DEC-2026-0008 — the transaction structure is undefined, so China cannot screen for exporters who accept the credit. Open since 7 August.',
    decisionBy: d('2026-09-30'),
  },
  {
    ref: 'FUND-2026-0002',
    name: 'Sourcing revolver — funds supplier deposits, repaid on bank settlement',
    instrument: 'revolver',
    funder: 'Trade financier — not yet approached',
    amount: 430_000_000,
    venture: 'MOBILITY',
    owner: YVES,
    stage: 'identified',
    unlocks: ['INIT-2026-0204'],
    evidence:
      'Roughly 105-day secured turn against vehicles, with the bank payment assignable. Two hundred drivers on a list and a lender already writing the product.',
    blocker:
      'Size it off the bank ceiling, which nobody has asked for. A facility larger than the off-take pays interest on idle cash.',
  },
  {
    ref: 'FUND-2026-0003',
    name: 'Lender panel — a second and third institution on the same product',
    instrument: 'offtake',
    funder: 'Unguka (tranche 1), then others',
    amount: 4_860_000_000,
    venture: 'MOBILITY',
    owner: SCORAH,
    stage: 'qualifying',
    unlocks: ['INIT-2026-0011', 'INIT-2026-0203'],
    evidence:
      'A documented product: contribution bands, the readiness score, the requirement list, the two disqualifiers, and the collateral release formula. A second lender is being sold an operating system rather than a favour.',
    blocker:
      'Nobody has asked Unguka the only question that matters: what is the maximum you can write on this programme in twelve months? Two hundred vehicles at ninety per cent is 4.86bn, which no single microfinance institution writes.',
    decisionBy: d('2026-09-15'),
  },
  {
    ref: 'FUND-2026-0004',
    name: 'Ireme Invest — charging and solar infrastructure',
    instrument: 'concessional',
    funder: 'Ireme Invest / BRD',
    amount: 300_000_000,
    venture: 'MOBILITY',
    owner: UNASSIGNED,
    stage: 'identified',
    unlocks: ['INIT-2026-0012', 'INIT-2026-0013', 'INIT-2026-0206'],
    evidence:
      'Three identified sites, real supplier quotations at $4,655 EXW for 120kW, and a solar canopy costed at roughly 54 kWp over 300 square metres.',
    blocker:
      'No owner. Two questions decide the instrument — is blocked cash collateral eligible under the project preparation facility, and does charger stock qualify under the BRD credit line. Neither has been asked.',
  },
  {
    ref: 'FUND-2026-0005',
    name: 'Non-resident investors — charging sites via an SPV per cluster',
    instrument: 'equity',
    funder: 'Diaspora and non-resident investors',
    amount: 200_000_000,
    venture: 'MOBILITY',
    owner: SCORAH,
    stage: 'identified',
    unlocks: ['INIT-2026-0206', 'INIT-2026-0208'],
    evidence:
      "The structure is designed: one SPV per site cluster, UZA operates under a management agreement and takes a fee plus the software subscription. The investor exposure ends at the SPV and so does UZA's.",
    blocker:
      'The site-owner portal does not exist, and an investor with no reporting surface is being asked to trust a spreadsheet.',
  },
  {
    ref: 'FUND-2026-0006',
    name: 'Training and impact — grant funding for the driver programme',
    instrument: 'grant',
    funder: 'Six funders assessed in The Grant Ledger',
    amount: 300_000_000,
    venture: 'EMPOWER',
    owner: UNASSIGNED,
    stage: 'qualifying',
    unlocks: ['INIT-2026-0016', 'INIT-2026-0017'],
    evidence:
      'A three-track training restructure and a cohort already in progress. What is missing is the evidence chain, which is exactly what UZA ID produces.',
    blocker:
      'No owner, and no impact measurement. Every application asks whether the driver, the vehicle, the income and the repayment are the same record — and today they are not.',
  },
  {
    ref: 'FUND-2026-0007',
    name: 'Bulk working capital against confirmed orders',
    instrument: 'debt',
    funder: 'Commercial bank — not yet approached',
    amount: 150_000_000,
    venture: 'BULK',
    owner: BADIANE,
    stage: 'parked',
    unlocks: ['INIT-2026-0101', 'INIT-2026-0102'],
    evidence: 'Five live enquiries with quotations in hand.',
    blocker:
      'Parked deliberately. Nineteen of twenty-one enquiries are waiting on the Rwanda side, so there is nothing to finance yet — borrowing against a pipeline that is not moving would pay interest on the wrong problem.',
  },
];

async function main() {
  const known = new Set(
    (await prisma.initiative.findMany({ select: { ref: true } })).map((i) => i.ref),
  );

  // A dangling unlock is recorded, not rejected — a track routinely releases work that has
  // not been entered yet. But it is reported, because an unlock nobody can find is intent
  // with nowhere to land.
  const dangling: string[] = [];
  for (const t of TRACKS)
    for (const u of t.unlocks) if (!known.has(u)) dangling.push(`${t.ref} -> ${u}`);

  for (const t of TRACKS) {
    const data = {
      name: t.name,
      instrument: t.instrument,
      funder: t.funder,
      amountSought: t.amount,
      currency: t.currency ?? 'RWF',
      ventureCode: t.venture,
      ownerId: t.owner,
      stage: t.stage,
      unlocks: t.unlocks,
      evidence: t.evidence,
      blocker: t.blocker ?? null,
      decisionBy: t.decisionBy ?? null,
    };
    await prisma.fundingTrack.upsert({
      where: { ref: t.ref },
      create: { ref: t.ref, ...data },
      update: data,
    });
  }

  const live = TRACKS.filter((t) => t.stage !== 'parked' && t.stage !== 'declined');
  const noOwner = TRACKS.filter((t) => t.owner === UNASSIGNED);
  const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}bn` : `${Math.round(n / 1e6)}M`);

  console.log(`${TRACKS.length} funding tracks — ${live.length} live`);
  for (const t of TRACKS) {
    console.log(
      `  ${t.ref}  ${fmt(t.amount).padStart(7)} RWF  ${t.instrument.padEnd(12)} ${t.stage.padEnd(12)} ${t.name.slice(0, 46)}`,
    );
  }
  console.log(
    `\ntotal sought across live tracks: RWF ${fmt(live.reduce((a, t) => a + t.amount, 0))}`,
  );
  console.log(
    `${noOwner.length} tracks have no owner. An unowned funder conversation does not happen.`,
  );
  if (dangling.length)
    console.log(`dangling unlocks (recorded, not in the register): ${dangling.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
