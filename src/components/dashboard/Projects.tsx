'use client';

import { useMemo, useState } from 'react';
import { useProjects } from '@/hooks/use-projects';
import type { ProjectGroup } from '@/hooks/use-projects';
import { useRouter } from 'next/navigation';
import { Clock, FileQuestion, Folder, FolderOpen, Loader2, Plus, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ProjectMenu } from '@/components/projects/ProjectMenu';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
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
import { useToast } from '@/hooks/use-toast';
import { formatMarks, subjectTone } from '@/lib/project-utils';
import { cn } from '@/lib/utils';
import { formatClassName } from '@/lib/school-classes';

export function Projects() {
  const {
    projects,
    groups,
    isLoaded,
    addProject,
    createGroup,
    updateProject,
    deleteProject,
    duplicateProject,
  } = useProjects();
  const router = useRouter();
  const { toast } = useToast();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  const childFolders = useMemo(
    () => groups.filter((group) => group.parentId === folderId),
    [groups, folderId]
  );
  const visibleProjects = useMemo(
    () => projects.filter((project) => (project.groupId ?? null) === folderId).slice(0, 12),
    [projects, folderId]
  );
  const folderPath = useMemo(() => {
    const path: ProjectGroup[] = [];
    let current = groups.find((group) => group.id === folderId);
    while (current) {
      path.unshift(current);
      current = current.parentId
        ? groups.find((group) => group.id === current?.parentId)
        : undefined;
    }
    return path;
  }, [groups, folderId]);

  const createFolder = async () => {
    if (!folderName.trim() || folderBusy) return;
    setFolderBusy(true);
    try {
      await createGroup(folderName.trim(), folderId);
      toast({ title: 'Folder created', description: folderName.trim() });
      setFolderDialogOpen(false);
      setFolderName('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not create folder',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setFolderBusy(false);
    }
  };

  const openFolder = (id: string | null) => {
    setFolderId(id);
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/editor?project=${projectId}`);
  };

  if (!isLoaded) {
    return (
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[132px] animate-pulse rounded-xl border border-[#e4ecea] bg-[#f7fbf9]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Papers folder path" className="flex flex-wrap items-center gap-1 text-xs">
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFolderName('');
              setFolderDialogOpen(true);
            }}
            className="h-9 border-[#d1e2de] bg-white px-3 text-xs font-bold text-[#587174] hover:bg-[#f0f8f6]"
          >
            <Folder className="size-3.5" /> New folder
          </Button>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-9 bg-[#0f766e] px-3 text-xs font-bold text-white hover:bg-[#115e59]"
          >
            <Plus className="size-3.5" /> New paper
          </Button>
        </div>
      </div>
      {childFolders.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#829697]">
            Folders in this location
          </p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {childFolders.map((folder) => {
              const papersCount = projects.filter((project) => project.groupId === folder.id).length;
              const nestedCount = groups.filter((group) => group.parentId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => openFolder(folder.id)}
                  className="flex items-center gap-3 rounded-xl border border-[#dce9e5] bg-[#f7fbf9] p-3.5 text-left transition-colors hover:border-[#a9d6ce] hover:bg-white"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                    <FolderOpen className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[#102f35]">
                      {folder.name}
                    </span>
                    <span className="block text-[11px] text-[#829697]">
                      {papersCount} paper{papersCount === 1 ? '' : 's'} · {nestedCount} subfolder{nestedCount === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {visibleProjects.length > 0 && (
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {visibleProjects.map((project) => {
        const tone = subjectTone(project.subject);
        const questionCount = project.questionCount ?? 0;
        const marks = project.totalMarks ?? 0;
        const status = project.completed
          ? { label: 'Completed', className: 'bg-[#dff3e8] text-[#247a58]' }
          : questionCount === 0
            ? { label: 'No questions', className: 'bg-[#fff1dc] text-[#a66b1d]' }
            : { label: 'Saved', className: 'bg-[#eaf7f2] text-[#327d68]' };

        return (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            className={cn(
              'group cursor-pointer rounded-xl border border-[#dce9e5] border-l-4 bg-[#f7fbf9] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_20px_rgba(23,52,58,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa99d]',
              project.completed ? 'border-l-[#4ca783] bg-[#f3fbf7] hover:border-l-[#247a58]' : 'border-l-[#75bdb0] hover:border-[#a9d6ce] hover:border-l-[#0f766e]'
            )}
            onClick={() => handleProjectClick(project.id)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleProjectClick(project.id);
              }
            }}
          >
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <h3 className="truncate text-[13px] font-bold text-[#102f35]">
                {project.name}
              </h3>
              <ProjectMenu
                project={project}
                groups={groups}
                onMove={async (groupId) => {
                  await updateProject(project.id, { groupId });
                  toast({
                    title: 'Paper moved',
                    description: groupId ? 'Moved to the selected group.' : 'Removed from the group.',
                  });
                }}
                onOpen={() => handleProjectClick(project.id)}
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
                onToggleCompletion={async (completed) => {
                  await updateProject(project.id, { completed });
                  toast({
                    title: completed ? 'Paper completed' : 'Paper reopened',
                    description: completed
                      ? `“${project.name}” is marked as finished.`
                      : `“${project.name}” is back in progress.`,
                  });
                }}
                onDelete={async () => {
                  await deleteProject(project.id);
                  toast({
                    title: 'Paper deleted',
                    description: `“${project.name}” was removed.`,
                  });
                }}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-md px-2 py-1 text-[11px] font-bold', tone.badge)}>
                {project.subject}
              </span>
              <span className="rounded-md bg-[#edf1f0] px-2 py-1 text-[11px] font-bold text-[#6b8081]">
                {formatClassName(project.class)}
              </span>
              <span className={cn('rounded-md px-2 py-1 text-[11px] font-bold', status.className)}>
                {status.label}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-[#4f6d6f] ring-1 ring-[#e4ecea]">
                <FileQuestion className="size-3.5 text-[#4a9b8d]" />
                {questionCount} question{questionCount === 1 ? '' : 's'}
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-[#4f6d6f] ring-1 ring-[#e4ecea]">
                <Target className="size-3.5 text-[#c77b22]" />
                {formatMarks(marks)} marks
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#e4ecea] pt-3">
              <div className="flex items-center text-[11px] font-medium text-[#5d7778]">
                <Clock className="mr-1.5 size-3.5 text-[#4a9b8d]" />
                <span>
                  Updated {formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true })}
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#0f766e] opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            </div>
          </div>
        );
      })}
      </div>
      )}
      {visibleProjects.length === 0 && childFolders.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] p-6 text-center text-sm text-[#829697]">
          {folderId
            ? 'This folder is empty. Create a paper or a subfolder here.'
            : 'No papers or folders yet. Create your first paper or folder above.'}
        </div>
      )}
      <Dialog
        open={folderDialogOpen}
        onOpenChange={(open) => !folderBusy && setFolderDialogOpen(open)}
      >
        <DialogContent className="border-[#d7e5e1] bg-white text-[#17343a] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[#102f35]">Create a folder</DialogTitle>
            <DialogDescription className="text-[#6b8385]">
              {folderId
                ? `This folder will be created inside ${folderPath[folderPath.length - 1]?.name ?? 'the current folder'}.`
                : 'Create a folder to organize papers. You can also create folders inside folders.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="dashboard-folder-name" className="text-[13px] font-bold text-[#17343a]">
              Folder name
            </Label>
            <Input
              id="dashboard-folder-name"
              value={folderName}
              maxLength={80}
              autoFocus
              onChange={(event) => setFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createFolder();
                }
              }}
              placeholder="e.g., Half-yearly 2026"
              className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]"
            />
          </div>
          <DialogFooter className="border-[#e8efed]">
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
              disabled={folderBusy}
              className="border-[#d1e2de] bg-white text-[#587174]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void createFolder()}
              disabled={!folderName.trim() || folderBusy}
              className="bg-[#0f766e] text-white hover:bg-[#115e59]"
            >
              {folderBusy && <Loader2 className="size-4 animate-spin" />}
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
          toast({ title: 'Paper created', description: 'Opening the editor…' });
          handleProjectClick(created.id);
        }}
      />
    </div>
  );
}
