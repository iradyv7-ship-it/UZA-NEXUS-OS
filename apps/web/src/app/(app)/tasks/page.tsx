import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';
import { NewTask, TaskActions } from './TaskUI';

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

interface Task {
  ref: string;
  title: string;
  description: string | null;
  assigneeId: string;
  priority: Priority;
  status: TaskStatus;
  dueAt: string | null;
  linkedRef: string | null;
  createdById: string;
}

const PRIORITY_TONE: Record<Priority, 'red' | 'amber' | 'slate'> = {
  urgent: 'red',
  high: 'amber',
  medium: 'slate',
  low: 'slate',
};

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
];

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
const overdue = (t: Task) => !!t.dueAt && new Date(t.dueAt).getTime() < Date.now() && t.status !== 'done';

/**
 * Tasks.
 *
 * Three columns and not four: `done` is not shown as a column because a wall of finished
 * work is the most flattering and least useful thing a board can display. What is open,
 * what is moving, what is stuck — that is the whole question.
 *
 * Every task carries an assignee and a due date because the service requires them. That is
 * the founder's own rule from 22 August, recorded as RESP-2026-0044: a task without an
 * aim, an owner and a deadline is what becomes an "awaiting" row three weeks later.
 */
export default async function TasksPage() {
  const session = await getSession();
  if (!session) return null;
  const isExec = session.actor.role === 'ceo' || session.actor.role === 'venture_manager';

  const res = await authedCall<{ items?: Task[] } | Task[]>('/command/tasks?limit=100');
  if (res.kind === 'unauthorized') return null;
  if (res.kind !== 'ok') {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          {res.kind === 'denied' ? 'You do not have access to tasks.' : 'Tasks could not be loaded.'}
        </p>
      </Card>
    );
  }

  // The list endpoint is paginated for some roles and a bare array for others; accept both
  // rather than guessing, since guessing wrong renders an empty board that looks like calm.
  const raw = res.data as { items?: Task[] } | Task[];
  const tasks: Task[] = Array.isArray(raw) ? raw : (raw.items ?? []);
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const late = open.filter(overdue);
  const mine = open.filter((t) => t.assigneeId === session.actor.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {open.length} open · {mine.length} mine · {late.length} overdue
          </p>
        </div>
        {isExec ? <NewTask /> : null}
      </div>

      {late.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">Overdue</h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {late.map((t) => (
                <li key={t.ref} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-sm text-slate-800">{t.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">
                    {t.assigneeId} · was due {fmt(t.dueAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const rows = open.filter((t) => t.status === col.key);
          return (
            <section key={col.key} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {col.label} — {rows.length}
              </h2>
              {rows.length === 0 ? (
                <Card>
                  <p className="text-xs text-slate-400">Nothing here.</p>
                </Card>
              ) : (
                rows.map((t) => (
                  <Card key={t.ref}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{t.title}</p>
                      <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                    </div>
                    {t.description ? (
                      <p className="mt-1 text-xs text-slate-600">{t.description}</p>
                    ) : null}
                    <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                      {t.assigneeId}
                      {t.dueAt ? ` · due ${fmt(t.dueAt)}` : ''}
                      {t.linkedRef ? ` · ${t.linkedRef}` : ''}
                    </p>
                    <TaskActions taskRef={t.ref} status={t.status} />
                  </Card>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
