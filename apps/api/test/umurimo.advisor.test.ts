import { describe, expect, it } from 'vitest';
import {
  buildMyAdvisorBrief,
  type MyAdvisorBriefInput,
} from '../src/umurimo/advisor/my-advisor-brief';

/**
 * `buildMyAdvisorBrief` is the one piece of the self-advisor that does not need a database
 * or a model call to verify — the assembly of already-fetched data into the text Claude is
 * grounded on. What these tests guard is the property that would be easiest to break
 * silently: nothing here ever mentions another person, a team average, or a target the
 * person did not set themselves — see the module's own "reports upward on work, never on
 * people" charter.
 */

const baseScorecard: MyAdvisorBriefInput['scorecard'] = {
  kept: { done: 0, of: 0, pct: null },
  onTime: { planAgreed: true, reportSent: true },
  cleared: { solved: 0, stillOpen: 0, late: 0 },
  answered: { answered: 0, of: 0, pct: null },
  tasks: { overdue: 0 },
  standing: 'a good week',
};

const base: MyAdvisorBriefInput = {
  periodKey: '2026-W37',
  objectives: [],
  needsMyConfirmation: false,
  reportFiled: true,
  iOwe: [],
  waitingOnSomebody: [],
  askedOfMe: [],
  scorecard: baseScorecard,
};

describe('buildMyAdvisorBrief', () => {
  it('states the period and standing plainly', () => {
    const brief = buildMyAdvisorBrief(base);
    expect(brief).toContain('2026-W37');
    expect(brief).toContain('Standing: a good week.');
  });

  it('flags an unconfirmed plan and an unfiled report as their own lines', () => {
    const brief = buildMyAdvisorBrief({ ...base, needsMyConfirmation: true, reportFiled: false });
    expect(brief).toContain('have not agreed to this week');
    expect(brief).toContain('have not filed this week');
  });

  it('lists each objective with its own status and note, never a percentage graded against anyone else', () => {
    const brief = buildMyAdvisorBrief({
      ...base,
      objectives: [
        { text: 'Ship the Kigali quotation', status: 'done', note: 'sent Tuesday' },
        { text: 'Chase the forwarder invoice', status: 'todo' },
      ],
      scorecard: { ...baseScorecard, kept: { done: 1, of: 2, pct: 50 } },
    });
    expect(brief).toContain('[done] Ship the Kigali quotation — sent Tuesday');
    expect(brief).toContain('[todo] Chase the forwarder invoice');
    expect(brief).toContain('1 of 2 done (50%)');
  });

  it('names owned blockers with their due date, or says plainly that none was set', () => {
    const brief = buildMyAdvisorBrief({
      ...base,
      iOwe: [
        { ref: 'BLK-2026-0001', summary: 'Waiting on customs clearance', dueAt: '2026-09-20' },
        { ref: 'BLK-2026-0002', summary: 'No date agreed yet', dueAt: null },
      ],
    });
    expect(brief).toContain('[BLK-2026-0001] Waiting on customs clearance (due 2026-09-20)');
    expect(brief).toContain('[BLK-2026-0002] No date agreed yet (no due date set)');
  });

  it('separates what I raised and nobody owns from what I myself own', () => {
    const brief = buildMyAdvisorBrief({
      ...base,
      waitingOnSomebody: [{ ref: 'BLK-2026-0009', summary: "Needs finance's sign-off" }],
    });
    expect(brief).toContain("RAISED BY YOU, STILL NOBODY'S TO OWN");
    expect(brief).toContain("[BLK-2026-0009] Needs finance's sign-off");
  });

  it('lists requests aimed at me by ref and body', () => {
    const brief = buildMyAdvisorBrief({
      ...base,
      askedOfMe: [{ ref: 'CMT-2026-000042', body: 'Can you confirm the container weight?' }],
    });
    expect(brief).toContain('[CMT-2026-000042] Can you confirm the container weight?');
  });

  it('mentions overdue mirrored tasks only when there are some', () => {
    const withOverdue = buildMyAdvisorBrief({
      ...base,
      scorecard: { ...baseScorecard, tasks: { overdue: 3 } },
    });
    expect(withOverdue).toContain('MIRRORED WORKSPACE TASKS: 3 overdue.');

    const withoutOverdue = buildMyAdvisorBrief(base);
    expect(withoutOverdue).not.toContain('MIRRORED WORKSPACE TASKS');
  });

  it('never mentions another person, a comparison, or a ranking', () => {
    const brief = buildMyAdvisorBrief({
      ...base,
      objectives: [{ text: 'Ship the Kigali quotation', status: 'done' }],
      iOwe: [{ ref: 'BLK-2026-0001', summary: 'Waiting on customs clearance', dueAt: null }],
      scorecard: { ...baseScorecard, kept: { done: 1, of: 1, pct: 100 } },
    });
    for (const word of ['average', 'compared', 'ranking', 'versus', 'other employees', 'team score']) {
      expect(brief.toLowerCase()).not.toContain(word);
    }
  });
});
