import { authedCall } from '../../../lib/api';
import { Card, Badge } from '../../../components/ui';
import { AnswerForm } from './AnswerForm';

interface Moved {
  ref: string;
  name: string;
  ventureCode: string | null;
  ownerId: string;
  moved: string;
  blocked: string | null;
  needsFromCeo: string | null;
}
interface Silent {
  ref: string;
  name: string;
  ventureCode: string | null;
  ownerId: string;
}
interface Overdue {
  ref: string;
  name: string;
  ownerId: string;
  reviewAt: string;
  daysLate: number;
}
interface Decision {
  ref: string;
  question: string;
  initiativeRef: string | null;
  raisedById: string;
  ageDays: number;
}
interface Review {
  weekKey: string;
  counts: {
    runs: number;
    holds: number;
    parked: number;
    filed: number;
    silent: number;
    openDecisions: number;
    overdueTasks: number;
  };
  bottleneckDays: number;
  moved: Moved[];
  silent: Silent[];
  overdueReviews: Overdue[];
  escalations: { initiativeRef: string; name: string; needsFromCeo: string | null }[];
  decisions: Decision[];
  deferralsNowDue: { ref: string; question: string }[];
  overdueTasks: { ref: string; title: string; assigneeId: string }[];
}
interface Concentration {
  total: number;
  approvalConcentration: number;
  topApprover: string | null;
  noBackup: { ref: string; name: string; ownerId: string }[];
  load: { userRef: string; owns: number; approvals: number; gates: number }[];
}

function Stat({
  label,
  value,
  tone = 'slate',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'red' | 'amber' | 'blue' | 'slate';
  hint?: string;
}) {
  const color =
    tone === 'red'
      ? 'text-red-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'blue'
          ? 'text-sky-600'
          : 'text-slate-800';
  return (
    <Card className="text-center">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
    </Card>
  );
}

/**
 * The Monday review.
 *
 * The order is the argument. Decisions waiting on the CEO come FIRST, before anything the
 * team did, because a queue in front of one person is the only item on this page that
 * gets worse purely by being looked at later. Then the silences — what did not happen.
 * What did happen comes last: it is the most pleasant to read and the least actionable.
 */
export default async function RegisterPage() {
  const [reviewRes, concRes] = await Promise.all([
    authedCall<Review>('/planning/review'),
    authedCall<Concentration>('/planning/responsibilities/concentration'),
  ]);

  if (reviewRes.kind === 'unauthorized') return null;
  if (reviewRes.kind === 'denied') {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          The weekly review is for the CEO and venture managers. Your own initiatives are on{' '}
          <a href="/week" className="font-medium text-brand underline underline-offset-2">
            My week
          </a>
          .
        </p>
      </Card>
    );
  }
  if (reviewRes.kind !== 'ok') {
    return (
      <Card>
        <p className="text-sm text-slate-600">The review could not be loaded.</p>
      </Card>
    );
  }

  const r = reviewRes.data;
  const conc = concRes.kind === 'ok' ? concRes.data : null;
  const bottleneckTone = r.bottleneckDays >= 7 ? 'red' : r.bottleneckDays >= 3 ? 'amber' : 'slate';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">The register — week of {r.weekKey}</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {r.counts.runs} running · {r.counts.holds} held · {r.counts.parked} parked
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="days the oldest decision has waited"
          value={r.bottleneckDays}
          tone={bottleneckTone}
          hint="the bottleneck"
        />
        <Stat
          label="waiting on the CEO"
          value={r.counts.openDecisions}
          tone={r.counts.openDecisions > 5 ? 'amber' : 'slate'}
        />
        <Stat
          label="running, no check-in filed"
          value={r.counts.silent}
          tone={r.counts.silent > 0 ? 'amber' : 'slate'}
        />
        <Stat
          label="approvals held by one person"
          value={conc ? `${Math.round(conc.approvalConcentration * 100)}%` : '—'}
          tone={conc && conc.approvalConcentration > 0.5 ? 'red' : 'slate'}
          hint={conc?.topApprover ?? undefined}
        />
      </div>

      {r.decisions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Waiting on you — oldest first
          </h2>
          {r.decisions.map((d) => (
            <Card key={d.ref}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-slate-900">{d.question}</p>
                <Badge tone={d.ageDays >= 7 ? 'red' : d.ageDays >= 3 ? 'amber' : 'slate'}>
                  {d.ageDays}d
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-400">
                {d.ref} · raised by {d.raisedById}
                {d.initiativeRef ? ` · ${d.initiativeRef}` : ''}
              </p>
              <AnswerForm decisionRef={d.ref} />
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <p className="text-sm text-slate-600">
            Nothing is waiting on you. That is rare — enjoy it.
          </p>
        </Card>
      )}

      {r.deferralsNowDue.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600">
            Deferred, and now due
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {r.deferralsNowDue.map((d) => (
                <li key={d.ref} className="py-2 text-sm text-slate-700">
                  {d.question} <span className="font-mono text-xs text-slate-400">{d.ref}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {r.escalations.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Asked of you in a check-in
          </h2>
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

      {r.silent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Running, but silent this week
          </h2>
          <Card>
            <p className="mb-2 text-xs text-slate-500">
              No check-in filed. Either it is not really running, or it has no real owner.
            </p>
            <ul className="divide-y divide-slate-100">
              {r.silent.map((s) => (
                <li key={s.ref} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm text-slate-800">{s.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{s.ownerId}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {r.overdueReviews.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Held past their review date
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {r.overdueReviews.map((h) => (
                <li key={h.ref} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm text-slate-800">{h.name}</span>
                  <Badge tone="amber">{h.daysLate}d late</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {r.moved.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What moved — {r.counts.filed} filed
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {r.moved.map((m) => (
                <li key={m.ref} className="py-2.5">
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="mt-0.5 text-sm text-slate-700">{m.moved}</p>
                  {m.blocked ? (
                    <p className="mt-1 text-xs text-amber-700">blocked: {m.blocked}</p>
                  ) : null}
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {m.ref} · {m.ownerId}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {conc && conc.noBackup.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Duties with no backup
          </h2>
          <Card>
            <p className="mb-2 text-xs text-slate-500">
              Each of these stops the week its owner is unreachable.
            </p>
            <ul className="divide-y divide-slate-100">
              {conc.noBackup.map((n) => (
                <li key={n.ref} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm text-slate-800">{n.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{n.ownerId}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
