import { authedCall } from '../../../lib/api';
import { redirect } from 'next/navigation';
import { Card, Badge } from '../../../components/ui';

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
type GrantStatus = 'identified' | 'preparing' | 'submitted' | 'awarded' | 'rejected' | 'closed';

interface Task {
  ref: string; title: string; assigneeId: string; priority: Priority; status: TaskStatus;
  dueAt: string | null; linkedRef: string | null;
}
interface Grant {
  ref: string; name: string; funder: string; amountMinor: number; currency: string;
  deadlineAt: string | null; status: GrantStatus;
}
interface Overview {
  generatedAt: string; horizonDays: number;
  myOpenTasks: Task[]; needsAttention: Task[];
  upcomingDeadlines: { tasks: Task[]; grants: Grant[] };
  grantPipeline: Partial<Record<GrantStatus, number>>;
  counts: { myOpenTasks: number; needsAttention: number; upcomingTasks: number; upcomingGrants: number };
}

const PRIORITY_TONE: Record<Priority, 'red' | 'amber' | 'slate'> = { urgent: 'red', high: 'amber', medium: 'slate', low: 'slate' };
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (minor: number, ccy: string) => `${ccy} ${(minor / 100).toLocaleString()}`;
const isOverdue = (t: Task) => !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();

function Stat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'red' | 'amber' | 'blue' | 'slate' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-sky-600' : 'text-slate-800';
  return (
    <Card className="text-center">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </Card>
  );
}

function TaskRow({ t }: { t: Task }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-900">{t.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.assigneeId} · due {fmtDate(t.dueAt)}
          {t.linkedRef ? <> · <span className="font-mono">{t.linkedRef}</span></> : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
        {t.status === 'blocked' ? <Badge tone="red">blocked</Badge> : isOverdue(t) ? <Badge tone="amber">overdue</Badge> : null}
      </div>
    </div>
  );
}

export default async function CommandPage() {
  const res = await authedCall<Overview>('/command/overview');
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') {
    return (
      <div className="py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Command Center</h1>
        <p className="mt-2 text-sm text-slate-500">This executive view is available to leadership only.</p>
      </div>
    );
  }
  if (res.kind !== 'ok') {
    return <div className="py-16 text-center text-sm text-slate-500">Could not load the command overview. Please retry.</div>;
  }
  const o = res.data;
  const pipeline = Object.entries(o.grantPipeline);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Command Center</h1>
        <p className="text-sm text-slate-500">What needs your attention · next {o.horizonDays} days</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="My open tasks" value={o.counts.myOpenTasks} />
        <Stat label="Needs attention" value={o.counts.needsAttention} tone="red" />
        <Stat label="Upcoming tasks" value={o.counts.upcomingTasks} tone="amber" />
        <Stat label="Grant deadlines" value={o.counts.upcomingGrants} tone="blue" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs attention</h2>
        <Card>
          {o.needsAttention.length === 0
            ? <p className="py-4 text-center text-sm text-slate-400">Nothing overdue or blocked. 🎉</p>
            : o.needsAttention.map((t) => <TaskRow key={t.ref} t={t} />)}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming grant deadlines</h2>
          <Card>
            {o.upcomingDeadlines.grants.length === 0
              ? <p className="py-4 text-center text-sm text-slate-400">No grant deadlines in window.</p>
              : o.upcomingDeadlines.grants.map((g) => (
                  <div key={g.ref} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{g.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{g.funder} · {fmtMoney(g.amountMinor, g.currency)} · due {fmtDate(g.deadlineAt)}</p>
                    </div>
                    <Badge tone="blue">{g.status}</Badge>
                  </div>
                ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Grant pipeline</h2>
          <Card>
            {pipeline.length === 0
              ? <p className="py-4 text-center text-sm text-slate-400">No grants yet.</p>
              : pipeline.map(([status, n]) => (
                  <div key={status} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                    <span className="text-sm capitalize text-slate-700">{status}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{n}</span>
                  </div>
                ))}
          </Card>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">My open tasks</h2>
        <Card>
          {o.myOpenTasks.length === 0
            ? <p className="py-4 text-center text-sm text-slate-400">No tasks assigned to you.</p>
            : o.myOpenTasks.map((t) => <TaskRow key={t.ref} t={t} />)}
        </Card>
      </section>
    </div>
  );
}
