/**
 * The subscriber/dispatch registry: which module handlers react to each published event.
 *
 * This lives at the apps/api composition root because it must reference several modules'
 * services at once. The app root is *allowed* to know every module; a feature module still
 * never imports another feature module. `platform/*` is untouched — it owns no business
 * events and knows nothing of these handlers.
 *
 * The map is built by a plain function (no NestJS) so the exact same registry can be
 * assembled from DI-managed providers in the running app AND from directly-instantiated
 * services in a Vitest integration test. The test therefore drives the REAL registry, not
 * a synthetic copy of it.
 *
 * Idempotency: every handler below SELF-GUARDS on `(eventId, consumer)` via ProcessedEvent
 * (it reads the row, then claims it inside its own transaction). We therefore invoke each
 * handler DIRECTLY and must NOT wrap it in `processOutboxEvent` under the same consumer key
 * — that wrapper would claim the key first and the handler would then see its own row and
 * no-op without ever doing its work. The `consumer` field here is the key each handler
 * owns internally, recorded for logging/observability and as living documentation.
 */
import type { EventEnvelope, UzaEventName } from '@uza/contracts';
import type { OrderService } from '../trade/order/order.service';
import type { InvoiceService } from '../finance/invoice/invoice.service';
import type { CommissionService } from '../finance/commission/commission.service';
import type { ForwarderClaimService } from '../finance/claim/forwarder-claim.service';
import type { SupplierScoreService } from '../sourcing/supplier/supplier-score.service';
import type { OrderPaymentService } from '../logistics/consumers/order-payment.service';
import type { QualityGateService } from '../logistics/consumers/quality-gate.service';

/** One module handler subscribed to an event, plus the ProcessedEvent key it self-guards on. */
export interface ConsumerBinding {
  readonly consumer: string;
  readonly handler: (envelope: EventEnvelope) => Promise<unknown>;
}

/** The handler-owning services the registry binds. Structural (`Pick`) so the app's DI
 *  providers and the test's raw instances both satisfy it. */
export interface DispatchDeps {
  readonly order: Pick<OrderService, 'handlePaymentVerified'>;
  readonly invoice: Pick<InvoiceService, 'handleOrderCreated'>;
  readonly commission: Pick<CommissionService, 'handleOrderCancelled'>;
  readonly claim: Pick<ForwarderClaimService, 'handleBilledWeightRecorded'>;
  readonly supplierScore: Pick<SupplierScoreService, 'handleWarehouseReceipt'>;
  readonly orderPayment: Pick<OrderPaymentService, 'handlePaymentVerified'>;
  readonly qualityGate: Pick<
    QualityGateService,
    'handleInspectionRecorded' | 'handleQualityFailed'
  >;
}

export type DispatchMap = ReadonlyMap<UzaEventName, readonly ConsumerBinding[]>;

/**
 * Build the event → [{consumer, handler}] registry.
 *
 * The map as built:
 *   order.created                 → finance   InvoiceService.handleOrderCreated
 *   order.cancelled               → finance   CommissionService.handleOrderCancelled
 *   payment.verified              → trade     OrderService.handlePaymentVerified
 *                                 → logistics OrderPaymentService.handlePaymentVerified
 *   inspection.recorded           → logistics QualityGateService.handleInspectionRecorded
 *   quality.failed                → logistics QualityGateService.handleQualityFailed
 *   warehouse.receiptRecorded     → sourcing  SupplierScoreService.handleWarehouseReceipt
 *   shipment.billedWeightRecorded → finance   ForwarderClaimService.handleBilledWeightRecorded
 *
 * NOTE on `payment.verified` + commission: finance does NOT consume `payment.verified`.
 * It is the PUBLISHER — the 2%-at-confirmation accrual is written inline inside
 * `PaymentService.verify()` in the same transaction that emits the event. So the only
 * fan-out subscribers for `payment.verified` are trade and logistics.
 */
export function buildDispatchMap(deps: DispatchDeps): DispatchMap {
  const map = new Map<UzaEventName, ConsumerBinding[]>();

  const bind = <T extends UzaEventName>(
    name: T,
    consumer: string,
    handler: (envelope: EventEnvelope<T>) => Promise<unknown>,
  ): void => {
    const binding: ConsumerBinding = {
      consumer,
      handler: (envelope) => handler(envelope as EventEnvelope<T>),
    };
    const list = map.get(name) ?? [];
    list.push(binding);
    map.set(name, list);
  };

  bind('order.created', 'finance.order-created', (e) => deps.invoice.handleOrderCreated(e));
  bind('order.cancelled', 'finance.order-cancelled', (e) =>
    deps.commission.handleOrderCancelled(e),
  );
  bind('payment.verified', 'trade.payment-verified', (e) => deps.order.handlePaymentVerified(e));
  bind('payment.verified', 'logistics.payment-verified', (e) =>
    deps.orderPayment.handlePaymentVerified(e),
  );
  bind('inspection.recorded', 'logistics.inspection-recorded', (e) =>
    deps.qualityGate.handleInspectionRecorded(e),
  );
  bind('quality.failed', 'logistics.quality-failed', (e) =>
    deps.qualityGate.handleQualityFailed(e),
  );
  bind('warehouse.receiptRecorded', 'sourcing.warehouse-receipt', (e) =>
    deps.supplierScore.handleWarehouseReceipt(e),
  );
  bind('shipment.billedWeightRecorded', 'finance.billed-weight', (e) =>
    deps.claim.handleBilledWeightRecorded(e),
  );

  return map;
}

/** The outcome of running one binding for a delivered envelope. */
export interface DispatchOutcome {
  readonly consumer: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: unknown;
}

/**
 * Raised when one or more bindings for an envelope failed. Throwing this is what makes the
 * BullMQ job fail and retry (per EVENT_JOB_OPTS): the ordering/failure policy in action.
 * Succeeded bindings are already committed and self-guard, so a retry re-runs only the
 * bindings that have not yet recorded their ProcessedEvent row.
 */
export class EventDispatchError extends Error {
  constructor(
    readonly eventName: UzaEventName,
    readonly eventId: string,
    readonly failures: readonly { consumer: string; error: unknown }[],
  ) {
    super(
      `fan-out of ${eventName} ${eventId} failed for ${failures.length} consumer(s): ` +
        failures.map((f) => `${f.consumer} (${(f.error as Error)?.message ?? f.error})`).join('; '),
    );
    this.name = 'EventDispatchError';
  }
}

/**
 * Deliver one envelope to every subscribed binding. Runs them all (rather than stopping at
 * the first failure) so a transient fault in one consumer does not starve its siblings of
 * their first attempt; each is independently idempotent, so re-running the succeeded ones
 * on a later retry is a safe no-op. If any binding failed, throws `EventDispatchError` so
 * the job is retried.
 */
export async function dispatchEnvelope(
  map: DispatchMap,
  envelope: EventEnvelope,
  onOutcome?: (outcome: DispatchOutcome, envelope: EventEnvelope) => void,
): Promise<DispatchOutcome[]> {
  const bindings = map.get(envelope.name) ?? [];
  const outcomes: DispatchOutcome[] = [];
  const failures: { consumer: string; error: unknown }[] = [];

  for (const binding of bindings) {
    try {
      const result = await binding.handler(envelope);
      const outcome: DispatchOutcome = { consumer: binding.consumer, ok: true, result };
      outcomes.push(outcome);
      onOutcome?.(outcome, envelope);
    } catch (error) {
      const outcome: DispatchOutcome = { consumer: binding.consumer, ok: false, error };
      outcomes.push(outcome);
      failures.push({ consumer: binding.consumer, error });
      onOutcome?.(outcome, envelope);
    }
  }

  if (failures.length > 0) {
    throw new EventDispatchError(envelope.name, envelope.eventId, failures);
  }
  return outcomes;
}
