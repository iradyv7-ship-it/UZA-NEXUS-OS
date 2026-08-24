import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';
import { ObjectivesForm, type Objective } from './ObjectivesForm';
import { ReportForm } from './ReportForm';
import { ownBlockerAction, clearBlockerAction } from './actions';

interface Blocker {
  ref: string;
  summary: string;
  raisedBy: string;
  ownerId: string | null;
  dueAt: string | null;
  createdAt: string;
}
interface Request {
  ref: string;
  body: string;
  authorId: string;
  subjectType: string;
  subjectRef: string;
}
interface MyWeek {
  weekOf: string;
  periodKey: string;
  plan: { ref: string; status: 'draft' | 'active' | 'done'; objectives: Objective[] } | null;
  needsMyConfirmation: boolean;
  reportFiled: boolean;
  iOwe: Blocker[];
  waitingOnSomebody: Blocker[];
  askedOfMe: Request[];
}
interface Memo {
  ref: string;
  subject: string;
  fromId: string;
  needsAck: boolean;
  sentAt: string;
  outstanding: boolean;
}
interface Inbox {
  unread: number;
  memos: Memo[];
}
interface Nudges {
  mine: { confirmYourPlan: boolean; writeYourReport: boolean; overdueBlockers: Blocker[] };
  counts?: { staff: number; unconfirmed: number; noPlan: number; noReport: number; overdueBlockers: number };
  everyone?: { unconfirmed: string[]; noPlan: string[]; noReport: string[] };
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

const NOTE: Record<string, string> = {
  confirmed: 'Your week is agreed.',
  filed: 'Report sent.',
  owned: 'Taken. It has a person and a date now.',
  cleared: 'Solved.',
};
const ERR: Record<string, string> = {
  empty: 'A week with no objectives is not a plan — write at least one.',
  highlights: 'Write what you finished, even if it is little.',
  own: 'It needs a person AND a date, together.',
  clear: 'Say how it was solved, so the next person learns something.',
  save: 'That did not save. Try again.',
  report: 'The report did not save. Try again.',
};

/**
 * My week — the employee half of the register.
 *
 * Two halves, and the order is deliberate. What I owe comes first because it is what the
 * company needs. What I am owed comes second because it is why anybody opens the page twice:
 * a screen that only ever asks people for things gets closed and not reopened.
 */
export default async function MyWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { ok, err } = await searchParams;
  const session = await getSession();

  const [weekRes, nudgeRes, inboxRes] = await Promise.all([
    authedCall<MyWeek>('/umurimo/week/mine'),
    authedCall<Nudges>('/umurimo/week/nudges'),
    authedCall<Inbox>('/planning/memos'),
  ]);

  if (weekRes.kind === 'unauthorized') {
    return <p className="text-sm text-slate-600">Session expired. Sign in again.</p>;
  }
  if (weekRes.kind !== 'ok') {
    return <p className="text-sm text-slate-600">Could not load your week.</p>;
  }

  const w = weekRes.data;
  const n = nudgeRes.kind === 'ok' ? nudgeRes.data : null;
  const me = session?.actor.userId ?? '';
  const inbox = inboxRes.kind === 'ok' ? inboxRes.data : null;
  const unreadMemos = inbox?.memos.filter((m) => m.outstanding) ?? [];
  const objectives = w.plan?.objectives ?? [];
  const done = objectives.filter((o) => o.status === 'done').length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My week</h1>
          <p className="text-sm text-slate-600">
            Week of {day(w.weekOf)} · {w.periodKey}
            {objectives.length > 0 && ` · ${done} of ${objectives.length} done`}
          </p>
        </div>
        <div className="flex gap-2">
          {w.needsMyConfirmation && <Badge tone="amber">You have not agreed this yet</Badge>}
          {!w.reportFiled && <Badge tone="slate">No report yet</Badge>}
          {w.reportFiled && <Badge tone="blue">Report sent</Badge>}
        </div>
      </header>

      {ok && NOTE[ok] && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{NOTE[ok]}</p>
      )}
      {err && ERR[err] && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{ERR[err]}</p>
      )}

      {unreadMemos.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {unreadMemos.length === 1 ? 'One message for you' : `${unreadMemos.length} messages for you`}
            </h2>
            <a
              href="/memos"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open messages
            </a>
          </div>
          <ul className="mt-2 space-y-1">
            {unreadMemos.slice(0, 4).map((m) => (
              <li key={m.ref} className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                <span>{m.subject}</span>
                <span className="text-xs text-slate-500">from {m.fromId} · {day(m.sentAt)}</span>
                {m.needsAck && <Badge tone="amber">needs your reply</Badge>}
              </li>
            ))}
            {unreadMemos.length > 4 && (
              <li className="text-xs text-slate-500">and {unreadMemos.length - 4} more</li>
            )}
          </ul>
        </Card>
      )}

      {/* ---------------------------------------------------------- what I owe */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">What I will finish this week</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-600">
          {w.plan
            ? 'Change anything that is not right. It is your week, not the meeting&rsquo;s.'
            : 'Nothing came out of the meeting for you. Write your own.'}
        </p>
        <ObjectivesForm initial={objectives} isDraft={w.needsMyConfirmation} />
      </Card>

      {w.iOwe.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Problems I took on</h2>
          <ul className="mt-2 space-y-3">
            {w.iOwe.map((b) => {
              const overdue = b.dueAt ? new Date(b.dueAt) < new Date() : false;
              return (
                <li key={b.ref} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-sm text-slate-800">{b.summary}</span>
                    <Badge tone={overdue ? 'red' : 'slate'}>
                      {b.dueAt ? `due ${day(b.dueAt)}` : 'no date'}
                    </Badge>
                  </div>
                  <form action={clearBlockerAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="ref" value={b.ref} />
                    <input
                      type="text"
                      name="note"
                      required
                      placeholder="How was it solved?"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Mark it solved
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------- what I am owed */}
      {(w.waitingOnSomebody.length > 0 || w.askedOfMe.length > 0) && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">What I am waiting for</h2>

          {w.waitingOnSomebody.length > 0 && (
            <>
              <p className="mb-2 mt-0.5 text-xs text-slate-600">
                I said these were stopping me and nobody has taken them yet. Chase someone, or take it yourself.
              </p>
              <ul className="space-y-3">
                {w.waitingOnSomebody.map((b) => (
                  <li key={b.ref} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                    <span className="text-sm text-slate-800">{b.summary}</span>
                    <form action={ownBlockerAction} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="ref" value={b.ref} />
                      <input
                        type="text"
                        name="ownerId"
                        required
                        defaultValue={me}
                        placeholder="Who will do it?"
                        className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <input
                        type="date"
                        name="dueAt"
                        required
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Give it a person and a date
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}

          {w.askedOfMe.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-xs text-slate-600">Somebody asked for my comment.</p>
              <ul className="space-y-2">
                {w.askedOfMe.map((r) => (
                  <li key={r.ref} className="text-sm text-slate-800">
                    {r.body}
                    <span className="ml-2 text-xs text-slate-500">
                      on {r.subjectType} {r.subjectRef}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------------- the report */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {w.reportFiled ? 'My report for the week' : 'My report for the week'}
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-600">
          {w.reportFiled
            ? 'Sent. You can still change it until Monday.'
            : 'Everyone writes one, including Yves.'}
        </p>
        <ReportForm filed={w.reportFiled} />
      </Card>

      {/* ----------------------------------------------------------- the nudges */}
      {n && (n.mine.confirmYourPlan || n.mine.writeYourReport || n.counts) && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">What the system is asking for</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {unreadMemos.length > 0 && (
              <li>· Read {unreadMemos.length === 1 ? 'the message' : `the ${unreadMemos.length} messages`} above.</li>
            )}
            {n.mine.confirmYourPlan && <li>· Agree your week above.</li>}
            {n.mine.writeYourReport && <li>· Write your report before Friday ends.</li>}
            {n.mine.overdueBlockers.map((b) => (
              <li key={b.ref} className="text-red-700">
                · Late: {b.summary}
              </li>
            ))}
            {!unreadMemos.length && !n.mine.confirmYourPlan && !n.mine.writeYourReport && !n.mine.overdueBlockers.length && (
              <li className="text-emerald-700">· Nothing is waiting on you.</li>
            )}
          </ul>

          {n.counts && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              Across the team: <strong>{n.counts.noPlan}</strong> of {n.counts.staff} have no plan,{' '}
              <strong>{n.counts.unconfirmed}</strong> have not agreed theirs,{' '}
              <strong>{n.counts.noReport}</strong> have not written a report.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
