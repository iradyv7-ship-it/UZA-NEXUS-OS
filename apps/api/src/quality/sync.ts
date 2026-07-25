/**
 * Offline-capture replay guard (quality copy).
 *
 * François captures inspections in a Ningbo warehouse on poor signal and syncs later; a
 * sync may retry. Every write path carries a client-supplied `clientRequestId` (a device
 * UUID) under a UNIQUE constraint. Before creating, a service asks this guard whether that
 * id already produced a row — if so it returns the existing row and skips both the write
 * and any event emission. The unique column is the hard backstop against a concurrent
 * duplicate that slips past the read.
 */
export async function findByClientRequestId<T>(
  delegate: { findUnique(args: { where: { clientRequestId: string } }): Promise<T | null> },
  clientRequestId: string | undefined,
): Promise<T | null> {
  if (!clientRequestId) return null;
  return delegate.findUnique({ where: { clientRequestId } });
}
