import { formatId } from '../platform/ids/readable-id';

/**
 * Readable-id helpers for logistics-warehouse.
 *
 * `lot`, `package`, `shipment`, `tracking` and `delivery` are all defined in
 * @uza/contracts ID_PATTERNS, so every ref renders through the shared platform formatter
 * (single source over the patterns, CF-001). The `tracking` key was added from the accepted
 * contract-request 2026-07-26-tracking-id.md.
 *
 * Sequencing is `count()+1` inside the insert transaction — collision-free under the
 * single-writer model, with the `ref`/`@id` constraint as the hard backstop (the same
 * convention trade/sourcing/finance use).
 */
export const VENTURE = 'BULK';

export const currentYear = (): string => String(new Date().getFullYear());

/**
 * The `{parent}` segment of lot/package ids, derived from the order ref the way the
 * reference does: `ORD-BULK-2026-0001` → `ORD0001`.
 */
export const parentOf = (orderRef: string): string => {
  const suffix = orderRef.split('-').pop() ?? orderRef;
  return `ORD${suffix}`;
};

export const lotRef = (orderRef: string, seq: number): string =>
  formatId('lot', { parent: parentOf(orderRef), seq });

export const packageRef = (orderRef: string, seq: number): string =>
  formatId('package', { parent: parentOf(orderRef), seq });

export const shipmentRef = (seq: number): string =>
  formatId('shipment', { year: currentYear(), seq });

export const deliveryRef = (office: string, seq: number): string =>
  formatId('delivery', { office, year: currentYear(), seq });

export const trackingRef = (seq: number): string =>
  formatId('tracking', { year: currentYear(), seq });
