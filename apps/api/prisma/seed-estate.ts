/**
 * Every system UZA owns, as at 22 August 2026.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-estate.ts
 *
 * Read from the GitHub API, not from memory. Seventeen distinct systems across two
 * accounts — the personal `iradyv7-ship-it` and the `UZA-SOLUTIONS` organisation — with
 * three of them existing in both places.
 *
 * On every duplicate, the ORG copy is canonical. That is not a preference: on 8 August the
 * personal copies stopped receiving pushes and the org copies kept going, so the org is
 * where the work actually happens and the personal copies are three months of divergence
 * waiting for someone to read the wrong one.
 */
import { PrismaClient, type SystemKind, type SystemStatus, type SystemVisibility } from '@prisma/client';

const prisma = new PrismaClient();

const YVES = 'CEO-KGL-0001';
const SCORAH = 'EMP-KGL-0002';
const BADIANE = 'EMP-KGL-0003';
const GAD = 'EMP-KGL-0007';
const SADDOCK = 'EMP-KGL-0008';
const ABIJURU = 'EMP-KGL-0009';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ORG = 'https://github.com/UZA-SOLUTIONS';
const ME = 'https://github.com/iradyv7-ship-it';

interface Sys {
  ref: string;
  name: string;
  kind: SystemKind;
  venture: string | null;
  owner: string;
  status: SystemStatus;
  repoUrl?: string;
  liveUrl?: string;
  visibility: SystemVisibility;
  lastPush?: Date;
  supersededBy?: string;
  initiativeRef?: string;
  notes?: string;
}

const SYSTEMS: Sys[] = [
  // ── The operating layer ──────────────────────────────────────────────────
  {
    ref: 'SYS-2026-0001',
    name: 'UZA Nexus OS',
    kind: 'backend',
    venture: 'NEXUS',
    owner: GAD,
    status: 'building',
    repoUrl: `${ME}/UZA-NEXUS-OS`,
    visibility: 'private',
    lastPush: d('2026-08-22'),
    initiativeRef: 'INIT-2026-0020',
    notes: 'The register, the decision queue, responsibilities, intake and the advisor. Not yet deployed.',
  },
  {
    ref: 'SYS-2026-0002',
    name: 'UZA Solutions working documents',
    kind: 'document',
    venture: 'GROUP',
    owner: YVES,
    status: 'live',
    repoUrl: `${ME}/UZA-SOLUTIONS-GUIDE`,
    visibility: 'private',
    lastPush: d('2026-08-22'),
    notes: 'Every published artifact and its source. Holds the Mento and Unguka material — must stay private.',
  },

  // ── UZA Mobility ─────────────────────────────────────────────────────────
  {
    ref: 'SYS-2026-0003',
    name: 'uza-mobility-bn — backend (canonical)',
    kind: 'backend',
    venture: 'MOBILITY',
    owner: GAD,
    status: 'live',
    repoUrl: `${ORG}/uza-mobility-bn`,
    visibility: 'public',
    lastPush: d('2026-08-12'),
    initiativeRef: 'INIT-2026-0015',
    notes: '~100 models, 125 endpoints. The UZA ID migration lands here first. Source is publicly readable.',
  },
  {
    ref: 'SYS-2026-0004',
    name: 'uza-mobility-fn — customer front end (canonical)',
    kind: 'web_app',
    venture: 'MOBILITY',
    owner: ABIJURU,
    status: 'live',
    repoUrl: `${ORG}/uza-mobility-fn`,
    liveUrl: 'https://uzamobility.com',
    visibility: 'public',
    lastPush: d('2026-08-11'),
    initiativeRef: 'INIT-2026-0003',
  },
  {
    ref: 'SYS-2026-0005',
    name: 'uza-mobility-admin — admin panel (canonical)',
    kind: 'admin_panel',
    venture: 'MOBILITY',
    owner: SADDOCK,
    status: 'live',
    repoUrl: `${ORG}/uza-mobility-admin`,
    visibility: 'public',
    lastPush: d('2026-08-11'),
  },
  {
    ref: 'SYS-2026-0006',
    name: 'uza-mobility-bn — personal copy',
    kind: 'backend',
    venture: 'MOBILITY',
    owner: GAD,
    status: 'dormant',
    repoUrl: `${ME}/uza-mobility-bn`,
    visibility: 'public',
    lastPush: d('2026-07-08'),
    supersededBy: 'SYS-2026-0003',
    notes: 'Five weeks behind the org copy. Archive it before someone clones the wrong one.',
  },
  {
    ref: 'SYS-2026-0007',
    name: 'uza-mobility-fn — personal copy',
    kind: 'web_app',
    venture: 'MOBILITY',
    owner: ABIJURU,
    status: 'dormant',
    repoUrl: `${ME}/uza-mobility-fn`,
    visibility: 'public',
    lastPush: d('2026-08-07'),
    supersededBy: 'SYS-2026-0004',
  },
  {
    ref: 'SYS-2026-0008',
    name: 'uza-mobility-admin — personal copy',
    kind: 'admin_panel',
    venture: 'MOBILITY',
    owner: SADDOCK,
    status: 'dormant',
    repoUrl: `${ME}/uza-mobility-admin`,
    visibility: 'public',
    lastPush: d('2026-07-08'),
    supersededBy: 'SYS-2026-0005',
  },
  {
    ref: 'SYS-2026-0009',
    name: 'uza-charge — charging management',
    kind: 'web_app',
    venture: 'MOBILITY',
    owner: SCORAH,
    status: 'prototype',
    repoUrl: `${ME}/uza-charge`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
    initiativeRef: 'INIT-2026-0012',
    notes: 'Should move to the UZA-SOLUTIONS org — it is a product line, not a personal project.',
  },
  {
    ref: 'SYS-2026-0010',
    name: 'Battery-life',
    kind: 'prototype',
    venture: 'MOBILITY',
    owner: SCORAH,
    status: 'prototype',
    repoUrl: `${ME}/Battery-life`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
    notes: 'Also belongs in the org.',
  },
  {
    ref: 'SYS-2026-0011',
    name: 'evfleet',
    kind: 'prototype',
    venture: 'MOBILITY',
    owner: SCORAH,
    status: 'prototype',
    repoUrl: `${ME}/evfleet`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
  },
  {
    ref: 'SYS-2026-0012',
    name: 'UZA battery value-chain strategy',
    kind: 'document',
    venture: 'MOBILITY',
    owner: YVES,
    status: 'dormant',
    repoUrl: `${ME}/UZA-BATTERY-VALUE-CHAIN-STRATEGY`,
    visibility: 'public',
    lastPush: d('2026-07-29'),
  },
  {
    ref: 'SYS-2026-0013',
    name: 'Tunga Taxi partner portal (v6)',
    kind: 'web_app',
    venture: 'MOBILITY',
    owner: SCORAH,
    status: 'building',
    visibility: 'private',
    initiativeRef: 'INIT-2026-0011',
    notes:
      'A single self-contained HTML file in the documents repository, not its own project. Three roles, twenty-one views. Deployed from Vercel when it goes to the bank.',
  },

  // ── UZA Bulk ─────────────────────────────────────────────────────────────
  {
    ref: 'SYS-2026-0014',
    name: 'uzabulk-bn — backend',
    kind: 'backend',
    venture: 'BULK',
    owner: GAD,
    status: 'live',
    repoUrl: `${ORG}/uzabulk-bn`,
    visibility: 'public',
    lastPush: d('2026-08-19'),
    initiativeRef: 'INIT-2026-0024',
    notes: 'Runs on Alibaba Cloud. The 21 August milestone shipped — search, chatbot, deployment.',
  },
  {
    ref: 'SYS-2026-0015',
    name: 'uzabulk-fn — customer front end',
    kind: 'web_app',
    venture: 'BULK',
    owner: ABIJURU,
    status: 'live',
    repoUrl: `${ORG}/uzabulk-fn`,
    visibility: 'public',
    lastPush: d('2026-08-19'),
    initiativeRef: 'INIT-2026-0024',
  },
  {
    ref: 'SYS-2026-0016',
    name: 'uzabulk-admin-bn — admin backend',
    kind: 'backend',
    venture: 'BULK',
    owner: SADDOCK,
    status: 'dormant',
    repoUrl: `${ORG}/uzabulk-admin-bn`,
    visibility: 'public',
    lastPush: d('2026-07-16'),
  },
  {
    ref: 'SYS-2026-0017',
    name: 'uzabulk-admin-fn — admin front end',
    kind: 'admin_panel',
    venture: 'BULK',
    owner: SADDOCK,
    status: 'dormant',
    repoUrl: `${ORG}/uzabulk-admin-fn`,
    visibility: 'public',
    lastPush: d('2026-07-13'),
  },
  {
    ref: 'SYS-2026-0018',
    name: 'UZA Bulk mobile app — UI design',
    kind: 'mobile_app',
    venture: 'BULK',
    owner: ABIJURU,
    status: 'building',
    visibility: 'private',
    initiativeRef: 'INIT-2026-0023',
    notes: 'Design only, no repository yet. Six screens due 25 August, project deadline 28 August.',
  },

  // ── Group and unassigned ─────────────────────────────────────────────────
  {
    ref: 'SYS-2026-0019',
    name: 'uza-blueprint',
    kind: 'prototype',
    venture: null,
    owner: ABIJURU,
    status: 'prototype',
    repoUrl: `${ME}/uza-blueprint`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
    notes: 'No venture assigned — nobody has decided what this is for.',
  },
  {
    ref: 'SYS-2026-0020',
    name: 'uza-build',
    kind: 'prototype',
    venture: null,
    owner: ABIJURU,
    status: 'prototype',
    repoUrl: `${ME}/uza-build`,
    visibility: 'public',
    lastPush: d('2026-07-25'),
    notes: 'Almost certainly the same thing as uzabuild. One of the two should go.',
  },
  {
    ref: 'SYS-2026-0021',
    name: 'uzabuild',
    kind: 'prototype',
    venture: null,
    owner: ABIJURU,
    status: 'prototype',
    repoUrl: `${ME}/uzabuild`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
    supersededBy: 'SYS-2026-0020',
    notes: 'Same name as uza-build with a hyphen removed. Confirm which is real, retire the other.',
  },
  {
    ref: 'SYS-2026-0022',
    name: 'uza-serve',
    kind: 'prototype',
    venture: null,
    owner: SADDOCK,
    status: 'prototype',
    repoUrl: `${ME}/uza-serve`,
    visibility: 'public',
    lastPush: d('2026-08-03'),
  },
  {
    ref: 'SYS-2026-0023',
    name: 'uzasolutions.com',
    kind: 'web_app',
    venture: 'GROUP',
    owner: ABIJURU,
    status: 'building',
    liveUrl: 'https://uzasolutions.com',
    visibility: 'private',
    initiativeRef: 'INIT-2026-0003',
    notes: 'The group front door. Blocked on the hero line.',
  },
  {
    ref: 'SYS-2026-0024',
    name: 'Trippo — team operations platform',
    kind: 'web_app',
    venture: 'GROUP',
    owner: GAD,
    status: 'live',
    liveUrl: 'https://bookfy.trippo.rw',
    visibility: 'private',
    notes:
      'Third-party. Messages, tasks, calendar, products, sales and a full finance module. Only the engineering team uses the task board.',
  },
];

async function main() {
  for (const s of SYSTEMS) {
    const data = {
      name: s.name,
      kind: s.kind,
      ventureCode: s.venture,
      ownerId: s.owner,
      status: s.status,
      repoUrl: s.repoUrl ?? null,
      liveUrl: s.liveUrl ?? null,
      visibility: s.visibility,
      lastPushAt: s.lastPush ?? null,
      supersededBy: s.supersededBy ?? null,
      initiativeRef: s.initiativeRef ?? null,
      notes: s.notes ?? null,
    };
    await prisma.systemRecord.upsert({ where: { ref: s.ref }, create: { ref: s.ref, ...data }, update: data });
  }

  const pub = SYSTEMS.filter((s) => s.visibility === 'public').length;
  const dup = SYSTEMS.filter((s) => s.supersededBy).length;
  const noVenture = SYSTEMS.filter((s) => !s.venture).length;
  console.log(`${SYSTEMS.length} systems recorded`);
  console.log(`  ${pub} have publicly readable source`);
  console.log(`  ${dup} are duplicates of another entry`);
  console.log(`  ${noVenture} have no venture — nobody has decided what they are for`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
