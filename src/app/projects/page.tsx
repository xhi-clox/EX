'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  FileQuestion,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Target,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { ProjectMenu } from '@/components/projects/ProjectMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import { formatMarks, subjectTone } from '@/lib/project-utils';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import type { ProjectGroup } from '@/hooks/use-projects';
import { compareSchoolClasses, formatClassName } from '@/lib/school-classes';

type SortKey = 'updated' | 'name' | 'questions' | 'class';

function ProjectsPage() {
  const { projects, groups, isLoaded, addProject, updateProject, deleteProject, duplicateProject, createGroup, deleteGroup, renameGroup } =
    useProjects();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [subject, setSubject] = useState('all');
  const [classLevel, setClassLevel] = useState('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [createOpen, setCreateOpen] = useState(false);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(searchParams.get('folder'));
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setFolderId(searchParams.get('folder'));
  }, [searchParams]);

  // Deep links from the dashboard/help can open the create dialog with the
  // intended destination already selected (blank, AI or image import).
  useEffect(() => {
    const intent = searchParams.get('intent');
    if (searchParams.get('newGroup') === '1') {
      setGroupName('');
      setGroupDialogOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('newGroup');
      router.replace(params.toString() ? `/projects?${params}` : '/projects');
      return;
    }
    if (intent !== 'blank' && intent !== 'image' && intent !== 'ai') return;

    setNextStep(
      intent === 'image' ? '/editor/image' : intent === 'ai' ? '/ai/suggest' : '/editor'
    );
    setCreateOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('intent');
    const next = params.toString();
    router.replace(next ? `/projects?${next}` : '/projects');
  }, [searchParams, router]);

  const subjects = useMemo(
    () => Array.from(new Set(projects.map((project) => project.subject))).sort(),
    [projects]
  );
  const classes = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.class))).sort(
        compareSchoolClasses
      ),
    [projects]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return projects
      .filter((project) => {
        if (subject !== 'all' && project.subject !== subject) return false;
        if (classLevel !== 'all' && project.class !== classLevel) return false;
        if ((project.groupId ?? null) !== folderId) return false;
        if (!needle) return true;
        return [project.name, project.subject, project.class]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'questions')
          return (b.questionCount ?? 0) - (a.questionCount ?? 0);
        if (sort === 'class')
          return compareSchoolClasses(a.class, b.class) || a.name.localeCompare(b.name);
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });
  }, [projects, query, subject, classLevel, folderId, sort]);

  const childGroups = useMemo(
    () => groups.filter((group) => group.parentId === folderId),
    [groups, folderId]
  );
  const projectCountInFolder = projects.filter((project) => (project.groupId ?? null) === folderId).length;
  const folderPath = useMemo(() => {
    const path: ProjectGroup[] = [];
    let current = groups.find((group) => group.id === folderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? groups.find((group) => group.id === current?.parentId) : undefined;
    }
    return path;
  }, [groups, folderId]);

  const totals = useMemo(
    () => ({
      questions: projects.reduce((sum, project) => sum + (project.questionCount ?? 0), 0),
      marks: projects.reduce((sum, project) => sum + (project.totalMarks ?? 0), 0),
      subjects: subjects.length,
    }),
    [projects, subjects.length]
  );

  const hasFilters =
    query.trim().length > 0 || subject !== 'all' || classLevel !== 'all';

  const clearFilters = () => {
    setQuery('');
    setSubject('all');
    setClassLevel('all');
    router.replace(folderId ? `/projects?folder=${encodeURIComponent(folderId)}` : '/projects');
  };

  const openFolder = (id: string | null) => {
    setFolderId(id);
    router.push(id ? `/projects?folder=${encodeURIComponent(id)}` : '/projects');
  };

  const openProject = (project: Project) => {
    router.push(`/editor?project=${project.id}`);
  };

  const toggleCompletion = async (project: Project, completed: boolean) => {
    await updateProject(project.id, { completed });
    toast({
      title: completed ? 'Paper completed' : 'Paper reopened',
      description: completed
        ? `“${project.name}” is marked as finished.`
        : `“${project.name}” is back in progress.`,
    });
  };

  const statCards = [
    {
      label: 'Papers',
      value: String(projects.length),
      detail: projects.length === 1 ? 'workspace' : 'in your workspace',
      icon: Folder,
      tone: 'bg-[#e3f2ee] text-[#0f766e]',
    },
    {
      label: 'Questions',
      value: String(totals.questions),
      detail: 'across all papers',
      icon: FileQuestion,
      tone: 'bg-[#e8eefb] text-[#3d5f9a]',
    },
    {
      label: 'Subjects',
      value: String(totals.subjects),
      detail: 'represented',
      icon: BookOpen,
      tone: 'bg-[#f0e9fb] text-[#6d4fa3]',
    },
    {
      label: 'Total marks',
      value: formatMarks(totals.marks),
      detail: 'saved in papers',
      icon: Target,
      tone: 'bg-[#fff1dc] text-[#a66b1d]',
    },
  ];

  return (
    <DashboardShell
      title="Projects"
      eyebrow="Your paper library"
      actions={
        <Button
          onClick={() => {
            setNextStep(null);
            setCreateOpen(true);
          }}
          className="h-10 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white hover:bg-[#115e59]"
        >
          <Plus className="size-4" /> New paper
        </Button>
      }
    >
      <div className="grid gap-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[#d7e5e1] bg-white p-4 shadow-[0_8px_22px_rgba(23,52,58,0.04)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={cn('flex size-9 items-center justify-center rounded-xl', stat.tone)}>
                  <stat.icon className="size-4" />
                </span>
              </div>
              <p className="text-2xl font-bold tracking-[-0.03em] text-[#102f35]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#4f6d6f]">{stat.label}</p>
              <p className="text-[11px] text-[#829697]">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#d7e5e1] bg-white shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#e8efed] p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#789093]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by paper name, subject or class..."
                aria-label="Search papers"
                className="border-[#d1e2de] bg-[#f4f9f7] pl-10 text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-[132px] border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
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

              <Select value={classLevel} onValueChange={setClassLevel}>
                <SelectTrigger className="w-[122px] border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {formatClassName(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setGroupName('');
                  setGroupDialogOpen(true);
                }}
                className="h-10 border-[#d1e2de] bg-white text-xs font-bold text-[#587174] hover:bg-[#f0f8f6]"
              >
                <Folder className="size-3.5" /> New folder
              </Button>

              <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                <SelectTrigger className="w-[168px] border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="questions">Most questions</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-xl border border-[#d1e2de] bg-[#f4f9f7] p-1">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg transition-colors',
                    view === 'grid'
                      ? 'bg-white text-[#0f766e] shadow-sm'
                      : 'text-[#789093] hover:text-[#17343a]'
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg transition-colors',
                    view === 'list'
                      ? 'bg-white text-[#0f766e] shadow-sm'
                      : 'text-[#789093] hover:text-[#17343a]'
                  )}
                >
                  <List className="size-4" />
                </button>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-[#6b8385] transition-colors hover:bg-[#f0f8f6] hover:text-[#0f766e]"
                >
                  <X className="size-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-bold text-[#4f6d6f]">
                {isLoaded
                  ? `${filtered.length} of ${projectCountInFolder} paper${projectCountInFolder === 1 ? '' : 's'}`
                  : 'Loading papers…'}
              </p>
              {isLoaded && projects.length > 0 && (
                <p className="text-[11px] text-[#829697]">
                  Tip: open a folder to see its papers and subfolders.
                </p>
              )}
            </div>

            {isLoaded && (
              <nav aria-label="Folder path" className="mb-4 flex flex-wrap items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => openFolder(null)}
                  className={cn(
                    'rounded-md px-2 py-1 font-bold hover:bg-[#f0f8f6] hover:text-[#0f766e]',
                    folderId ? 'text-[#6b8385]' : 'text-[#17343a]'
                  )}
                >
                  All papers
                </button>
                {folderPath.map((folder, index) => (
                  <span key={folder.id} className="flex items-center gap-1">
                    <span className="text-[#9aacab]">/</span>
                    <button
                      type="button"
                      onClick={() => openFolder(folder.id)}
                      className={cn(
                        'rounded-md px-2 py-1 font-bold hover:bg-[#f0f8f6] hover:text-[#0f766e]',
                        index === folderPath.length - 1 ? 'text-[#17343a]' : 'text-[#6b8385]'
                      )}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}

            {!isLoaded ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className="h-[170px] animate-pulse rounded-xl border border-[#e4ecea] bg-[#f7fbf9]"
                  />
                ))}
              </div>
            ) : projects.length === 0 && groups.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] px-6 py-10 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                  <Folder className="size-6" />
                </span>
                <p className="text-base font-bold text-[#294b50]">Your library is empty</p>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-[#829697]">
                  Create a blank paper, generate one from a topic, or import a photo of an
                  existing paper.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    onClick={() => {
                      setNextStep(null);
                      setCreateOpen(true);
                    }}
                    className="bg-[#0f766e] text-white hover:bg-[#115e59]"
                  >
                    <Plus className="size-4" /> Create paper
                  </Button>
                  <Link
                    href="/help"
                    className="rounded-md px-3 py-2 text-sm font-bold text-[#0f766e] hover:bg-[#e8f2ef]"
                  >
                    See how it works
                  </Link>
                </div>
              </div>
            ) : filtered.length === 0 && childGroups.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] px-6 py-8 text-center">
                <p className="text-sm font-bold text-[#294b50]">No papers match these filters</p>
                <p className="mt-1 text-xs text-[#829697]">
                  Try a different search term, subject or class.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
                >
                  Clear all filters
                </button>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {childGroups.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => openFolder(folder.id)}
                    className="flex min-h-[112px] flex-col justify-between rounded-xl border border-[#dce9e5] bg-[#f7fbf9] p-4 text-left transition-colors hover:border-[#a9d6ce] hover:bg-white hover:shadow-[0_8px_20px_rgba(23,52,58,0.07)]"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                      <Folder className="size-5" />
                    </span>
                    <span className="mt-3 block min-w-0">
                      <span className="block truncate text-sm font-bold text-[#17343a]">{folder.name}</span>
                      <span className="text-[11px] text-[#829697]">Open folder</span>
                    </span>
                  </button>
                ))}
                {filtered.map((project) => {
                  const tone = subjectTone(project.subject);
                  const questions = project.questionCount ?? 0;
                  return (
                    <article
                      key={project.id}
                      className={cn(
                        'group flex cursor-pointer flex-col rounded-xl border border-[#dce9e5] border-l-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(23,52,58,0.08)]',
                        project.completed
                          ? 'border-l-[#4ca783] bg-[#f3fbf7] hover:border-l-[#247a58] hover:bg-white'
                          : 'border-l-[#75bdb0] bg-[#f9fcfb] hover:border-[#a9d6ce] hover:border-l-[#0f766e] hover:bg-white'
                      )}
                      onClick={() => openProject(project)}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#102f35]">
                            {project.name}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-[#829697]">
                            {questions === 0 ? 'Not started' : `${questions} questions`}
                          </p>
                        </div>
                        <ProjectMenu
                          project={project}
                          onOpen={() => openProject(project)}
                          onRename={async (name) => {
                            await updateProject(project.id, { name });
                            toast({ title: 'Paper renamed', description: name });
                          }}
                          onDuplicate={async () => {
                            await duplicateProject(project.id);
                            toast({
                              title: 'Paper duplicated',
                              description: `A copy of “${project.name}” is ready.`,
                            });
                          }}
                          onToggleCompletion={(completed) => toggleCompletion(project, completed)}
                          onDelete={async () => {
                            await deleteProject(project.id);
                            toast({
                              title: 'Paper deleted',
                              description: `“${project.name}” was removed.`,
                            });
                          }}
                          groups={groups}
                          onMove={async (groupId) => {
                            await updateProject(project.id, { groupId });
                            toast({
                              title: 'Paper moved',
                              description: groupId
                                ? `Moved to ${groups.find((group) => group.id === groupId)?.name ?? 'group'}.`
                                : 'Removed from the group.',
                            });
                          }}
                        />
                      </div>

                      <div className="mb-4 flex flex-wrap gap-1.5">
                        <span className={cn('rounded-md px-2 py-1 text-[11px] font-bold', tone.badge)}>
                          {project.subject}
                        </span>
                        <span className="rounded-md bg-[#edf1f0] px-2 py-1 text-[11px] font-bold text-[#6b8081]">
                          {formatClassName(project.class)}
                        </span>
                        <span
                          className={cn(
                            'rounded-md px-2 py-1 text-[11px] font-bold',
                            project.completed
                              ? 'bg-[#dff3e8] text-[#247a58]'
                              : project.hasPaper
                                ? 'bg-[#eaf7f2] text-[#327d68]'
                                : 'bg-[#fff1dc] text-[#a66b1d]'
                          )}
                        >
                          {project.completed ? 'Completed' : project.hasPaper ? 'Saved' : 'Draft'}
                        </span>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8aa0a0]">
                            Questions
                          </p>
                          <p className="text-sm font-bold text-[#294b50]">{questions}</p>
                        </div>
                        <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8aa0a0]">
                            Marks
                          </p>
                          <p className="text-sm font-bold text-[#294b50]">
                            {formatMarks(project.totalMarks ?? 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-[#e4ecea] pt-3 text-[11px]">
                        <span className="text-[#6b8385]">
                          Updated{' '}
                          {formatDistanceToNow(new Date(project.lastUpdated), {
                            addSuffix: true,
                          })}
                        </span>
                        <span className="font-bold text-[#0f766e] opacity-0 transition-opacity group-hover:opacity-100">
                          Open →
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e4ecea]">
                <div className="hidden grid-cols-[minmax(0,1fr)_110px_80px_90px_120px_44px] items-center gap-3 border-b border-[#e4ecea] bg-[#f7faf9] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8aa0a0] md:grid">
                  <span>Paper</span>
                  <span>Subject</span>
                  <span>Class</span>
                  <span>Questions</span>
                  <span>Updated</span>
                  <span className="sr-only">Actions</span>
                </div>
                {childGroups.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => openFolder(folder.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_44px] items-center gap-3 border-b border-[#edf2f0] bg-[#f9fcfb] px-4 py-3 text-left hover:bg-[#f0f8f6] md:grid-cols-[minmax(0,1fr)_110px_80px_90px_120px_44px]"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#29484d]">
                      <Folder className="size-4 shrink-0 text-[#0f766e]" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="hidden text-xs text-[#829697] md:block">Folder</span>
                    <span className="hidden text-xs text-[#829697] md:block">
                      {groups.filter((group) => group.parentId === folder.id).length} subfolders
                    </span>
                    <span className="hidden text-xs font-bold text-[#0f766e] md:block">Open</span>
                    <span className="hidden md:block" />
                    <span className="md:hidden" />
                  </button>
                ))}
                {filtered.map((project) => {
                  const tone = subjectTone(project.subject);
                  return (
                    <div
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openProject(project)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openProject(project);
                        }
                      }}
                      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_44px] items-center gap-3 border-b border-[#edf2f0] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f7faf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5aa99d] md:grid-cols-[minmax(0,1fr)_110px_80px_90px_120px_44px]"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-[#29484d]">
                          <span className="truncate">{project.name}</span>
                          {project.completed && (
                            <span className="shrink-0 rounded-md bg-[#dff3e8] px-1.5 py-0.5 text-[10px] font-bold text-[#247a58]">
                              Completed
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#829697] md:hidden">
                          {project.subject} · {formatClassName(project.class)} · {project.questionCount ?? 0}{' '}
                          questions
                        </p>
                      </div>
                      <span className={cn('hidden w-fit rounded-md px-2 py-1 text-[11px] font-bold md:block', tone.badge)}>
                        {project.subject}
                      </span>
                      <span className="hidden text-xs font-semibold text-[#587174] md:block">
                        {formatClassName(project.class)}
                      </span>
                      <span className="hidden text-xs font-semibold text-[#587174] md:block">
                        {project.questionCount ?? 0}
                      </span>
                      <span className="hidden text-xs text-[#829697] md:block">
                        {formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true })}
                      </span>
                      <ProjectMenu
                        project={project}
                        groups={groups}
                        onMove={async (groupId) => {
                          await updateProject(project.id, { groupId });
                          toast({
                            title: 'Paper moved',
                            description: groupId
                              ? `Moved to ${groups.find((group) => group.id === groupId)?.name ?? 'folder'}.`
                              : 'Moved out of its folder.',
                          });
                        }}
                        onOpen={() => openProject(project)}
                        onRename={async (name) => {
                          await updateProject(project.id, { name });
                          toast({ title: 'Paper renamed', description: name });
                        }}
                        onDuplicate={async () => {
                          await duplicateProject(project.id);
                          toast({
                            title: 'Paper duplicated',
                            description: `A copy of “${project.name}” is ready.`,
                          });
                        }}
                        onToggleCompletion={(completed) => toggleCompletion(project, completed)}
                        onDelete={async () => {
                          await deleteProject(project.id);
                          toast({
                            title: 'Paper deleted',
                            description: `“${project.name}” was removed.`,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={groupDialogOpen} onOpenChange={(open) => !groupBusy && setGroupDialogOpen(open)}>
        <DialogContent className="border-[#d7e5e1] bg-white text-[#17343a] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[#102f35]">Create a folder</DialogTitle>
            <DialogDescription className="text-[#6b8385]">
              {folderId
                ? `This folder will be created inside ${groups.find((group) => group.id === folderId)?.name ?? 'the current folder'}.`
                : 'Create a folder to organize related papers. You can create folders inside folders.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="group-name" className="text-[13px] font-bold text-[#17343a]">Folder name</Label>
            <Input
              id="group-name"
              value={groupName}
              maxLength={80}
              autoFocus
              onChange={(event) => setGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void (async () => {
                    if (!groupName.trim() || groupBusy) return;
                    setGroupBusy(true);
                    try {
                      await createGroup(groupName.trim(), folderId);
                      setGroupDialogOpen(false);
                      toast({ title: 'Group created', description: groupName.trim() });
                    } catch (error) {
                      toast({ variant: 'destructive', title: 'Could not create group', description: error instanceof Error ? error.message : 'Please try again.' });
                    } finally {
                      setGroupBusy(false);
                    }
                  })();
                }
              }}
              placeholder="e.g., Half-yearly 2026"
              className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]"
            />
          </div>
          <DialogFooter className="border-[#e8efed]">
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)} disabled={groupBusy}>Cancel</Button>
            <Button
              disabled={!groupName.trim() || groupBusy}
              onClick={async () => {
                setGroupBusy(true);
                try {
                  await createGroup(groupName.trim(), folderId);
                  setGroupDialogOpen(false);
                  toast({ title: 'Group created', description: groupName.trim() });
                } catch (error) {
                  toast({ variant: 'destructive', title: 'Could not create group', description: error instanceof Error ? error.message : 'Please try again.' });
                } finally {
                  setGroupBusy(false);
                }
              }}
              className="bg-[#0f766e] text-white hover:bg-[#115e59]"
            >
              {groupBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        groups={groups}
        initialGroupId={folderId}
        onCreate={async (project) => {
          const created = await addProject(project);
          setCreateOpen(false);
          toast({
            title: 'Paper created',
            description: nextStep ? 'Opening the next step…' : 'Opening the editor…',
          });
          router.push(`${nextStep ?? '/editor'}?project=${created.id}`);
        }}
      />
    </DashboardShell>
  );
}

export default function ProjectsRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f7f6]" />}>
      <ProjectsPage />
    </Suspense>
  );
}
