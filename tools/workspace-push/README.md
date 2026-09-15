# Pushing workspace tasks into Nexus

The workspace is where work happens. Nexus is the layer above it, and it answers what a task
board structurally cannot: whether the week's commitments actually completed, who is silent,
which problem keeps coming back, and who is carrying too much.

This script is the bridge. **Nothing is ever written back to the workspace.**

---

## Start here — working today, no engineering

You do not need an API to prove this. Export whatever the workspace can export, and run:

```bash
node push.mjs                    # dry run: reads, maps, shows the payload. Sends nothing
```

```bash
NEXUS_URL=http://localhost:3000 \
NEXUS_EMAIL=yves@uzasolutions.rw \
NEXUS_PASSWORD=… \
SOURCE=file SOURCE_PATH=./tasks.json \
node push.mjs --commit
```

Node 18 or newer. **No dependencies to install** — the file uses built-in `fetch` only, so it
can be copied onto whatever machine the workspace runs on and executed as-is.

---

## Field names

You almost certainly do not have to touch these. The mapping already accepts the common
spellings, and it was tested against a messy export using `id`, `name`, `state`, `assignee`,
`project_name`, `due_date`, `completed_at` and `completion_note` — all picked up without a
single edit.

If a field is missed, add its name to the front of the relevant list in `MAPPING` at the top of
`push.mjs`. Nothing else changes.

Statuses are normalised into the three Nexus knows:

| Workspace says | Nexus stores |
|---|---|
| done · complete · completed · closed · finished · resolved | `done` |
| in progress · doing · started · active · wip · review | `in_progress` |
| anything else, including backlog and new | `todo` |

A task marked done with no completion date is stamped with the time of the push — otherwise it
never falls inside any week and silently counts for nothing.

---

## The three ways to read

| `SOURCE` | Needs | Use when |
|---|---|---|
| **`file`** | a JSON array, or one JSON object per line | **Start here.** Works with a manual export, today |
| `rest` | `SOURCE_URL`, optionally `SOURCE_TOKEN` | The workspace has an API |
| `custom` | five lines in `fromCustom()` | Reading a database directly. A worked Postgres example is in the comment |

Keep any query read-only.

---

## Running it nightly

Once it works by hand, schedule it. A missed night is harmless — the push is **idempotent on
the task's own id**, so re-sending the same task updates it rather than duplicating. Verified:
running twice leaves five rows, not ten.

```
0 2 * * *  cd /path/to/workspace-push && node push.mjs --commit >> push.log 2>&1
```

Exit codes, so a scheduler can tell the difference:

| Code | Meaning |
|---|---|
| `0` | everything pushed and every assignee matched |
| `1` | it failed — could not read the source, could not log in, the API refused |
| `2` | **it pushed, but somebody's email matches no Nexus user** |

---

## Exit code 2 is the one that matters

An unmatched assignee is not cosmetic. **That person's work is invisible to Nexus**, so their
scorecard shows nothing and the digest counts them as silent when they are not.

Usually the email differs between the two systems, or they have no Nexus account yet. Fix it at
the source rather than mapping around it — a hand-maintained translation table between two
systems is wrong within a month and nobody notices.

`GET /umurimo/workspace/health` reports the running count at any time, along with whether the
bridge has gone quiet:

```json
{ "total": 5, "hoursSinceLastSync": 0, "stale": false,
  "unmappedAssignees": 1, "byStatus": { "done": 2, "in_progress": 2, "todo": 1 } }
```

**`stale: true` means nothing has arrived in over a day.** That looks exactly like a quiet week
and is not one — check it before believing anything the scorecard says.

---

## The account it runs as

`workspace:sync` is held by `ceo` and `venture_manager` only. Pushing a batch rewrites what the
register believes about everyone's work, which is not a participation right.

That means the script currently runs as a real person's account, and the credential sits in the
environment of whatever machine runs it. **That is a compromise, not a design.** A dedicated
integration role would be better, but roles live in `@uza/contracts` and Umurimo does not modify
the shared contract. Worth revisiting once the bridge has proved itself.

Until then: put the credential in the scheduler's environment, never in a file in this
repository, and use an account whose password you are willing to rotate.
