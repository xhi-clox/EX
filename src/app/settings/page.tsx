'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BellRing,
  Check,
  Download,
  FileText,
  Loader2,
  MonitorCog,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  User,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useProjects } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_PAPER_DEFAULTS,
  DEFAULT_WORKSPACE_SETTINGS,
  readPaperDefaults,
  readWorkspaceSettings,
  writePaperDefaults,
  writeWorkspaceSettings,
  type PaperDefaults,
  type WorkspaceSettings,
} from '@/lib/paper-defaults';
import { cn } from '@/lib/utils';
import { formatClassName, SCHOOL_CLASSES } from '@/lib/school-classes';

const inputClass =
  'border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]';
const selectClass = 'border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]';

function SettingsPage() {
  const { projects, deleteAllProjects } = useProjects();
  const { toast } = useToast();
  const [defaults, setDefaults] = useState<PaperDefaults>(DEFAULT_PAPER_DEFAULTS);
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(
    DEFAULT_WORKSPACE_SETTINGS
  );
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setDefaults(readPaperDefaults());
    setWorkspace(readWorkspaceSettings());
  }, []);

  const saveDefaults = () => {
    setSavingDefaults(true);
    writePaperDefaults(defaults);
    window.setTimeout(() => {
      setSavingDefaults(false);
      toast({
        title: 'Paper defaults saved',
        description: 'New papers will start with these values.',
      });
    }, 250);
  };

  const saveWorkspace = () => {
    setSavingWorkspace(true);
    writeWorkspaceSettings(workspace);
    window.setTimeout(() => {
      setSavingWorkspace(false);
      toast({
        title: 'Workspace preferences saved',
        description: 'Your editor and notification choices are up to date.',
      });
    }, 250);
  };

  const resetPreferences = () => {
    setDefaults(DEFAULT_PAPER_DEFAULTS);
    setWorkspace(DEFAULT_WORKSPACE_SETTINGS);
    writePaperDefaults(DEFAULT_PAPER_DEFAULTS);
    writeWorkspaceSettings(DEFAULT_WORKSPACE_SETTINGS);
    toast({ title: 'Preferences reset', description: 'Defaults restored on this browser.' });
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/account/export', { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `exampro-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({
        title: 'Export ready',
        description: `${projects.length} paper${projects.length === 1 ? '' : 's'} downloaded as JSON.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'Could not export your papers.',
      });
    } finally {
      setExporting(false);
    }
  };

  const deleteEverything = async () => {
    setDeleting(true);
    try {
      const deleted = await deleteAllProjects();
      setDeleteOpen(false);
      toast({
        title: 'Workspace cleared',
        description: `${deleted} paper${deleted === 1 ? '' : 's'} deleted permanently.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not delete papers',
        description:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const questionCount = projects.reduce(
    (sum, project) => sum + (project.questionCount ?? 0),
    0
  );

  return (
    <DashboardShell
      title="Settings"
      eyebrow="Workspace, editor and data preferences"
      actions={
        <Link
          href="/profile"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d1e2de] bg-white px-4 text-sm font-bold text-[#587174] transition-colors hover:border-[#8bc8bd] hover:bg-[#f0f8f6] hover:text-[#0f766e]"
        >
          <User className="size-4" /> Account profile
        </Link>
      }
    >
      <Tabs defaultValue="paper" className="w-full">
        <TabsList className="mb-5 h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-[#d7e5e1] bg-white p-1.5 shadow-[0_8px_22px_rgba(23,52,58,0.04)] scrollbar-hide sm:w-auto">
          {[
            { value: 'paper', label: 'Paper defaults', icon: FileText },
            { value: 'workspace', label: 'Editor & alerts', icon: MonitorCog },
            { value: 'data', label: 'Data & privacy', icon: ShieldAlert },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 rounded-lg px-3.5 py-2 text-xs font-bold text-[#6b8385] data-[state=active]:bg-[#173f45] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="paper" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-5 flex items-start gap-3 border-b border-[#e8efed] pb-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                  <Settings2 className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#102f35]">New paper defaults</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#6b8385]">
                    These values prefill a blank paper when you create a project. Each paper can
                    still be edited individually.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="school-name" className="text-[13px] font-bold text-[#17343a]">
                    School / institution name
                  </Label>
                  <Input
                    id="school-name"
                    value={defaults.schoolName}
                    maxLength={120}
                    onChange={(event) =>
                      setDefaults((current) => ({ ...current, schoolName: event.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="time-allowed" className="text-[13px] font-bold text-[#17343a]">
                      Time allowed
                    </Label>
                    <Input
                      id="time-allowed"
                      value={defaults.timeAllowed}
                      maxLength={40}
                      onChange={(event) =>
                        setDefaults((current) => ({
                          ...current,
                          timeAllowed: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="e.g., 3 Hours"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="total-marks" className="text-[13px] font-bold text-[#17343a]">
                      Total marks
                    </Label>
                    <Input
                      id="total-marks"
                      value={defaults.totalMarks}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setDefaults((current) => ({
                          ...current,
                          totalMarks: event.target.value.replace(/[^\d]/g, ''),
                        }))
                      }
                      className={inputClass}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-[13px] font-bold text-[#17343a]">Default subject</Label>
                    <Select
                      value={defaults.defaultSubject}
                      onValueChange={(value) =>
                        setDefaults((current) => ({ ...current, defaultSubject: value }))
                      }
                    >
                      <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="Subject" />
                      </SelectTrigger>
                      <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                        {[
                          'Bangla',
                          'English',
                          'Math',
                          'Science',
                          'Physics',
                          'Chemistry',
                          'Biology',
                          'ICT',
                          'Religion',
                          'Social Science',
                        ].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[13px] font-bold text-[#17343a]">Default class</Label>
                    <Select
                      value={defaults.defaultClass}
                      onValueChange={(value) =>
                        setDefaults((current) => ({ ...current, defaultClass: value }))
                      }
                    >
                      <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="Class" />
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
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8efed] pt-4">
                <button
                  type="button"
                  onClick={resetPreferences}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#6b8385] transition-colors hover:text-[#0f766e]"
                >
                  <RotateCcw className="size-3.5" /> Reset all preferences
                </button>
                <Button
                  onClick={saveDefaults}
                  disabled={savingDefaults}
                  className="bg-[#0f766e] text-white hover:bg-[#115e59]"
                >
                  {savingDefaults ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save defaults
                </Button>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
                <h2 className="text-sm font-bold text-[#17343a]">Blank paper preview</h2>
                <p className="mt-1 text-xs text-[#829697]">
                  What a new paper will start with.
                </p>
                <div className="mt-4 rounded-xl border border-[#dce9e5] bg-[#f9fcfb] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#829697]">
                    Institution
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#29484d]">
                    {defaults.schoolName || 'School name'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                      <p className="text-[10px] font-bold uppercase text-[#8aa0a0]">Class</p>
                      <p className="font-bold text-[#29484d]">
                        {defaults.defaultClass ? formatClassName(defaults.defaultClass) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                      <p className="text-[10px] font-bold uppercase text-[#8aa0a0]">Subject</p>
                      <p className="truncate font-bold text-[#29484d]">
                        {defaults.defaultSubject || '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                      <p className="text-[10px] font-bold uppercase text-[#8aa0a0]">Time</p>
                      <p className="font-bold text-[#29484d]">{defaults.timeAllowed || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#e4ecea]">
                      <p className="text-[10px] font-bold uppercase text-[#8aa0a0]">Marks</p>
                      <p className="font-bold text-[#29484d]">{defaults.totalMarks || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d7e5e1] bg-[#12363c] p-5 text-white shadow-[0_10px_30px_rgba(23,52,58,0.12)]">
                <h2 className="text-sm font-bold">Your workspace</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white/10 px-2 py-2.5">
                    <p className="text-lg font-bold">{projects.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#b5ccca]">
                      Papers
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/10 px-2 py-2.5">
                    <p className="text-lg font-bold">{questionCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#b5ccca]">
                      Questions
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="workspace" className="mt-0">
          <section className="max-w-3xl rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
            <div className="mb-5 flex items-start gap-3 border-b border-[#e8efed] pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#e8eefb] text-[#3d5f9a]">
                <MonitorCog className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#102f35]">Editor & alerts</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-[#6b8385]">
                  Preferences are stored in this browser. They apply the next time you open the
                  editor or dashboard.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#e8efed]">
              <div className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-bold text-[#17343a]">Default editor theme</p>
                  <p className="mt-0.5 text-xs text-[#6b8385]">
                    The editor still has a quick toggle in its header.
                  </p>
                </div>
                <Select
                  value={workspace.defaultEditorTheme}
                  onValueChange={(value) =>
                    setWorkspace((current) => ({
                      ...current,
                      defaultEditorTheme: value === 'dark' ? 'dark' : 'light',
                    }))
                  }
                >
                  <SelectTrigger className={cn(selectClass, 'w-[130px]')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-bold text-[#17343a]">Autosave while editing</p>
                  <p className="mt-0.5 text-xs text-[#6b8385]">
                    Saves changes shortly after you stop typing. When off, use the save shortcut.
                  </p>
                </div>
                <Switch
                  checked={workspace.autosave}
                  onCheckedChange={(checked) =>
                    setWorkspace((current) => ({ ...current, autosave: checked }))
                  }
                  aria-label="Autosave while editing"
                  className="data-[state=checked]:bg-[#0f766e] data-[state=unchecked]:bg-[#d1e2de]"
                />
              </div>

              <div className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[#17343a]">
                    <BellRing className="size-4 text-[#c77b22]" /> Paper update alerts
                  </p>
                  <p className="mt-0.5 text-xs text-[#6b8385]">
                    Show the unread badge and recent paper updates in the header bell.
                  </p>
                </div>
                <Switch
                  checked={workspace.notifications}
                  onCheckedChange={(checked) =>
                    setWorkspace((current) => ({ ...current, notifications: checked }))
                  }
                  aria-label="Paper update alerts"
                  className="data-[state=checked]:bg-[#0f766e] data-[state=unchecked]:bg-[#d1e2de]"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#e8efed] pt-4">
              <button
                type="button"
                onClick={resetPreferences}
                className="flex items-center gap-1.5 text-xs font-bold text-[#6b8385] transition-colors hover:text-[#0f766e]"
              >
                <RotateCcw className="size-3.5" /> Reset all preferences
              </button>
              <Button
                onClick={saveWorkspace}
                disabled={savingWorkspace}
                className="bg-[#0f766e] text-white hover:bg-[#115e59]"
              >
                {savingWorkspace ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Save preferences
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="data" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-5 flex items-start gap-3 border-b border-[#e8efed] pb-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#fff1dc] text-[#a66b1d]">
                  <ShieldAlert className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#102f35]">Your data</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#6b8385]">
                    Download a complete JSON backup of your papers, or clear the workspace and
                    start fresh.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-xl border border-[#e4ecea] bg-[#f9fcfb] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#17343a]">Export everything</p>
                    <p className="mt-0.5 text-xs text-[#6b8385]">
                      {projects.length} paper{projects.length === 1 ? '' : 's'} ·{' '}
                      {questionCount} questions
                    </p>
                  </div>
                  <Button
                    onClick={() => void exportData()}
                    disabled={exporting || projects.length === 0}
                    variant="outline"
                    className="border-[#d1e2de] bg-white text-[#0f766e] hover:bg-[#f0f8f6] hover:text-[#115e59]"
                  >
                    {exporting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Download JSON
                  </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-[#f2cdc7] bg-[#fdf7f5] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#8f3f33]">Delete all papers</p>
                    <p className="mt-0.5 text-xs text-[#a86b60]">
                      Permanently removes every paper and question in your workspace.
                    </p>
                  </div>
                  <Button
                    onClick={() => setDeleteOpen(true)}
                    disabled={projects.length === 0}
                    variant="outline"
                    className="border-[#e6b8af] bg-white text-[#b04a3b] hover:bg-[#fdf1ef] hover:text-[#9a3f32]"
                  >
                    <Trash2 className="size-4" /> Delete all
                  </Button>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
                <h2 className="text-sm font-bold text-[#17343a]">Need a copy for another device?</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#829697]">
                  The JSON export includes the full paper document for every project, so it can
                  be imported into another workspace or kept as a backup.
                </p>
                <Link
                  href="/help"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
                >
                  Read the backup guide →
                </Link>
              </div>
              <div className="rounded-2xl border border-[#d7e5e1] bg-[#f9fcfb] p-5">
                <h2 className="text-sm font-bold text-[#17343a]">Privacy</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#6b8385]">
                  Papers are stored in your account and only visible to you. Clearing local
                  preferences does not touch your saved papers.
                </p>
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent className="border-[#d7e5e1] bg-white text-[#17343a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#102f35]">
              Delete all {projects.length} papers?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b8385]">
              This removes every project, paper and question from your account. Export a backup
              first if you might need them later. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="border-[#d1e2de] bg-white text-[#587174] hover:bg-[#f0f8f6] hover:text-[#17343a]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteEverything();
              }}
              disabled={deleting}
              className="bg-[#b04a3b] text-white hover:bg-[#9a3f32]"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

export default SettingsPage;
