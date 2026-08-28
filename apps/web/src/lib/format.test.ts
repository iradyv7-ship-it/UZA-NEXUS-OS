import { describe, expect, it } from 'vitest';
import { maskedMoney, maskedPercent, money, percent } from './format';
import { MASK } from './types';

/**
 * The reference test for the web app. Copy its shape.
 *
 * Masking is the reason this file is tested first. The API decides what a role may see and
 * replaces the rest with `***`. If the UI ever formats that as a number, it invents data
 * the server deliberately withheld — a disclosure bug that would look like a rendering
 * quirk, and that no type checker catches.
 */

describe('money', () => {
  it('treats the input as MINOR units', () => {
    // 1234 is $12.34, not $1,234. Getting this backwards misprices by 100x, and it reads
    // plausibly either way on screen.
    expect(money(1234, 'en')).toBe('$12.34');
  });

  it('renders zero rather than an empty string', () => {
    expect(money(0, 'en')).toBe('$0.00');
  });

  it('keeps negative amounts signed — a credit is not a debit', () => {
    expect(money(-5000, 'en')).toContain('50.00');
    expect(money(-5000, 'en')).toMatch(/-|\(/);
  });

  it('formats in USD whatever the locale, because USD is the corridor currency', () => {
    // The SYMBOL and separators follow the locale; the currency itself must not change.
    for (const locale of ['en', 'fr', 'zh', 'rw'] as const) {
      expect(money(123_456, locale)).toMatch(/\$|US\$|USD/);
    }
  });
});

describe('maskedMoney — the one that matters', () => {
  it('passes the mask through instead of formatting it', () => {
    // If this ever returns something like "$0.00", the UI is fabricating a number the
    // server refused to send.
    expect(maskedMoney(MASK, 'en')).toBe(MASK);
  });

  it('never renders a currency symbol for a masked value', () => {
    for (const locale of ['en', 'fr', 'zh', 'rw'] as const) {
      expect(maskedMoney(MASK, locale)).not.toMatch(/\d/);
    }
  });

  it('still formats a real amount normally', () => {
    expect(maskedMoney(1234, 'en')).toBe('$12.34');
  });

  it('does not mistake a legitimate zero for a masked value', () => {
    // A real zero and a withheld value are different facts and must look different.
    expect(maskedMoney(0, 'en')).toBe('$0.00');
    expect(maskedMoney(0, 'en')).not.toBe(MASK);
  });
});

describe('percent', () => {
  it('takes a FRACTION, not an already-multiplied number', () => {
    // 0.15 is 15%. Passing 15 would render 1,500% — a mistake that has to be caught here
    // because it renders happily.
    expect(percent(0.15, 'en')).toBe('15%');
  });

  it('rounds to one decimal place', () => {
    expect(percent(0.12345, 'en')).toBe('12.3%');
  });
});

describe('maskedPercent', () => {
  it('passes the mask through', () => {
    expect(maskedPercent(MASK, 'en')).toBe(MASK);
  });

  it('distinguishes "not applicable" from "withheld"', () => {
    // null means there is no margin to show; *** means there is one and you may not see
    // it. Rendering both the same way would hide a real permission boundary from the user.
    expect(maskedPercent(null, 'en')).toBe('—');
    expect(maskedPercent(null, 'en')).not.toBe(MASK);
  });

  it('formats a real fraction normally', () => {
    expect(maskedPercent(0.2, 'en')).toBe('20%');
  });
});
