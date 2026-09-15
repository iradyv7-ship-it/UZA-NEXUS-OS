/**
 * Offline-capture replay guard.
 *
 * François captures writes on a phone with poor Ningbo signal and syncs later; a sync may
 * retry the same write. Every write path carries a client-supplied `clientRequestId`
 * (a device-generated UUID) stored under a UNIQUE constraint. Before creating anything,
 * a service asks this guard whether that id already produced a row — if so it returns the
 * existing row and skips the write (and, crucially, skips re-emitting the event).
 *
 * The guard runs a plain `findUnique` on `clientRequestId`; because the column is unique,
 * a concurrent duplicate that slips past the read still fails at insert time, so this is
 * safe, not merely best-effort.
 */
export interface ClientRequestScoped {
  findUnique(args: { where: { clientRequestId: string } }): Promise<unknown>;
}

export async function findByClientRequestId<T>(
  delegate: { findUnique(args: { where: { clientRequestId: string } }): Promise<T | null> },
  clientRequestId: string | undefined,
): Promise<T | null> {
  if (!clientRequestId) return null;
  return delegate.findUnique({ where: { clientRequestId } });
}
