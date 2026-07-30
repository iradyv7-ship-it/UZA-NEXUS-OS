import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { homePathFor } from '@/lib/permissions';

export default async function IndexPage() {
  const session = await getSession();
  redirect(session ? homePathFor(session.actor) : '/login');
}
