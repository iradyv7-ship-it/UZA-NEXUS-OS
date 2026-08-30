/**
 * The UZA Bulk B2B pipeline, from the China handover workbook of 7 August 2026.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-bulk-pipeline.ts
 *
 * Twenty-one enquiries. Every one of them is "awaiting" something, and on nineteen the
 * thing being awaited is on the Rwanda side — a client specification, a sample, a decision.
 * The China desk is not behind; it is idle by dependency.
 *
 * Sixteen are seeded `paused` rather than `parked`. The distinction matters: `paused` keeps
 * them on the books and findable without putting them in the weekly review, so they stop
 * consuming attention while remaining recoverable if a client comes back. Five are active,
 * and those five are the whole near-term revenue case.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const YVES = 'CEO-KGL-0001';
const BADIANE = 'EMP-KGL-0003';
const CECILIA = 'EMP-CHN-0004';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const REVIEW = d('2026-09-05');

interface Deal {
  ref: string;
  name: string;
  client: string;
  live: boolean;
  attention: 'runs' | 'holds' | 'parked';
  owner: string;
  nextAction: string;
  reviewAt?: Date;
}

/** The five that are alive. Each next action is a Rwanda-side action — that is the finding. */
const LIVE: Deal[] = [
  {
    ref: 'INIT-2026-0101',
    name: 'Custom flour bags — 5/10/25 kg',
    client: 'Flour bag client',
    live: true,
    attention: 'runs',
    owner: BADIANE,
    nextAction:
      'Send China a physical bag sample or inside/outside photos, plus quantity by size and whether a PE liner is required. Base quotations are already in hand and cannot be firmed without it.',
  },
  {
    ref: 'INIT-2026-0102',
    name: 'PVC pipe raw materials and formula support',
    client: 'PVC pipe manufacturer',
    live: true,
    attention: 'runs',
    owner: BADIANE,
    nextAction:
      'Collect the technical inputs the factory asked for — pipe type, diameter and wall thickness, standard, a sample or photos, and the existing formula or TDS. Questions were sent and the client has not replied.',
  },
  {
    ref: 'INIT-2026-0103',
    name: 'Vitamin A fortified sugar line — 60–100 t/day turnkey',
    client: 'Sugar producer',
    live: true,
    attention: 'runs',
    owner: BADIANE,
    nextAction:
      'Arrange the end-client technical meeting with ProMach. Do not request a turnkey quotation before installation country, site utilities and budget are known — that is weeks of unpaid engineering.',
  },
  {
    ref: 'INIT-2026-0104',
    name: 'Chemical samples for a paint factory',
    client: 'Paint factory',
    live: true,
    attention: 'holds',
    owner: BADIANE,
    reviewAt: REVIEW,
    nextAction:
      'Consolidate one complete raw-material list — chemical name, grade, application, quantity. Styrene-acrylic is quoted; the rest span several factories and cannot be sourced item by item.',
  },
  {
    ref: 'INIT-2026-0105',
    name: 'School bags, pens and notebooks',
    client: 'School supplies buyer',
    live: true,
    attention: 'holds',
    owner: BADIANE,
    reviewAt: REVIEW,
    nextAction:
      'Confirm an acceptable quality and price. USD 1–2 per bag is not achievable at the stated quality — adjust the specification rather than pressing the price.',
  },
];

/** Dormant. Kept on the books, out of the review, awaiting one close-or-restart decision. */
const DORMANT: { ref: string; name: string; why: string }[] = [
  {
    ref: 'INIT-2026-0106',
    name: 'Airport solar HVAC',
    why: 'Awaiting UZA decision on whether the project is real.',
  },
  {
    ref: 'INIT-2026-0107',
    name: 'Cocoa bean processing line',
    why: 'Quoted; no end-client feedback.',
  },
  {
    ref: 'INIT-2026-0108',
    name: 'Tomato paste raw materials',
    why: 'Quoted FOB Tianjin; validity needs reconfirming.',
  },
  {
    ref: 'INIT-2026-0109',
    name: 'Fireworks and candles',
    why: 'Dangerous-goods freight alone is about USD 20,000.',
  },
  { ref: 'INIT-2026-0110', name: 'Charcoal toothpaste OEM', why: 'No product brief.' },
  {
    ref: 'INIT-2026-0111',
    name: 'AURA branded products',
    why: 'Scope never narrowed to one or two pilot products.',
  },
  {
    ref: 'INIT-2026-0112',
    name: 'Ctorch LED bulbs',
    why: 'Quoted for two containers; noted as highly competitive.',
  },
  {
    ref: 'INIT-2026-0113',
    name: 'Mining crusher',
    why: 'Process design done; no client feedback.',
  },
  { ref: 'INIT-2026-0114', name: 'Roasting factory equipment', why: 'No requirement sheet.' },
  {
    ref: 'INIT-2026-0115',
    name: 'HDPE blow moulding machine',
    why: 'Quoted; unclear whether demand still exists.',
  },
  { ref: 'INIT-2026-0116', name: 'Hotel procurement list', why: 'No BOQ.' },
  { ref: 'INIT-2026-0117', name: 'Adjustable scaffolding', why: 'System type never selected.' },
  {
    ref: 'INIT-2026-0118',
    name: 'Custom mobile phones',
    why: 'Quoted; product direction not chosen.',
  },
  { ref: 'INIT-2026-0119', name: 'Sliding-door smart locks', why: 'Quoted; order not confirmed.' },
  { ref: 'INIT-2026-0120', name: 'Educational facility equipment', why: 'No equipment list.' },
  { ref: 'INIT-2026-0121', name: 'Electrical products', why: 'No actionable RFQ list.' },
];

/** Meeting actions that are genuinely decisions. Backdated to the meeting: 7 August. */
const DECISIONS = [
  {
    ref: 'DEC-2026-0006',
    question: 'Which of the 16 dormant B2B enquiries do we close, and which do we restart?',
    context:
      'All 16 are quoted or half-worked and have had no client movement. Each one still occupies the China desk as an open loop. Recommendation is to close 14 and restart 2 only if a named client re-confirms.',
    initiativeRef: 'INIT-2026-0122',
    raisedAt: d('2026-08-07'),
  },
  {
    ref: 'DEC-2026-0007',
    question:
      'What are the agreed commercial terms with Cecilia — service fee, commission, and who funds samples?',
    context:
      'Meeting action 7, unresolved since 7 August. The workbook states twice that sample and courier costs must be pre-approved by UZA and not advanced by Cecilia. Until this is written down it is a personal exposure carried by an employee.',
    raisedAt: d('2026-08-07'),
  },
  {
    ref: 'DEC-2026-0008',
    question:
      'What is the LC transaction structure — issuing bank, country, value, deposit, sight or usance, tenor?',
    context:
      'Meeting action 6. China cannot screen for exporters who accept the letter of credit without the full structure; a general assurance that "we can do LC" is not screenable.',
    raisedAt: d('2026-08-07'),
  },
  {
    ref: 'DEC-2026-0009',
    question: 'Do we adopt the handover gate as a hard rule from today?',
    context:
      'Meeting action 8, already agreed as correct and not enforced. No China-side work begins until client, specification, quantity, budget/timing and owner are all known. Applying it retroactively would pause most of the current list, which is the point.',
    raisedAt: d('2026-08-07'),
  },
  {
    ref: 'DEC-2026-0010',
    question: 'Which 1–3 market samples do we buy first?',
    context:
      'Meeting actions 3 and 4. Nothing pilots until this is chosen, and the cost must be approved in advance rather than advanced by Cecilia.',
    raisedAt: d('2026-08-07'),
  },
];

const TASKS = [
  {
    ref: 'CTSK-2026-0101',
    title: 'Break the August USD 150,000 target into a project-level pipeline',
    description:
      'Meeting action 5. Per project: expected value, close probability, owner and the client decision date. Overdue — the month is nearly gone, and without a breakdown the number is a target rather than a plan.',
    assigneeId: YVES,
    dueAt: d('2026-08-15'),
  },
  {
    ref: 'CTSK-2026-0102',
    title: 'Create the conference-hall client group and clarify venue, BOQ, budget and timeline',
    description: 'Meeting action 2. No formal RFQ until the inputs are complete.',
    assigneeId: BADIANE,
    dueAt: d('2026-08-29'),
  },
  {
    ref: 'CTSK-2026-0103',
    title: 'Reconfirm quotation validity on every enquiry that is kept open',
    description:
      'Several quotations date from before 7 August and the workbook flags validity explicitly on tomato paste. A stale price presented to a client is worse than no price.',
    assigneeId: CECILIA,
    dueAt: d('2026-09-05'),
  },
];

async function main() {
  for (const deal of LIVE) {
    const data = {
      name: deal.name,
      kind: 'client' as const,
      clientName: deal.client,
      ownerId: deal.owner,
      ventureCode: 'BULK',
      attention: deal.attention,
      nextAction: deal.nextAction,
      reviewAt: deal.reviewAt ?? null,
      status: 'active' as const,
      startedAt: deal.attention === 'runs' ? d('2026-08-07') : null,
    };
    await prisma.initiative.upsert({
      where: { ref: deal.ref },
      create: { ref: deal.ref, ...data },
      update: data,
    });
  }

  for (const deal of DORMANT) {
    const data = {
      name: deal.name,
      kind: 'client' as const,
      ownerId: BADIANE,
      ventureCode: 'BULK',
      // paused, not parked: off the weekly review, still on the books.
      status: 'paused' as const,
      attention: 'parked' as const,
      nextAction: deal.why,
      reviewAt: null,
    };
    await prisma.initiative.upsert({
      where: { ref: deal.ref },
      create: { ref: deal.ref, ...data },
      update: data,
    });
  }

  const sweep = {
    name: 'Close or restart the 16 dormant B2B enquiries',
    kind: 'internal' as const,
    ownerId: BADIANE,
    ventureCode: 'BULK',
    attention: 'runs' as const,
    nextAction:
      'One sitting with Yves and Cecilia. Each of the 16 gets closed or restarted with a named client and a date. Nothing stays open by default.',
    status: 'active' as const,
    startedAt: d('2026-08-07'),
  };
  await prisma.initiative.upsert({
    where: { ref: 'INIT-2026-0122' },
    create: { ref: 'INIT-2026-0122', ...sweep },
    update: sweep,
  });

  for (const dec of DECISIONS) {
    const data = {
      question: dec.question,
      context: dec.context,
      initiativeRef: dec.initiativeRef ?? null,
      raisedById: CECILIA,
      raisedAt: dec.raisedAt,
      status: 'open' as const,
    };
    await prisma.execDecision.upsert({
      where: { ref: dec.ref },
      create: { ref: dec.ref, ...data },
      update: data,
    });
  }

  for (const t of TASKS) {
    const data = {
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId,
      createdById: YVES,
      priority: 'high' as const,
      status: 'todo' as const,
      dueAt: t.dueAt,
    };
    await prisma.commandTask.upsert({
      where: { ref: t.ref },
      create: { ref: t.ref, ...data },
      update: data,
    });
  }

  console.log(`${LIVE.length} live enquiries, ${DORMANT.length} paused, 1 sweep initiative`);
  console.log(`${DECISIONS.length} decisions raised (oldest dated 7 August — 15 days open)`);
  console.log(`${TASKS.length} tasks, 1 already overdue`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
