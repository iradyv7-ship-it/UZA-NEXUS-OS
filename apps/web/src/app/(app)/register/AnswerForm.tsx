'use client';

import { useState } from 'react';
import { answerDecisionAction, deferDecisionAction } from './actions';

/**
 * Answer or defer, in place. Two buttons rather than one form with a mode switch, because
 * the two are genuinely different acts and the deferral needs a date the answer does not.
 *
 * The date input has no default. Offering "next week" as a pre-filled value would make the
 * easy path the one that moves everything a week to the right.
 */
export function AnswerForm({ decisionRef }: { decisionRef: string }) {
  const [mode, setMode] = useState<'closed' | 'answer' | 'defer'>('closed');

  if (mode === 'closed') {
    return (
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('answer')}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          Answer
        </button>
        <button
          type="button"
          onClick={() => setMode('defer')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
        >
          Defer to a date
        </button>
      </div>
    );
  }

  if (mode === 'answer') {
    return (
      <form action={answerDecisionAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="ref" value={decisionRef} />
        <textarea
          name="answer"
          required
          rows={3}
          autoFocus
          placeholder="The decision, and the reason in one line. Whoever executes this reads it, not you."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            Decide it
          </button>
          <button
            type="button"
            onClick={() => setMode('closed')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={deferDecisionAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="ref" value={decisionRef} />
      <label className="block">
        <span className="text-xs font-medium text-slate-600">
          Come back to it on — a date is required, there is no &ldquo;later&rdquo;
        </span>
        <input
          type="date"
          name="deferredTo"
          required
          autoFocus
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button className="rounded-lg border border-slate-400 px-3 py-1.5 text-xs font-semibold text-slate-700">
          Defer
        </button>
        <button
          type="button"
          onClick={() => setMode('closed')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
