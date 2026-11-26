'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { readPaperDefaults } from '@/lib/paper-defaults';
import type { Project } from '@/types';
import type { ProjectGroup } from '@/hooks/use-projects';
import { getProjectGroupPath } from '@/hooks/use-projects';
import { formatClassName, SCHOOL_CLASSES } from '@/lib/school-classes';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Omit<Project, 'id' | 'lastUpdated'>) => Promise<void> | void;
  groups?: ProjectGroup[];
  initialGroupId?: string | null;
}

export function CreateProjectModal({ isOpen, onClose, onCreate, groups = [], initialGroupId = null }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState('ungrouped');

  useEffect(() => {
    if (!isOpen) return;
    const defaults = readPaperDefaults();
    setName('');
    setSubject(defaults.defaultSubject);
    setGrade(defaults.defaultClass);
    setGroupId(initialGroupId ?? 'ungrouped');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, initialGroupId]);

  const handleCreate = async () => {
    if (!name.trim() || !subject || !grade || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        subject,
        class: grade,
        groupId: groupId === 'ungrouped' ? null : groupId,
      });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create the paper. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="border-[#d7e5e1] bg-white text-[#17343a] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[#102f35]">Create a new paper</DialogTitle>
          <DialogDescription className="text-[#6b8385]">
            Give the paper a working name. You can change every detail later in the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#f2cdc7] bg-[#fdf1ef] px-4 py-3 text-sm font-medium text-[#b04a3b]"
            >
              {error}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="project-name" className="text-[13px] font-bold text-[#17343a]">
              Paper name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              maxLength={120}
              autoFocus
              className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]"
              placeholder="e.g., Half-yearly Examination 2026"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="project-subject" className="text-[13px] font-bold text-[#17343a]">
                Subject
              </Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger
                  id="project-subject"
                  className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]"
                >
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                  <SelectItem value="Bangla">Bangla</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Math">Math</SelectItem>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                  <SelectItem value="ICT">ICT</SelectItem>
                  <SelectItem value="Religion">Religion</SelectItem>
                  <SelectItem value="Social Science">Social Science</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-grade" className="text-[13px] font-bold text-[#17343a]">
                Class
              </Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger
                  id="project-grade"
                  className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]"
                >
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                  {SCHOOL_CLASSES.map((schoolClass) => (
                    <SelectItem key={schoolClass.value} value={schoolClass.value}>
                      {formatClassName(schoolClass.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {groups.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="project-group" className="text-[13px] font-bold text-[#17343a]">
                Folder
              </Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger
                  id="project-group"
                  className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]"
                >
                  <SelectValue placeholder="Choose a folder" />
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
            </div>
          )}

          <p className="rounded-xl bg-[#f4f9f7] px-3.5 py-2.5 text-xs leading-relaxed text-[#587174]">
            Defaults for time allowed, marks and school name come from your{' '}
            <a href="/settings" className="font-bold text-[#0f766e] hover:text-[#115e59]">
              paper settings
            </a>
            .
          </p>
        </div>

        <DialogFooter className="border-[#e8efed]">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-[#d1e2de] bg-white text-[#587174] hover:bg-[#f0f8f6] hover:text-[#17343a]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || !subject || !grade || isSubmitting}
            className="bg-[#0f766e] text-white hover:bg-[#115e59]"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? 'Creating…' : 'Create paper'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
