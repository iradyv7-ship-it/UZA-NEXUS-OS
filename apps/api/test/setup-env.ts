import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load apps/api/.env into process.env without adding a dotenv dependency.
try {
  const envPath = resolve(__dirname, '..', '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  // .env is optional; DATABASE_URL may already be set in the environment.
}

/**
 * Send the suite at a SEPARATE database, always.
 *
 * `resetDb()` truncates User, Office and Organisation with CASCADE between test files. Until
 * this block existed, `.env` was loaded above and the tests inherited the development
 * DATABASE_URL — so running `pnpm test` silently emptied the dev database's users, employee
 * profiles and departments, and everyone was logged out. It happened twice on 24 August 2026
 * before anyone worked out why.
 *
 * Order of preference: an explicit TEST_DATABASE_URL, else the dev URL with `_test` appended.
 * The guard in `db.ts` is the second line of defence and refuses to truncate anything whose
 * database name does not contain "test".
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/([^/?]+)(\?|$)/,
    (_m, name: string, tail: string) => `/${name.endsWith('_test') ? name : `${name}_test`}${tail}`,
  );
}
