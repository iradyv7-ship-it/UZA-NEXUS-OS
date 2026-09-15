# Handoff — Nexas Command Center (v1)

The first slice of the **Nexas executive layer** (`docs/nexas-executive-layer.md`): the
*structured* management brain. Cross-department **tasks**, the **grants** pipeline, a light
**org/department** graph, and the CEO **overview** ("what needs my attention"). Built as a new
module `apps/api/src/command/` on the existing app; the conversational/proactive AI PA layer
sits on top of this later.

Branch merged: `nexas-command-center` (commits `1e1c690` code+wiring, then tests+seed). Wired
into `AppModule`. **192 tests pass** (185 prior + 7 new `test/command.test.ts`).

## Routes (`/command/*`, behind the global JWT guard)
| Method | Path | Access (module-local policy) |
|---|---|---|
| POST/GET/GET/PATCH | `/command/tasks`, `/tasks/:ref` | create/read/write; ceo/vm see ALL, managers their dept, ICs their own |
| POST | `/command/tasks/:ref/complete` \| `/cancel`, DELETE `/tasks/:ref` | task:write (scoped) |
| POST/GET/GET/PATCH | `/command/grants`, `/grants/:ref` | ceo/vm all; owner sees own |
| POST | `/command/grants/:ref/advance` `{to}` | pipeline transition (no skipping/backwards) |
| POST/GET/GET | `/command/departments`, `/departments/:ref` | org:read all internal; org:write ceo/vm |
| POST | `/command/employee-profiles` | org:write (ceo/vm) — link user→department/manager |
| GET | `/command/overview?horizonDays=` | ceo/vm — my tasks, overdue/blocked, upcoming deadlines, grant pipeline |

## Authorization
Module-local policy `command-access.ts` (`COMMAND_ACCESS`: role → capability) — kept OUT of
`@uza/contracts` ROLE_GRANTS (that's UZA Nexus's kernel). Enforced at the service layer via
`CommandAccessService` (audits every denial into the SAME platform audit log before throwing).
Object-scope (a manager's department, a grant owner) lives in `command-scope.ts` + the services,
mirroring how trade separates role grants from object scope. `ceo`/`venture_manager` → full;
other internal roles → own/assigned tasks + owned grants; `customer`/`sales_agent`/
`logistics_partner` → 403 on everything.

## Models (migration `command_center_init`)
`Department`, `EmployeeProfile` (user→dept/manager), `CommandTask` (assignee, priority, status
todo/in_progress/blocked/done/cancelled, dueAt, linkedRef to any UZA Nexus record, subtasks),
`Grant` (funder, amountMinor, currency, deadlineAt, status identified→…→closed, requirements JSON).
Money is `Minor` integer minor units. `Task` name is trade's — this module's is `CommandTask`.

## Seed
`seed-web.ts` seeds 2 departments, 3 tasks (one due-soon, one **overdue**, one **blocked**) and
2 grants (one **near deadline**) so the overview shows real data. Idempotent.

## Real vs next
**Real:** the full structured CRUD + scoping + overview, tested + live-verified.
**Next (the actual "PA"):** a web UI (command dashboard), then the conversational/proactive AI
layer over this data ("Nexa, what's overdue? assign this, chase that"). And per the roadmap,
the Google Calendar integration for the calendar half. Employee "monitoring" here is *management
visibility* (assignment/workload/overdue), deliberately not surveillance.
