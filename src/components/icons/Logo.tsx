import { cn } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex size-9 items-center justify-center rounded-xl bg-[#75c8b7] text-[#12363c]', className)}>
      <GraduationCap className="size-5 text-white" />
    </div>
  );
}
