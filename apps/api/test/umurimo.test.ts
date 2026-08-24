import { describe, expect, it } from 'vitest';
import {
  UMURIMO_ACCESS,
  hasUmurimoCapability,
  seesAllBlockers,
  mayModerate,
  isCommentSubject,
  COMMENT_SUBJECTS,
} from '../src/umurimo/umurimo-access';
import { blockerRef, commentRef, extractMentions } from '../src/umurimo/umurimo-ids';

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
    for (const role of ['customer', 'sales_agent', 'logistics_partner'] as const) {
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
    expect(extractMentions('write to yves@uzasolutions.rw about the RWF 22,500,000 units')).toEqual([]);
    expect(extractMentions('no mentions here at all')).toEqual([]);
  });

  it('returns an empty list rather than throwing on an empty body', () => {
    expect(extractMentions('')).toEqual([]);
  });
});
