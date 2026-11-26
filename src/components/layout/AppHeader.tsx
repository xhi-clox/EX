'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Settings,
  User,
  FileText,
  CheckCheck,
  ArrowRight,
  Command,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjects } from '@/hooks/use-projects';
import { readWorkspaceSettings } from '@/lib/paper-defaults';
import { subjectTone } from '@/lib/project-utils';
import { cn } from '@/lib/utils';
import { formatClassName } from '@/lib/school-classes';

const NOTIFICATIONS_READ_KEY = 'examProNotificationsReadAt';

interface AppHeaderProps {
  /** When set, the header shows a page title instead of the welcome message. */
  title?: string;
  /** Small line above the title. Defaults to today's date. */
  eyebrow?: string;
  /** Right-aligned page actions, shown before the global controls. */
  actions?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, actions }: AppHeaderProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { projects } = useProjects();
  const [today, setToday] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [readAt, setReadAt] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );

    const stored = Number(window.localStorage.getItem(NOTIFICATIONS_READ_KEY) || 0);
    if (Number.isFinite(stored)) setReadAt(stored);
    setNotificationsEnabled(readWorkspaceSettings().notifications);
  }, []);

  // ⌘K / Ctrl+K focuses the workspace search from anywhere in the dashboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the search results when clicking elsewhere.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'there';
  const initial = displayName.charAt(0).toUpperCase();

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    return projects
      .filter((project) =>
        [project.name, project.subject, project.class]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 6);
  }, [projects, query]);

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        )
        .slice(0, 4),
    [projects]
  );

  const unreadCount = notificationsEnabled
    ? recentProjects.filter(
        (project) => new Date(project.lastUpdated).getTime() > readAt
      ).length
    : 0;

  const markAllRead = () => {
    const now = Date.now();
    window.localStorage.setItem(NOTIFICATIONS_READ_KEY, String(now));
    setReadAt(now);
  };

  const submitSearch = () => {
    const needle = query.trim();
    if (!needle) return;
    setSearchOpen(false);
    router.push(`/projects?q=${encodeURIComponent(needle)}`);
  };

  return (
    <header className="flex min-h-[86px] flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d7e5e1] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(23,52,58,0.05)] lg:px-6">
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4d7777]">
          {eyebrow || today || '\u00a0'}
        </p>
        <h1 className="truncate text-[22px] font-bold tracking-[-0.03em] text-[#102f35] lg:text-2xl">
          {title ||
            (status === 'authenticated' ? `Welcome back, ${displayName}` : 'Welcome back')}
        </h1>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        {actions}

        <div ref={searchRef} className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#789093]" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitSearch();
              }
              if (event.key === 'Escape') {
                setSearchOpen(false);
                searchInputRef.current?.blur();
              }
            }}
            placeholder="Search papers, subjects..."
            aria-label="Search papers"
            className="w-56 rounded-xl border border-[#d1e2de] bg-[#f4f9f7] py-2.5 pl-10 pr-16 text-sm font-medium text-[#17343a] outline-none transition-all placeholder:text-[#668384] focus:border-[#5aa99d] focus:bg-white focus:ring-4 focus:ring-[#dff1ed] lg:w-64"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[#d7e5e1] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#789093] lg:flex">
            <Command className="size-2.5" />K
          </span>

          {searchOpen && query.trim() && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#d7e5e1] bg-white shadow-[0_18px_40px_rgba(23,52,58,0.14)]">
              <div className="flex items-center justify-between border-b border-[#e8efed] px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#829697]">
                  {searchResults.length
                    ? `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
                    : 'No matches'}
                </span>
                <button
                  type="button"
                  onClick={submitSearch}
                  className="text-[11px] font-bold text-[#0f766e] hover:text-[#115e59]"
                >
                  Search all
                </button>
              </div>

              {searchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto app-scrollbar-light py-1">
                  {searchResults.map((project) => {
                    const tone = subjectTone(project.subject);
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/editor?project=${project.id}`);
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#f4faf8]"
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e3f2ee] text-[#0f766e]">
                          <FileText className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-[#17343a]">
                            {project.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6b8385]">
                            <span className={cn('rounded px-1.5 py-0.5 font-bold', tone.badge)}>
                              {project.subject}
                            </span>
                            {formatClassName(project.class)}
                          </span>
                        </span>
                        <ArrowRight className="mt-1 size-3.5 shrink-0 text-[#9cb0b0]" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-[#4c686b]">
                    Nothing matches “{query.trim()}”
                  </p>
                  <p className="mt-1 text-xs text-[#829697]">
                    Try a subject, class or part of a paper name.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              className="relative flex size-10 items-center justify-center rounded-xl border border-[#dfe9e7] bg-white text-[#587174] transition-colors hover:border-[#8bc8bd] hover:bg-[#f0f8f6] hover:text-[#0f766e]"
            >
              <Bell className="size-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[#d96b5d] text-[9px] font-bold text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 border-[#d7e5e1] bg-white p-0 text-[#17343a]"
          >
            <div className="flex items-center justify-between border-b border-[#e8efed] px-3 py-2.5">
              <span className="text-[13px] font-bold text-[#17343a]">Notifications</span>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0f766e] transition-opacity hover:text-[#115e59] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            </div>

            {!notificationsEnabled ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[#4c686b]">
                  Notifications are turned off
                </p>
                <Link
                  href="/settings"
                  className="mt-1 inline-block text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
                >
                  Turn them back on in Settings
                </Link>
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[#4c686b]">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-[#829697]">
                  Recent paper updates will appear here.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto app-scrollbar-light py-1">
                {recentProjects.map((project) => {
                  const isUnread =
                    new Date(project.lastUpdated).getTime() > readAt;
                  return (
                    <DropdownMenuItem
                      key={project.id}
                      asChild
                      className="cursor-pointer rounded-none px-3 py-2.5 focus:bg-[#f4faf8]"
                    >
                      <Link href={`/editor?project=${project.id}`}>
                        <span
                          className={cn(
                            'mt-1 size-2 shrink-0 rounded-full',
                            isUnread ? 'bg-[#0f766e]' : 'bg-[#d7e5e1]'
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-[#294b50]">
                            {project.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#6b8385]">
                            {project.subject} · {formatClassName(project.class)} · updated{' '}
                            {formatDistanceToNow(new Date(project.lastUpdated), {
                              addSuffix: true,
                            })}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}

            <div className="border-t border-[#e8efed] px-3 py-2">
              <Link
                href="/activity"
                className="flex items-center justify-between text-[11px] font-bold text-[#0f766e] hover:text-[#115e59]"
              >
                View all activity
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="hidden items-center gap-2 rounded-xl border border-[#dfe9e7] bg-[#f7faf9] py-2 pl-2 pr-3 text-[#17343a] transition-colors hover:border-[#8bc8bd] sm:flex"
            >
              <span className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-[#173f45] text-xs font-bold text-white">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt=""
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : status === 'authenticated' ? (
                  initial
                ) : (
                  <User className="size-4" />
                )}
              </span>
              <ChevronDown className="size-4 text-[#789093]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-[#d7e5e1] bg-white text-[#17343a]">
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
