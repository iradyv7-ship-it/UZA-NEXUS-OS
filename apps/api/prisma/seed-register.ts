/**
 * Seeds the register with what UZA is actually running, as at 21 August 2026.
 *
 * This is not sample data. Every row is a real initiative with a real owner, a real
 * next action, and — where one exists — the published artifact that settles it. Run it
 * once against a fresh database; it is idempotent on `ref` via upsert, so re-running
 * refreshes the register rather than duplicating it.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-register.ts
 *
 * `ownerId` holds a `User.ref`. There is deliberately no foreign key: the register has to
 * be able to name an owner before that person has a login, and "unassigned" has to be
 * expressible. Four initiatives below are owned by UNASSIGNED, which is the honest state
 * and the most important thing this seed records.
 */
import { PrismaClient, type AttentionState, type InitiativeKind } from '@prisma/client';

const prisma = new PrismaClient();

/** User.refs. Employees who exist; UNASSIGNED where nobody has been named yet. */
const YVES = 'CEO-KGL-0001';
const SCORAH = 'EMP-KGL-0002';
const BADIANE = 'EMP-KGL-0003';
const CECILIA = 'EMP-CHN-0004';
const FRANCOIS = 'EMP-CHN-0005';
const TRESOR = 'EMP-KGL-0006';
const GAD = 'EMP-KGL-0007';
const SADDOCK = 'EMP-KGL-0008';
const ABIJURU = 'EMP-KGL-0009';
const UNASSIGNED = 'UNASSIGNED';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface Row {
  ref: string;
  name: string;
  kind: InitiativeKind;
  ventureCode: string;
  ownerId: string;
  attention: AttentionState;
  nextAction?: string;
  reviewAt?: Date;
  targetDate?: Date;
  artifactUrl?: string;
  clientName?: string;
}

/**
 * The register. Order is roughly by venture, not by priority — priority is `attention`,
 * and the point of the register is that it is the only place priority is recorded.
 *
 * Note the invariants the service enforces: every `runs` row carries a nextAction, and
 * every `holds` row carries a reviewAt. If a row below is missing one, the seed will fail
 * rather than write a register that lies.
 */
const REGISTER: Row[] = [
  // ── GROUP ────────────────────────────────────────────────────────────────
  {
    ref: 'INIT-2026-0001',
    name: 'Group structure — which company holds what',
    kind: 'internal',
    ventureCode: 'GROUP',
    ownerId: YVES,
    attention: 'runs',
    nextAction:
      'Answer the four open decisions: one company or two, UZA Charge before or after the licence, internal wholesale margin, and whether Empower separates this year.',
    artifactUrl: 'https://claude.ai/code/artifact/0565a5a1-2816-4484-92ea-eda2e0993704',
  },
  {
    ref: 'INIT-2026-0002',
    name: 'The licence perimeter — six regulators',
    kind: 'internal',
    ventureCode: 'GROUP',
    ownerId: YVES,
    attention: 'runs',
    nextAction: 'Send the ten questions to counsel. The e-money bright line blocks the wallet design until answered.',
    artifactUrl: 'https://claude.ai/code/artifact/e87bcda5-b971-4bed-bb62-c3695c2d652c',
  },
  {
    ref: 'INIT-2026-0003',
    name: 'uzasolutions.com rebuild',
    kind: 'internal',
    ventureCode: 'GROUP',
    ownerId: ABIJURU,
    attention: 'runs',
    nextAction: 'Choose the hero line so the homepage can be finished. Five changes from the blueprint are already documented.',
    artifactUrl: 'https://claude.ai/code/artifact/4a6f42dc-b799-4db3-892d-2e9375884c5f',
  },
  {
    ref: 'INIT-2026-0004',
    name: 'The operating model — owners for every venture',
    kind: 'internal',
    ventureCode: 'GROUP',
    ownerId: YVES,
    attention: 'runs',
    nextAction: 'Name owners for charging, grants, Cloud and Empower. Four holes, and three of them are blocking other initiatives.',
    artifactUrl: 'https://claude.ai/code/artifact/d60231b0-805a-4cd2-8cb2-364df0ff69b8',
  },

  // ── UZA BULK ─────────────────────────────────────────────────────────────
  {
    ref: 'INIT-2026-0005',
    name: 'Bulk sourcing operations — factory to consignee',
    kind: 'internal',
    ventureCode: 'BULK',
    ownerId: CECILIA,
    attention: 'runs',
    nextAction: "Decide François's reporting line, then hand him the manual on day one.",
    artifactUrl: 'https://claude.ai/code/artifact/92e662bc-aa38-4bc5-b5a5-17ad167dbeee',
  },
  {
    ref: 'INIT-2026-0006',
    name: 'Bulk go-to-market',
    kind: 'internal',
    ventureCode: 'BULK',
    ownerId: BADIANE,
    attention: 'runs',
    nextAction: 'Give Badiane one weekly number and hold him to it. The go-to-market document is not written yet.',
  },
  {
    ref: 'INIT-2026-0007',
    name: 'Charging pile wholesale line',
    kind: 'venture',
    ventureCode: 'BULK',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-15'),
    nextAction: 'Haidira is the cheapest quote at $4,655 EXW for 120kW. Nothing moves until charging has an owner.',
    artifactUrl: 'https://claude.ai/code/artifact/75856dd2-0493-4bae-83a4-2fe464a7ce86',
  },
  {
    ref: 'INIT-2026-0008',
    name: 'Solar hardware import line',
    kind: 'venture',
    ventureCode: 'BULK',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-10-01'),
    nextAction: 'Quote panels, inverters and mounting through the same corridor as the chargers. Same suppliers, same terms.',
  },

  // ── UZA MOBILITY ─────────────────────────────────────────────────────────
  {
    ref: 'INIT-2026-0009',
    name: 'RURA taxi cab company licence',
    kind: 'internal',
    ventureCode: 'MOBILITY',
    ownerId: YVES,
    attention: 'runs',
    nextAction: 'File the application. 681 days of zero-tax EV imports remain and the operator-of-record position depends on this.',
    targetDate: d('2026-09-30'),
    artifactUrl: 'https://claude.ai/code/artifact/f5703915-9521-412a-83c8-11add5919420',
  },
  {
    ref: 'INIT-2026-0010',
    name: 'Mento vehicle supply — amendment and addendum 001',
    kind: 'client',
    clientName: 'Mento',
    ventureCode: 'MOBILITY',
    ownerId: YVES,
    attention: 'runs',
    nextAction:
      'Fix the proforma defects and add the release clause before the 40% deposit leaves. Eight vehicles, RWF 200,000,000.',
    artifactUrl: 'https://claude.ai/code/artifact/0bfbd133-169d-42ac-ac40-c87d21b45ecd',
  },
  {
    ref: 'INIT-2026-0011',
    name: 'Tunga Taxi driver financing with LOLC Unguka',
    kind: 'venture',
    ventureCode: 'MOBILITY',
    ownerId: SCORAH,
    attention: 'runs',
    nextAction:
      'Get the portal in front of the bank with the real requirement list and the two disqualifiers. Then agree the cash-collateral release formula in writing.',
  },
  {
    ref: 'INIT-2026-0012',
    name: 'Charging network — three sites',
    kind: 'venture',
    ventureCode: 'MOBILITY',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-15'),
    nextAction: 'Gatenga, Nature Kigali and Elite Paradise are identified. This needs a named owner before a site is committed.',
    artifactUrl: 'https://claude.ai/code/artifact/75856dd2-0493-4bae-83a4-2fe464a7ce86',
  },
  {
    ref: 'INIT-2026-0013',
    name: 'Solar canopy at Gatenga',
    kind: 'venture',
    ventureCode: 'MOBILITY',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-10-01'),
    nextAction:
      'Confirm three assumptions before this becomes a proposal: PV yield, the industrial tariff, and installed cost per watt. ~54 kWp over 300 m².',
    artifactUrl: 'https://claude.ai/code/artifact/0565a5a1-2816-4484-92ea-eda2e0993704',
  },
  {
    ref: 'INIT-2026-0014',
    name: 'Garage — high-voltage readiness',
    kind: 'venture',
    ventureCode: 'MOBILITY',
    ownerId: TRESOR,
    attention: 'runs',
    nextAction: 'Buy the nine safety items before the first high-voltage job. No HV work until they are on the wall.',
    artifactUrl: 'https://claude.ai/code/artifact/aa60e04c-b14b-431d-80d2-14393a9be193',
  },
  {
    ref: 'INIT-2026-0015',
    name: 'uza-mobility-bn backend change pack',
    kind: 'internal',
    ventureCode: 'MOBILITY',
    ownerId: GAD,
    attention: 'runs',
    nextAction: 'Apply migration 01 (UZA ID), then 06 immediately after. Everything downstream waits on the shared identity.',
  },

  // ── UZA EMPOWER ──────────────────────────────────────────────────────────
  {
    ref: 'INIT-2026-0016',
    name: 'Driver training — the three-track restructure',
    kind: 'venture',
    ventureCode: 'EMPOWER',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-08'),
    nextAction: 'Name a delivery lead. Agree the repayment comparison group with Unguka before cohort 2 starts.',
    artifactUrl: 'https://claude.ai/code/artifact/ded404ac-5815-45ae-8c70-a40604135eb8',
  },
  {
    ref: 'INIT-2026-0017',
    name: 'Impact measurement across the group',
    kind: 'internal',
    ventureCode: 'EMPOWER',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-08'),
    nextAction: 'Blocked behind UZA ID. Until one person has one identifier across five systems, no impact claim survives diligence.',
  },
  {
    ref: 'INIT-2026-0018',
    name: 'Grant pipeline — six live funders',
    kind: 'internal',
    ventureCode: 'GROUP',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-01'),
    nextAction:
      'Name an owner, then one meeting with Ireme Invest: is blocked cash collateral eligible under the PPF, and does vehicle stock qualify under the BRD facility?',
    artifactUrl: 'https://claude.ai/code/artifact/6f2aae43-705f-4b3a-918d-872b7c1ac439',
  },

  // ── UZA CLOUD / NEXUS ────────────────────────────────────────────────────
  {
    ref: 'INIT-2026-0019',
    name: 'Alibaba Cloud reseller agreement',
    kind: 'venture',
    ventureCode: 'CLOUD',
    ownerId: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-22'),
    nextAction: 'This is a signature, not a build. Get the reseller agreement executed, then staff it.',
  },
  {
    ref: 'INIT-2026-0020',
    name: 'UZA Nexus — the operating layer',
    kind: 'internal',
    ventureCode: 'NEXUS',
    ownerId: GAD,
    attention: 'runs',
    nextAction: 'Push the repository — it still has no git remote. Then seed the register and run the first Monday review against it.',
    artifactUrl: 'https://claude.ai/code/artifact/55b9f1e2-c2bd-4870-840f-4205c6abf7a4',
  },
  {
    ref: 'INIT-2026-0021',
    name: 'Software estate consolidation',
    kind: 'internal',
    ventureCode: 'CLOUD',
    ownerId: SADDOCK,
    attention: 'runs',
    nextAction: 'Move uza-charge and Battery-life into the UZA-SOLUTIONS org, then retire the duplicated Lovable projects.',
    artifactUrl: 'https://claude.ai/code/artifact/55b9f1e2-c2bd-4870-840f-4205c6abf7a4',
  },
  {
    ref: 'INIT-2026-0022',
    name: 'Apsara in Kigali',
    kind: 'venture',
    ventureCode: 'CLOUD',
    ownerId: YVES,
    attention: 'parked',
    nextAction: 'Parked until the Alibaba meeting happens. Held personally and deliberately unentangled from the group.',
  },
];

/**
 * The decisions that are genuinely waiting on the CEO right now. Seeded open, with
 * `raisedAt` backdated so the bottleneck metric reports the truth on day one rather
 * than starting everything at zero days.
 */
const DECISIONS = [
  {
    ref: 'DEC-2026-0001',
    question: 'Do UZA Bulk and UZA Mobility stay divisions of one company?',
    context:
      'Separating them costs a second audit, a second filing, and a transfer-pricing position on every vehicle. Recommendation is to stay one company and revisit only if an investor demands a ring-fence.',
    initiativeRef: 'INIT-2026-0001',
    raisedAt: d('2026-08-21'),
  },
  {
    ref: 'DEC-2026-0002',
    question: 'Is UZA Charge incorporated before the RURA licence application, or after?',
    context:
      'Applying in the trading company name and moving the licence later is, in most regimes, a fresh application. Recommendation is before.',
    initiativeRef: 'INIT-2026-0009',
    raisedAt: d('2026-08-21'),
  },
  {
    ref: 'DEC-2026-0003',
    question: 'Does Bulk charge UZA Charge a real wholesale margin on internal charging-pile sales?',
    context:
      'At the third-party price, the wholesale line learns whether it is competitive before external sales are bet on. At a discount, it never finds out.',
    initiativeRef: 'INIT-2026-0007',
    raisedAt: d('2026-08-21'),
  },
  {
    ref: 'DEC-2026-0004',
    question: 'Does UZA Empower become a separate entity this year, or stay a division?',
    context:
      'Genuinely open. It should be answered by the grant strategy rather than by preference, and answering it late will cost a funding round.',
    initiativeRef: 'INIT-2026-0018',
    raisedAt: d('2026-08-21'),
  },
  {
    ref: 'DEC-2026-0005',
    question: 'Who owns charging?',
    context:
      'Four initiatives are held solely because nobody is named: the wholesale line, the three sites, the solar canopy, and by extension the licence timing.',
    initiativeRef: 'INIT-2026-0004',
    raisedAt: d('2026-08-14'),
  },
];

async function main() {
  // The invariants the service enforces, checked here too — a seed that writes a
  // register the API would have rejected is worse than a seed that fails.
  for (const r of REGISTER) {
    if (r.attention === 'runs' && !r.nextAction) throw new Error(`${r.ref}: runs with no nextAction`);
    if (r.attention === 'holds' && !r.reviewAt) throw new Error(`${r.ref}: holds with no reviewAt`);
  }

  for (const r of REGISTER) {
    const data = {
      name: r.name,
      kind: r.kind,
      clientName: r.clientName ?? null,
      ownerId: r.ownerId,
      ventureCode: r.ventureCode,
      attention: r.attention,
      nextAction: r.nextAction ?? null,
      reviewAt: r.reviewAt ?? null,
      targetDate: r.targetDate ?? null,
      artifactUrl: r.artifactUrl ?? null,
      status: 'active' as const,
      startedAt: r.attention === 'runs' ? d('2026-08-21') : null,
    };
    await prisma.initiative.upsert({ where: { ref: r.ref }, create: { ref: r.ref, ...data }, update: data });
  }

  for (const dec of DECISIONS) {
    await prisma.execDecision.upsert({
      where: { ref: dec.ref },
      create: {
        ref: dec.ref,
        question: dec.question,
        context: dec.context,
        initiativeRef: dec.initiativeRef,
        raisedById: YVES,
        raisedAt: dec.raisedAt,
        status: 'open',
      },
      update: { question: dec.question, context: dec.context, initiativeRef: dec.initiativeRef },
    });
  }

  const runs = REGISTER.filter((r) => r.attention === 'runs').length;
  const holds = REGISTER.filter((r) => r.attention === 'holds').length;
  const parked = REGISTER.filter((r) => r.attention === 'parked').length;
  const orphans = REGISTER.filter((r) => r.ownerId === UNASSIGNED).length;

  console.log(`register seeded: ${REGISTER.length} initiatives — ${runs} running, ${holds} held, ${parked} parked`);
  console.log(`${orphans} have no named owner. That is the finding, not a gap in the data.`);
  console.log(`${DECISIONS.length} decisions open and waiting on the CEO.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
