'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Bell, Search, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppHeader() {
  const { data: session, status } = useSession();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'there';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex min-h-[86px] items-center justify-between rounded-2xl border border-[#d7e5e1] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(23,52,58,0.05)] lg:px-6">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4d7777]">
            {today || '\u00a0'}
          </p>
          <h1 className="truncate text-[22px] font-bold tracking-[-0.03em] text-[#102f35] lg:text-2xl">
            {status === 'authenticated' ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h1>
        </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#789093]" />
          <input
            type="text"
            placeholder="Search papers, projects..."
            className="w-56 rounded-xl border border-[#d1e2de] bg-[#f4f9f7] py-2.5 pl-10 pr-4 text-sm font-medium text-[#17343a] outline-none transition-all placeholder:text-[#668384] focus:border-[#5aa99d] focus:bg-white focus:ring-4 focus:ring-[#dff1ed] lg:w-64"
          />
        </div>
        <button aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-xl border border-[#dfe9e7] bg-white text-[#587174] transition-colors hover:border-[#8bc8bd] hover:bg-[#f0f8f6] hover:text-[#0f766e]">
          <Bell className="size-[18px]" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d96b5d] ring-2 ring-white"></span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="hidden items-center gap-2 rounded-xl border border-[#dfe9e7] bg-[#f7faf9] py-2 pl-2 pr-3 text-[#17343a] transition-colors hover:border-[#8bc8bd] sm:flex"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#173f45] text-xs font-bold text-white">
                {status === 'authenticated' ? initial : <User className="size-4" />}
              </span>
              <ChevronDown className="size-4 text-[#789093]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-[#d7e5e1] bg-white">
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-sm font-bold text-[#102f35]">
                {status === 'authenticated' ? displayName : 'Your account'}
              </span>
              {user?.email && (
                <span className="block truncate text-xs text-[#6b8385]">{user.email}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#e2ecea]" />
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#f0f8f6]">
              <Link href="/profile">
                <User className="size-4 text-[#587174]" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#f0f8f6]">
              <Link href="/settings">
                <Settings className="size-4 text-[#587174]" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#e2ecea]" />
            <DropdownMenuItem
              className="cursor-pointer text-[#b04a3b] focus:bg-[#fdf1ef] focus:text-[#b04a3b]"
              onSelect={() => {
                void signOut({ callbackUrl: '/login' });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
