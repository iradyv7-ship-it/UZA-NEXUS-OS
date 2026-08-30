import { authedCall } from '../../../lib/api';
import { getSession } from '../../../lib/session';
import { Card, Badge } from '../../../components/ui';
import { MemoActions, SendMemo } from './MemoUI';

interface InboxMemo {
  ref: string;
  subject: string;
  body: string;
  fromId: string;
  needsAck: boolean;
  linkedRef: string | null;
  sentAt: string;
  readAt: string | null;
  ackedAt: string | null;
  outstanding: boolean;
}
interface SentMemo {
  ref: string;
  subject: string;
  fromId: string;
  audience: string;
  needsAck: boolean;
  sentAt: string;
  sentTo: number;
  read: number;
  acknowledged: number;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Memos — the things that had to reach people, and whether they did.
 *
 * The inbox comes first because most people only ever need that half. The sent list
 * carries read and acknowledged counts, which is the entire reason this exists instead of
 * a chat message: "I told everyone" is not a fact until you can name who has not opened it.
 */
export default async function MemosPage() {
  const session = await getSession();
  if (!session) return null;
  const isExec = session.actor.role === 'ceo' || session.actor.role === 'venture_manager';

  const inboxRes = await authedCall<{ unread: number; memos: InboxMemo[] }>('/planning/memos');
  const sentRes = isExec ? await authedCall<SentMemo[]>('/planning/memos/sent') : null;

  const inbox = inboxRes.kind === 'ok' ? inboxRes.data : { unread: 0, memos: [] };
  const sent = sentRes?.kind === 'ok' ? sentRes.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Memos</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {inbox.unread} needing your attention · {inbox.memos.length} in total
        </p>
      </div>

      {isExec ? <SendMemo /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sent to me</h2>
        {inbox.memos.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">Nothing yet.</p>
          </Card>
        ) : (
          inbox.memos.map((m) => (
            <Card key={m.ref}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{m.subject}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {m.ref} · from {m.fromId} · {fmt(m.sentAt)}
                    {m.linkedRef ? ` · ${m.linkedRef}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {m.needsAck ? (
                    <Badge tone={m.ackedAt ? 'slate' : 'red'}>
                      {m.ackedAt ? 'acknowledged' : 'needs you'}
                    </Badge>
                  ) : null}
                  {!m.needsAck && !m.readAt ? <Badge tone="amber">unread</Badge> : null}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{m.body}</p>
              <MemoActions
                memoRef={m.ref}
                needsAck={m.needsAck}
                read={!!m.readAt}
                acked={!!m.ackedAt}
              />
            </Card>
          ))
        )}
      </section>

      {isExec && sent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sent — and who has opened it
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Subject</th>
                  <th className="px-4 py-2 font-medium">Audience</th>
                  <th className="px-4 py-2 text-right font-medium">Sent</th>
                  <th className="px-4 py-2 text-right font-medium">Read</th>
                  <th className="px-4 py-2 text-right font-medium">Acked</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((m) => (
                  <tr key={m.ref} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-800">{m.subject}</td>
                    <td className="px-4 py-2 text-slate-500">{m.audience}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{m.sentTo}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{m.read}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {m.needsAck ? (
                        <span
                          className={
                            m.acknowledged < m.sentTo ? 'text-amber-600' : 'text-slate-700'
                          }
                        >
                          {m.acknowledged}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
