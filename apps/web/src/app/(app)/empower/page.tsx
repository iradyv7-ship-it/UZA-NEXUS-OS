import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Badge, Card, CardGrid } from '../../../components/ui';

type Bridge<T> = { configured: boolean; ok: boolean; data: T | null; error: string | null };

type Impact = {
  generatedAt: string;
  delivery: {
    enrolments: Record<string, number>;
    participantsWithAnyRecord: number;
    certified: number;
    moduleSittings: number;
    moduleSittingsPassed: number;
    hoursDelivered: number;
    distinctTrainers: number;
    advisedToBuildFurther: number;
    placedInDriversPool: number;
  };
  comprehension: {
    firstAssessments: number;
    meanFirstScorePct: number | null;
    retestsTaken: number;
    meanRetestScorePct: number | null;
    participantsFallingOnRetest: number;
  };
  value: {
    curriculumHoursPerParticipant: number;
    hoursDelivered: number;
    participantsTrained: number;
    costPerParticipantHourRwf: number;
    valuePerParticipantRwf: number;
    valueDeliveredRwf: number;
    benchmark: { label: string; perTraineeEur: number; perTraineeRwf: number | null; confidence: string };
  };
  repayment: { groups: { group: string; loans: number; inArrears: number; arrearsRatePct: number | null }[]; verdict: string; sufficient: boolean };
  notMeasured: { metric: string; reason: string; unlockedBy: string }[];
};

type Covenants = {
  generatedAt: string;
  activeLoans: number;
  loansWithWarnings: number;
  alerts: number;
  rows: {
    loanRef: string;
    uzaId: string | null;
    displayName: string;
    lender: string;
    worst: 'NOTICE' | 'WARNING' | 'ALERT' | null;
    covenants: { kind: string; severity: string; message: string; audience: string[] }[];
  }[];
};

type Application = { ref: string; fullName: string; district: string; status: string; preferredLenderKey: string | null; signedAt: string | null; createdAt: string };

const rwf = (n: number | null | undefined) => (n == null ? '—' : `RWF ${Math.round(n).toLocaleString('en-RW')}`);
const tone = (s: string | null) => (s === 'ALERT' ? 'red' : s === 'WARNING' ? 'amber' : s === 'NOTICE' ? 'blue' : 'slate') as 'red' | 'amber' | 'blue' | 'slate';

/**
 * UZA Empower, watched from the operating layer. Everything on this page is read live from
 * the Mobility API through the Nexus bridge; nothing is copied. If the bridge is not
 * configured, the page says so and stops — an unconfigured integration is a state, not a
 * broken screen.
 */
export default async function EmpowerPage() {
  const session = await getSession();
  if (!session) return null;

  const [impactR, covR, appsR] = await Promise.all([
    authedCall<Bridge<Impact>>('/empower/impact?costPerParticipantHourRwf=12000&rwfPerEur=1500'),
    authedCall<Bridge<Covenants>>('/empower/covenants'),
    authedCall<Bridge<Application[]>>('/empower/applications'),
  ]);

  const bridge = impactR.kind === 'ok' ? impactR.data : null;
  if (!bridge || !bridge.configured) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">UZA Empower</h1>
        <Card>
          <p className="text-sm">
            The bridge to the Mobility API is not configured on the Nexus API. Set{' '}
            <code>MOBILITY_API_URL</code>, <code>MOBILITY_SERVICE_EMAIL</code> and{' '}
            <code>MOBILITY_SERVICE_PASSWORD</code> (a FINANCE_ADMIN service account) and this page will
            read Empower's live records — nothing is copied into Nexus.
          </p>
          {bridge?.error ? <p className="mt-2 text-xs text-fgMuted">{bridge.error}</p> : null}
        </Card>
      </div>
    );
  }
  if (!bridge.ok || !bridge.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">UZA Empower</h1>
        <Card>
          <p className="text-sm">The Mobility API did not answer.</p>
          <p className="mt-2 text-xs text-fgMuted">{bridge.error}</p>
        </Card>
      </div>
    );
  }

  const impact = bridge.data;
  const cov = covR.kind === 'ok' && covR.data.ok ? covR.data.data : null;
  const apps = appsR.kind === 'ok' && appsR.data.ok ? (appsR.data.data ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">UZA Empower</h1>
        <span className="text-xs text-fgMuted">Live from the Mobility API · {new Date(impact.generatedAt).toLocaleString('en-GB')}</span>
      </div>

      {/* Covenants first: the thing that needs somebody today. */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fgMuted">Covenant warnings</h2>
          {cov ? <Badge tone={cov.alerts ? 'red' : cov.loansWithWarnings ? 'amber' : 'green'}>{cov.alerts} alert{cov.alerts === 1 ? '' : 's'} · {cov.loansWithWarnings} of {cov.activeLoans} loans</Badge> : null}
        </div>
        {!cov ? (
          <Card><p className="text-sm text-fgMuted">Could not read covenants.</p></Card>
        ) : cov.rows.length === 0 ? (
          <Card><p className="text-sm">No open warnings on {cov.activeLoans} active loan{cov.activeLoans === 1 ? '' : 's'}.</p></Card>
        ) : (
          <div className="space-y-2">
            {cov.rows.map((r) => (
              <Card key={r.loanRef}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{r.displayName}</span>
                    <span className="text-fgMuted"> · {r.uzaId ?? 'no UZA ID'} · {r.loanRef} · {r.lender}</span>
                  </div>
                  <Badge tone={tone(r.worst)}>{r.worst}</Badge>
                </div>
                <ul className="mt-2 space-y-1">
                  {r.covenants.map((c) => (
                    <li key={c.kind} className="text-sm">
                      <span className="text-fgMuted">{c.kind.replaceAll('_', ' ').toLowerCase()} · </span>
                      {c.message}
                      <span className="text-xs text-fgMuted"> — seen by {c.audience.join(', ').toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fgMuted">Academy</h2>
        <CardGrid>
          <Card><div className="text-xs text-fgMuted">Participants with a record</div><div className="text-2xl font-semibold">{impact.delivery.participantsWithAnyRecord}</div></Card>
          <Card><div className="text-xs text-fgMuted">Certified</div><div className="text-2xl font-semibold">{impact.delivery.certified}</div></Card>
          <Card><div className="text-xs text-fgMuted">Hours delivered</div><div className="text-2xl font-semibold">{impact.delivery.hoursDelivered}</div><div className="text-xs text-fgMuted">of {impact.value.curriculumHoursPerParticipant} per participant</div></Card>
          <Card><div className="text-xs text-fgMuted">Comprehension, first → re-test</div><div className="text-2xl font-semibold">{impact.comprehension.meanFirstScorePct ?? '—'}% → {impact.comprehension.meanRetestScorePct ?? '—'}%</div><div className="text-xs text-fgMuted">{impact.comprehension.participantsFallingOnRetest} falling</div></Card>
          <Card><div className="text-xs text-fgMuted">Advised to build further</div><div className="text-2xl font-semibold">{impact.delivery.advisedToBuildFurther}</div><div className="text-xs text-fgMuted">a counted outcome, not a failure</div></Card>
          <Card><div className="text-xs text-fgMuted">Value delivered</div><div className="text-2xl font-semibold">{rwf(impact.value.valueDeliveredRwf)}</div><div className="text-xs text-fgMuted">at RWF {impact.value.costPerParticipantHourRwf.toLocaleString('en-RW')}/h (input) · S.U.L benchmark €{impact.value.benchmark.perTraineeEur}/trainee</div></Card>
        </CardGrid>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fgMuted">The claim to lenders — measured</h2>
        <Card>
          <p className="text-sm">{impact.repayment.verdict}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-fgMuted">
            {impact.repayment.groups.map((g) => (
              <span key={g.group}>{g.group.replace('_', ' ')}: {g.loans} loans, {g.inArrears} in arrears{g.arrearsRatePct != null ? ` (${g.arrearsRatePct}%)` : ''}</span>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fgMuted">Not measured — and why</h2>
        <Card>
          <ul className="space-y-1 text-sm">
            {impact.notMeasured.map((n) => (
              <li key={n.metric}><span className="font-medium">{n.metric}.</span> <span className="text-fgMuted">{n.reason}</span> <span className="text-xs">Unlocked by: {n.unlockedBy}</span></li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fgMuted">Applications · {apps.length}</h2>
        {apps.length === 0 ? (
          <Card><p className="text-sm text-fgMuted">None yet.</p></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fgMuted"><tr><th className="py-1 pr-3">Ref</th><th className="py-1 pr-3">Applicant</th><th className="py-1 pr-3">District</th><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Lender named</th><th className="py-1">Signed</th></tr></thead>
                <tbody>
                  {apps.slice(0, 25).map((a) => (
                    <tr key={a.ref} className="border-t border-border">
                      <td className="py-1 pr-3 font-mono text-xs">{a.ref}</td>
                      <td className="py-1 pr-3">{a.fullName}</td>
                      <td className="py-1 pr-3">{a.district}</td>
                      <td className="py-1 pr-3"><Badge tone={a.status === 'SUBMITTED' ? 'blue' : a.status === 'ACCEPTED' ? 'green' : 'slate'}>{a.status}</Badge></td>
                      <td className="py-1 pr-3">{a.preferredLenderKey ?? '—'}</td>
                      <td className="py-1">{a.signedAt ? new Date(a.signedAt).toLocaleDateString('en-GB') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
