'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Folder,
  HelpCircle,
  LayoutDashboard,
  Settings,
  User,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { cn } from '@/lib/utils';

const mobileNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Folder },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className="mt-3 flex gap-1.5 overflow-x-auto rounded-xl border border-[#d7e5e1] bg-white p-1.5 shadow-[0_6px_18px_rgba(23,52,58,0.04)] scrollbar-hide md:hidden"
    >
      {mobileNav.map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
              active
                ? 'bg-[#173f45] text-white'
                : 'text-[#587174] hover:bg-[#f0f8f6] hover:text-[#0f766e]'
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  /** Fill the viewport on large screens (used by the dashboard itself). */
  fullHeight?: boolean;
  contentClassName?: string;
}

export function DashboardShell({
  children,
  title,
  eyebrow,
  actions,
  fullHeight = false,
  contentClassName,
}: DashboardShellProps) {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  return (
    <div
      className={cn(
        'flex min-h-screen bg-[#f3f7f6] text-[#17343a]',
        fullHeight && 'lg:h-screen lg:overflow-hidden'
      )}
    >
      <AppSidebar onCollapseChange={setSidebarHidden} />
      <main
        className={cn(
          'flex-1 px-4 py-4 transition-[margin] duration-200 sm:px-5 sm:py-5 lg:px-8 lg:py-7',
          fullHeight && 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden',
          sidebarHidden ? 'md:ml-0' : 'md:ml-[260px]'
        )}
      >
        <div className="shrink-0">
          <AppHeader title={title} eyebrow={eyebrow} actions={actions} />
        </div>
        <MobileNav />
        <div className={cn('mt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  );
}
