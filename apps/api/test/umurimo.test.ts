import { describe, expect, it } from 'vitest';
import {
  UMURIMO_ACCESS,
  hasUmurimoCapability,
  seesAllBlockers,
  mayModerate,
  isCommentSubject,
  seesAllWeeks,
  maySyncWorkspace,
  COMMENT_SUBJECTS,
} from '../src/umurimo/umurimo-access';
import { blockerRef, commentRef, extractMentions } from '../src/umurimo/umurimo-ids';
import { nextSequence, refPrefix } from '../src/planning/planning-ids';

/**
 * These tests guard the three decisions in this module that would be silently reversed by a
 * well-meaning edit: that external roles hold nothing, that nobody but the executive rewrites
 * another person's words, and that the comment subject is a closed set.
 */
describe('umurimo access policy', () => {
  it('gives every internal role the right to comment', () => {
    // The module only works if the person who knows the answer can leave it. A commenting
    // right rationed by seniority produces a register full of executive opinion and no field
    // knowledge.
    for (const role of ['finance', 'china_sourcing', 'china_warehouse', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'comment:read')).toBe(true);
      expect(hasUmurimoCapability(role, 'comment:write')).toBe(true);
    }
  });

  it('lets any internal role raise AND own a blocker', () => {
    // Routing ownership through a manager guarantees the assignment does not happen in the
    // meeting, which is the only moment everyone is in the room.
    for (const role of ['finance', 'china_sourcing', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'blocker:raise')).toBe(true);
      expect(hasUmurimoCapability(role, 'blocker:own')).toBe(true);
    }
  });

  it('never lets an internal role rewrite another person or see every blocker', () => {
    for (const role of ['finance', 'china_sourcing', 'china_warehouse', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'comment:moderate')).toBe(false);
      expect(hasUmurimoCapability(role, 'blocker:all')).toBe(false);
    }
    expect(mayModerate('ceo')).toBe(true);
    expect(mayModerate('venture_manager')).toBe(true);
    expect(seesAllBlockers('ceo')).toBe(true);
    expect(seesAllBlockers('finance')).toBe(false);
  });

  it('denies external roles everything', () => {
    for (const role of ['sales_agent', 'logistics_partner'] as const) {
      expect(UMURIMO_ACCESS[role]).toHaveLength(0);
      expect(hasUmurimoCapability(role, 'comment:read')).toBe(false);
      expect(hasUmurimoCapability(role, 'digest')).toBe(false);
    }
  });

  it('grants the digest to internal roles, not only the executive', () => {
    // A person seeing the week's open asks is how an ask gets answered.
    expect(hasUmurimoCapability('finance', 'digest')).toBe(true);
  });
});

describe('comment subjects are a closed set', () => {
  it('accepts only allowlisted subjects', () => {
    for (const s of COMMENT_SUBJECTS) expect(isCommentSubject(s)).toBe(true);
  });

  it('rejects anything else', () => {
    // An unconstrained polymorphic key becomes a dumping ground inside a month, after which
    // nothing can be joined or reported on.
    for (const s of ['chat', 'general', 'shipment', '', 'Initiative', 'user']) {
      expect(isCommentSubject(s)).toBe(false);
    }
  });
});

describe('readable ids', () => {
  const year = String(new Date().getFullYear());

  it('pads a blocker ref to four digits', () => {
    expect(blockerRef(1)).toBe(`BLK-${year}-0001`);
    expect(blockerRef(4210)).toBe(`BLK-${year}-4210`);
  });

  it('pads a comment ref to six, because comments are the high-volume row', () => {
    expect(commentRef(1)).toBe(`CMT-${year}-000001`);
    expect(commentRef(123456)).toBe(`CMT-${year}-123456`);
  });
});

describe('mentions', () => {
  it('finds readable user refs and de-duplicates them', () => {
    expect(extractMentions('@AGT-GOM-0021 please look, cc @CEO-KGL-01 and @AGT-GOM-0021')).toEqual([
      'AGT-GOM-0021',
      'CEO-KGL-01',
    ]);
  });

  it('does not mistake an email or a price for a mention', () => {
    // The pattern is deliberately conservative: a false mention notifies the wrong person
    // about a record they may not even be able to open.
    expect(extractMentions('write to yves@uzasolutions.rw about the RWF 22,500,000 units')).toEqual(
      [],
    );
    expect(extractMentions('no mentions here at all')).toEqual([]);
  });

  it('returns an empty list rather than throwing on an empty body', () => {
    expect(extractMentions('')).toEqual([]);
  });
});

describe('the weekly loop', () => {
  it('lets everyone internal plan and report', () => {
    // "each employee including me should be answerable" - so the capability to plan and to
    // file is universal among internal roles, not a management privilege.
    for (const role of ['finance', 'china_sourcing', 'china_warehouse', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'week:read')).toBe(true);
      expect(hasUmurimoCapability(role, 'week:confirm')).toBe(true);
    }
    expect(hasUmurimoCapability('ceo', 'week:confirm')).toBe(true);
  });

  it('keeps company-wide filing state and minutes-posting executive', () => {
    for (const role of ['finance', 'china_sourcing', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'week:all')).toBe(false);
      expect(hasUmurimoCapability(role, 'minutes:ingest')).toBe(false);
    }
    expect(seesAllWeeks('ceo')).toBe(true);
    expect(seesAllWeeks('venture_manager')).toBe(true);
    expect(seesAllWeeks('front_office')).toBe(false);
    expect(hasUmurimoCapability('venture_manager', 'minutes:ingest')).toBe(true);
  });

  it('denies the whole weekly loop to external roles', () => {
    for (const role of ['sales_agent', 'logistics_partner'] as const) {
      expect(hasUmurimoCapability(role, 'week:read')).toBe(false);
      expect(hasUmurimoCapability(role, 'week:confirm')).toBe(false);
      expect(hasUmurimoCapability(role, 'minutes:ingest')).toBe(false);
    }
  });
});

describe('the workspace bridge', () => {
  it('lets everyone see their own mirrored tasks', () => {
    for (const role of ['finance', 'china_sourcing', 'china_warehouse', 'front_office'] as const) {
      expect(hasUmurimoCapability(role, 'workspace:read')).toBe(true);
    }
  });

  it('does not let an ordinary role push a batch in', () => {
    // A write that rewrites what the register believes about everyone's work is not a
    // participation right, however wide the rest of this module is.
    for (const role of ['finance', 'china_sourcing', 'front_office'] as const) {
      expect(maySyncWorkspace(role)).toBe(false);
      expect(hasUmurimoCapability(role, 'workspace:sync')).toBe(false);
    }
    expect(maySyncWorkspace('ceo')).toBe(true);
    expect(maySyncWorkspace('venture_manager')).toBe(true);
  });

  it('keeps external roles out of the bridge entirely', () => {
    for (const role of ['sales_agent', 'logistics_partner'] as const) {
      expect(hasUmurimoCapability(role, 'workspace:read')).toBe(false);
      expect(hasUmurimoCapability(role, 'workspace:sync')).toBe(false);
    }
  });
});

describe('readable refs survive a gap in the sequence', () => {
  // The bug this guards: `count() + 1` was the original scheme, and it collides the moment a
  // row is deleted or seeded out of order. On 24 August 2026 there were 32 decisions in the
  // database and the highest ref was DEC-2026-0033, so count()+1 produced a ref that already
  // existed and every attempt to raise a decision returned a 500.
  const model = (ref: string | null) => ({ findFirst: async () => (ref ? { ref } : null) });

  it('continues from the highest ref, not from the row count', async () => {
    expect(await nextSequence(model('DEC-2026-0033'), 'DEC-2026-')).toBe(34);
    expect(await nextSequence(model('INIT-2026-0222'), 'INIT-2026-')).toBe(223);
  });

  it('starts at 1 when nothing exists yet', async () => {
    expect(await nextSequence(model(null), 'DEC-2026-')).toBe(1);
  });

  it('falls back to 1 rather than NaN on a ref it cannot parse', async () => {
    expect(await nextSequence(model('DEC-2026-legacy'), 'DEC-2026-')).toBe(1);
  });

  it('scopes the prefix by year, so January starts again at 1', () => {
    expect(refPrefix('DEC')).toBe(`DEC-${new Date().getFullYear()}-`);
  });
});
