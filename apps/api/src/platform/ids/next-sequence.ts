/**
 * The next number in a readable-ref sequence, derived from the highest ref that exists.
 *
 * `(await tx.thing.count()) + 1` was the original scheme across this codebase and it is
 * wrong. It only holds while no row is ever deleted and every row is created in order.
 * The first time either fails, the next insert collides on the `ref` primary key and the
 * request 500s.
 *
 * That is not hypothetical. On 24 August 2026 the register held 32 decisions while the
 * highest ref was `DEC-2026-0033`, so `count() + 1` produced `DEC-2026-0033` — already
 * taken — and every attempt to raise a decision failed until someone worked out why.
 *
 * The fix was written then, and applied to exactly one module. This is the same logic,
 * generalised so the other twenty-six call sites can use it.
 *
 * ## How the prefix is found
 *
 * Ref formats differ across the estate — `INV-MOB-2026-0001`, `SUP-RW-0001`,
 * `DLV-KGL-2026-0001`, `SQ-0001` — but every one of them **ends in a zero-padded
 * sequence**. So rather than being told the prefix, this asks the caller's own ref
 * builder for `buildRef(1)` and takes everything before the trailing digits. The
 * sequence and the prefix can then never disagree, because both come from one function.
 *
 * Sorting on `ref` descending is safe precisely because the sequence is zero-padded to a
 * fixed width: lexical order and numeric order agree. Refs that embed a year are scoped
 * by it in the prefix, so January starts again at 1 without colliding with December.
 *
 * ## What this does and does not fix
 *
 * It makes SEQUENTIAL writers safe, which is the failure that actually occurred.
 *
 * It does **not** make concurrent writers safe: two inserts racing still read the same
 * highest ref and compute the same number. The `ref` primary key remains the backstop —
 * one of them fails loudly rather than overwriting the other. Under the single-writer
 * model this service runs today that race does not arise; if that changes, the answer is
 * a database sequence, not a cleverer read.
 */

/** The shape any Prisma delegate satisfies, including one inside a transaction. */
export interface RefQueryable {
  findFirst(args: {
    where: { ref: { startsWith: string } };
    orderBy: { ref: 'desc' };
    select: { ref: true };
  }): Promise<{ ref: string } | null>;
}

/**
 * The second argument is either the caller's ref builder, or the literal prefix.
 *
 * The builder form is preferred: it derives the prefix from the same function that
 * writes the ref, so the two cannot drift apart. The prefix form exists because fifteen
 * call sites in `planning` and `umurimo` already pass `refPrefix('DEC')`, and rewriting
 * them to gain nothing would be change for its own sake.
 */
export async function nextSequence(
  model: RefQueryable,
  refBuilderOrPrefix: ((seq: number) => string) | string,
): Promise<number> {
  if (typeof refBuilderOrPrefix === 'string') {
    return nextAfterPrefix(model, refBuilderOrPrefix);
  }

  const sample = refBuilderOrPrefix(1);
  const split = /^(.*?)(\d+)$/.exec(sample);

  // A ref that does not end in digits cannot be sequenced by reading it back. Callers
  // in that position need their own scheme; failing loudly here beats returning 1
  // forever and colliding on the second row.
  if (!split) {
    throw new Error(
      `nextSequence: "${sample}" does not end in a sequence number, so the next value ` +
        `cannot be derived from existing refs.`,
    );
  }

  // `noUncheckedIndexedAccess` is on, so a capture group is `string | undefined` even
  // though this one matched. Narrow rather than assert.
  const prefix = split[1];
  if (prefix === undefined) return 1;

  const newest = await model.findFirst({
    where: { ref: { startsWith: prefix } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  if (!newest) return 1;

  const tail = /(\d+)$/.exec(newest.ref);
  if (!tail) return 1;

  const digits = tail[1];
  if (digits === undefined) return 1;

  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? 1 : parsed + 1;
}

/** Shared tail: given a prefix, read back the highest ref and add one. */
async function nextAfterPrefix(model: RefQueryable, prefix: string): Promise<number> {
  const newest = await model.findFirst({
    where: { ref: { startsWith: prefix } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  if (!newest) return 1;

  const tail = /(\d+)$/.exec(newest.ref);
  const digits = tail?.[1];
  if (digits === undefined) return 1;

  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? 1 : parsed + 1;
}
