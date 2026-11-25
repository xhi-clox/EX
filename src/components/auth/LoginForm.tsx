'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { GoogleButton } from './GoogleButton';
import { FormError, OrDivider, inputClassName, labelClassName } from './AuthFields';

export function LoginForm({
  googleEnabled,
  initialError = null,
}: {
  googleEnabled: boolean;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError('Incorrect email or password.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        <div>
          <label htmlFor="email" className={labelClassName}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClassName}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className={inputClassName}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] py-3 text-sm font-bold text-white transition-colors hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
