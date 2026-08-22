import { authedCall } from '../../../lib/api';
import { Card, Badge } from '../../../components/ui';

type Status = 'live' | 'building' | 'prototype' | 'dormant' | 'retired';

interface SystemRow {
  ref: string;
  name: string;
  kind: string;
  ventureCode: string | null;
  ownerId: string;
  status: Status;
  repoUrl: string | null;
  liveUrl: string | null;
  visibility: 'public' | 'private' | 'unknown';
  supersededBy: string | null;
  initiativeRef: string | null;
  notes: string | null;
  daysSincePush: number | null;
}

const STATUS_TONE: Record<Status, 'blue' | 'amber' | 'slate' | 'red'> = {
  live: 'blue',
  building: 'amber',
  prototype: 'slate',
  dormant: 'slate',
  retired: 'slate',
};

/**
 * Every system UZA owns.
 *
 * Grouped by venture rather than by status, because the question people actually arrive
 * with is "what does Mobility have" and not "what is dormant". The warnings — public
 * source, a duplicate, months of silence — ride on the row itself so they are impossible
 * to page past.
 */
export default async function ProjectsPage() {
  const res = await authedCall<SystemRow[]>('/planning/systems');
  if (res.kind === 'unauthorized') return null;
  if (res.kind === 'denied')
    return (
      <Card>
        <p className="text-sm text-slate-600">You do not have access to the systems register.</p>
      </Card>
    );
  if (res.kind !== 'ok')
    return (
      <Card>
        <p className="text-sm text-slate-600">The systems register could not be loaded.</p>
      </Card>
    );

  const systems = res.data;
  const ventures = [...new Set(systems.map((s) => s.ventureCode ?? 'Unassigned'))].sort((a, b) =>
    a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b),
  );
  const publicCount = systems.filter((s) => s.visibility === 'public').length;
  const dupCount = systems.filter((s) => s.supersededBy).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Projects and systems</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {systems.length} recorded · {publicCount} with public source · {dupCount} duplicated
        </p>
      </div>

      {ventures.map((v) => {
        const rows = systems.filter((s) => (s.ventureCode ?? 'Unassigned') === v);
        return (
          <section key={v} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {v} — {rows.length}
            </h2>
            <Card>
              <ul className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <li key={s.ref} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{s.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {s.ref} · {s.kind.replace('_', ' ')} · {s.ownerId}
                          {s.daysSincePush !== null ? ` · pushed ${s.daysSincePush}d ago` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                        {s.visibility === 'public' ? <Badge tone="red">public source</Badge> : null}
                        {s.supersededBy ? <Badge tone="amber">duplicate</Badge> : null}
                        {s.daysSincePush !== null && s.daysSincePush > 60 && s.status !== 'dormant' ? (
                          <Badge tone="amber">silent {s.daysSincePush}d</Badge>
                        ) : null}
                      </div>
                    </div>

                    {s.notes ? <p className="mt-1.5 text-xs text-slate-600">{s.notes}</p> : null}

                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                      {s.repoUrl ? (
                        <a href={s.repoUrl} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
                          source
                        </a>
                      ) : null}
                      {s.liveUrl ? (
                        <a href={s.liveUrl} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
                          live
                        </a>
                      ) : null}
                      {s.initiativeRef ? (
                        <span className="font-mono text-slate-400">{s.initiativeRef}</span>
                      ) : null}
                      {s.supersededBy ? (
                        <span className="text-amber-700">keep {s.supersededBy} instead</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
