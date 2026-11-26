'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pencil,
  FolderInput,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/types';
import type { ProjectGroup } from '@/hooks/use-projects';
import { getProjectGroupPath } from '@/hooks/use-projects';
import { cn } from '@/lib/utils';

interface ProjectMenuProps {
  project: Project;
  onOpen: () => void;
  onRename: (name: string) => Promise<void> | void;
  onDuplicate: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  groups?: ProjectGroup[];
  onMove?: (groupId: string | null) => Promise<void> | void;
  triggerClassName?: string;
}

export function ProjectMenu({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  groups = [],
  onMove,
  triggerClassName,
}: ProjectMenuProps) {
  const { toast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [groupId, setGroupId] = useState(project.groupId ?? 'ungrouped');
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState<'rename' | 'delete' | 'duplicate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (renameOpen) {
      setName(project.name);
      setError(null);
    }
  }, [renameOpen, project.name]);

  useEffect(() => {
    if (moveOpen) {
      setGroupId(project.groupId ?? 'ungrouped');
      setError(null);
    }
  }, [moveOpen, project.groupId]);

  const handleMove = async () => {
    if (!onMove) return;
    setBusy('rename');
    setError(null);
    try {
      await onMove(groupId === 'ungrouped' ? null : groupId);
      setMoveOpen(false);
    } catch (moveError) {
      const message =
        moveError instanceof Error ? moveError.message : 'Could not move the paper.';
      setError(message);
      toast({ variant: 'destructive', title: 'Move failed', description: message });
    } finally {
      setBusy(null);
    }
  };

  const handleRename = async () => {
    const nextName = name.trim();
    if (!nextName || nextName === project.name) {
      setRenameOpen(false);
      return;
    }

    setBusy('rename');
    setError(null);
    try {
      await onRename(nextName);
      setRenameOpen(false);
    } catch (renameError) {
      const message =
        renameError instanceof Error ? renameError.message : 'Could not rename the paper.';
      setError(message);
      toast({ variant: 'destructive', title: 'Rename failed', description: message });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    setError(null);
    try {
      await onDelete();
      setDeleteOpen(false);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Could not delete the paper.';
      setError(message);
      toast({ variant: 'destructive', title: 'Delete failed', description: message });
    } finally {
      setBusy(null);
    }
  };

  const handleDuplicate = async () => {
    setBusy('duplicate');
    setError(null);
    try {
      await onDuplicate();
    } catch (duplicateError) {
      const message =
        duplicateError instanceof Error
          ? duplicateError.message
          : 'Could not duplicate the paper.';
      setError(message);
      toast({ variant: 'destructive', title: 'Duplicate failed', description: message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${project.name}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              'flex size-7 items-center justify-center rounded-lg text-[#8aa0a0] transition-colors hover:bg-[#e8f2ef] hover:text-[#0f766e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa99d]',
              triggerClassName
            )}
          >
            {busy === 'duplicate' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreVertical className="size-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 border-[#d7e5e1] bg-white text-[#17343a]"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            className="cursor-pointer focus:bg-[#f0f8f6]"
            onSelect={onOpen}
          >
            <ExternalLink className="size-4 text-[#587174]" />
            Open in editor
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-[#f0f8f6]"
            onSelect={() => setRenameOpen(true)}
          >
            <Pencil className="size-4 text-[#587174]" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-[#f0f8f6]"
            onSelect={() => void handleDuplicate()}
          >
            <Copy className="size-4 text-[#587174]" />
            Duplicate
          </DropdownMenuItem>
          {onMove && (
            <DropdownMenuItem
              className="cursor-pointer focus:bg-[#f0f8f6]"
              onSelect={() => setMoveOpen(true)}
            >
              <FolderInput className="size-4 text-[#587174]" />
              Move to folder
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-[#e2ecea]" />
          <DropdownMenuItem
            className="cursor-pointer text-[#b04a3b] focus:bg-[#fdf1ef] focus:text-[#b04a3b]"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={(open) => !busy && setRenameOpen(open)}>
        <DialogContent
          className="border-[#d7e5e1] bg-white text-[#17343a] sm:max-w-[420px]"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-[#102f35]">Rename paper</DialogTitle>
            <DialogDescription className="text-[#6b8385]">
              The new name appears on your dashboard and in the project list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 py-2">
            <Label htmlFor={`rename-${project.id}`} className="text-[13px] font-bold text-[#17343a]">
              Paper name
            </Label>
            <Input
              id={`rename-${project.id}`}
              value={name}
              maxLength={120}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleRename();
                }
              }}
              className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] focus-visible:ring-[#5aa99d]"
            />
            {error && (
              <p className="mt-1 text-xs font-medium text-[#b04a3b]" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="border-[#e8efed]">
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={busy === 'rename'}
              className="border-[#d1e2de] bg-white text-[#587174] hover:bg-[#f0f8f6] hover:text-[#17343a]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={!name.trim() || busy === 'rename'}
              className="bg-[#0f766e] text-white hover:bg-[#115e59]"
            >
              {busy === 'rename' && <Loader2 className="size-4 animate-spin" />}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {onMove && (
        <Dialog open={moveOpen} onOpenChange={(open) => !busy && setMoveOpen(open)}>
          <DialogContent
            className="border-[#d7e5e1] bg-white text-[#17343a] sm:max-w-[420px]"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="text-[#102f35]">Move paper to a folder</DialogTitle>
              <DialogDescription className="text-[#6b8385]">
                Organize “{project.name}” with related papers and subfolders.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-2">
              <Label className="text-[13px] font-bold text-[#17343a]">Folder</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                  <SelectItem value="ungrouped">No folder</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {getProjectGroupPath(group.id, groups)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <p className="mt-1 text-xs font-medium text-[#b04a3b]" role="alert">{error}</p>
              )}
            </div>
            <DialogFooter className="border-[#e8efed]">
              <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={!!busy}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleMove()}
                disabled={!!busy}
                className="bg-[#0f766e] text-white hover:bg-[#115e59]"
              >
                Move paper
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
        <AlertDialogContent
          className="border-[#d7e5e1] bg-white text-[#17343a]"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#102f35]">
              Delete “{project.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b8385]">
              The paper and every question saved in it will be permanently removed. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm font-medium text-[#b04a3b]" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy === 'delete'}
              className="border-[#d1e2de] bg-white text-[#587174] hover:bg-[#f0f8f6] hover:text-[#17343a]"
            >
              Keep paper
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={busy === 'delete'}
              className="bg-[#b04a3b] text-white hover:bg-[#9a3f32]"
            >
              {busy === 'delete' && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
