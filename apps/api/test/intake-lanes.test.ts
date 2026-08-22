import { describe, it, expect } from 'vitest';
import { classify, redact, wallsCollide } from '../src/intake/intake-lanes';

/**
 * These rules are the only thing standing between an automated mailbox sweep and a shared
 * queue that shows the lender the supplier's terms. They run before anything is stored and
 * before anything is sent to the model, so they get tested without a database.
 */
describe('compartmentalisation walls', () => {
  it('files a signal naming the supply counterparty as private', () => {
    const c = classify('Proforma update', 'Mento confirmed the eight units at 200,000,000.');
    expect(c.lane).toBe('private');
    expect(c.wallTags).toContain('supply-counterparty');
  });

  it('files a signal naming the lender as private', () => {
    const c = classify('Collateral', 'Unguka wants the 3% released against principal repaid.');
    expect(c.lane).toBe('private');
    expect(c.wallTags).toContain('lender');
  });

  it('catches the misspelling, because a wall that only catches correct spelling is not a wall', () => {
    expect(classify('note', 'ungaka called about the portal').lane).toBe('private');
  });

  it('matches on word boundaries so unrelated words do not trip it', () => {
    // "lolc" is a wall term; "lolcat" must not fire it.
    expect(classify('random', 'someone sent a lolcat').wallTags).toHaveLength(0);
  });

  it('does not care about case', () => {
    expect(classify('MENTO AGREEMENT', 'signed').lane).toBe('private');
  });

  it('walls a bank-detail change even with no counterparty named', () => {
    const c = classify('Urgent: change of account', 'Please use the new account number for this invoice.');
    expect(c.lane).toBe('private');
    expect(c.wallTags.some((t) => t.startsWith('restricted:'))).toBe(true);
  });

  it('leaves ordinary operational traffic shared', () => {
    const c = classify('Garage tools', 'The insulated glove set arrived, Tresor signed for it.');
    expect(c.lane).toBe('shared');
    expect(c.wallTags).toEqual([]);
  });
});

describe('redaction', () => {
  it('strips Rwandan mobile numbers in every common format', () => {
    for (const n of ['0788123456', '+250788123456', '078 812 3456', '0788-123-456']) {
      expect(redact(`call ${n} today`)).not.toContain('123');
    }
  });

  it('strips a 16-digit national ID', () => {
    expect(redact('ID 1199580123456789 attached')).toContain('[national-id]');
  });

  it('strips a bare account number', () => {
    expect(redact('pay into 4001234567890')).toContain('[number]');
  });

  it('leaves ordinary figures alone — a price is not personal data', () => {
    const out = redact('the vehicle is 25,000,000 RWF and the deposit is 40%');
    expect(out).toContain('25,000,000');
    expect(out).toContain('40%');
  });

  it('is idempotent, so a summary re-run does not double-mask', () => {
    const once = redact('reach me on 0788123456');
    expect(redact(once)).toBe(once);
  });
});

describe('wall adjacency', () => {
  it('reports a collision between two different walls', () => {
    expect(wallsCollide(['supply-counterparty'], ['lender'])).toBe(true);
  });

  it('allows two signals inside the same wall together', () => {
    expect(wallsCollide(['lender'], ['lender'])).toBe(false);
  });

  it('treats an unwalled signal as safe next to anything', () => {
    expect(wallsCollide([], ['lender'])).toBe(false);
    expect(wallsCollide(['restricted:payroll'], ['lender'])).toBe(false);
  });
});
