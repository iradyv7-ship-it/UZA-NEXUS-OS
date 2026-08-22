'use client';

import { useState } from 'react';
import { readMemoAction, ackMemoAction, sendMemoAction } from './actions';

/**
 * Read and acknowledge are separate buttons because they are separate claims. "I have seen
 * this" and "I will do this" are not the same statement, and collapsing them into one
 * click is how an acknowledgement stops meaning anything.
 */
export function MemoActions({
  memoRef,
  needsAck,
  read,
  acked,
}: {
  memoRef: string;
  needsAck: boolean;
  read: boolean;
  acked: boolean;
}) {
  if (acked || (!needsAck && read)) {
    return <p className="mt-3 text-xs text-slate-400">{acked ? 'Acknowledged.' : 'Read.'}</p>;
  }
  return (
    <div className="mt-3 flex gap-2">
      {!read ? (
        <form action={readMemoAction}>
          <input type="hidden" name="ref" value={memoRef} />
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600">
            Mark as read
          </button>
        </form>
      ) : null}
      {needsAck ? (
        <form action={ackMemoAction}>
          <input type="hidden" name="ref" value={memoRef} />
          <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            I have read this and will act on it
          </button>
        </form>
      ) : null}
    </div>
  );
}

const DEPARTMENTS = ['GROUP', 'BULK', 'MOBILITY', 'EMPOWER', 'CLOUD'];

export function SendMemo() {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState('everyone');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        Write a memo
      </button>
    );
  }

  return (
    <form action={sendMemoAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Subject</span>
        <input
          name="subject"
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Message</span>
        <textarea
          name="body"
          required
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">To</span>
          <select
            name="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="everyone">Everyone</option>
            <option value="department">A department</option>
            <option value="person">One person</option>
          </select>
        </label>

        {audience === 'department' ? (
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Department</span>
            <select name="departmentCode" className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {audience === 'person' ? (
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Their ref</span>
            <input
              name="toId"
              placeholder="EMP-KGL-0003"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Link to (optional)</span>
          <input
            name="linkedRef"
            placeholder="INIT-2026-0001"
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>

      <label className="flex items-start gap-2">
        <input type="checkbox" name="needsAck" className="mt-0.5" />
        <span className="text-xs text-slate-600">
          <strong>Require acknowledgement.</strong> Use this when the memo changes how someone works — a
          new rule, a threshold, a deadline. Reading it will not be enough; they have to say they will act.
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Send</button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
