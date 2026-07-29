import { authedCall } from './api';
import { orderPromise, quotationPromise, type Promise as Promised } from './promise';
import type { OrderListRow, ProjectListRow, QuotationListRow } from './types';

/**
 * The venture-manager work queue, built from the LIVE scoped + masked list endpoints
 * (GET /quotations, /orders, /projects) — no worklist cookie. Each endpoint is scoped to
 * the caller server-side (a VM sees all, a sales_agent only their own), so this queue is
 * "everything I own" without the client tracking refs. Projects are fetched best-effort to
 * resolve human-readable names/owners; a role without project:read (e.g. sales_agent) still
 * gets a full queue, just without project names.
 */

export const PAGE_SIZE = 20;
export const MAX_LIMIT = 100; // API caps `limit` at 100.

/** A normalised card: one record, showing stage · next action · owner (the promise). */
export interface QueueCard {
  kind: 'quotation' | 'order';
  ref: string;
  projectRef: string;
  customerRef: string;
  projectName?: string;
  /** The specific responsible person's readable ref, when we know it (project owner). */
  ownerId?: string;
  amount: { minor: number; per: 'unit' | 'total' };
  promise: Promised;
}

type ListState = 'ok' | 'denied' | 'error';

export type QueueResult =
  | { kind: 'unauthorized' }
  | {
      kind: 'loaded';
      quotations: QueueCard[];
      orders: QueueCard[];
      quotationsState: ListState;
      ordersState: ListState;
      /** True when either list returned a full page — more may exist within the API cap. */
      hasMore: boolean;
      count: number;
    };

function stateOf(kind: string): ListState {
  return kind === 'ok' ? 'ok' : kind === 'denied' ? 'denied' : 'error';
}

export async function loadQueue(requested: number): Promise<QueueResult> {
  const count = Math.min(Math.max(requested, PAGE_SIZE), MAX_LIMIT);

  // The two queue sources + projects for names, in parallel.
  const [qRes, oRes, pRes] = await Promise.all([
    authedCall<QuotationListRow[]>(`/quotations?limit=${count}`),
    authedCall<OrderListRow[]>(`/orders?limit=${count}`),
    authedCall<ProjectListRow[]>(`/projects?limit=${MAX_LIMIT}`),
  ]);

  if (qRes.kind === 'unauthorized' || oRes.kind === 'unauthorized' || pRes.kind === 'unauthorized') {
    return { kind: 'unauthorized' };
  }

  // Project name/owner map — best-effort. A role denied project:read simply gets no names.
  const projects = new Map<string, ProjectListRow>();
  if (pRes.kind === 'ok') for (const p of pRes.data) projects.set(p.ref, p);

  const quotations: QueueCard[] =
    qRes.kind === 'ok'
      ? qRes.data.map((q) => {
          const project = projects.get(q.projectRef);
          const promise = quotationPromise(q.status);
          return {
            kind: 'quotation' as const,
            ref: q.ref,
            projectRef: q.projectRef,
            customerRef: q.customerRef,
            projectName: project?.name,
            ownerId: promise.ownerRole === 'venture_manager' ? project?.owner : undefined,
            amount: { minor: q.customerUnitPriceMinor, per: 'unit' as const },
            promise,
          };
        })
      : [];

  const orders: QueueCard[] =
    oRes.kind === 'ok'
      ? oRes.data.map((o) => {
          const project = projects.get(o.projectRef);
          return {
            kind: 'order' as const,
            ref: o.ref,
            projectRef: o.projectRef,
            customerRef: o.customerRef,
            projectName: project?.name,
            amount: { minor: o.totalMinor, per: 'total' as const },
            promise: orderPromise(o.status),
          };
        })
      : [];

  const hasMore =
    count < MAX_LIMIT &&
    ((qRes.kind === 'ok' && qRes.data.length >= count) ||
      (oRes.kind === 'ok' && oRes.data.length >= count));

  return {
    kind: 'loaded',
    quotations,
    orders,
    quotationsState: stateOf(qRes.kind),
    ordersState: stateOf(oRes.kind),
    hasMore,
    count,
  };
}
