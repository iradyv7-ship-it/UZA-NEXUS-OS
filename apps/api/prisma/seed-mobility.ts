/**
 * The UZA Mobility go-live plan, as settled on 22 August 2026.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-mobility.ts
 *
 * Run AFTER seed-register and seed-estate — the decisions here reference initiatives
 * created in both.
 *
 * The nine steps are seeded in dependency order and, crucially, most of them are seeded
 * `holds` rather than `runs`. Nine simultaneous running initiatives on one venture with one
 * project manager is not a plan, it is a list. Only what is genuinely unblocked runs; the
 * rest carry a review date and start when the thing above them finishes.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const YVES = 'CEO-KGL-0001';
const SCORAH = 'EMP-KGL-0002';
const GAD = 'EMP-KGL-0007';
const SADDOCK = 'EMP-KGL-0008';
const TRESOR = 'EMP-KGL-0006';
const UNASSIGNED = 'UNASSIGNED';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DOC = 'https://claude.ai/code/artifact/1c9f00f7-60a4-4eb7-9266-739dc2f20684';

interface Step {
  ref: string;
  name: string;
  owner: string;
  attention: 'runs' | 'holds';
  nextAction: string;
  reviewAt?: Date;
  targetDate?: Date;
}

const STEPS: Step[] = [
  {
    ref: 'INIT-2026-0201',
    name: 'UZA ID — one person, one identifier, everywhere',
    owner: GAD,
    attention: 'runs',
    targetDate: d('2026-09-05'),
    nextAction:
      'Written and applied on branch uza-id-and-programme-pack, verified against a database built from every migration in order. Review and merge, then run it on staging. The NOT NULL step is a separate deploy after the two verification queries come back clean.',
  },
  {
    ref: 'INIT-2026-0202',
    name: 'Charging identity join — the smallest proof the ecosystem works',
    owner: GAD,
    attention: 'runs',
    targetDate: d('2026-09-12'),
    nextAction:
      'Unblocked — identity_links exists and takes the link. Write one row per uza-charge driver and the ecosystem claim stops being an assertion.',
  },
  {
    ref: 'INIT-2026-0211',
    name: 'Unguka referral list — 42 candidates, and none of them are ready',
    owner: SCORAH,
    attention: 'runs',
    targetDate: d('2026-09-12'),
    nextAction:
      'Running the generator proved the bottleneck is not paperwork. Not one of the 42 has training, a placement, a readiness score or an allocated vehicle — it is a referral list, not a pipeline. Get the first cohort into the academy; six of the eleven file items produce themselves once that data exists.',
  },
  {
    ref: 'INIT-2026-0212',
    name: 'Generate the eleven — bank file assembly from records we already hold',
    owner: SADDOCK,
    attention: 'runs',
    targetDate: d('2026-09-30'),
    nextAction:
      'Built and merged into the branch. It generates what exists and refuses what does not, which is the point. Wire it to run after every upload, then add the CRB fetch — that is the only one of the eleven with no path at all today.',
  },
  {
    ref: 'INIT-2026-0215',
    name: 'Charging points leased to local operators',
    owner: SCORAH,
    attention: 'holds',
    reviewAt: d('2026-09-15'),
    nextAction:
      'The one line where UZA growing makes other people money. Build one and run it yourself — you cannot lease a model you have never operated — then sign one outside operator for the second before it becomes a strategy.',
  },
  {
    ref: 'INIT-2026-0216',
    name: 'Moto associations — the cheapest route to volume',
    owner: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-08'),
    nextAction:
      'An association with two thousand members is a distribution channel, a credit screen and a constituency in one. Kigali moto taxis are public transport, and the operator-of-record position was built for exactly this. Open the conversation before approaching more banks.',
  },
  {
    ref: 'INIT-2026-0213',
    name: 'First cohort into the academy — the referrals have no training',
    owner: UNASSIGNED,
    attention: 'holds',
    reviewAt: d('2026-09-08'),
    nextAction:
      'Blocked on DEC-2026-0016 — Empower still has no project manager. Every one of the 42 files is waiting on a certificate, a readiness score and measured daily net, and all three come from the academy and placement.',
  },
  {
    ref: 'INIT-2026-0214',
    name: 'CRB report fetch — the one item with no path at all',
    owner: SADDOCK,
    attention: 'holds',
    reviewAt: d('2026-09-22'),
    nextAction:
      'Ten of the eleven file items either generate or can be uploaded. The credit reference report is the only one with no route today, and it is required on every single file.',
  },
  {
    ref: 'INIT-2026-0203',
    name: 'Bank surface on real data — retire the demo portal',
    owner: SCORAH,
    attention: 'runs',
    targetDate: d('2026-09-30'),
    nextAction:
      'The portal the bank has seen is one HTML file with figures typed into it. Rebuild it as a real surface over the platform: the file, the readiness evidence, the repayment record, the collateral release. Until then nothing shown to Unguka can be audited.',
  },
  {
    ref: 'INIT-2026-0204',
    name: 'Buy and book — listing to a reserved VIN',
    owner: SADDOCK,
    attention: 'holds',
    reviewAt: d('2026-09-15'),
    nextAction:
      'The marketplace lists vehicles and has traffic; there is no path from a listing to a booked VIN. This is the shortest route to revenue from customers who already exist.',
  },
  {
    ref: 'INIT-2026-0205',
    name: 'Wallet and the daily split',
    owner: GAD,
    attention: 'holds',
    reviewAt: d('2026-09-22'),
    nextAction:
      'Schema written (migration 02). Blocked on the e-money question with counsel — the design deliberately never holds float overnight, and that has to be confirmed before it is built, not after.',
  },
  {
    ref: 'INIT-2026-0206',
    name: 'One charging site, actually live',
    owner: SCORAH,
    attention: 'holds',
    reviewAt: d('2026-09-15'),
    nextAction:
      'Three sites identified, none committed. Pick one, cost it properly, and order the pile. Everything else in Charge is downstream of real hardware in the ground.',
  },
  {
    ref: 'INIT-2026-0207',
    name: 'OCPP telemetry and live availability',
    owner: SADDOCK,
    attention: 'holds',
    reviewAt: d('2026-10-01'),
    nextAction:
      'Nothing exists. The concierge and the booking logic are both worthless without it — an assistant that routes a driver to a faulted charger costs them a journey rather than saving one.',
  },
  {
    ref: 'INIT-2026-0208',
    name: 'Site-owner and investor portal on UZA Charge',
    owner: SCORAH,
    attention: 'holds',
    reviewAt: d('2026-10-15'),
    nextAction:
      'Uptime, kWh, revenue and their share. This is the surface that makes the management-system subscription sellable to a third party, which is much of why charging is worth doing.',
  },
  {
    ref: 'INIT-2026-0209',
    name: 'Garage and spare parts — job cards against a VIN',
    owner: TRESOR,
    attention: 'holds',
    reviewAt: d('2026-10-01'),
    nextAction:
      'Tools bought, no system. A job card is an event on a VIN and a part is fitted to one, so both belong on the platform rather than in a paper book in the workshop.',
  },
  {
    ref: 'INIT-2026-0210',
    name: 'The charging concierge — find, route, book',
    owner: SADDOCK,
    attention: 'holds',
    reviewAt: d('2026-11-01'),
    nextAction:
      'Deliberately last. Order is hardware, OCPP, availability, booking, payment, and only then the assistant. Starting at the other end produces a demo.',
  },
];

const DECISIONS = [
  {
    ref: 'DEC-2026-0024',
    question: 'Do we set one connector standard across every bike we import?',
    context:
      'Free, and it decides whether a battery swap network is buildable at all. It gets made by accident with the first bike order and cannot be unmade afterwards — a mixed fleet has no swap network, ever.',
    initiativeRef: 'INIT-2026-0206',
    raisedAt: d('2026-08-23'),
  },
  {
    ref: 'DEC-2026-0025',
    question: 'Do we refuse to manufacture our own bike brand, and specify instead?',
    context:
      'Recommendation is refuse, for now. Manufacturing is six capabilities UZA does not have, and badge-engineering takes on the warranty liability without any control over the quality that drives it. At sixty bikes a week no factory rewrites its bill of materials for you; at five hundred it will. Specifying — geometry, chemistry, connector, service interval, diagnostics — is free and delivers most of what the brand was wanted for.',
    initiativeRef: 'INIT-2026-0004',
    raisedAt: d('2026-08-23'),
  },
  {
    ref: 'DEC-2026-0026',
    question: 'What is the ceiling on charging sites UZA operates itself?',
    context:
      'An enabler does not compete with the people it enables. If UZA runs the best site on the street it is also selling software to, the software stops being infrastructure. Own enough to learn and to prove; lease the rest. The number matters because without one, owning drifts upward by default.',
    initiativeRef: 'INIT-2026-0012',
    raisedAt: d('2026-08-23'),
  },
  {
    ref: 'DEC-2026-0027',
    question: 'How many days may a financed vehicle be off the road before it is a credit problem?',
    context:
      'Parts for financed vehicles are credit risk control, not a retail line. The answer sizes the inventory against the loan book rather than against expected sales, which is a different number and usually a larger one. Parts sold to the wider market belong to Bulk, which already has the corridor.',
    initiativeRef: 'INIT-2026-0011',
    raisedAt: d('2026-08-23'),
  },
  {
    ref: 'DEC-2026-0020',
    question: 'Does UZA Charge stay a separate platform and a separate database from UZA Mobility?',
    context:
      'Recommendation is yes, for three reasons that are not preferences: the management system is sold to third-party site owners who will not run on the operator own platform; RURA licences charging and the licensed entity should be narrow; and a charging network is realtime infrastructure whose uptime obligation should not be coupled to a marketplace. They stay joined by UZA ID, not by database.',
    initiativeRef: 'INIT-2026-0206',
    raisedAt: d('2026-08-22'),
  },
  {
    ref: 'DEC-2026-0021',
    question: 'Do we build a founder dashboard per product, or is Nexus the only one?',
    context:
      'Recommendation: Nexus only. Three founder dashboards will disagree with each other within a month, and then none of them gets opened. Each platform feeds Nexus rather than reproducing it.',
    initiativeRef: 'INIT-2026-0020',
    raisedAt: d('2026-08-22'),
  },
  {
    ref: 'DEC-2026-0022',
    question: 'Which of uza-build and uzabuild is real, and what happens to uza-blueprint and uza-serve?',
    context:
      'The same name with a hyphen removed, plus two prototypes with no venture assigned and no push in weeks. Four repositories nobody can currently explain. Recommendation: keep one, archive three.',
    initiativeRef: 'INIT-2026-0021',
    raisedAt: d('2026-08-22'),
  },
  {
    ref: 'DEC-2026-0023',
    question: 'Do the eighteen public repositories become private?',
    context:
      'Including uza-mobility-bn, which carries roughly a hundred models and the entire data design of the financing programme. Five seconds per repository. This is currently a default rather than a decision.',
    initiativeRef: 'INIT-2026-0021',
    raisedAt: d('2026-08-22'),
  },
];

async function main() {
  const known = await prisma.initiative.findMany({ select: { ref: true } });
  const refs = new Set(known.map((k) => k.ref));

  for (const s of STEPS) {
    if (s.attention === 'runs' && !s.nextAction) throw new Error(`${s.ref}: runs with no nextAction`);
    if (s.attention === 'holds' && !s.reviewAt) throw new Error(`${s.ref}: holds with no reviewAt`);
    const data = {
      name: s.name,
      kind: 'venture' as const,
      ventureCode: 'MOBILITY',
      ownerId: s.owner,
      attention: s.attention,
      nextAction: s.nextAction,
      reviewAt: s.reviewAt ?? null,
      targetDate: s.targetDate ?? null,
      artifactUrl: DOC,
      status: 'active' as const,
      startedAt: s.attention === 'runs' ? d('2026-08-22') : null,
    };
    await prisma.initiative.upsert({ where: { ref: s.ref }, create: { ref: s.ref, ...data }, update: data });
    refs.add(s.ref);
  }

  for (const dec of DECISIONS) {
    if (dec.initiativeRef && !refs.has(dec.initiativeRef)) {
      throw new Error(
        `${dec.ref} references ${dec.initiativeRef}, which does not exist.\n` +
          'Run seeds in order: org -> bulk -> register -> estate -> mobility',
      );
    }
    const data = {
      question: dec.question,
      context: dec.context,
      initiativeRef: dec.initiativeRef,
      raisedById: YVES,
      raisedAt: dec.raisedAt,
      status: 'open' as const,
    };
    await prisma.execDecision.upsert({ where: { ref: dec.ref }, create: { ref: dec.ref, ...data }, update: data });
  }

  // The verdicts from the architecture review, recorded against the systems themselves so
  // the projects page shows the judgement rather than only the inventory.
  const verdicts: [string, string][] = [
    ['SYS-2026-0009', 'STANDALONE. Licensed, sellable to third-party site owners, realtime. Move to the UZA-SOLUTIONS org. Joined to Mobility by UZA ID, not by database.'],
    ['SYS-2026-0010', 'MERGE into Mobility. Battery health is an attribute of a vehicle — a column and a chart, not a codebase.'],
    ['SYS-2026-0011', 'MERGE into Mobility as the fleet module. Same vehicles, same drivers; standalone means a second copy of both.'],
    ['SYS-2026-0013', 'MERGE. Becomes the bank surface of the platform. Today it is one HTML file with hard-coded figures — a demo, not a system of record.'],
    ['SYS-2026-0019', 'RETIRE. No venture, no push in weeks, nobody can say what it is for.'],
    ['SYS-2026-0020', 'PICK ONE with uzabuild, archive the other. The same name with a hyphen removed.'],
    ['SYS-2026-0021', 'PICK ONE with uza-build, archive the other.'],
    ['SYS-2026-0022', 'RETIRE. No venture assigned.'],
  ];
  for (const [ref, note] of verdicts) {
    const exists = await prisma.systemRecord.findUnique({ where: { ref }, select: { notes: true } });
    if (!exists) continue;
    await prisma.systemRecord.update({
      where: { ref },
      data: { notes: `${note}${exists.notes ? ` — ${exists.notes}` : ''}`.slice(0, 900) },
    });
  }

  // ── reconcile with what was already in the register ──────────────────────
  //
  // INIT-2026-0015 "backend change pack" and INIT-2026-0201 "UZA ID" are the same work
  // described twice — the pack IS the migrations, and UZA ID is the first of them. Two
  // entries for one job is exactly how a register stops being believed, so the older one
  // is closed rather than left to drift alongside its replacement.
  //
  // INIT-2026-0011 is NOT a duplicate of 0203 and stays: the programme (the bank
  // relationship, the collateral formula, the cohort) is a different thing from the
  // software surface that serves it. Its next action is re-pointed so the two do not
  // silently compete for the same week.
  const superseded = await prisma.initiative.findUnique({ where: { ref: 'INIT-2026-0015' } });
  if (superseded && superseded.status === 'active') {
    await prisma.initiative.update({
      where: { ref: 'INIT-2026-0015' },
      data: {
        status: 'done',
        attention: 'parked',
        closedAt: d('2026-08-22'),
        nextAction:
          'Superseded by INIT-2026-0201. The change pack is the migrations; UZA ID is the first of them and carries the work.',
      },
    });
  }

  await prisma.initiative.updateMany({
    where: { ref: 'INIT-2026-0011' },
    data: {
      nextAction:
        'The programme, not the build — INIT-2026-0203 is the software. Agree the cash-collateral release formula with Unguka in writing, and settle the two disqualifiers with the branch.',
    },
  });

  const runs = STEPS.filter((s) => s.attention === 'runs');
  console.log(`${STEPS.length} go-live steps seeded — ${runs.length} running, ${STEPS.length - runs.length} held behind them`);
  console.log('running now:');
  for (const s of runs) console.log(`  ${s.ref}  ${s.name}  (${s.owner})`);
  console.log(`${DECISIONS.length} decisions raised, ${verdicts.length} systems given a verdict`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
