'use client';

import { useState } from 'react';
import { createTaskAction, advanceTaskAction, completeTaskAction } from './actions';

const PEOPLE = [
  ['CEO-KGL-0001', 'Yves — CEO'],
  ['EMP-KGL-0002', 'Scorah — PM Mobility'],
  ['EMP-KGL-0003', 'Badiane — PM Bulk'],
  ['EMP-KGL-0007', 'Gad — PM IT'],
  ['EMP-CHN-0004', 'Cecilia — China ops'],
  ['EMP-CHN-0005', 'François — China verification'],
  ['EMP-KGL-0010', 'Adeline — customer care'],
  ['EMP-KGL-0006', 'Tresor — garage'],
  ['EMP-KGL-0008', 'Saddock — engineering'],
  ['EMP-KGL-0009', 'Abijuru — web and brand'],
] as const;

export function TaskActions({ taskRef, status }: { taskRef: string; status: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {status === 'todo' ? (
        <form action={advanceTaskAction}>
          <input type="hidden" name="ref" value={taskRef} />
          <input type="hidden" name="to" value="in_progress" />
          <button className="rounded border border-border px-2 py-1 text-[11px] text-fgMuted">
            Start
          </button>
        </form>
      ) : null}
      {status !== 'blocked' ? (
        <form action={advanceTaskAction}>
          <input type="hidden" name="ref" value={taskRef} />
          <input type="hidden" name="to" value="blocked" />
          <button className="rounded border border-border px-2 py-1 text-[11px] text-fgMuted">
            Blocked
          </button>
        </form>
      ) : (
        <form action={advanceTaskAction}>
          <input type="hidden" name="ref" value={taskRef} />
          <input type="hidden" name="to" value="in_progress" />
          <button className="rounded border border-border px-2 py-1 text-[11px] text-fgMuted">
            Unblock
          </button>
        </form>
      )}
      <form action={completeTaskAction}>
        <input type="hidden" name="ref" value={taskRef} />
        <button className="rounded bg-primary px-2 py-1 text-[11px] font-semibold text-surface">
          Done
        </button>
      </form>
    </div>
  );
}

/**
 * Assignee and due date are `required` on the form, not optional with a nudge.
 *
 * This is RESP-2026-0044 made physical: a task carries an aim, an owner and a deadline
 * before it is assigned. Making the field optional and hoping is exactly how twenty-one
 * enquiries ended up "awaiting" somebody unnamed.
 */
export function NewTask() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-surface"
      >
        New task
      </button>
    );
  }

  return (
    <form
      action={createTaskAction}
      className="w-full space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <label className="block">
        <span className="text-xs font-medium text-fgMuted">What has to happen</span>
        <input
          name="title"
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-fgMuted">Detail (optional)</span>
        <textarea
          name="description"
          rows={2}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="text-xs font-medium text-fgMuted">Who</span>
          <select
            name="assigneeId"
            required
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          >
            {PEOPLE.map(([ref, label]) => (
              <option key={ref} value={ref}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-fgMuted">By when</span>
          <input
            type="date"
            name="dueAt"
            required
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-fgMuted">Priority</span>
          <select
            name="priority"
            defaultValue="medium"
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-fgMuted">Part of (optional)</span>
          <input
            name="linkedRef"
            placeholder="INIT-2026-0101"
            className="mt-1 rounded-lg border border-border px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>

      <p className="text-[11px] text-fgSubtle">
        Owner and deadline are required. A task without both is the thing that turns into an
        &ldquo;awaiting&rdquo; row three weeks later.
      </p>

      <div className="flex gap-2">
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-surface">
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-fgMuted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
