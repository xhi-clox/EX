import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Create account · Bangla Exam Maker Pro',
};

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start creating exam papers in a couple of minutes."
      footer={
        <>
          Already have an account?{' '}
          <a href="/login" className="font-bold text-[#0f766e] hover:text-[#115e59]">
            Sign in
          </a>
        </>
      }
    >
      <SignupForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
