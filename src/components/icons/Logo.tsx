import { cn } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-primary to-accent', className)}>
      <GraduationCap className="size-5 text-white" />
    </div>
  );
}
