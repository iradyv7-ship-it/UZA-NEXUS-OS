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
