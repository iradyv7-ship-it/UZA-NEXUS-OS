# Building a portal

**How to add the client, bank, garage and training portals — and any portal after them.**

---

## The idea in one paragraph

UZA needs four portals, and they look like four different problems until you write the
second one. Every one is the same sentence:

> **An outside party, authenticated, sees a scoped subset of records about people, and every
> look is recorded.**

What differs between them is only **why the party is entitled**. That is the whole variation.
So the policy lives in one place — `src/platform/portal/portal-access.ts`, about a hundred
lines you can read in five minutes — and each portal supplies its own entitlement lookup.

This is **not** a generic permission framework. It does one job. If you need something it does
not do, add it deliberately rather than making it configurable.

---

## The four portals, in the same shape

| Portal | Party | Subject | Entitled because | Consent? |
|---|---|---|---|---|
| **Client** | the person | themselves | they *are* the subject | **No** — `selfService` |
| **Bank** | a lender | a borrower | a loan exists | **Yes**, per lender |
| **Garage** | a mechanic or partner garage | a vehicle + its owner | a job card is assigned to them | **Yes**, for owner data |
| **Training** | a trainer | a candidate | the candidate is in their cohort | **Yes** |
| | a candidate | themselves | they *are* the subject | **No** — `selfService` |

**The bank portal already exists** as `platform/lender-view/` and is the worked reference —
27 passing tests. Read it before building the second one.

---

## The four rules, and why each exists

Every one is there because of a specific failure. None is ceremony.

**1 · Entitlement.** The party has a real link to this subject. Without it a portal is an
enumeration tool: try IDs until one answers.

**2 · Consent, unless the party is the subject.** Under Law N° 058/2021 consent is *specific* —
agreeing that Unguka may see a file is not agreeing that Equity may. A person needs no consent
to see their own record, which is what `selfService` is for. **Requiring consent-to-self would
lock people out of their own file.**

**3 · One refusal.** Every denial returns `PORTAL_REFUSAL`, whichever rule failed. If "not your
borrower" were distinguishable from "no such person", the portal would answer *"is this
national ID a UZA client?"* — **a disclosure even when the answer is no.** The real reason goes
to the audit log.

**4 · Audit both ways.** Allowed reads *and* refusals. The refusals are often the interesting
ones: a party repeatedly asking about subjects that are not theirs is worth a human noticing.

---

## Building one — the client portal, end to end

### 1 · Entitlement: what links this party to this subject?

For the client portal it is identity itself — the signed-in person *is* the subject. No new
table. For the garage portal it would be a job card; for training, cohort membership.

**Ask this question first.** It is the only part that genuinely differs, and getting it wrong
is how a portal leaks.

### 2 · Define what they see

A plain interface. Optional sections for anything a live system does not feed yet:

```ts
export interface ClientFile {
  uzaId: string;
  displayName: string;
  training?: { programme: string; completedAt: string | null };
  wallet?: { allocations: Record<string, number>; reserveStatus: string };
  vehicle?: { vin: string; handedOverAt: string | null };
}
```

> **Absent is not zero.** If the wallet is not wired up yet, omit the section and name it in
> `notYetInstrumented`. An empty section reads as *"this person has no wallet"* — a claim
> somebody will act on. An absent one reads as *"we are not measuring this yet"*, which is
> true. `lender-view.service.ts` does exactly this.

### 3 · The service

```ts
import {
  decideAccess, portalAudit, redact, PORTAL_REFUSAL,
} from '../portal/portal-access';

@Injectable()
export class ClientPortalService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async view(actorUzaId: string, subjectRef: string): Promise<ClientFile> {
    const party = { kind: 'client', id: actorUzaId };
    const person = await this.prisma.person.findUnique({ where: { ref: subjectRef } });

    const decision = decideAccess({
      subjectExists: Boolean(person),
      entitled: actorUzaId === subjectRef,   // ← the entitlement rule for THIS portal
      selfService: true,
    });

    if (!decision.allowed) {
      await this.audit.record(
        portalAudit({ party, portal: 'client', subjectRef,
                      decision: 'deny', reason: decision.reason }),
      );
      throw new ForbiddenException(PORTAL_REFUSAL);   // same message, always
    }

    const file = await this.compose(person!);
    await this.audit.record(
      portalAudit({ party, portal: 'client', subjectRef, decision: 'allow' }),
    );
    return file;
  }
}
```

**That is the entire pattern.** Swap the one `entitled:` line and you have a different portal.

### 4 · Redaction, where a party may not see everything

```ts
return redact(file, maySeeCollateral(lender) ? [] : ['creditEnhancement']);
```

`redact` deletes from a copy rather than building one up. Building up silently drops any field
added to the type later — safe for disclosure, but the portal quietly loses data and nobody
notices for months. Deleting fails the other way, so **each sensitive field is removed
explicitly and named in a test.**

### 5 · Test it

Copy `test/portal-access.test.ts` and `test/lender-view.test.ts`. Every portal must assert:

- an entitled party gets the record
- **an unentitled party and an unknown subject produce byte-identical refusals**
- withdrawn consent refuses
- both an allow and a deny land in the audit log
- anything redacted is gone, and everything else survives

That fifth one is best written as the reference portal does it: make the data source return
the sensitive field **for every party**, so only redaction stands between it and a disclosure.

---

## The rules a portal must never break

| | |
|---|---|
| **One refusal message** | Never a "more helpful" error. It leaks which rule failed |
| **Never list** | No endpoint returns "all my borrowers" or "all clients". One subject per request |
| **Never leak another party** | A lender must not learn another lender exists |
| **Audit before you throw** | Write the deny row *first*, without a transaction handle, so it survives the exception |
| **No employee Role for an outside party** | `AuditLog.actorRole` is a free string. Do **not** add `lender` or `garage` to the `Role` union — that drives `ROLE_GRANTS` for employees |
| **Cash collateral: Unguka only** | `COLLATERAL_ENTITLED` in `lender-view-access.ts` is a list of one. Widening it is a founder decision |

---

## Where each portal's data comes from

Nexus **computes and stores nothing of its own** here. Each portal composes from the operating
systems through an interface, so the systems can be wired in one at a time:

```ts
export interface ClientDataSource {
  training(uzaId: string): Promise<ClientFile['training'] | undefined>;
  wallet(uzaId: string): Promise<ClientFile['wallet'] | undefined>;
}
export const NOT_YET_INSTRUMENTED: ClientDataSource = {
  training: async () => undefined,
  wallet: async () => undefined,
};
```

Bind `NOT_YET_INSTRUMENTED` in the module today; replace that one binding when the Mobility
platform or the wallet adopts the UZA ID. **Nothing else changes.** `lender-view.module.ts`
shows the shape.

---

## Suggested order

| | Portal | Why here |
|---|---|---|
| **1** | **Client** | Simplest entitlement (`self`), and it proves the pattern generalises beyond the bank |
| **2** | **Training** | Trainer + candidate — the first portal with *two* party kinds, which is where a weak abstraction breaks |
| **3** | **Garage** | Entitlement is a job card, so it needs the job-card model first |
| **4** | **Bank** | **Already built.** Needs a front end and a real `LenderDataSource`, not new access logic |

**Every portal needs the UZA ID.** Without it there is no subject to scope to. That adoption —
one column and one call per system — is the prerequisite for all four.

---

## Checklist for a new portal

- [ ] Entitlement question answered, and written down in the service
- [ ] `ClientFile`-style interface, optional sections for what is not instrumented
- [ ] `decideAccess` called; the `entitled:` line is the only bespoke part
- [ ] `PORTAL_REFUSAL` on every failure, no exceptions
- [ ] Deny audited **before** the throw
- [ ] Redaction list explicit, and each dropped field named in a test
- [ ] A `DataSource` interface with a `NOT_YET_INSTRUMENTED` binding
- [ ] Tests: allow · identical refusals · withdrawn consent · both audit rows · redaction
- [ ] No new entry in the `Role` union
