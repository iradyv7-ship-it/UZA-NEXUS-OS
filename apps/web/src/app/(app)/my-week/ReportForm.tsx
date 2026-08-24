'use client';

import { useState } from 'react';
import { fileReportAction } from './actions';

/**
 * Four boxes, one required.
 *
 * Collapsed until asked for when nothing is filed yet, for the same reason the check-in form
 * collapses: four empty boxes at the bottom of every screen turns a page you scan into a page
 * you avoid.
 *
 * "Asking the team for" is separate from "blocked" on purpose. A blocker is something in the
 * way; an ask is a trade. The ask is the field that turns a status meeting into one people
 * want to attend, so it is collected even in a week where nothing is blocked.
 */
export function ReportForm({ filed }: { filed: boolean }) {
  const [open, setOpen] = useState(filed);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Write it now
      </button>
    );
  }

  return (
    <form action={fileReportAction} className="space-y-2">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">What I finished this week</span>
        <textarea
          name="highlights"
          required
          rows={2}
          placeholder="Something you actually finished - not something you started."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">What is stopping me</span>
        <textarea
          name="blockers"
          rows={2}
          placeholder="Leave this empty if nothing is."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">What I need from someone</span>
        <textarea
          name="asking"
          rows={2}
          placeholder="Name the person and say what you need."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">What I will finish next week</span>
        <textarea
          name="nextWeek"
          rows={2}
          placeholder="One thing. We should be able to check it next Monday."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
      >
        {filed ? 'Update my report' : 'Send my report'}
      </button>
    </form>
  );
}
