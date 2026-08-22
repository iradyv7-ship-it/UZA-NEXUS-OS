import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';
import { CheckinForm } from './CheckinForm';

type Attention = 'runs' | 'holds' | 'parked';

interface Initiative {
  ref: string;
  name: string;
  ventureCode: string | null;
  attention: Attention;
  nextAction: string | null;
  reviewAt: string | null;
  targetDate: string | null;
  artifactUrl: string | null;
}
interface Responsibility {
  ref: string;
  name: string;
  ventureCode: string | null;
  kind: 'standing' | 'gate' | 'approval';
  trigger: string;
  responseHours: number | null;
  backupId: string | null;
  notes: string | null;
  startsOn: string | null;
}
interface Mine {
  userRef: string;
  owns: Responsibility[];
  covers: Responsibility[];
  load: number;
}
interface Checkin {
  initiativeRef: string;
}

const ATTENTION_TONE: Record<Attention, 'blue' | 'amber' | 'slate'> = {
  runs: 'blue',
  holds: 'amber',
  parked: 'slate',
};
const KIND_TONE = { approval: 'red', gate: 'amber', standing: 'slate' } as const;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

const TRIGGER_LABEL: Record<string, string> = {
  per_shipment: 'every shipment',
  per_deal: 'every deal',
  per_request: 'every request',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  ad_hoc: 'as needed',
};

/**
 * My week — the one page a person opens.
 *
 * Deliberately not a dashboard. It answers three questions in order and nothing else:
 * what am I running, what did I do about it this week, and what am I permanently on the
 * hook for. Anything that is not one of those three belongs on the review, which is the
 * CEO's page, not this one.
 *
 * The check-in form is the point of the page. A register nobody writes to is a document,
 * and the difference between the two is whether filing takes ten seconds.
 */
export default async function MyWeekPage() {
  const session = await getSession();
  if (!session) return null;
  const me = session.actor.userId;

  const [initiativesRes, mineRes, missingRes] = await Promise.all([
    authedCall<Initiative[]>(`/planning/initiatives?ownerId=${encodeURIComponent(me)}`),
    authedCall<Mine>(`/planning/responsibilities/person/${encodeURIComponent(me)}`),
    authedCall<{ missing: Checkin[] }>('/planning/initiatives/missing-checkins'),
  ]);

  if (initiativesRes.kind === 'unauthorized') return null;
  const initiatives = initiativesRes.kind === 'ok' ? initiativesRes.data : [];
  const mine = mineRes.kind === 'ok' ? mineRes.data : null;
  // `missing-checkins` needs report:all, so most people get a 403 here. That is fine —
  // absence of the list just means we do not mark which cards are outstanding.
  const missing =
    missingRes.kind === 'ok' ? new Set(missingRes.data.missing.map((m) => m.initiativeRef)) : null;

  const running = initiatives.filter((i) => i.attention === 'runs');
  const held = initiatives.filter((i) => i.attention === 'holds');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My week</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {running.length} running · {held.length} held · {mine?.load ?? 0} standing duties
        </p>
      </div>

      {running.length === 0 && held.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nothing in the register is owned by <span className="font-mono">{me}</span>. If that is
            wrong, the initiative needs its owner changed — it is not a display problem.
          </p>
        </Card>
      ) : null}

      {running.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Running</h2>
          {running.map((i) => (
            <Card key={i.ref}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{i.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {i.ref}
                    {i.ventureCode ? ` · ${i.ventureCode}` : ''}
                    {i.targetDate ? ` · target ${fmt(i.targetDate)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Badge tone={ATTENTION_TONE[i.attention]}>{i.attention}</Badge>
                  {missing?.has(i.ref) ? <Badge tone="amber">no check-in</Badge> : null}
                </div>
              </div>

              {i.nextAction ? (
                <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                  {i.nextAction}
                </p>
              ) : null}

              {i.artifactUrl ? (
                <a
                  href={i.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-brand underline underline-offset-2"
                >
                  Open the document
                </a>
              ) : null}

              <CheckinForm initiativeRef={i.ref} />
            </Card>
          ))}
        </section>
      ) : null}

      {held.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Held — deliberately paused, with a date
          </h2>
          {held.map((i) => (
            <Card key={i.ref}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{i.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {i.ref}
                    {i.ventureCode ? ` · ${i.ventureCode}` : ''}
                  </p>
                </div>
                <Badge tone={i.reviewAt && new Date(i.reviewAt) < new Date() ? 'red' : 'amber'}>
                  review {fmt(i.reviewAt) ?? '—'}
                </Badge>
              </div>
              {i.nextAction ? <p className="mt-2 text-sm text-slate-600">{i.nextAction}</p> : null}
            </Card>
          ))}
        </section>
      ) : null}

      {mine && mine.owns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What I am always on the hook for
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {mine.owns.map((r) => {
                const future = r.startsOn && new Date(r.startsOn) > new Date();
                return (
                  <li key={r.ref} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {TRIGGER_LABEL[r.trigger] ?? r.trigger}
                        {r.responseHours ? ` · respond within ${r.responseHours}h` : ''}
                        {r.backupId ? ` · backup ${r.backupId}` : ' · no backup'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {future ? <Badge tone="slate">from {fmt(r.startsOn)}</Badge> : null}
                      <Badge tone={KIND_TONE[r.kind]}>{r.kind}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      {mine && mine.covers.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What I cover when someone else is away
          </h2>
          <Card>
            <ul className="space-y-1.5">
              {mine.covers.map((r) => (
                <li key={r.ref} className="text-sm text-slate-600">
                  {r.name}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
