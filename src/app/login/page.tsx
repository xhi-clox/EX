import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign in · Bangla Exam Maker Pro',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect('/');

  const { error } = await searchParams;
  const initialError =
    error === 'OAuthAccountNotLinked'
      ? 'This email is already registered with a password. Sign in with your email and password instead.'
      : error === 'AccessDenied'
        ? 'Google sign-in was cancelled or access was denied.'
        : error === 'Configuration'
          ? 'Google sign-in is not configured correctly.'
          : error
            ? 'Could not sign you in. Please try again.'
            : null;

  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue building your exam papers."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <a href="/signup" className="font-bold text-[#0f766e] hover:text-[#115e59]">
            Create one
          </a>
        </>
      }
    >
      <LoginForm googleEnabled={googleEnabled} initialError={initialError} />
    </AuthShell>
  );
}
