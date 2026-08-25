import Link from 'next/link';
import { authedCall } from '../../../lib/api';
import { Card, Badge } from '../../../components/ui';

interface Blocker {
  ref: string;
  summary: string;
  raisedBy: string;
  ownerId: string | null;
  dueAt: string | null;
  createdAt: string;
}
interface Ask {
  ref: string;
  ownerId: string;
  asking: string | null;
}
interface Request {
  ref: string;
  body: string;
  authorId: string;
  subjectType: string;
  subjectRef: string;
  createdAt: string;
}
interface Dept {
  code: string;
  name: string;
  people: number;
  filed: number;
  silent: string[];
  unowned: number;
  overdue: number;
}
interface Digest {
  weekOf: string;
  periodKey: string;
  openAsks: Ask[];
  unownedBlockers: Blocker[];
  overdueBlockers: Blocker[];
  openRequests: Request[];
  silent: string[];
  byDepartment: Dept[];
  counts: {
    filed: number;
    silent: number;
    unowned: number;
    overdue: number;
    openAsks: number;
    openRequests: number;
  };
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

const ageDays = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/**
 * The Monday read.
 *
 * Ordered by what should change the meeting, not by what is pleasant. Unowned blockers come
 * first because that list must be empty before anyone leaves the room; silence comes before
 * activity because a digest that only shows what people wrote flatters the organisation.
 *
 * Deliberately separate from `/week`, which answers the same four questions about initiatives.
 * Merging a work dashboard with a people dashboard produces a screen that ranks humans by
 * proxy, and this module is explicitly not that: every count here is about work that is stuck,
 * and the names appear only as the people who could unstick it.
 */
export default async function DigestPage() {
  const res = await authedCall<Digest>('/umurimo/digest');

  if (res.kind === 'unauthorized') {
    return <p className="text-sm text-slate-600">Session expired. Sign in again.</p>;
  }
  if (res.kind === 'denied') {
    return <p className="text-sm text-slate-600">This view is for the executive and the PMs.</p>;
  }
  if (res.kind !== 'ok') {
    return <p className="text-sm text-slate-600">Could not load the digest.</p>;
  }

  const d = res.data;
  const c = d.counts;
  const nothingOutstanding =
    !c.unowned && !c.overdue && !c.openAsks && !c.openRequests && !c.silent;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Monday digest</h1>
          <p className="text-sm text-slate-600">
            Week of {day(d.weekOf)} · {d.periodKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.unowned > 0 && <Badge tone="red">{c.unowned} unassigned</Badge>}
          {c.overdue > 0 && <Badge tone="red">{c.overdue} late</Badge>}
          {c.silent > 0 && <Badge tone="amber">{c.silent} silent</Badge>}
          <Badge tone="blue">{c.filed} filed</Badge>
        </div>
      </header>

      {nothingOutstanding && (
        <Card>
          <p className="text-sm text-slate-700">
            Nothing outstanding, and everyone has filed. That is either a very good week or a
            sign nobody is writing anything down — worth knowing which before believing it.
          </p>
        </Card>
      )}

      {/* --------------------------------------------- must be empty by the end */}
      {d.unownedBlockers.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">
            Raised, and nobody has taken it
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-600">
            This list should be empty before the meeting ends. A team that watches problems get
            discussed and dropped stops raising them within a month.
          </p>
          <ul className="space-y-2">
            {d.unownedBlockers.map((b) => (
              <li
                key={b.ref}
                className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0"
              >
                <span className="text-sm text-slate-800">{b.summary}</span>
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {b.raisedBy} · {ageDays(b.createdAt)}d ·{' '}
                  {!b.ownerId && !b.dueAt
                    ? 'no name, no date'
                    : !b.ownerId
                      ? 'no name'
                      : 'no date'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --------------------------------------------------------------- late */}
      {d.overdueBlockers.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Taken, dated, and past the date</h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-600">
            A different failure from the list above: that one is a team that did not assign, this
            is a person who did not deliver. Reporting them together hides both.
          </p>
          <ul className="space-y-2">
            {d.overdueBlockers.map((b) => (
              <li
                key={b.ref}
                className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0"
              >
                <span className="text-sm text-slate-800">{b.summary}</span>
                <span className="whitespace-nowrap text-xs text-red-700">
                  {b.ownerId} · due {day(b.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------- the trades */}
      {d.openAsks.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">What people need from each other</h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-600">
            The field that turns a status meeting into a trade. Read these out.
          </p>
          <ul className="space-y-2">
            {d.openAsks.map((a) => (
              <li key={a.ref} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <span className="text-sm text-slate-800">{a.asking}</span>
                <span className="ml-2 text-xs text-slate-500">{a.ownerId}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.openRequests.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Questions nobody has answered</h2>
          <ul className="mt-2 space-y-2">
            {d.openRequests.map((r) => (
              <li key={r.ref} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <span className="text-sm text-slate-800">{r.body}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {r.authorId} · on {r.subjectType} {r.subjectRef} · {ageDays(r.createdAt)}d
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------- by arm */}
      {d.byDepartment.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">By arm</h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-600">
            Worst filing first. An arm where nobody filed is a different problem from three
            individuals scattered across three arms.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Arm</th>
                  <th className="py-2 pr-4 font-medium">Filed</th>
                  <th className="py-2 pr-4 font-medium">Unassigned</th>
                  <th className="py-2 pr-4 font-medium">Late</th>
                  <th className="py-2 font-medium">Silent</th>
                </tr>
              </thead>
              <tbody>
                {d.byDepartment.map((x) => (
                  <tr key={x.code} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{x.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-700">
                      {x.filed} / {x.people}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-slate-700">{x.unowned || '—'}</td>
                    <td
                      className={`py-2 pr-4 tabular-nums ${x.overdue ? 'text-red-700' : 'text-slate-700'}`}
                    >
                      {x.overdue || '—'}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {x.silent.length ? x.silent.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- the silence */}
      {d.silent.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Filed nothing this week</h2>
          <p className="mb-2 mt-0.5 text-xs text-slate-600">
            Not an accusation — most of the time it means the week got away from someone. But it
            is the list that matters most, and it is the easiest one to leave off a dashboard.
          </p>
          <p className="text-sm text-slate-800">{d.silent.join(' · ')}</p>
        </Card>
      )}

      <p className="text-xs text-slate-500">
        Derived from what people wrote in{' '}
        <Link href="/my-week" className="underline">
          My week
        </Link>
        . Nothing here is typed in twice.
      </p>
    </div>
  );
}
