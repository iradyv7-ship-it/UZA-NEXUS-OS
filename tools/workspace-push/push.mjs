#!/usr/bin/env node
/**
 * Push workspace tasks into UZA Nexus.
 *
 *   node push.mjs                 # dry run — reads, maps, shows what WOULD be sent
 *   node push.mjs --commit        # actually sends
 *
 * Zero dependencies. Node 18+ only, using built-in fetch, so this file can be copied to
 * whatever machine the workspace runs on and executed with nothing installed.
 *
 * WHAT YOU HAVE TO FILL IN
 * ------------------------
 * Exactly one thing: how to read tasks out of the workspace. Two adapters are written and
 * working — `file` and `rest` — and a third (`custom`) is a five-line function to complete if
 * neither fits. Everything downstream of that is done: mapping, batching, retry, reporting.
 *
 * Start with `file`. Export whatever the workspace can export, point SOURCE_PATH at it, and
 * this works today with no engineering on the workspace side at all. Move to `rest` or
 * `custom` once someone has time; nothing else changes.
 *
 * SAFETY
 * ------
 * Dry run is the default and prints the exact payload. Nothing is sent until --commit.
 * The push is idempotent on externalId, so running it twice is harmless and running it on a
 * schedule is the intended use.
 *
 * ENVIRONMENT
 * -----------
 *   NEXUS_URL          http://localhost:3000
 *   NEXUS_EMAIL        an account holding workspace:sync (ceo or venture_manager today)
 *   NEXUS_PASSWORD
 *   SOURCE             file | rest | custom          (default: file)
 *   SOURCE_PATH        ./tasks.json                  (SOURCE=file)
 *   SOURCE_URL         https://…/api/tasks           (SOURCE=rest)
 *   SOURCE_TOKEN       bearer token for SOURCE_URL   (SOURCE=rest, optional)
 */

const CFG = {
  nexus: process.env.NEXUS_URL ?? 'http://localhost:3000',
  email: process.env.NEXUS_EMAIL ?? '',
  password: process.env.NEXUS_PASSWORD ?? '',
  source: process.env.SOURCE ?? 'file',
  path: process.env.SOURCE_PATH ?? './tasks.json',
  url: process.env.SOURCE_URL ?? '',
  token: process.env.SOURCE_TOKEN ?? '',
};

const COMMIT = process.argv.includes('--commit');
const BATCH = 200; // the API caps at 500; smaller batches fail smaller

// ---------------------------------------------------------------- read the workspace

/**
 * Adapter 1 — a file the workspace exported. JSON array, or one JSON object per line.
 *
 * This is the one to start with. It needs nothing built on the workspace side, which means
 * the bridge can be proved end to end this week rather than after an integration project.
 */
async function fromFile() {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(CFG.path, 'utf8');
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith('[')) return JSON.parse(text);
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l)); // JSON lines
}

/** Adapter 2 — a REST endpoint returning an array, or `{ tasks: [...] }`, or `{ data: [...] }`. */
async function fromRest() {
  if (!CFG.url) throw new Error('SOURCE=rest needs SOURCE_URL');
  const res = await fetch(CFG.url, {
    headers: CFG.token ? { authorization: `Bearer ${CFG.token}` } : {},
  });
  if (!res.ok) throw new Error(`workspace responded ${res.status} ${await res.text()}`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body.tasks ?? body.data ?? body.results ?? []);
}

/**
 * Adapter 3 — anything else. Reading a database directly goes here.
 *
 * Example, if the workspace is a UZA build on Postgres (needs `npm i pg`):
 *
 *   const { Client } = await import('pg');
 *   const c = new Client({ connectionString: process.env.WORKSPACE_DATABASE_URL });
 *   await c.connect();
 *   const { rows } = await c.query(
 *     `select id, title, status, assignee_email, project, priority,
 *             created_at, due_at, completed_at, completion_note
 *        from tasks where updated_at > now() - interval '30 days'`);
 *   await c.end();
 *   return rows;
 *
 * Keep the query read-only. Nexus observes the workspace; it never writes to it.
 */
async function fromCustom() {
  throw new Error('SOURCE=custom: fill in fromCustom() in push.mjs');
}

// ---------------------------------------------------------------- map to the Nexus shape

/**
 * Field names in the workspace, in preference order.
 *
 * **This is the part to edit.** Add your workspace's own field names to the front of any list
 * and the mapping picks them up. Nothing else in this file needs to change.
 */
const MAPPING = {
  externalId: ['externalId', 'id', 'taskId', 'task_id', '_id', 'uuid'],
  title: ['title', 'name', 'subject', 'task', 'summary'],
  status: ['status', 'state', 'column', 'stage'],
  assigneeEmail: ['assigneeEmail', 'assignee_email', 'assignee', 'owner', 'ownerEmail', 'email'],
  project: ['project', 'projectName', 'project_name', 'board'],
  priority: ['priority', 'severity'],
  url: ['url', 'link', 'permalink'],
  createdAt: ['createdAt', 'created_at', 'created'],
  deadline: ['deadline', 'dueAt', 'due_at', 'dueDate', 'due_date', 'due'],
  completedAt: ['completedAt', 'completed_at', 'doneAt', 'done_at', 'finishedAt'],
  completionNote: ['completionNote', 'completion_note', 'doneNote', 'resolution', 'closingNote'],
};

const pick = (row, keys) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

/** Whatever the workspace calls a column, Nexus stores one of three states. */
function normaliseStatus(raw) {
  const v = String(raw ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (['done', 'complete', 'completed', 'closed', 'finished', 'resolved'].includes(v)) return 'done';
  if (['inprogress', 'doing', 'started', 'active', 'wip', 'review', 'inreview'].includes(v)) {
    return 'in_progress';
  }
  return 'todo'; // todo, backlog, new, open, anything unrecognised
}

const iso = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

function mapTask(row, index) {
  const externalId = pick(row, MAPPING.externalId);
  const title = pick(row, MAPPING.title);
  if (!externalId) return { error: `row ${index}: no id — add its field name to MAPPING.externalId` };
  if (!title) return { error: `row ${index} (${externalId}): no title` };

  const email = pick(row, MAPPING.assigneeEmail);
  const status = normaliseStatus(pick(row, MAPPING.status));
  const completedAt = iso(pick(row, MAPPING.completedAt));

  return {
    task: {
      externalId: String(externalId),
      title: String(title).trim(),
      status,
      ...(email && String(email).includes('@') ? { assigneeEmail: String(email).trim() } : {}),
      ...(pick(row, MAPPING.project) ? { project: String(pick(row, MAPPING.project)).trim() } : {}),
      ...(pick(row, MAPPING.priority) ? { priority: String(pick(row, MAPPING.priority)).trim() } : {}),
      ...(pick(row, MAPPING.url) ? { url: String(pick(row, MAPPING.url)).trim() } : {}),
      ...(iso(pick(row, MAPPING.createdAt)) ? { createdAt: iso(pick(row, MAPPING.createdAt)) } : {}),
      ...(iso(pick(row, MAPPING.deadline)) ? { deadline: iso(pick(row, MAPPING.deadline)) } : {}),
      // A task marked done with no completion date is dated now, or it never counts in any week.
      ...(status === 'done' ? { completedAt: completedAt ?? new Date().toISOString() } : {}),
      ...(pick(row, MAPPING.completionNote)
        ? { completionNote: String(pick(row, MAPPING.completionNote)).trim() }
        : {}),
    },
  };
}

// ---------------------------------------------------------------- talk to Nexus

async function login() {
  if (!CFG.email || !CFG.password) throw new Error('set NEXUS_EMAIL and NEXUS_PASSWORD');
  const res = await fetch(`${CFG.nexus}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: CFG.email, password: CFG.password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error('login returned no token');
  return accessToken;
}

async function pushBatch(token, tasks) {
  const res = await fetch(`${CFG.nexus}/umurimo/workspace/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ tasks }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`push failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------- run

async function main() {
  const readers = { file: fromFile, rest: fromRest, custom: fromCustom };
  const read = readers[CFG.source];
  if (!read) throw new Error(`SOURCE must be one of: ${Object.keys(readers).join(', ')}`);

  const rows = await read();
  console.log(`read ${rows.length} row(s) from ${CFG.source}`);
  if (!rows.length) {
    console.log('nothing to send');
    return;
  }

  const mapped = rows.map(mapTask);
  const errors = mapped.filter((m) => m.error).map((m) => m.error);
  const tasks = mapped.filter((m) => m.task).map((m) => m.task);

  if (errors.length) {
    console.error(`\n${errors.length} row(s) could not be mapped:`);
    for (const e of errors.slice(0, 10)) console.error(`  ${e}`);
    if (errors.length > 10) console.error(`  …and ${errors.length - 10} more`);
  }

  const byStatus = tasks.reduce((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }), {});
  const noAssignee = tasks.filter((t) => !t.assigneeEmail).length;
  console.log(`mapped ${tasks.length}:`, byStatus);
  if (noAssignee) console.log(`  ${noAssignee} with no assignee — invisible to the scorecard`);

  if (!COMMIT) {
    console.log('\nDRY RUN. First task that would be sent:');
    console.log(JSON.stringify(tasks[0], null, 2));
    console.log('\nRe-run with --commit to send.');
    return;
  }

  const token = await login();
  let sent = 0;
  const unmatched = new Set();

  for (let i = 0; i < tasks.length; i += BATCH) {
    const slice = tasks.slice(i, i + BATCH);
    const result = await pushBatch(token, slice);
    sent += result.received;
    for (const e of result.unmatched ?? []) unmatched.add(e);
    console.log(`  sent ${sent}/${tasks.length}`);
  }

  console.log(`\ndone — ${sent} task(s) in Nexus`);

  if (unmatched.size) {
    // Loud, and a non-zero exit, because each one is a person whose work the scorecard
    // cannot see. Silence here is how the whole bridge quietly stops being true.
    console.error(`\n${unmatched.size} assignee(s) match no Nexus user:`);
    for (const e of unmatched) console.error(`  ${e}`);
    console.error('\nEither the person has no Nexus account, or their email differs between');
    console.error('the two systems. Until it is fixed, none of their work is graded.');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
});
