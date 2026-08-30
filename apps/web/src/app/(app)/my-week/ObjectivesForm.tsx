'use client';

import { useState } from 'react';
import { confirmWeekAction } from './actions';

export interface Objective {
  text: string;
  status: 'todo' | 'done' | 'dropped';
  source: 'minutes' | 'self';
}

/** Local-only identity for React's key — never sent to the server (confirmWeekAction reads
 *  objectiveText/objectiveDone/objectiveSource by DOM position, not by this id). Without a
 *  stable key, removing row N left every row after it reusing the DOM node — and therefore
 *  the checked state — of the row that used to sit at that index. */
type Row = Objective & { id: string };

const newRowId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Math.random().toString(36).slice(2)}`;

const withId = (o: Objective): Row => ({ ...o, id: newRowId() });

/**
 * The objectives the meeting proposed, editable before they become yours.
 *
 * Rows are open for editing from the start rather than behind an "edit" button. The whole
 * purpose of this screen is that a person changes what a meeting said about them, and hiding
 * that behind a click makes the default "accept whatever was written down", which is the
 * outcome the draft state exists to prevent.
 *
 * A row emptied is a row dropped — the server filters blanks. That is deliberate: deleting a
 * commitment you did not agree to should be as easy as disagreeing out loud.
 */
export function ObjectivesForm({ initial, isDraft }: { initial: Objective[]; isDraft: boolean }) {
  const [rows, setRows] = useState<Row[]>(
    (initial.length
      ? initial
      : [{ text: '', status: 'todo' as const, source: 'self' as const }]
    ).map(withId),
  );

  const update = (i: number, patch: Partial<Objective>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <form action={confirmWeekAction} className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              name="objectiveDone"
              value={String(i)}
              checked={row.status === 'done'}
              onChange={(e) => update(i, { status: e.target.checked ? 'done' : 'todo' })}
              aria-label="Done"
              className="mt-2.5 h-4 w-4 shrink-0 rounded border-slate-300"
            />
            <div className="flex-1">
              <input
                type="text"
                name="objectiveText"
                value={row.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="What will be finished by Friday?"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {row.source === 'minutes' && (
                <span className="mt-1 inline-block text-[11px] text-slate-500">
                  from Monday&rsquo;s meeting — change it if that is not what you agreed to
                </span>
              )}
            </div>
            <input type="hidden" name="objectiveSource" value={row.source} />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              aria-label="Remove this line"
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setRows((r) => [...r, withId({ text: '', status: 'todo', source: 'self' })])
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add something of my own
        </button>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {isDraft ? 'Yes, this is my week' : 'Save changes'}
        </button>
        {isDraft && (
          <span className="text-xs text-amber-700">
            Until you press this, it is what the meeting said — not what you agreed.
          </span>
        )}
      </div>
    </form>
  );
}
