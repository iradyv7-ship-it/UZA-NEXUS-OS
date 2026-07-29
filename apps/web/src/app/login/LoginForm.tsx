'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type LoginState } from './actions';

interface Labels {
  email: string;
  password: string;
  submit: string;
  submitting: string;
  invalid: string;
  network: string;
}

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}

export default function LoginForm({ labels }: { labels: Labels }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error === 'network' ? labels.network : labels.invalid}
        </p>
      )}

      <SubmitButton idle={labels.submit} busy={labels.submitting} />
    </form>
  );
}
