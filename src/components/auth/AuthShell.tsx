import { Logo } from '@/components/icons/Logo';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f6] px-5 py-10 text-[#17343a]">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center justify-center gap-3 text-lg font-bold tracking-[-0.02em] text-[#12363c]">
          <Logo />
          <span>ExamPro</span>
        </div>

        <div className="rounded-2xl border border-[#d7e5e1] bg-white p-7 shadow-[0_20px_50px_rgba(23,52,58,0.08)] sm:p-9">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#102f35]">{title}</h1>
            <p className="mt-2 text-sm text-[#5d7778]">{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="mt-6 text-center text-sm text-[#5d7778]">{footer}</p>
      </div>
    </div>
  );
}
