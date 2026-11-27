'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarDays,
  Clock,
  FileQuestion,
  FileText,
  Filter,
  Folder,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  startOfDay,
  subDays,
} from 'date-fns';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/use-projects';
import { formatMarks, subjectTone } from '@/lib/project-utils';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import { formatClassName } from '@/lib/school-classes';

function groupLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM yyyy');
}

function ActivityPage() {
  const { projects, isLoaded } = useProjects();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');

  const subjects = useMemo(
    () => Array.from(new Set(projects.map((project) => project.subject))).sort(),
    [projects]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (subject !== 'all' && project.subject !== subject) return false;
        if (!needle) return true;
        return [project.name, project.subject, project.class]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      );
  }, [projects, query, subject]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; date: Date; items: Project[] }>();

    for (const project of filtered) {
      const date = new Date(project.lastUpdated);
      const key = startOfDay(date).toISOString();
      const existing = map.get(key);
      if (existing) {
        existing.items.push(project);
      } else {
        map.set(key, { label: groupLabel(date), date: startOfDay(date), items: [project] });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filtered]);

  const weekStart = subDays(new Date(), 7);
  const stats = useMemo(
    () => ({
      today: projects.filter((project) => isToday(new Date(project.lastUpdated))).length,
      week: projects.filter(
        (project) => new Date(project.lastUpdated) >= weekStart
      ).length,
      questions: projects.reduce(
        (sum, project) => sum + (project.questionCount ?? 0),
        0
      ),
      subjects: subjects.length,
    }),
    [projects, subjects.length, weekStart]
  );

  const statCards = [
    { label: 'Updated today', value: stats.today, icon: Clock, tone: 'bg-[#e3f2ee] text-[#0f766e]' },
    { label: 'Last 7 days', value: stats.week, icon: CalendarDays, tone: 'bg-[#e8eefb] text-[#3d5f9a]' },
    { label: 'Questions', value: stats.questions, icon: FileQuestion, tone: 'bg-[#f0e9fb] text-[#6d4fa3]' },
    { label: 'Subjects', value: stats.subjects, icon: Sparkles, tone: 'bg-[#fff1dc] text-[#a66b1d]' },
  ];

  return (
    <DashboardShell
      title="Activity"
      eyebrow="Everything that changed in your workspace"
      actions={
        <Link
          href="/projects"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white transition-colors hover:bg-[#115e59]"
        >
          <Folder className="size-4" /> All papers
        </Link>
      }
    >
      <div className="grid gap-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[#d7e5e1] bg-white p-4 shadow-[0_8px_22px_rgba(23,52,58,0.04)]"
            >
              <span className={cn('mb-3 flex size-9 items-center justify-center rounded-xl', stat.tone)}>
                <stat.icon className="size-4" />
              </span>
              <p className="text-2xl font-bold tracking-[-0.03em] text-[#102f35]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#4f6d6f]">{stat.label}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
            <div className="mb-5 flex flex-col gap-3 border-b border-[#e8efed] pb-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#789093]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search activity..."
                  aria-label="Search activity"
                  className="border-[#d1e2de] bg-[#f4f9f7] pl-10 text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-[#789093]" />
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-[150px] border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjects.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isLoaded ? (
              <div className="space-y-4">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex animate-pulse gap-3">
                    <div className="size-10 rounded-xl bg-[#eef4f2]" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-1/2 rounded bg-[#eef4f2]" />
                      <div className="h-2.5 w-1/3 rounded bg-[#eef4f2]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] px-6 py-10 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                  <Activity className="size-6" />
                </span>
                <p className="text-sm font-bold text-[#294b50]">
                  {projects.length === 0 ? 'No activity yet' : 'No activity matches this filter'}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#829697]">
                  {projects.length === 0
                    ? 'Create or edit a paper and every change will show up in this timeline.'
                    : 'Try clearing the search or choosing a different subject.'}
                </p>
                <Button asChild className="mt-4 bg-[#0f766e] text-white hover:bg-[#115e59]">
                  <Link href="/projects">
                    <Folder className="size-4" /> Go to papers
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-7">
                {groups.map((group) => (
                  <section key={group.date.toISOString()}>
                    <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b8385]">
                      <span className="h-px flex-1 bg-[#e8efed]" />
                      {group.label}
                      <span className="h-px flex-1 bg-[#e8efed]" />
                    </h2>
                    <div className="relative space-y-1 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-[#dfeae7]">
                      {group.items.map((project) => {
                        const tone = subjectTone(project.subject);
                        return (
                          <Link
                            key={project.id}
                            href={`/editor?project=${project.id}`}
                            className="group relative flex gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-[#e4ecea] hover:bg-[#f8fbfa]"
                          >
                            <span className={cn('absolute -left-[17px] top-4 size-2.5 rounded-full border-2 border-white ring-1', project.completed ? 'bg-[#4ca783] ring-[#b8e2cf]' : 'bg-[#75bdb0] ring-[#cfe6e1]')} />
                            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', project.completed ? 'bg-[#dff3e8] text-[#247a58]' : 'bg-[#e3f2ee] text-[#0f766e]')}>
                              <FileText className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-[#29484d]">
                                {project.name}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                {project.completed && (
                                  <span className="rounded bg-[#dff3e8] px-1.5 py-0.5 text-[10px] font-bold text-[#247a58]">
                                    Completed
                                  </span>
                                )}
                                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', tone.badge)}>
                                  {project.subject}
                                </span>
                                <span className="rounded bg-[#edf1f0] px-1.5 py-0.5 text-[10px] font-bold text-[#6b8081]">
                                  {formatClassName(project.class)}
                                </span>
                                <span className="text-[10px] font-semibold text-[#5d7778]">
                                  {project.questionCount ?? 0} questions ·{' '}
                                  {formatMarks(project.totalMarks ?? 0)} marks
                                </span>
                              </span>
                              <span className="mt-1 flex items-center gap-1 text-[11px] text-[#829697]">
                                <Clock className="size-3" />
                                Updated{' '}
                                {formatDistanceToNow(new Date(project.lastUpdated), {
                                  addSuffix: true,
                                })}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <h2 className="text-sm font-bold text-[#17343a]">Workspace pulse</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#829697]">
                Activity is generated from the last time each paper was saved. Open a paper to
                continue where you left off.
              </p>
              <div className="mt-4 space-y-2">
                {subjects.slice(0, 6).map((value) => {
                  const count = projects.filter((project) => project.subject === value).length;
                  const tone = subjectTone(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSubject(value)}
                      className="flex w-full items-center justify-between rounded-lg border border-[#e8efed] bg-[#f9fcfb] px-3 py-2 text-left transition-colors hover:border-[#b9dcd4] hover:bg-white"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-[#4f6d6f]">
                        <span className={cn('size-2 rounded-full', tone.dot)} />
                        {value}
                      </span>
                      <span className="text-[11px] font-bold text-[#829697]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#d7e5e1] bg-[#12363c] p-5 text-white shadow-[0_10px_30px_rgba(23,52,58,0.12)]">
              <h2 className="text-sm font-bold">Keep momentum</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#b5ccca]">
                Papers with saved questions are easy to duplicate and adapt for another class or
                exam.
              </p>
              <Link
                href="/projects"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#70c7b6] px-3 py-2 text-xs font-bold text-[#12363c] transition-colors hover:bg-[#8bd6c7]"
              >
                Browse papers <Folder className="size-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

export default ActivityPage;
