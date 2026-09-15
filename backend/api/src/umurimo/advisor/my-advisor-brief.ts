import type { Objective } from '../week/week.service';

/**
 * The grounding text for a person's own advisor — the self-scoped analogue of
 * `ReviewService.brief()`, which grounds the executive advisor over the whole register.
 *
 * Two rules carried over from `WeekService.scorecard()`'s own doc comment, because this
 * text is what turns that data into an LLM prompt and must not lose the discipline on the
 * way:
 *
 *  1. Graded against what THIS PERSON committed to — never a target somebody else set,
 *     and never another person's numbers. There is no "how does my week compare" input
 *     here on purpose: the umurimo module's own charter is "reports upward on work, never
 *     on people," and a brief that could answer a ranking question would violate that
 *     even if nothing calls it that way today.
 *  2. No score out of a hundred. `standing` is already a word, not a number, by the time
 *     it reaches here — this function does not recompute or re-derive one.
 *
 * A pure function, deliberately: everything it needs is already-fetched data, so it can be
 * unit-tested without a database or a model call, and the advisor service's own job shrinks
 * to "fetch my week, fetch my scorecard, hand both to this, send the result to Claude."
 */

export interface MyAdvisorObjectiveInput {
  readonly text: string;
  readonly status: Objective['status'];
  readonly note?: string;
}

export interface MyAdvisorBlockerInput {
  readonly ref: string;
  readonly summary: string;
  readonly dueAt?: Date | string | null;
}

export interface MyAdvisorAskInput {
  readonly ref: string;
  readonly body: string;
}

export interface MyAdvisorScorecardInput {
  readonly kept: { readonly done: number; readonly of: number; readonly pct: number | null };
  readonly onTime: { readonly planAgreed: boolean; readonly reportSent: boolean };
  readonly cleared: { readonly solved: number; readonly stillOpen: number; readonly late: number };
  readonly answered: { readonly answered: number; readonly of: number; readonly pct: number | null };
  readonly tasks: { readonly overdue: number } & Record<string, unknown>;
  readonly standing: string;
}

export interface MyAdvisorBriefInput {
  readonly periodKey: string;
  readonly objectives: readonly MyAdvisorObjectiveInput[];
  readonly needsMyConfirmation: boolean;
  readonly reportFiled: boolean;
  readonly iOwe: readonly MyAdvisorBlockerInput[];
  readonly waitingOnSomebody: readonly MyAdvisorBlockerInput[];
  readonly askedOfMe: readonly MyAdvisorAskInput[];
  readonly scorecard: MyAdvisorScorecardInput;
}

function dateOnly(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function buildMyAdvisorBrief(input: MyAdvisorBriefInput): string {
  const lines: string[] = [];
  lines.push(`Your week — ${input.periodKey}`);
  lines.push(`Standing: ${input.scorecard.standing}.`);

  if (input.needsMyConfirmation) {
    lines.push('You have not agreed to this week\'s objectives yet — they are still a draft.');
  }
  if (!input.reportFiled) {
    lines.push('You have not filed this week\'s report yet.');
  }

  lines.push(
    '',
    'WHAT YOU COMMITTED TO',
    input.objectives.length
      ? `${input.scorecard.kept.done} of ${input.scorecard.kept.of} done` +
          (input.scorecard.kept.pct === null ? '.' : ` (${input.scorecard.kept.pct}%).`)
      : 'Nothing recorded for this week.',
  );
  for (const o of input.objectives) {
    const bits = [`[${o.status}]`, o.text];
    if (o.note) bits.push(`— ${o.note}`);
    lines.push(`- ${bits.join(' ')}`);
  }

  lines.push(
    '',
    'PROBLEMS YOU OWN',
    `${input.scorecard.cleared.solved} solved this week, ${input.scorecard.cleared.stillOpen} still open, ${input.scorecard.cleared.late} of those overdue.`,
  );
  for (const b of input.iOwe) {
    const due = dateOnly(b.dueAt);
    lines.push(`- [${b.ref}] ${b.summary}${due ? ` (due ${due})` : ' (no due date set)'}`);
  }

  if (input.waitingOnSomebody.length) {
    lines.push('', 'RAISED BY YOU, STILL NOBODY\'S TO OWN — chase these, do not wait on them');
    for (const b of input.waitingOnSomebody) lines.push(`- [${b.ref}] ${b.summary}`);
  }

  lines.push(
    '',
    'REQUESTS AIMED AT YOU',
    `${input.scorecard.answered.answered} of ${input.scorecard.answered.of} answered` +
      (input.scorecard.answered.pct === null ? '.' : ` (${input.scorecard.answered.pct}%).`),
  );
  for (const a of input.askedOfMe) lines.push(`- [${a.ref}] ${a.body}`);

  if (typeof input.scorecard.tasks.overdue === 'number' && input.scorecard.tasks.overdue > 0) {
    lines.push('', `MIRRORED WORKSPACE TASKS: ${input.scorecard.tasks.overdue} overdue.`);
  }

  return lines.join('\n');
}
