import { Module } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { PlanningAccessService } from '../planning/planning-authz.service';
import { IntakeService } from './intake.service';
import { TriageService } from './triage.service';
import { IntakeController } from './intake.controller';
import { ClaudeCodeSource } from './sources/claude-code.source';
import { GmailSource } from './sources/gmail.source';
import { DocumentSource } from './sources/document.source';

/**
 * Intake — the layer that watches where ideas actually appear and files them as
 * candidates for the register.
 *
 * Three sources today: Claude Code session transcripts on disk, documents in the working
 * repository, and the founder's mailbox. Each is incremental and idempotent, so a sweep
 * can be run at any frequency without duplicating anything.
 *
 * Two rules hold the whole module together:
 *
 *  1. **Nothing auto-writes to the register.** Sweeps capture, rules classify, the advisor
 *     proposes, a person promotes. The register's value is that everything in it was put
 *     there on purpose.
 *  2. **Classification happens before storage.** A signal that mentions a walled
 *     counterparty is filed private at the moment it is written — there is no window in
 *     which it exists as shared, and no shared read path that could catch it.
 *
 * The sweep runs on demand via POST /intake/signals/sweep. Scheduling it is a separate
 * decision: a process that reads a mailbox on a timer should be turned on deliberately,
 * by whoever owns the mailbox.
 *
 * Access reuses `PLANNING_ACCESS` rather than defining a second policy — intake feeds the
 * register and belongs to the same executive layer. `intake:declassify` is CEO-only, and
 * is the only capability the venture manager does not share.
 */
@Module({
  providers: [
    AuditService,
    PlanningAccessService,
    IntakeService,
    TriageService,
    ClaudeCodeSource,
    GmailSource,
    DocumentSource,
  ],
  controllers: [IntakeController],
  exports: [IntakeService, TriageService],
})
export class IntakeModule {}
