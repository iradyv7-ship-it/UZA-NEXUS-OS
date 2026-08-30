import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';

type CheckOutcome = 'pass' | 'fail' | 'not_applicable' | 'not_run';
type ReadinessState = 'green' | 'failing' | 'stale' | 'unverified';

interface SystemRow {
  ref: string;
  name: string;
  ventureCode: string | null;
  status: string;
  ownerId: string;
  state: ReadinessState;
  lastVerifiedAt: string | null;
  daysSinceVerified: number | null;
  checks: {
    typecheck: CheckOutcome;
    tests: CheckOutcome;
    imageBuilds: CheckOutcome;
    testsPassed: number | null;
    testsTotal: number | null;
    verifiedBy: string;
  } | null;
  gaps: string | null;
  trend: 'growing' | 'shrinking' | 'flat' | null;
}

interface Readiness {
  systems: SystemRow[];
  summary: {
    total: number;
    green: number;
    failing: number;
    stale: number;
    unverified: number;
    testsPassing: number;
  };
  caveat: string;
}

/**
 * Where every system stands.
 *
 * The founder's question is "how is each project going", and until now it was answered
 * in meetings from memory — which is how a system stays "nearly done" for two months.
 * This page answers it only from measurements: what was run, when, and what happened.
 *
 * Ordering is the argument, and it is the same one the Nexus page makes: what is WRONG
 * comes first. Failing, then unverified, then stale, then green. A page that opens with
 * "six systems green" is a page that gets skimmed; one that opens with "two systems
 * nobody has ever measured" is one that gets acted on.
 *
 * Nothing here is stored. Every number comes from the same endpoint the API exposes, so
 * this page cannot disagree with the register.
 */

const STATE_ORDER: Record<ReadinessState, number> = {
  failing: 0,
  unverified: 1,
  stale: 2,
  green: 3,
};

const STATE_LABEL: Record<ReadinessState, { text: string; tone: 'red' | 'amber' | 'green' | 'slate' }> = {
  failing: { text: 'Failing', tone: 'red' },
  // Amber, not grey. Never measured is a gap somebody owns, not a neutral fact.
  unverified: { text: 'Never verified', tone: 'amber' },
  stale: { text: 'Stale', tone: 'amber' },
  green: { text: 'Green', tone: 'green' },
};

const CHECK_MARK: Record<CheckOutcome, string> = {
  pass: '✓',
  fail: '✗',
  not_applicable: '–',
  not_run: '?',
};

function Check({ label, outcome }: { label: string; outcome: CheckOutcome }) {
  const color =
    outcome === 'pass' ? 'text-emerald-600'
    : outcome === 'fail' ? 'text-red-600'
    : outcome === 'not_run' ? 'text-amber-600'
    : 'text-slate-400';
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <span className={`font-bold ${color}`}>{CHECK_MARK[outcome]}</span>
      {label}
    </span>
  );
}

function Metric({
  label, value, tone = 'slate', hint,
}: {
  label: string; value: string | number; tone?: 'red' | 'amber' | 'green' | 'slate'; hint?: string;
}) {
  const color =
    tone === 'red' ? 'text-red-600'
    : tone === 'amber' ? 'text-amber-600'
    : tone === 'green' ? 'text-emerald-600'
    : 'text-slate-800';
  return (
    <Card className="h-full">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-xs leading-tight text-slate-500">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
    </Card>
  );
}

function whenVerified(row: SystemRow): string {
  if (row.daysSinceVerified === null) return 'never';
  if (row.daysSinceVerified === 0) return 'today';
  if (row.daysSinceVerified === 1) return 'yesterday';
  return `${row.daysSinceVerified} days ago`;
}

export default async function SystemsPage() {
  const session = await getSession();
  if (!session) return null;

  const res = await authedCall<Readiness>('/planning/systems/readiness');
  if (res.kind !== 'ok') {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold text-slate-800">Systems</h1>
        <Card className="mt-4">
          <p className="text-sm text-slate-600">
            The readiness view could not be loaded. Nothing is inferred here — the page
            shows measurements or it shows nothing.
          </p>
        </Card>
      </main>
    );
  }

  const { systems, summary, caveat } = res.data;
  const rows = [...systems].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name),
  );

  const needsAttention = rows.filter((r) => r.state !== 'green');

  return (
    <main className="space-y-5 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">Systems</h1>
        <p className="mt-1 text-sm text-slate-500">
          Where each project stands, from what was last actually run.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Failing"
          value={summary.failing}
          tone={summary.failing > 0 ? 'red' : 'slate'}
          hint="a check did not pass"
        />
        <Metric
          label="Never verified"
          value={summary.unverified}
          tone={summary.unverified > 0 ? 'amber' : 'slate'}
          hint="nobody has run the checks"
        />
        <Metric
          label="Stale"
          value={summary.stale}
          tone={summary.stale > 0 ? 'amber' : 'slate'}
          hint="passed, but over two weeks ago"
        />
        <Metric label="Green" value={summary.green} tone="green" hint="passed recently" />
        <Metric
          label="Tests passing"
          value={summary.testsPassing.toLocaleString('en-GB')}
          hint="across every measured system"
        />
      </div>

      {/*
        Said where it is read, not in a footnote. A dashboard that only shows green
        numbers trains people to stop reading it, and "builds clean" is a much smaller
        claim than "is finished".
      */}
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        {caveat}
      </p>

      {needsAttention.length === 0 && rows.length > 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Every system has a passing verification from the last two weeks.
          </p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const label = STATE_LABEL[row.state];
          return (
            <Card key={row.ref}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <Badge tone={label.tone}>{label.text}</Badge>
                    {row.ventureCode ? <Badge>{row.ventureCode}</Badge> : null}
                    <span className="text-xs text-slate-400">{row.ref}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.status} · owner {row.ownerId} · verified {whenVerified(row)}
                    {row.checks ? ` by ${row.checks.verifiedBy}` : ''}
                  </div>
                </div>

                {row.checks ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Check label="types" outcome={row.checks.typecheck} />
                    <Check label="tests" outcome={row.checks.tests} />
                    <Check label="image" outcome={row.checks.imageBuilds} />
                    {row.checks.testsTotal !== null ? (
                      <span className="tabular-nums text-xs text-slate-600">
                        {row.checks.testsPassed ?? 0}/{row.checks.testsTotal}
                        {row.trend === 'growing' ? ' ↑' : row.trend === 'shrinking' ? ' ↓' : ''}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-amber-700">No checks have been run.</span>
                )}
              </div>

              {/* The unfinished half. Green says the code works, not that it is done. */}
              {row.gaps ? (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-700">Not connected yet: </span>
                  {row.gaps}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            No systems are registered yet. Add them in the estate, then record a
            verification against each.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
