'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export function GoogleButton({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => {
        setIsLoading(true);
        void signIn('google', { callbackUrl });
      }}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#d1e2de] bg-white py-3 text-sm font-bold text-[#17343a] transition-colors hover:border-[#8bc8bd] hover:bg-[#f7fbfa] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="size-5 animate-spin text-[#0f766e]" />
      ) : (
        <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.07.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.11-6.71-4.94H1.28v3.09A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.09Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.09C6.24 6.87 8.88 4.75 12 4.75Z"
          />
        </svg>
      )}
      Continue with Google
    </button>
  );
}
