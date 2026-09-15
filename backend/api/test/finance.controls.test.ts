import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { minor, type Minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import { pettyCash, supplierBank, frontOffice, finance, finance2, agent } from './finance-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('petty cash — an append-only per-office ledger', () => {
  it('floats, spends and replenishes; balance is the signed sum', async () => {
    await pettyCash.record(frontOffice, {
      office: 'GOM',
      amountMinor: minor(500) as Minor,
      kind: 'float',
      memo: 'seed tin',
    });
    await pettyCash.record(frontOffice, {
      office: 'GOM',
      amountMinor: minor(120) as Minor,
      kind: 'expense',
      memo: 'moto courier',
    });
    await pettyCash.record(frontOffice, {
      office: 'GOM',
      amountMinor: minor(100) as Minor,
      kind: 'replenishment',
      memo: 'top up',
    });

    const bal = await pettyCash.balance(frontOffice, 'GOM');
    // 500 - 120 + 100 = 480.00 → 48000 minor. Expense is stored negative regardless of sign.
    expect(bal.balanceMinor).toBe(48000);
    expect(bal.entries).toBe(3);
    const rows = await prisma.pettyCashTransaction.findMany({ where: { office: 'GOM' } });
    const expense = rows.find((r) => r.kind === 'expense')!;
    expect(expense.amountMinor).toBe(-12000);
  });

  it('a sales agent cannot touch petty cash (no pettyCash grant)', async () => {
    await expect(
      pettyCash.record(agent, {
        office: 'GOM',
        amountMinor: minor(50) as Minor,
        kind: 'expense',
        memo: 'nope',
      }),
    ).rejects.toThrow(/ACCESS_DENIED_ROLE|does not permit/);
  });
});

// Supplier bank-detail changes require DUAL APPROVAL — redirecting supplier money is the
// classic fraud vector, so no single person can push a change through.
describe('supplier bank details — dual approval (four-eyes)', () => {
  const details = {
    supplierRef: 'SUP-CN-0001',
    accountName: 'Ningbo Widgets Ltd',
    iban: 'CN00-1234',
    bankName: 'BOC',
  };

  it('applies only after TWO distinct finance approvers approve', async () => {
    const req = await supplierBank.requestChange(finance, details);
    expect(req.status).toBe('pending_dual_approval');
    // No active account exists yet.
    expect(await supplierBank.readAccount(finance, details.supplierRef)).toBeNull();

    // A second finance person approves — but that is only ONE approval, still pending.
    const first = await supplierBank.approve(finance2, req.ref);
    expect(first.status).toBe('pending_dual_approval');
    expect(await supplierBank.readAccount(finance, details.supplierRef)).toBeNull();

    // A second DISTINCT approver reaches the threshold → applied.
    const ceoApprover = { userId: 'CEO', role: 'ceo' as const, office: 'RW', scope: {} };
    const second = await supplierBank.approve(ceoApprover, req.ref);
    expect(second.status).toBe('applied');

    const account = await supplierBank.readAccount(finance, details.supplierRef);
    expect(account).toMatchObject({ iban: 'CN00-1234', appliedByRequest: req.ref });
    const row = await prisma.supplierBankChangeRequest.findUniqueOrThrow({
      where: { ref: req.ref },
    });
    expect(row.status).toBe('applied');
  });

  it('the requester cannot self-approve', async () => {
    const req = await supplierBank.requestChange(finance, details);
    await expect(supplierBank.approve(finance, req.ref)).rejects.toThrow(
      /requester.*cannot approve/i,
    );
    // Still no account, still pending.
    expect(await supplierBank.readAccount(finance, details.supplierRef)).toBeNull();
  });

  it('one approver cannot approve twice to fake dual approval', async () => {
    const req = await supplierBank.requestChange(finance, details);
    await supplierBank.approve(finance2, req.ref);
    await expect(supplierBank.approve(finance2, req.ref)).rejects.toThrow();
    // Only one distinct approval was recorded — not applied.
    const row = await prisma.supplierBankChangeRequest.findUniqueOrThrow({
      where: { ref: req.ref },
    });
    expect(row.status).toBe('pending_dual_approval');
  });

  it('a non-finance role cannot request or approve a bank change', async () => {
    await expect(supplierBank.requestChange(agent, details)).rejects.toThrow(
      /ACCESS_DENIED_ROLE|does not permit/,
    );
  });
});
