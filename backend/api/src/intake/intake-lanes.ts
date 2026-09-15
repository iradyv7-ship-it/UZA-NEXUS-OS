/**
 * Compartmentalisation — the rules that decide what an ingested signal is allowed to
 * become visible as.
 *
 * This file exists because intake is the one place in UZA Nexus where text UZA did not
 * author flows into a shared surface. A mailbox sweep that dumps everything into a common
 * register would, on its first run, put the supply counterparty in front of the lender and
 * the lender in front of the supply counterparty, and would publish forty-one drivers'
 * phone numbers into a view that was never meant to hold them.
 *
 * Two mechanisms, deliberately separate:
 *
 *  1. **Walls** decide the LANE. A signal that mentions a walled counterparty is filed
 *     private — visible to the CEO only. This is coarse on purpose. It is a filter for
 *     things that must not travel, not a permission model, and being coarse is what makes
 *     it hold when someone writes the name in a way nobody anticipated.
 *
 *  2. **Redaction** decides what the SUMMARY may contain. Phone numbers, national IDs and
 *     account numbers are stripped before the summary is written, because the summary is
 *     the field that appears in shared views and in the advisor's context.
 *
 * Both run on capture, before anything is stored as shared and before any text is sent to
 * the model. A signal is never re-classified downward automatically: private stays private
 * until a person with executive authority moves it.
 */

/**
 * Counterparties that must not appear in each other's field of view, and parties whose
 * dealings are not group-shared at all.
 *
 * Each entry is a wall. Any signal matching any term in any wall is filed `private`.
 * The founder's standing instructions this encodes:
 *   - the vehicle supplier does not know about the lender, and the lender does not know
 *     about the vehicle supplier;
 *   - China operations staff are not party to the supply commercials.
 *
 * Terms are matched case-insensitively on word boundaries. Keep them short and keep the
 * obvious misspellings — a wall that only catches the correct spelling is not a wall.
 */
export const WALLS: Readonly<Record<string, readonly string[]>> = {
  'supply-counterparty': ['mento'],
  lender: ['unguka', 'ungaka', 'lolc'],
  /** Personal, founder-held, and not a group matter until there is an agreement. */
  'founder-held': ['apsara'],
};

/**
 * Terms that mark a signal private on their own, independent of any wall — money
 * instructions and personal records. Bank-detail changes in particular are the single
 * highest-risk thing that can arrive by email, and they should never reach a shared queue
 * where they can be actioned by whoever reads it first.
 */
export const RESTRICTED: readonly string[] = [
  'bank details',
  'account number',
  'change of account',
  'payroll',
  'salary',
  'national id',
  'passport',
];

/** Phone numbers (Rwandan and international), long digit runs, and national ID numbers. */
const REDACTIONS: readonly { readonly re: RegExp; readonly with: string }[] = [
  // Rwandan mobile: 078/079/072/073 with optional +250 and separators.
  { re: /(?:\+?250[\s-]?)?0?7[2389]\d[\s-]?\d{3}[\s-]?\d{3}\b/g, with: '[phone]' },
  // Rwandan national ID is 16 digits, usually written in groups.
  { re: /\b\d{4}[\s-]?\d{1}[\s-]?\d{7}[\s-]?\d{2}[\s-]?\d{2}\b/g, with: '[national-id]' },
  // Any other run of 9+ digits — account numbers, IBANs written bare.
  { re: /\b\d{9,}\b/g, with: '[number]' },
  { re: /\b[A-Z]{2}\d{2}[\s]?[A-Z0-9]{4}(?:[\s]?[A-Z0-9]{4}){2,}\b/g, with: '[iban]' },
];

const wordBoundary = (term: string): RegExp =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

export interface Classification {
  readonly lane: 'shared' | 'private';
  /** Which walls or restricted terms fired. Recorded even when the lane ends up shared. */
  readonly wallTags: readonly string[];
}

/**
 * Decide the lane for a captured signal. Title and body are both examined — a subject line
 * that says nothing and a body that names the counterparty is the normal case.
 */
export function classify(title: string, body: string): Classification {
  const text = `${title}\n${body}`;
  const tags: string[] = [];

  for (const [wall, terms] of Object.entries(WALLS)) {
    if (terms.some((t) => wordBoundary(t).test(text))) tags.push(wall);
  }
  for (const term of RESTRICTED) {
    if (wordBoundary(term).test(text)) tags.push(`restricted:${term}`);
  }

  return { lane: tags.length ? 'private' : 'shared', wallTags: tags };
}

/**
 * Strip personal and account identifiers. Applied to anything that will be stored as a
 * summary or sent to the model — the point is not that the model cannot be trusted with
 * it, but that the summary is a shared field and this is the last place before it becomes
 * one.
 */
export function redact(text: string): string {
  return REDACTIONS.reduce((acc, r) => acc.replace(r.re, r.with), text);
}

/**
 * True when a signal in one wall would be exposed alongside another wall's material.
 * Used when assembling a batch for triage: two walled signals are never summarised in the
 * same model call, because a single call is a single context and that is exactly the
 * adjacency the walls exist to prevent.
 */
export function wallsCollide(a: readonly string[], b: readonly string[]): boolean {
  const wallsOf = (tags: readonly string[]) => tags.filter((t) => !t.startsWith('restricted:'));
  const wa = wallsOf(a);
  const wb = wallsOf(b);
  if (!wa.length || !wb.length) return false;
  return wa.some((x) => !wb.includes(x)) || wb.some((x) => !wa.includes(x));
}
