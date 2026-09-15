import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EventEnvelope } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { varianceScoreDelta, SCORE_CAUSE, type ScoreCause } from '../scoring';

const RECEIPT_CONSUMER = 'sourcing.warehouse-receipt';

type Tx = Prisma.TransactionClient;

export interface ScoreChange {
  readonly supplierRef: string;
  readonly delta: number;
  readonly cause: ScoreCause;
  readonly causeRef?: string;
  readonly detail?: Prisma.InputJsonValue;
  readonly sourceEventId?: string;
}

/**
 * Supplier score is a competitive asset that moves ONLY on logged evidence. There is no
 * setter. Every movement runs through `applyScoreChange`, which writes an append-only
 * SupplierScoreEvent (delta, before/after, CAUSE) and updates the running `score` in the
 * SAME transaction. A future score input (defect rate, delivery lateness, packaging
 * failure) reuses this primitive; only its cause tag differs.
 *
 * CF-015 mechanism: `handleWarehouseReceipt` consumes warehouse's `warehouse.receiptRecorded`
 * and lowers the supplier's score on declared-vs-measured volumetric variance. Warehouse is
 * Sprint 3, so this is wired and unit-tested against SYNTHETIC envelopes now; it is
 * idempotent on `eventId` via ProcessedEvent so a redelivery cannot double-penalise.
 */
@Injectable()
export class SupplierScoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply one evidence-backed score change inside an existing transaction. Reads the
   * current score, writes the ledger row and the new running total atomically.
   */
  async applyScoreChange(tx: Tx, change: ScoreChange) {
    const supplier = await tx.supplier.findUnique({ where: { ref: change.supplierRef } });
    if (!supplier) throw new NotFoundException(`supplier ${change.supplierRef} not found`);

    const previousScore = supplier.score;
    const newScore = Math.round((previousScore + change.delta) * 100) / 100;

    await tx.supplierScoreEvent.create({
      data: {
        supplierRef: change.supplierRef,
        delta: change.delta,
        previousScore,
        newScore,
        cause: change.cause,
        causeRef: change.causeRef ?? null,
        detail: change.detail,
        sourceEventId: change.sourceEventId ?? null,
      },
    });

    return tx.supplier.update({ where: { ref: change.supplierRef }, data: { score: newScore } });
  }

  /**
   * CF-015: declared-vs-measured variance lowers the supplier's score. Idempotent on
   * eventId. A receipt without a flagged discrepancy is recorded as processed but moves
   * no score (normal factory drift is not a supplier fault).
   */
  async handleWarehouseReceipt(envelope: EventEnvelope<'warehouse.receiptRecorded'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: RECEIPT_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const };

    const { poRef, orderRef, variance, discrepancy } = envelope.payload;

    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: RECEIPT_CONSUMER },
      });

      const po = await tx.purchaseOrder.findUnique({ where: { ref: poRef } });
      if (!po) throw new NotFoundException(`purchase order ${poRef} not found`);

      if (!discrepancy) {
        return { status: 'no_change' as const, supplierRef: po.supplierRef, variance };
      }

      const delta = varianceScoreDelta(variance);
      const updated = await this.applyScoreChange(tx, {
        supplierRef: po.supplierRef,
        delta,
        cause: SCORE_CAUSE.declaredVsMeasuredVariance,
        causeRef: orderRef,
        detail: {
          poRef,
          orderRef,
          variance,
          declaredCbm: envelope.payload.declaredCbm,
          measuredCbm: envelope.payload.measuredCbm,
        },
        sourceEventId: envelope.eventId,
      });

      return {
        status: 'scored' as const,
        supplierRef: po.supplierRef,
        delta,
        newScore: updated.score,
      };
    });
  }
}
