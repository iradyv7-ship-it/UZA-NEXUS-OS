import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@uza/contracts';
import { IdentityService } from '../src/platform/identity/identity.service';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { prisma } from './db';
import { resetAllDb } from './api-e2e-db';

/**
 * HTTP e2e against the REAL app over `fetch`. The app is booted as a child process under the
 * SWC runtime (`node -r @swc-node/register`), because NestJS constructor injection needs
 * `emitDecoratorMetadata`, which Vitest's esbuild transform does not emit — the same reason
 * the unit suites instantiate services directly. Seeding is done straight through Prisma +
 * a directly-constructed IdentityService (no DI needed for that).
 *
 * Proves the API is the security boundary the frontend builds on:
 *  - the global JWT guard: 401 without/with a bad token, authenticated access with a good one;
 *  - masking THROUGH an endpoint: a sales_agent reads a quotation and sees `***`;
 *  - a service permission denial surfaces as 403 with the contract error code;
 *  - input validation rejects a malformed body with 400;
 *  - one happy path per module (trade, sourcing, quality, finance, logistics).
 */

const PORT = 3765;
const baseUrl = `http://127.0.0.1:${PORT}`;
let server: ChildProcessWithoutNullStreams;

interface Json {
  [k: string]: unknown;
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : {} };
}

async function login(email: string, password: string): Promise<string> {
  const res = await api('POST', '/auth/login', { body: { email, password } });
  expect(res.status, `login ${email} -> ${JSON.stringify(res.body)}`).toBe(201);
  return res.body.accessToken as string;
}

const tokens: Record<string, string> = {};

beforeAll(async () => {
  await resetAllDb();

  // Seed identity directly (Prisma works without the DI container). Bootstrap uses a ceo
  // Actor value — authorize() checks the grant, not DB existence, so the first admin seeds.
  const authz = new AuthorizationService(new AuditService(prisma as never));
  const identity = new IdentityService(prisma as never, authz);
  const ceoActor: Actor = { userId: 'CEO-RW-0001', role: 'ceo', office: 'GOM', scope: {} };
  const org = await identity.createOrganisation(ceoActor, 'UZA Solutions Ltd');
  const off = await identity.createOffice(ceoActor, org.id, 'GOM', 'Goma HQ');
  const seed = (ref: string, email: string, role: string) =>
    identity.createEmployee(ceoActor, { ref, email, password: 'password1', role: role as never, officeId: off.id });
  await seed('CEO-RW-0001', 'ceo@uza.rw', 'ceo');
  await seed('AGT-GOM-0021', 'agent@uza.rw', 'sales_agent');
  await seed('VM-RW-0001', 'vm@uza.rw', 'venture_manager');
  await seed('FIN-RW-0001', 'finance@uza.rw', 'finance');
  await seed('FO-GOM-0001', 'front@uza.rw', 'front_office');
  await seed('WH-CN-0001', 'warehouse@uza.cn', 'china_warehouse');

  // Boot the app under SWC so DI injects properly.
  server = spawn('node', ['-r', '@swc-node/register', 'src/main.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
  });
  await new Promise<void>((resolve, reject) => {
    // BOOT_TIMEOUT is generous on purpose, and the reason is worth knowing before you
    // shrink it again.
    //
    // This spawns the real API under @swc-node/register, which compiles the whole
    // application on the fly. With a COLD swc cache that is slow — slower than the 45s
    // this used to allow — so the suite failed here on a first run and passed on a retry,
    // which looked like flakiness and was really a cold cache. It is not CPU contention:
    // vitest runs these files serially (fileParallelism: false, singleFork).
    //
    // It must also stay comfortably below the hook timeout below, or vitest kills the hook
    // first and you get a timeout with no output instead of the message built here.
    const BOOT_TIMEOUT = 100_000;
    let outBuf = '';
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `API did not start within ${BOOT_TIMEOUT / 1000}s.
` +
              `stdout: ${outBuf.slice(-800) || '(nothing)'}
` +
              `stderr: ${errBuf.slice(-800) || '(nothing)'}`,
          ),
        ),
      BOOT_TIMEOUT,
    );
    let errBuf = '';
    server.stdout.on('data', (d: Buffer) => {
      outBuf += d.toString();
      if (d.toString().includes('listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (d: Buffer) => {
      errBuf += d.toString();
      if (/Error|EADDRINUSE/i.test(errBuf)) {
        clearTimeout(timer);
        reject(new Error(errBuf));
      }
    });
    server.on('exit', (code) => reject(new Error(`API exited early (${code}): ${errBuf}`)));
  });

  tokens.ceo = await login('ceo@uza.rw', 'password1');
  tokens.agent = await login('agent@uza.rw', 'password1');
  tokens.finance = await login('finance@uza.rw', 'password1');
  tokens.front = await login('front@uza.rw', 'password1');
}, 150_000);

afterAll(async () => {
  server?.kill('SIGTERM');
  await prisma.$disconnect();
});

describe('JWT guard', () => {
  it('rejects a protected route without a token (401)', async () => {
    const res = await api('GET', '/suppliers/SUP-CN-0001');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token (401)', async () => {
    const res = await api('GET', '/suppliers/SUP-CN-0001', { token: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });

  it('allows an authenticated request and reconstructs the actor (sourcing happy path)', async () => {
    const created = await api('POST', '/suppliers', {
      token: tokens.ceo,
      body: { nameEn: 'Ningbo Widgets', nameZh: '宁波小部件' },
    });
    expect(created.status).toBe(201);
    const ref = created.body.ref as string;
    expect(ref).toMatch(/^SUP-CN-\d{4}$/);

    const read = await api('GET', `/suppliers/${ref}`, { token: tokens.ceo });
    expect(read.status).toBe(200);
    expect(read.body.ref).toBe(ref);
  });
});

describe('permission denial surfaces as 403', () => {
  it('a sales_agent cannot build a quotation (ACCESS_DENIED_ROLE)', async () => {
    const res = await api('POST', '/quotations', {
      token: tokens.agent,
      body: { projectRef: 'PRJ-X', supplierUnitCostMinor: 1000, estCostsMinor: { exw: 1000 }, qty: 1, requiredMargin: 0.2 },
    });
    expect(res.status).toBe(403);
    const error = res.body.error as Json;
    expect(error.code).toBe('ACCESS_DENIED_ROLE');
  });
});

describe('masking is enforced at the API boundary (trade happy path)', () => {
  let quotationRef: string;
  let customerRef: string;

  it('builds a full trade chain and masks confidential fields per role', async () => {
    // Agent owns the customer, so the quotation carries the agent's id (object scope).
    const customer = await api('POST', '/customers', {
      token: tokens.agent,
      body: { name: 'Kivu Traders', country: 'CD', phone: '+243900000000' },
    });
    expect(customer.status).toBe(201);
    customerRef = customer.body.ref as string;
    expect(customer.body.agentId).toBe('AGT-GOM-0021');

    const lead = await api('POST', '/leads', {
      token: tokens.agent,
      body: { customerRef, rawText: 'need 500 solar lamps' },
    });
    expect(lead.status).toBe(201);
    const leadRef = lead.body.ref as string;

    const clarify = await api('POST', `/leads/${leadRef}/clarify`, {
      token: tokens.ceo,
      body: { spec: { item: 'solar lamp', qty: 500 } },
    });
    expect(clarify.status).toBe(201);
    const requestRef = clarify.body.ref as string;

    const project = await api('POST', '/projects', {
      token: tokens.ceo,
      body: { requestRef, name: 'Solar lamps Q3', owner: 'VM-RW-0001' },
    });
    expect(project.status).toBe(201);
    const projectRef = project.body.ref as string;

    const quotation = await api('POST', '/quotations', {
      token: tokens.ceo,
      body: { projectRef, supplierUnitCostMinor: 10_000, estCostsMinor: { exw: 10_000, ocean: 2_000 }, qty: 50, requiredMargin: 0.2 },
    });
    expect(quotation.status).toBe(201);
    quotationRef = quotation.body.ref as string;

    const approve = await api('POST', `/quotations/${quotationRef}/approve`, { token: tokens.ceo });
    expect(approve.status).toBe(201);

    // CEO sees the real margin.
    const asCeo = await api('GET', `/quotations/${quotationRef}`, { token: tokens.ceo });
    expect(asCeo.status).toBe(200);
    expect(typeof asCeo.body.marginPct).toBe('number');
    expect(typeof asCeo.body.supplierUnitCost).toBe('number');

    // Sales agent is in scope (agentId matches) but must see the confidential fields masked.
    const asAgent = await api('GET', `/quotations/${quotationRef}`, { token: tokens.agent });
    expect(asAgent.status).toBe(200);
    expect(asAgent.body.marginPct).toBe('***');
    expect(asAgent.body.supplierUnitCost).toBe('***');
    expect(asAgent.body.dapMargin).toBe('***');
  });

  it('creates an order from the approved quotation (trade order happy path)', async () => {
    const order = await api('POST', '/orders', { token: tokens.ceo, body: { quotationRef } });
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('awaiting_payment');
    expect(order.body.customerRef).toBe(customerRef);
  });
});

describe('quality happy path', () => {
  it('issues a PO, assigns a visit, and records a passing inspection', async () => {
    const supplier = await api('POST', '/suppliers', {
      token: tokens.ceo,
      body: { nameEn: 'Foshan Lighting', nameZh: '佛山照明' },
    });
    const supplierRef = supplier.body.ref as string;

    const po = await api('POST', '/purchase-orders', {
      token: tokens.ceo,
      body: { supplierRef, orderRef: 'ORD-BULK-2026-0001', qty: 50, unitCostMinor: 10_000, unitCbm: 0.3, unitKg: 100 },
    });
    expect(po.status).toBe(201);
    const poRef = po.body.ref as string;

    const visit = await api('POST', '/visits', {
      token: tokens.ceo,
      body: { poRef, inspectorId: 'WH-CN-0001' },
    });
    expect(visit.status).toBe(201);
    const visitRef = visit.body.ref as string;

    const inspection = await api('POST', '/inspections', {
      token: tokens.ceo,
      body: { visitRef, stage: 'pre_shipment', critical: 0, major: 0, minor: 1 },
    });
    expect(inspection.status).toBe(201);
    expect((inspection.body.inspection as Json).result).toBe('pass');
  });
});

describe('finance happy path (petty cash ledger)', () => {
  it('records a float and reads the office balance', async () => {
    const record = await api('POST', '/petty-cash', {
      token: tokens.front,
      body: { office: 'GOM', amountMinor: 50_000, kind: 'float', memo: 'opening float' },
    });
    expect(record.status).toBe(201);

    const balance = await api('GET', '/petty-cash/GOM/balance', { token: tokens.front });
    expect(balance.status).toBe(200);
    expect(balance.body.balanceMinor).toBe(50_000);
  });
});

describe('logistics happy path (warehouse receiving)', () => {
  it('receives a lot and reconciles measured against declared', async () => {
    const receipt = await api('POST', '/receiving', {
      token: tokens.ceo,
      body: {
        orderRef: 'ORD-BULK-2026-0001',
        customerRef: 'CUS-CD-000001',
        poRef: 'PO-CN-2026-0001',
        declaredCbm: 3,
        declaredKg: 1000,
        packages: [{ kg: 1000, cbm: 3 }],
      },
    });
    expect(receipt.status).toBe(201);
    expect((receipt.body.receipt as Json).measuredCbm).toBe(3);
    expect((receipt.body.packages as unknown[]).length).toBe(1);
  });
});

describe('input validation', () => {
  it('rejects a malformed body with 400', async () => {
    const res = await api('POST', '/customers', {
      token: tokens.ceo,
      body: { name: '', country: 'CD' }, // missing phone, empty name
    });
    expect(res.status).toBe(400);
  });
});
