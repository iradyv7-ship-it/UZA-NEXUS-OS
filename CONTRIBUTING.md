# Contributing

For anyone with write access to a UZA repository. Read once; it takes five minutes and
saves an argument later.

---

## The loop

```bash
git switch -c your-name/what-it-does     # never commit to master directly
# ... work ...
pnpm verify                              # typecheck + every test. Same command CI runs
git push -u origin your-name/what-it-does
# open a pull request
```

**`pnpm verify` before every push.** If it fails locally it will fail in CI, and finding out
in ninety seconds beats finding out in a pipeline ten minutes later.

---

## Branches and pull requests

**Branch naming:** `your-name/short-description` — `gad/split-listings-service`. Your name
first so `git branch -a` tells everyone who is working on what.

**One pull request, one concern.** A PR that fixes a bug *and* renames a folder *and* adds a
feature cannot be reviewed properly, and cannot be reverted cleanly when one third of it turns
out to be wrong.

**Every PR needs a green CI tick and one review.** Not ceremony — a second pair of eyes is the
cheapest defect-finding tool there is, and the reviewer learns the system.

**Say what and why in the description.** The diff already shows what changed. What it cannot
show is what you tried that did not work, and what you decided not to do.

---

## What we will ask you to change in review

Only these, and each exists because of something that actually went wrong here.

**Authorise in the service, not the controller.** A controller is one way in; events, seeds
and other services are others. Only the service sees them all.

**Refs come from the highest existing ref, never `count() + 1`.** Use `nextSequence()` in
`planning-ids.ts`. Counting breaks the moment a row is deleted — 32 decisions once existed
while the highest ref was `DEC-2026-0033`, and every insert returned a 500 until somebody
found it. **29 sites still use the old pattern; fixing one is a good first PR.**

**A feature module never imports another feature module.** `finance` does not import
`logistics`. They communicate by publishing events. The only place allowed to know every
module at once is `integration/dispatch-map.ts`.

**Write the audit row before you throw.** On a refusal, write it first and without a
transaction handle, so the denial survives the exception.

**Cover the change with a test.** Not every line — the *behaviour*. Prefer pure functions with
no database: `apps/web/src/lib/format.test.ts` and
`src/modules/listings/listing-pricing.util.spec.ts` (Mobility) are the reference shapes.

**Keep comments short.** What a line does, or a trap in one or two lines. Reasoning goes in
`docs/` with a link. This codebase currently runs about twice the comment density of a
hand-written one and is being corrected, not defended.

---

## Files to read before you touch them

Three files encode rules with **legal** consequences, not stylistic ones. Each has tests
naming specific counterparties.

| | Why |
|---|---|
| `intake/intake-lanes.ts` | Counterparty walls. The vehicle supplier and the lender must not appear in each other's view |
| `platform/lender-view/lender-view-access.ts` | Lender disclosure, consent, and the cash-collateral wall — a list of one, widened only by the founder |
| `platform/uza-id/uza-id.hash.ts` | Why national IDs and phone numbers are peppered hashes and never plaintext |

If a test in one of these fails, **do not adjust the test.** Come and ask.

---

## Secrets

**Never commit a `.env`.** Every repo has a `.env.example` — copy it. Two repos had a tracked
`.env` until 29 August 2026; it held only publishable keys, but a tracked `.env` is how a
service-role key eventually gets committed by somebody who did not notice.

**Two kinds of key, and the difference matters more than anything else here:**

| | |
|---|---|
| **Publishable / anon** | Public by design. It ships to every browser anyway. Safe in a client bundle or a build arg |
| **Service role, `JWT_SECRET`, `UZA_ID_PEPPER`, `MFA_ENCRYPTION_KEY`** | **Run time only.** Never a build arg — build args are recorded in image history and travel with the image into any registry |

**If you commit a secret by accident: say so immediately and rotate it.** Deleting the commit
does not help — the value is already in every clone and in the reflog. Rotating is the only
fix, and it is quick when you say so quickly.

The documents repository has `tools/check-before-push.py`, which catches phone numbers,
national IDs and literal credentials. **Read its exit code** — piping it into `tail` hides the
failure, which is how six findings once went out.

---

## Personal data

Candidate names, national IDs, phone numbers and loan files are **never** committed to any
repository. Seeds read them from a path supplied at run time.

Nexus itself holds no national ID or phone number in clear — only peppered hashes, for
matching. Keep it that way: it is the strongest control available, and under Law N° 058/2021
the obligation follows the data.

---

## Working alongside other people

Two of us edited the same files at the same time on 28 August and produced a red build twice.
Cheap to avoid:

- **Say what you are picking up** before you start, in whatever channel the team uses.
- **Small branches, merged often.** A branch open for two weeks is a merge conflict with a
  countdown on it.
- **If you find someone else's work in progress in your tree, do not "clean it up".** Ask.

---

## When something is wrong

**Change it.** Nothing here is sacred. Much of this code was written with AI assistance and
some of it is wrong — a stale README, a comment three times longer than it needs to be, a test
asserting `"Hello World!"` against an endpoint that never returned it.

The tests exist so you can change things confidently. **If you find something wrong and leave
it because you assume it was deliberate, that is the worst outcome.**

Two things to raise rather than fix silently: anything in the three files above, and anything
that changes what a lender, a donor or a regulator would be told.
