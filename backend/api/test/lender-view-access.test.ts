import { describe, expect, it } from 'vitest';
import {
  COLLATERAL_ENTITLED,
  mayDisclose,
  maySeeCollateral,
  redactForLender,
  type LenderFacingFile,
} from '../src/platform/lender-view/lender-view-access';

const file = (): LenderFacingFile => ({
  uzaId: 'UZA-P-000123',
  displayName: 'A Borrower',
  training: { programme: 'Tunga Taxi', completedAt: '2026-10-17', assessmentPassed: true },
  wallet: {
    allocations: { loan: 780_000, charging: 78_000, maintenance: 78_000, saving: 78_000 },
    windowStart: '2026-09-01',
    windowEnd: '2026-09-30',
    reserveStatus: 'on_track',
    arrearsStatus: 'current',
  },
  utilisation: {
    windowStart: '2026-09-01',
    windowEnd: '2026-09-30',
    productiveDays: 24,
    windowDays: 26,
  },
  creditEnhancement: {
    facility: 'cash collateral',
    depositedRwf: 750_000,
    releasedRwf: 0,
    callableRwf: 750_000,
  },
});

describe('the cash-collateral wall', () => {
  it('shows the collateral position to the one entitled lender', () => {
    const out = redactForLender(file(), 'unguka');
    expect(out.creditEnhancement).toBeDefined();
    expect(out.creditEnhancement?.depositedRwf).toBe(750_000);
  });

  it('removes it for every other lender named in the standing instruction', () => {
    // These four are named explicitly in the founder's rule. If any of them ever sees a
    // collateral figure, a confidentiality undertaking has been broken.
    for (const lender of ['jali', 'equity', 'ncba', 'bank of kigali']) {
      const out = redactForLender(file(), lender);
      expect(out.creditEnhancement, `${lender} must not see the collateral`).toBeUndefined();
    }
  });

  it('removes it for a lender nobody has thought of yet', () => {
    // The default is deny. A lender added to the business next year is redacted without
    // anybody having to remember to add them here.
    expect(redactForLender(file(), 'some-new-bank-2027').creditEnhancement).toBeUndefined();
  });

  it('is not fooled by case or padding in the lender name', () => {
    expect(redactForLender(file(), '  UNGUKA ').creditEnhancement).toBeDefined();
    expect(maySeeCollateral(' Unguka')).toBe(true);
    expect(maySeeCollateral('UNGUKA')).toBe(true);
  });

  it('does not match a lender whose name merely contains the entitled one', () => {
    // "unguka-brokers" is not Unguka. Substring matching here would be a disclosure bug.
    expect(maySeeCollateral('unguka-brokers')).toBe(false);
    expect(maySeeCollateral('not-unguka')).toBe(false);
  });

  it('keeps the entitlement list to one, so widening it is a deliberate change', () => {
    // This test exists to fail loudly if somebody adds a lender casually. Changing it
    // should require reading the rule and meaning it.
    expect(COLLATERAL_ENTITLED).toEqual(['unguka']);
  });

  it('leaves everything the lender IS entitled to intact', () => {
    const out = redactForLender(file(), 'equity');
    expect(out.training?.assessmentPassed).toBe(true);
    expect(out.wallet?.allocations['loan']).toBe(780_000);
    expect(out.utilisation?.productiveDays).toBe(24);
  });

  it('does not mutate the file it was given', () => {
    // The same file object may be shaped for two lenders in one request. If redaction
    // mutated it, the second lender's redaction would depend on the first one's.
    const original = file();
    redactForLender(original, 'equity');
    expect(original.creditEnhancement).toBeDefined();
  });
});

describe('who may be shown to whom', () => {
  const base = {
    personExists: true,
    isBorrowerOfThisLender: true,
    consentGivenAt: new Date('2026-09-01'),
    consentWithdrawnAt: null,
  };

  it('allows a consenting borrower of that lender', () => {
    expect(mayDisclose(base)).toEqual({ allowed: true });
  });

  it('refuses another lender’s borrower', () => {
    expect(mayDisclose({ ...base, isBorrowerOfThisLender: false }).allowed).toBe(false);
  });

  it('refuses without consent, and after consent is withdrawn', () => {
    expect(mayDisclose({ ...base, consentGivenAt: null }).reason).toBe('no-consent');
    expect(mayDisclose({ ...base, consentWithdrawnAt: new Date() }).reason).toBe(
      'consent-withdrawn',
    );
  });

  it('refuses an unknown person', () => {
    expect(mayDisclose({ ...base, personExists: false }).reason).toBe('no-such-person');
  });

  it('refuses on the FIRST failing gate, so a refusal leaks nothing', () => {
    // A lender probing UZA IDs must not be able to tell "this person is not mine" apart
    // from "this person does not exist" — otherwise the endpoint becomes a way to test
    // whether a given person is a UZA client at all.
    const unknown = mayDisclose({ ...base, personExists: false, isBorrowerOfThisLender: false });
    expect(unknown.allowed).toBe(false);
    const notMine = mayDisclose({ ...base, isBorrowerOfThisLender: false });
    expect(notMine.allowed).toBe(false);
    // Both refuse. The caller is expected to return one identical response for either.
  });
});

describe('reserve status is not arrears status', () => {
  it('keeps them as separate fields', () => {
    // A client behind on the DAILY reserve is not in arrears — the obligation is the
    // monthly instalment. Merging these would let a lender treat a smoothing tool as a
    // default, which would make the tool dangerous to the person using it.
    const f = file();
    f.wallet!.reserveStatus = 'behind';
    f.wallet!.arrearsStatus = 'current';
    const out = redactForLender(f, 'unguka');
    expect(out.wallet?.reserveStatus).toBe('behind');
    expect(out.wallet?.arrearsStatus).toBe('current');
  });
});
