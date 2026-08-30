import Link from 'next/link';
import { authedCall } from '../../../lib/api';
import { Card, Badge } from '../../../components/ui';

type Stage =
  | 'identified'
  | 'qualifying'
  | 'preparing'
  | 'submitted'
  | 'in_diligence'
  | 'approved'
  | 'closed'
  | 'declined'
  | 'parked';

interface Release {
  ref: string;
  name: string;
  attention: 'runs' | 'holds' | 'parked';
  ventureCode: string | null;
  ownerId: string;
}
interface Track {
  ref: string;
  name: string;
  funder: string;
  instrument: string;
  stage: Stage;
  ventureCode: string | null;
  amountSought: number;
  currency: string;
  blocker: string | null;
  decisionBy: string | null;
  releases: Release[];
  heldReleases: number;
  danglingRefs: string[];
}
interface UnlockMap {
  totalSought: number;
  liveTracks: number;
  unlocksNothing: { ref: string; name: string }[];
  tracks: Track[];
}

const STAGE_TONE: Partial<Record<Stage, 'blue' | 'amber' | 'slate' | 'red'>> = {
  identified: 'slate',
  qualifying: 'slate',
  preparing: 'amber',
  submitted: 'amber',
  in_diligence: 'amber',
  approved: 'blue',
  closed: 'blue',
};

const money = (v: number, ccy: string) => {
  if (v >= 1e9) return `${ccy} ${(v / 1e9).toFixed(2)}bn`;
  if (v >= 1e6) return `${ccy} ${Math.round(v / 1e6)}M`;
  return `${ccy} ${Math.round(v).toLocaleString('en-GB')}`;
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

/**
 * What is being raised, and what it releases.
 *
 * Grouped by venture because that is how it gets presented: the founder's strategy is that
 * each venture stands alone to a funder and whichever closes first pushes the others. So
 * every venture block here is complete on its own — a funder backing charging can be shown
 * their block and nothing else.
 *
 * The releases list under each track is the part that usually lives only in someone's head.
 * A track that releases nothing held is flagged, because either the money is not actually
 * needed for anything or the dependency was never written down.
 */
export default async function FundingPage() {
  const res = await authedCall<UnlockMap>('/planning/funding/unlocks');
  if (res.kind === 'unauthorized') return null;
  if (res.kind === 'denied')
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Funding is visible to the CEO and project managers.
        </p>
      </Card>
    );
  if (res.kind !== 'ok')
    return (
      <Card>
        <p className="text-sm text-slate-600">Funding could not be loaded.</p>
      </Card>
    );

  const { tracks, totalSought, liveTracks, unlocksNothing } = res.data;
  const ventures = [...new Set(tracks.map((t) => t.ventureCode ?? 'Group'))].sort();
  const unowned = tracks.filter((t) => t.blocker?.toLowerCase().includes('no owner')).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Funding</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {liveTracks} live tracks · {money(totalSought, 'RWF')} sought · each venture presentable
          on its own
        </p>
      </div>

      {unlocksNothing.length > 0 ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Releases nothing currently held
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Either the money is not needed for anything yet, or the dependency was never recorded.
          </p>
          <ul className="mt-2 space-y-1">
            {unlocksNothing.map((u) => (
              <li key={u.ref} className="text-sm text-slate-700">
                <span className="font-mono text-xs text-slate-400">{u.ref}</span> {u.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {ventures.map((v) => {
        const rows = tracks.filter((t) => (t.ventureCode ?? 'Group') === v);
        const sought = rows.reduce((a, t) => a + t.amountSought, 0);
        return (
          <section key={v} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {v} — {rows.length} {rows.length === 1 ? 'track' : 'tracks'}
              </h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {money(sought, 'RWF')}
              </span>
            </div>

            {rows.map((t) => (
              <Card key={t.ref}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {t.ref} · {t.funder}
                      {t.decisionBy ? ` · decides by ${fmtDate(t.decisionBy)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-bold tabular-nums text-slate-800">
                      {money(t.amountSought, t.currency)}
                    </span>
                    <Badge tone={STAGE_TONE[t.stage] ?? 'slate'}>{t.stage.replace('_', ' ')}</Badge>
                    <Badge tone="slate">{t.instrument}</Badge>
                  </div>
                </div>

                {t.blocker ? (
                  <p className="mt-2 border-l-2 border-amber-400 pl-3 text-sm text-slate-700">
                    <span className="font-medium text-amber-700">Blocked: </span>
                    {t.blocker}
                  </p>
                ) : null}

                {t.releases.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      If this closes, it releases
                    </p>
                    <ul className="mt-1 space-y-1">
                      {t.releases.map((r) => (
                        <li key={r.ref} className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="font-mono text-[11px] text-slate-400">{r.ref}</span>
                          <span className="text-slate-700">{r.name}</span>
                          {r.attention === 'holds' ? <Badge tone="amber">held</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Nothing recorded against this yet — name what it releases.
                  </p>
                )}

                {t.danglingRefs.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Names {t.danglingRefs.join(', ')}, which{' '}
                    {t.danglingRefs.length === 1 ? 'is' : 'are'} not in the register.
                  </p>
                ) : null}
              </Card>
            ))}
          </section>
        );
      })}

      <Card>
        <p className="text-sm text-slate-600">
          {unowned > 0 ? (
            <>
              <strong>{unowned}</strong> {unowned === 1 ? 'track has' : 'tracks have'} no owner. An
              unowned funder conversation does not happen — that is a decision for{' '}
              <Link
                href="/register"
                className="font-medium text-brand underline underline-offset-2"
              >
                the review
              </Link>
              .
            </>
          ) : (
            'Every track has an owner.'
          )}
        </p>
      </Card>
    </div>
  );
}
