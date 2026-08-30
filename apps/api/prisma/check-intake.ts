/**
 * Runs one intake sweep against the real database and prints what was filed and how it
 * was classified. Triage is not run here — that costs money and should be a deliberate
 * call, so this shows the capture and lane decisions only.
 *
 *   pnpm --filter @uza/api exec tsx prisma/check-intake.ts
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PlanningAccessService } from '../src/planning/planning-authz.service';
import { IntakeService } from '../src/intake/intake.service';
import { ClaudeCodeSource } from '../src/intake/sources/claude-code.source';
import { GmailSource } from '../src/intake/sources/gmail.source';
import { DocumentSource } from '../src/intake/sources/document.source';

const prisma = new PrismaClient();
const audit = { deny: async () => ({ id: 'noop' }), allow: async () => ({ id: 'noop' }) } as never;

async function main() {
  const config = new ConfigService();
  const intake = new IntakeService(
    prisma as never,
    new PlanningAccessService(audit),
    new ClaudeCodeSource(config),
    new GmailSource(config),
    new DocumentSource(config),
  );

  const result = await intake.sweep();
  console.log(`captured ${result.captured} (${result.private} private)`, result.bySource);

  const rows = await prisma.signal.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 12,
    select: { ref: true, source: true, lane: true, wallTags: true, status: true, title: true },
  });
  console.log('');
  for (const r of rows) {
    const wall = r.wallTags.length ? ` {${r.wallTags.join(',')}}` : '';
    console.log(`${r.ref} ${r.source.padEnd(11)} ${r.lane.padEnd(7)}${wall} ${r.title.slice(0, 70)}`);
  }

  const byLane = await prisma.signal.groupBy({ by: ['lane'], _count: { _all: true } });
  console.log('\ntotals:', byLane.map((l) => `${l.lane}=${l._count._all}`).join(' '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
