/**
 * Readable-id helpers for Umurimo.
 *
 * Same discipline as `planning-ids.ts` and `command-ids.ts`: these kinds are NOT in
 * `@uza/contracts` `ID_PATTERNS` — that kernel models the UZA Bulk record chain, and this
 * module must not modify the shared contract. Patterns are defined here, module-local, in the
 * shape the platform formatter uses (zero-padded sequence, 4-digit year).
 *
 * Sequencing mirrors trade-ids, command-ids and planning-ids: `count()+1` taken inside the
 * same call as the insert. Under the single-writer model this is collision-free; the `ref`
 * primary key is the hard backstop if two writers ever race.
 */
const pad = (seq: number, width: number): string => String(seq).padStart(width, '0');

export const currentYear = (): string => String(new Date().getFullYear());

/** BLK-{year}-{seq:4} — one thing standing in someone's way. */
export const blockerRef = (seq: number): string => `BLK-${currentYear()}-${pad(seq, 4)}`;

/**
 * CMT-{year}-{seq:6} — a comment on a record.
 *
 * Six digits rather than four: comments are the highest-volume row in this module by an order
 * of magnitude, and a sequence that wraps inside a year is a support incident nobody enjoys.
 */
export const commentRef = (seq: number): string => `CMT-${currentYear()}-${pad(seq, 6)}`;

/**
 * `@ref` mentions in a comment body.
 *
 * Deliberately conservative: it matches the readable-ref shape the platform issues for users
 * and nothing else, so an email address, a price or a hashtag in the body is never mistaken
 * for a mention. Returns unique refs in the order they appear.
 *
 * A mention drives notification only. It NEVER widens what somebody may read — mentioning a
 * person on a record they cannot see notifies them of nothing they can open, which is the
 * correct and safe failure.
 */
const MENTION = /@([A-Z]{2,4}(?:-[A-Z0-9]{2,6}){1,3})\b/g;

export function extractMentions(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION)) {
    const ref = match[1];
    if (ref) found.add(ref);
  }
  return [...found];
}
