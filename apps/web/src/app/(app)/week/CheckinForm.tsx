'use client';

import { useState } from 'react';
import { checkinAction } from './actions';

/**
 * Collapsed until asked for. The card above it is the thing being read; the form is the
 * thing being done, and showing four empty boxes under every initiative turns a page you
 * scan into a page you avoid.
 *
 * Three fields, one required. "Needs from the CEO" is separate from "blocked" on purpose:
 * a blocker somebody is working around is different from one only the founder can clear,
 * and only the second belongs in front of him on Monday.
 */
export function CheckinForm({ initiativeRef }: { initiativeRef: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        File this week
      </button>
    );
  }

  return (
    <form action={checkinAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="initiativeRef" value={initiativeRef} />

      <label className="block">
        <span className="text-xs font-medium text-slate-600">What moved?</span>
        <textarea
          name="moved"
          required
          rows={2}
          autoFocus
          placeholder="One line is enough. What is different from last week?"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Blocked by anything? (optional)</span>
        <input
          name="blocked"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">
          Need something from the CEO? (optional — this goes straight onto the Monday review)
        </span>
        <input
          name="needsFromCeo"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex gap-2 pt-1">
        <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
          File it
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
