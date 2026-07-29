import { cookies } from 'next/headers';
import { WORKLIST_COOKIE } from './session';

/**
 * The API surface (docs/handoff/api-surface.md) exposes GET-by-ref only — there is no
 * list endpoint for a user's projects / quotations / orders yet. Until one exists (filed
 * as a contract request), the dashboard keeps a per-user "worklist" of the records the
 * venture manager is tracking and fetches each LIVE from the real endpoint. The cookie
 * stores only readable refs plus display labels (project/customer names captured when a
 * deal is created) — no commercial figures, which always come fresh from the masked API.
 */

export interface WorklistEntry {
  kind: 'quotation' | 'order';
  ref: string;
  /** Display context captured at creation; secondary to live data, never authoritative. */
  projectName?: string;
  customerName?: string;
  /** Readable ref of the deal owner when known (e.g. project owner VM-…). */
  ownerId?: string;
}

export async function getWorklist(): Promise<WorklistEntry[]> {
  const jar = await cookies();
  const raw = jar.get(WORKLIST_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WorklistEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWorklist(entries: WorklistEntry[]): Promise<void> {
  const jar = await cookies();
  jar.set(WORKLIST_COOKIE, JSON.stringify(entries), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function addToWorklist(entry: WorklistEntry): Promise<void> {
  const current = await getWorklist();
  // De-dupe on (kind, ref); newest metadata wins, newest entry floats to the top.
  const filtered = current.filter((e) => !(e.kind === entry.kind && e.ref === entry.ref));
  await writeWorklist([entry, ...filtered]);
}

export async function removeFromWorklist(kind: WorklistEntry['kind'], ref: string): Promise<void> {
  const current = await getWorklist();
  await writeWorklist(current.filter((e) => !(e.kind === kind && e.ref === ref)));
}
