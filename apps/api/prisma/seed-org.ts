/**
 * The team, and what each person is on the hook for.
 *
 * Sourced from the founder's own assignment (22 August 2026) and from the China handover
 * workbook. Idempotent on `ref` — re-running refreshes rather than duplicates.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-org.ts
 *
 * The point of this file is not the list. It is that the list can be counted: once every
 * duty has a named owner, a backup and a response time, `ResponsibilityService.concentration`
 * can say out loud how much of the company is queued behind one person.
 */
import { PrismaClient, type ResponsibilityKind, type ResponsibilityTrigger } from '@prisma/client';

const prisma = new PrismaClient();

// ── people ─────────────────────────────────────────────────────────────────
const YVES = 'CEO-KGL-0001';
const SCORAH = 'EMP-KGL-0002';
const BADIANE = 'EMP-KGL-0003';
const CECILIA = 'EMP-CHN-0004';
const FRANCOIS = 'EMP-CHN-0005';
const TRESOR = 'EMP-KGL-0006';
const GAD = 'EMP-KGL-0007';
const SADDOCK = 'EMP-KGL-0008';
const ABIJURU = 'EMP-KGL-0009';
const ADELINE = 'EMP-KGL-0010';

const DEPARTMENTS = [
  { code: 'GROUP', name: 'Group & executive' },
  { code: 'BULK', name: 'UZA Bulk — sourcing and import' },
  { code: 'MOBILITY', name: 'UZA Mobility' },
  { code: 'EMPOWER', name: 'UZA Empower' },
  { code: 'CLOUD', name: 'UZA Cloud & Nexus' },
];

const PEOPLE = [
  { userId: YVES, title: 'Founder & CEO', dept: 'GROUP', managerId: null },
  { userId: SCORAH, title: 'Project manager — UZA Mobility', dept: 'MOBILITY', managerId: YVES },
  { userId: BADIANE, title: 'Project manager — UZA Bulk', dept: 'BULK', managerId: YVES },
  { userId: GAD, title: 'Project manager — IT and platform', dept: 'CLOUD', managerId: YVES },
  // Cecilia runs the China desk for BOTH ventures, which is why she reports to the CEO
  // rather than to either project manager. That is a deliberate choice and it has a cost:
  // when Badiane and Scorah both need her in the same week, nobody but the CEO can
  // sequence her. See DEC-2026-0015.
  { userId: CECILIA, title: 'China operations lead (Bulk and Mobility)', dept: 'BULK', managerId: YVES },
  { userId: FRANCOIS, title: 'China verification officer (from September)', dept: 'BULK', managerId: CECILIA },
  { userId: ADELINE, title: 'Customer care — all ventures', dept: 'GROUP', managerId: YVES },
  { userId: TRESOR, title: 'Garage & high-voltage technician', dept: 'MOBILITY', managerId: SCORAH },
  { userId: SADDOCK, title: 'Engineering', dept: 'CLOUD', managerId: GAD },
  { userId: ABIJURU, title: 'Web & brand', dept: 'CLOUD', managerId: GAD },
];

interface Resp {
  ref: string;
  name: string;
  venture: string;
  owner: string;
  backup?: string;
  kind: ResponsibilityKind;
  trigger: ResponsibilityTrigger;
  hours?: number;
  notes?: string;
  startsOn?: Date;
}

const SEPTEMBER = new Date('2026-09-01T00:00:00.000Z');

/**
 * Every duty, against a name.
 *
 * Response hours are set where the founder's own account of the problem points: the delays
 * are on decisions and approvals, not on execution. Where a number is a first proposal
 * rather than an agreed standard it is marked in the notes — an SLA nobody agreed to is
 * not an SLA.
 */
const RESPONSIBILITIES: Resp[] = [
  // ── UZA BULK — the China desk ────────────────────────────────────────────
  {
    ref: 'RESP-2026-0001',
    name: 'Supplier sourcing and factory matching (China)',
    venture: 'BULK',
    owner: CECILIA,
    kind: 'standing',
    trigger: 'per_deal',
    notes: 'Only starts once the handover gate has passed. Everything before that is the Rwanda side.',
  },
  {
    ref: 'RESP-2026-0002',
    name: 'Quotation coordination and technical clarification with factories',
    venture: 'BULK',
    owner: CECILIA,
    kind: 'standing',
    trigger: 'per_deal',
  },
  {
    ref: 'RESP-2026-0003',
    name: 'Client requirement collection — specification, quantity, budget, timing',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'per_deal',
    notes:
      'The binding constraint today. 19 of 21 open enquiries are waiting on this, not on China.',
  },
  {
    ref: 'RESP-2026-0004',
    name: 'Handover gate — no China work starts without client, spec, quantity, budget and owner',
    venture: 'BULK',
    owner: BADIANE,
    backup: CECILIA,
    kind: 'gate',
    trigger: 'per_deal',
    hours: 48,
    notes:
      'Meeting action 8 from the 7 August handover. Already agreed as the right rule and not yet enforced; enforcing it would have prevented most of the current backlog.',
  },
  {
    ref: 'RESP-2026-0005',
    name: 'Sample and courier cost approval',
    venture: 'BULK',
    owner: YVES,
    backup: SCORAH,
    kind: 'approval',
    trigger: 'per_request',
    hours: 24,
    notes:
      'Meeting actions 3 and 7: costs are pre-approved by UZA and never advanced by Cecilia. The 24-hour clock is a proposal until confirmed.',
  },
  {
    ref: 'RESP-2026-0006',
    name: 'Close-or-continue decision on a dormant enquiry',
    venture: 'BULK',
    owner: YVES,
    backup: BADIANE,
    kind: 'approval',
    trigger: 'per_deal',
    hours: 72,
    notes: 'Meeting action 1. Without this, dormant projects consume China-side attention indefinitely.',
  },
  {
    ref: 'RESP-2026-0007',
    name: 'What is ready to ship — readiness call and client notification',
    venture: 'BULK',
    owner: BADIANE,
    backup: CECILIA,
    kind: 'standing',
    trigger: 'per_shipment',
  },
  {
    ref: 'RESP-2026-0008',
    name: 'Freight booking and consolidation',
    venture: 'BULK',
    owner: CECILIA,
    kind: 'standing',
    trigger: 'per_shipment',
  },

  // ── UZA BULK — François, from September ──────────────────────────────────
  {
    ref: 'RESP-2026-0009',
    name: 'Quality verification at the factory',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: CECILIA,
    kind: 'gate',
    trigger: 'per_shipment',
    hours: 48,
    startsOn: SEPTEMBER,
    notes: 'Includes factories near Foshan, where the warehouse is. Tasked by Cecilia or Yves.',
  },
  {
    ref: 'RESP-2026-0010',
    name: 'Consignee verification',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: CECILIA,
    kind: 'gate',
    trigger: 'per_shipment',
    hours: 24,
    startsOn: SEPTEMBER,
    notes:
      'The consignee on the bill of lading determines who can collect the goods and, on financed vehicles, who the bank pays. Getting this wrong is not a paperwork error.',
  },
  {
    ref: 'RESP-2026-0011',
    name: 'Document verification — invoice, packing list, certificate of origin, bill of lading',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: CECILIA,
    kind: 'gate',
    trigger: 'per_shipment',
    hours: 24,
    startsOn: SEPTEMBER,
  },
  {
    ref: 'RESP-2026-0012',
    name: 'Weight and CBM verification before loading',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: CECILIA,
    kind: 'gate',
    trigger: 'per_shipment',
    hours: 24,
    startsOn: SEPTEMBER,
    notes: 'Understated CBM is discovered at the port, when it is expensive.',
  },
  {
    ref: 'RESP-2026-0013',
    name: 'Last-mile delivery address verification',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: ADELINE,
    kind: 'gate',
    trigger: 'per_shipment',
    hours: 24,
    startsOn: SEPTEMBER,
  },
  {
    ref: 'RESP-2026-0014',
    name: 'Loading supervision and container photographs',
    venture: 'BULK',
    owner: FRANCOIS,
    backup: CECILIA,
    kind: 'standing',
    trigger: 'per_shipment',
    startsOn: SEPTEMBER,
  },

  // ── UZA MOBILITY ─────────────────────────────────────────────────────────
  {
    ref: 'RESP-2026-0015',
    name: 'Vehicle sourcing and supplier terms (China)',
    venture: 'MOBILITY',
    owner: CECILIA,
    backup: YVES,
    kind: 'standing',
    trigger: 'per_deal',
  },
  {
    ref: 'RESP-2026-0016',
    name: 'Driver financing files and the bank relationship',
    venture: 'MOBILITY',
    owner: SCORAH,
    backup: YVES,
    kind: 'standing',
    trigger: 'per_deal',
  },
  {
    ref: 'RESP-2026-0017',
    name: 'Deposit release approval before a supplier payment leaves',
    venture: 'MOBILITY',
    owner: YVES,
    backup: SCORAH,
    kind: 'approval',
    trigger: 'per_deal',
    hours: 24,
    notes:
      'Any supplier bank-detail change requires two approvals plus voice verification on a previously held number. Never into a personal account.',
  },
  {
    ref: 'RESP-2026-0018',
    name: 'Change of ownership and registration in the client name',
    venture: 'MOBILITY',
    owner: SCORAH,
    backup: ADELINE,
    kind: 'gate',
    trigger: 'per_deal',
    hours: 72,
  },
  {
    ref: 'RESP-2026-0019',
    name: 'Garage intake, high-voltage safety and job sign-off',
    venture: 'MOBILITY',
    owner: TRESOR,
    backup: SCORAH,
    kind: 'gate',
    trigger: 'per_request',
    hours: 24,
    notes: 'No high-voltage work until the nine safety items are on the wall.',
  },

  // ── CUSTOMER COMMUNICATION — both ventures ───────────────────────────────
  {
    ref: 'RESP-2026-0020',
    name: 'First response to any inbound client message',
    venture: 'GROUP',
    owner: ADELINE,
    backup: BADIANE,
    kind: 'standing',
    trigger: 'per_request',
    hours: 4,
    notes:
      'A first response is an acknowledgement with a named owner and a date, not an answer. Four hours is a proposal until agreed.',
  },
  {
    ref: 'RESP-2026-0021',
    name: 'Client status updates on open orders and shipments',
    venture: 'GROUP',
    owner: ADELINE,
    backup: BADIANE,
    kind: 'standing',
    trigger: 'weekly',
  },
  {
    ref: 'RESP-2026-0022',
    name: 'Driver and applicant communication on the Tunga Taxi programme',
    venture: 'MOBILITY',
    owner: ADELINE,
    backup: SCORAH,
    kind: 'standing',
    trigger: 'per_request',
    hours: 24,
  },

  // ── GROUP ────────────────────────────────────────────────────────────────
  {
    ref: 'RESP-2026-0023',
    name: 'Answer decisions raised to the CEO',
    venture: 'GROUP',
    owner: YVES,
    backup: SCORAH,
    kind: 'approval',
    trigger: 'per_request',
    hours: 72,
    notes:
      'The measured one. DecisionService.bottleneck reports the oldest open decision every Monday; if it exceeds this number the constraint is named and dated rather than felt.',
  },
  {
    ref: 'RESP-2026-0024',
    name: 'Weekly check-in on every running initiative',
    venture: 'GROUP',
    owner: YVES,
    backup: SCORAH,
    kind: 'standing',
    trigger: 'weekly',
    notes: 'Owners file; the CEO reads. Missing check-ins are the finding, not the absence of a report.',
  },
  {
    ref: 'RESP-2026-0025',
    name: 'Website, brand and public claims',
    venture: 'CLOUD',
    owner: ABIJURU,
    backup: YVES,
    kind: 'standing',
    trigger: 'ad_hoc',
  },
  {
    ref: 'RESP-2026-0026',
    name: 'Platform engineering — Nexus, portals and backend',
    venture: 'CLOUD',
    owner: GAD,
    backup: SADDOCK,
    kind: 'standing',
    trigger: 'ad_hoc',
  },
  // ── PROJECT MANAGERS ─────────────────────────────────────────────────────
  // Named 22 August. A project manager here owns the venture end to end — thinking,
  // planning, sales, marketing, delivery — not a slice of it. Recording that as four
  // duties rather than one line is what makes it checkable: a PM who has not set a
  // quarterly target, or whose initiatives filed no check-in, is visibly not managing
  // the project, and the register says so without anyone having to raise it.
  {
    ref: 'RESP-2026-0027',
    name: 'UZA Mobility — venture plan, targets and quarterly review',
    venture: 'MOBILITY',
    owner: SCORAH,
    kind: 'standing',
    trigger: 'monthly',
    notes: 'Vehicle supply, Tunga Taxi, charging, solar and the garage. The whole venture, not a slice of it.',
  },
  {
    ref: 'RESP-2026-0028',
    name: 'UZA Mobility — sales and marketing',
    venture: 'MOBILITY',
    owner: SCORAH,
    kind: 'standing',
    trigger: 'weekly',
  },
  {
    ref: 'RESP-2026-0029',
    name: 'UZA Mobility — weekly check-in on every initiative in the venture',
    venture: 'MOBILITY',
    owner: SCORAH,
    kind: 'standing',
    trigger: 'weekly',
    notes:
      "Files for the venture, chases the owners who have not. A missing check-in is the PM's finding before it is the CEO's.",
  },
  {
    ref: 'RESP-2026-0030',
    name: 'UZA Mobility — spend approval inside the venture, below the CEO ceiling',
    venture: 'MOBILITY',
    owner: SCORAH,
    backup: YVES,
    kind: 'approval',
    trigger: 'per_request',
    hours: 24,
    notes:
      'Proposed, pending DEC-2026-0011. The ceiling is the whole point: without one this is not delegation, it is a second queue. Deposit release on vehicles stays with the CEO regardless.',
  },
  {
    ref: 'RESP-2026-0031',
    name: 'UZA Bulk — venture plan, targets and the sales pipeline',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'monthly',
    notes:
      'Includes breaking a monthly revenue target into named projects with expected value, probability and a client decision date. A target without that breakdown is not a plan.',
  },
  {
    ref: 'RESP-2026-0032',
    name: 'UZA Bulk — sales and marketing',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'weekly',
  },
  {
    ref: 'RESP-2026-0033',
    name: 'UZA Bulk — weekly check-in on every enquiry and initiative in the venture',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'weekly',
  },
  {
    ref: 'RESP-2026-0034',
    name: 'UZA Bulk — close or continue a dormant enquiry',
    venture: 'BULK',
    owner: BADIANE,
    backup: YVES,
    kind: 'approval',
    trigger: 'per_deal',
    hours: 48,
    notes:
      'Proposed, pending DEC-2026-0012. Moving this from the CEO to the Bulk PM is the single change that most reduces the approval queue, because it is the approval that fires most often.',
  },
  {
    ref: 'RESP-2026-0035',
    name: 'IT and platform — roadmap, priorities and release decisions',
    venture: 'CLOUD',
    owner: GAD,
    kind: 'standing',
    trigger: 'weekly',
    notes: 'Nexus, the portals, the mobility backend and the website. Saddock and Abijuru report here.',
  },
  {
    ref: 'RESP-2026-0036',
    name: 'IT and platform — weekly check-in on every engineering initiative',
    venture: 'CLOUD',
    owner: GAD,
    kind: 'standing',
    trigger: 'weekly',
  },
  {
    ref: 'RESP-2026-0037',
    name: 'IT and platform — technical decisions that do not need the CEO',
    venture: 'CLOUD',
    owner: GAD,
    backup: SADDOCK,
    kind: 'approval',
    trigger: 'per_request',
    hours: 24,
    notes:
      'Library choices, schema shape, deployment. What still goes to the CEO is anything that changes what a customer sees, what is claimed publicly, or what is spent.',
  },
  // ── PM SCOPE, WIDENED 22 AUGUST ──────────────────────────────────────────
  // The founder's instruction: a project manager works on sourcing, sales and marketing,
  // and social content — with support, not alone. Recorded per venture rather than as one
  // generic line, because "marketing" owned by two people is owned by neither.
  {
    ref: 'RESP-2026-0038',
    name: 'UZA Mobility — sourcing direction: what to buy, from where, at what landed cost',
    venture: 'MOBILITY',
    owner: SCORAH,
    kind: 'standing',
    trigger: 'per_deal',
    notes:
      'Scorah decides what Mobility needs and the commercial shape; Cecilia executes it in China. Two different jobs, and confusing them is how the China desk ends up setting strategy by default.',
  },
  {
    ref: 'RESP-2026-0039',
    name: 'UZA Bulk — sourcing direction and supplier strategy',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'per_deal',
    notes: 'Same split: Badiane sets what and why, Cecilia finds who and how much.',
  },
  {
    ref: 'RESP-2026-0040',
    name: 'UZA Mobility — social content and campaigns',
    venture: 'MOBILITY',
    owner: SCORAH,
    kind: 'standing',
    trigger: 'weekly',
    notes: 'Abijuru supports on brand and artwork. Scorah owns what gets said and when.',
  },
  {
    ref: 'RESP-2026-0041',
    name: 'UZA Bulk — social content and campaigns',
    venture: 'BULK',
    owner: BADIANE,
    kind: 'standing',
    trigger: 'weekly',
    notes: 'Abijuru supports on brand and artwork.',
  },
  {
    ref: 'RESP-2026-0042',
    name: 'Brand, artwork and content production support to both ventures',
    venture: 'CLOUD',
    owner: ABIJURU,
    kind: 'standing',
    trigger: 'weekly',
    notes:
      'The support the PMs are entitled to. Abijuru produces; the PM decides the message. Note this is on top of the UZA Bulk mobile app design, which is his own deadline.',
  },
  {
    ref: 'RESP-2026-0043',
    name: 'IT — platform vendors, tooling and cloud spend',
    venture: 'CLOUD',
    owner: GAD,
    backup: SADDOCK,
    kind: 'standing',
    trigger: 'monthly',
    notes: 'The Bulk platform already runs on Alibaba Cloud. Somebody has to own what that costs.',
  },
  {
    ref: 'RESP-2026-0044',
    name: 'Every task carries an aim, an owner and a deadline before it is assigned',
    venture: 'GROUP',
    owner: YVES,
    backup: SCORAH,
    kind: 'gate',
    trigger: 'per_request',
    hours: 24,
    notes:
      "The founder's working rule of 22 August: set up a group per task with a clear aim and a deadline. Recorded as a gate because a task without those three is the thing that becomes an 'awaiting' row three weeks later.",
  },
];

async function main() {
  const deptIds = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: d.code },
      create: { ref: `DPT-${d.code}`, code: d.code, name: d.name },
      update: { name: d.name },
    });
    deptIds.set(d.code, row.id);
  }

  for (const p of PEOPLE) {
    await prisma.employeeProfile.upsert({
      where: { userId: p.userId },
      create: { userId: p.userId, title: p.title, departmentId: deptIds.get(p.dept)!, managerId: p.managerId },
      update: { title: p.title, departmentId: deptIds.get(p.dept)!, managerId: p.managerId },
    });
  }

  // The same invariants the service enforces. A seed that writes rows the API would have
  // refused is a seed that quietly disables the rule.
  for (const r of RESPONSIBILITIES) {
    if (r.kind === 'approval' && !r.hours) throw new Error(`${r.ref}: approval with no responseHours`);
    if (r.kind !== 'standing' && (!r.backup || r.backup === r.owner)) {
      throw new Error(`${r.ref}: ${r.kind} needs a backup who is not the owner`);
    }
  }

  for (const r of RESPONSIBILITIES) {
    const data = {
      name: r.name,
      ventureCode: r.venture,
      ownerId: r.owner,
      backupId: r.backup ?? null,
      kind: r.kind,
      trigger: r.trigger,
      responseHours: r.hours ?? null,
      notes: r.notes ?? null,
      startsOn: r.startsOn ?? null,
      active: true,
    };
    await prisma.responsibility.upsert({ where: { ref: r.ref }, create: { ref: r.ref, ...data }, update: data });
  }

  const byOwner = new Map<string, number>();
  const approvalsBy = new Map<string, number>();
  for (const r of RESPONSIBILITIES) {
    byOwner.set(r.owner, (byOwner.get(r.owner) ?? 0) + 1);
    if (r.kind === 'approval') approvalsBy.set(r.owner, (approvalsBy.get(r.owner) ?? 0) + 1);
  }
  const approvals = RESPONSIBILITIES.filter((r) => r.kind === 'approval').length;

  console.log(`${DEPARTMENTS.length} departments, ${PEOPLE.length} people, ${RESPONSIBILITIES.length} responsibilities`);
  console.log('\nload by owner:');
  for (const [who, n] of [...byOwner.entries()].sort((a, b) => b[1] - a[1])) {
    const a = approvalsBy.get(who) ?? 0;
    console.log(`  ${who.padEnd(14)} ${String(n).padStart(2)} duties${a ? `, ${a} of them approvals` : ''}`);
  }
  const top = [...approvalsBy.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    console.log(
      `\napproval concentration: ${top[0]} holds ${top[1]} of ${approvals} approvals (${Math.round((top[1] / approvals) * 100)}%).`,
    );
  }
  console.log(`${RESPONSIBILITIES.filter((r) => r.startsOn).length} duties do not start until September.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
