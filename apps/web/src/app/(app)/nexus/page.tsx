import Link from 'next/link';
import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';

interface Review {
  weekKey: string;
  counts: { runs: number; holds: number; parked: number; filed: number; silent: number; openDecisions: number; overdueTasks: number };
  bottleneckDays: number;
  silent: { ref: string; name: string; ownerId: string }[];
  decisions: { ref: string; question: string; ageDays: number }[];
  overdueReviews: { ref: string; name: string; daysLate: number }[];
  escalations: { initiativeRef: string; name: string; needsFromCeo: string | null }[];
}
interface Concentration {
  total: number;
  approvalConcentration: number;
  topApprover: string | null;
  noBackup: { ref: string }[];
  standingNoBackup: number;
  notYetStarted: { ref: string }[];
}
interface EstateHealth {
  total: number;
  byVenture: Record<string, number>;
  byStatus: { live: number; building: number; prototype: number; dormant: number };
  publicSource: { ref: string; name: string; repoUrl: string | null }[];
  duplicates: { ref: string; name: string; supersededBy: string | null }[];
  silent: { ref: string; name: string; daysSincePush: number | null }[];
  unassigned: { ref: string; name: string }[];
}
interface Inbox {
  unread: number;
}
interface Initiative {
  ref: string;
  name: string;
  ventureCode: string | null;
  attention: 'runs' | 'holds' | 'parked';
  ownerId: string;
  nextAction: string | null;
}

const VENTURES = ['GROUP', 'BULK', 'MOBILITY', 'EMPOWER', 'CLOUD', 'NEXUS'] as const;

function Metric({
  label,
  value,
  tone = 'slate',
  hint,
  href,
}: {
  label: string;
  value: string | number;
  tone?: 'red' | 'amber' | 'blue' | 'slate';
  hint?: string;
  href?: string;
}) {
  const color =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-sky-600' : 'text-slate-800';
  const inner = (
    <Card className="h-full">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-xs leading-tight text-slate-500">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Nexus — everything, on one screen.
 *
 * The ordering is a claim about what matters, and it is the opposite of most dashboards:
 * the things that are WRONG come first, and the volume of activity comes last. A page that
 * opens with "24 systems, 24 initiatives, 44 duties" tells the founder his company is
 * busy, which he already knows. A page that opens with "17 decisions waiting on you, the
 * oldest 15 days" tells him something he can act on before lunch.
 *
 * Every number here is derived from the same services the API exposes. Nothing on this
 * page is stored, so nothing on it can disagree with the register.
 */
export default async function NexusPage() {
  const session = await getSession();
  if (!session) return null;
  const isExec = session.actor.role === 'ceo' || session.actor.role === 'venture_manager';

  const [reviewRes, concRes, estateRes, inboxRes, initRes] = await Promise.all([
    authedCall<Review>('/planning/review'),
    authedCall<Concentration>('/planning/responsibilities/concentration'),
    authedCall<EstateHealth>('/planning/systems/health'),
    authedCall<Inbox>('/planning/memos'),
    authedCall<Initiative[]>('/planning/initiatives?attention=runs'),
  ]);

  const r = reviewRes.kind === 'ok' ? reviewRes.data : null;
  const conc = concRes.kind === 'ok' ? concRes.data : null;
  const estate = estateRes.kind === 'ok' ? estateRes.data : null;
  const inbox = inboxRes.kind === 'ok' ? inboxRes.data : null;
  const running = initRes.kind === 'ok' ? initRes.data : [];

  if (!isExec) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">UZA Nexus</h1>
        <Card>
          <p className="text-sm text-slate-600">
            The group view is for the CEO and project managers. Everything that is yours is on{' '}
            <Link href="/week" className="font-medium text-brand underline underline-offset-2">
              My week
            </Link>
            {inbox && inbox.unread > 0 ? (
              <>
                {' '}
                — and you have <strong>{inbox.unread}</strong> unread {inbox.unread === 1 ? 'memo' : 'memos'}.
              </>
            ) : (
              '.'
            )}
          </p>
        </Card>
      </div>
    );
  }

  const byVenture = VENTURES.map((v) => ({
    code: v,
    running: running.filter((i) => i.ventureCode === v).length,
    systems: estate?.byVenture[v] ?? 0,
  })).filter((v) => v.running > 0 || v.systems > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">UZA Nexus</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Everything, {r ? `week of ${r.weekKey}` : 'now'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/register" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            The review
          </Link>
          <Link href="/projects" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Projects
          </Link>
          <Link href="/tasks" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Tasks
          </Link>
          <Link href="/memos" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Memos{inbox && inbox.unread > 0 ? ` (${inbox.unread})` : ''}
          </Link>
        </div>
      </div>

      {/* What is wrong, first. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs you</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="days the oldest decision has waited"
            value={r?.bottleneckDays ?? '—'}
            tone={(r?.bottleneckDays ?? 0) >= 7 ? 'red' : (r?.bottleneckDays ?? 0) >= 3 ? 'amber' : 'slate'}
            hint="the bottleneck"
            href="/register"
          />
          <Metric
            label="decisions waiting on the CEO"
            value={r?.counts.openDecisions ?? '—'}
            tone={(r?.counts.openDecisions ?? 0) > 5 ? 'amber' : 'slate'}
            href="/register"
          />
          <Metric
            label="running, but silent this week"
            value={r?.counts.silent ?? '—'}
            tone={(r?.counts.silent ?? 0) > 0 ? 'amber' : 'slate'}
            href="/register"
          />
          <Metric
            label="overdue tasks"
            value={r?.counts.overdueTasks ?? '—'}
            tone={(r?.counts.overdueTasks ?? 0) > 0 ? 'amber' : 'slate'}
            href="/tasks"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">How the work is held</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="of approvals sit with one person"
            value={conc ? `${Math.round(conc.approvalConcentration * 100)}%` : '—'}
            tone={conc && conc.approvalConcentration > 0.5 ? 'red' : 'slate'}
            hint={conc?.topApprover ?? undefined}
          />
          <Metric label="standing duties, all named" value={conc?.total ?? '—'} />
          <Metric
            label="gates and approvals with no backup"
            value={conc?.noBackup.length ?? '—'}
            tone={(conc?.noBackup.length ?? 0) > 0 ? 'amber' : 'slate'}
            hint={conc ? `${conc.standingNoBackup} standing duties uncovered too` : undefined}
          />
          <Metric label="duties that start in September" value={conc?.notYetStarted.length ?? '—'} hint="François lands" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">What we own</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="systems, all recorded" value={estate?.total ?? '—'} href="/projects" />
          <Metric
            label="with publicly readable source"
            value={estate?.publicSource.length ?? '—'}
            tone={(estate?.publicSource.length ?? 0) > 0 ? 'red' : 'slate'}
            hint="almost never on purpose"
            href="/projects"
          />
          <Metric
            label="duplicated in two places"
            value={estate?.duplicates.length ?? '—'}
            tone={(estate?.duplicates.length ?? 0) > 0 ? 'amber' : 'slate'}
            href="/projects"
          />
          <Metric
            label="no venture assigned"
            value={estate?.unassigned.length ?? '—'}
            tone={(estate?.unassigned.length ?? 0) > 0 ? 'amber' : 'slate'}
            href="/projects"
          />
        </div>
      </section>

      {byVenture.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">By venture</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Venture</th>
                  <th className="px-4 py-2 text-right font-medium">Running</th>
                  <th className="px-4 py-2 text-right font-medium">Systems</th>
                </tr>
              </thead>
              <tbody>
                {byVenture.map((v) => (
                  <tr key={v.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{v.code}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{v.running}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{v.systems}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {r && r.escalations.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Asked of you this week</h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {r.escalations.map((e) => (
                <li key={e.initiativeRef} className="py-2">
                  <p className="text-sm text-slate-800">{e.needsFromCeo}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{e.name}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {running.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Running now — {running.length}
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {running.map((i) => (
                <li key={i.ref} className="py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{i.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {i.ventureCode ?? '—'} · {i.ownerId}
                    </span>
                  </div>
                  {i.nextAction ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{i.nextAction}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
