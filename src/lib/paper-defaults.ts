/**
 * Per-browser defaults for newly created papers.
 *
 * These are deliberately stored in localStorage: they are workspace
 * preferences that only affect the device the teacher is working on, and
 * they must be available synchronously when the editor creates a blank paper.
 */

export interface PaperDefaults {
  schoolName: string;
  timeAllowed: string;
  totalMarks: string;
  defaultClass: string;
  defaultSubject: string;
}

export interface WorkspaceSettings {
  defaultEditorTheme: 'light' | 'dark';
  autosave: boolean;
  notifications: boolean;
}

export const PAPER_DEFAULTS_KEY = 'examProPaperDefaults';
export const WORKSPACE_SETTINGS_KEY = 'examProWorkspaceSettings';
export const EDITOR_THEME_KEY = 'editor-theme';
export const EDITOR_AUTOSAVE_KEY = 'editor-autosave';
export const NOTIFICATIONS_KEY = 'examProNotifications';

export const DEFAULT_PAPER_DEFAULTS: PaperDefaults = {
  schoolName: 'ABC GOVT. School and College',
  timeAllowed: '3 Hours',
  totalMarks: '100',
  defaultClass: '9',
  defaultSubject: 'Bangla',
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultEditorTheme: 'light',
  autosave: true,
  notifications: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readPaperDefaults(): PaperDefaults {
  if (typeof window === 'undefined') return DEFAULT_PAPER_DEFAULTS;

  try {
    const raw = window.localStorage.getItem(PAPER_DEFAULTS_KEY);
    if (!raw) return DEFAULT_PAPER_DEFAULTS;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_PAPER_DEFAULTS;

    return {
      schoolName:
        typeof parsed.schoolName === 'string' && parsed.schoolName.trim()
          ? parsed.schoolName
          : DEFAULT_PAPER_DEFAULTS.schoolName,
      timeAllowed:
        typeof parsed.timeAllowed === 'string' && parsed.timeAllowed.trim()
          ? parsed.timeAllowed
          : DEFAULT_PAPER_DEFAULTS.timeAllowed,
      totalMarks:
        typeof parsed.totalMarks === 'string' && parsed.totalMarks.trim()
          ? parsed.totalMarks
          : String(DEFAULT_PAPER_DEFAULTS.totalMarks),
      defaultClass:
        typeof parsed.defaultClass === 'string' && parsed.defaultClass.trim()
          ? parsed.defaultClass
          : DEFAULT_PAPER_DEFAULTS.defaultClass,
      defaultSubject:
        typeof parsed.defaultSubject === 'string' && parsed.defaultSubject.trim()
          ? parsed.defaultSubject
          : DEFAULT_PAPER_DEFAULTS.defaultSubject,
    };
  } catch {
    return DEFAULT_PAPER_DEFAULTS;
  }
}

export function writePaperDefaults(defaults: PaperDefaults): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PAPER_DEFAULTS_KEY, JSON.stringify(defaults));
}

export function readWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_SETTINGS;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const base = isRecord(parsed) ? parsed : {};

    return {
      defaultEditorTheme:
        base.defaultEditorTheme === 'dark' || base.defaultEditorTheme === 'light'
          ? base.defaultEditorTheme
          : DEFAULT_WORKSPACE_SETTINGS.defaultEditorTheme,
      autosave:
        typeof base.autosave === 'boolean'
          ? base.autosave
          : DEFAULT_WORKSPACE_SETTINGS.autosave,
      notifications:
        typeof base.notifications === 'boolean'
          ? base.notifications
          : DEFAULT_WORKSPACE_SETTINGS.notifications,
    };
  } catch {
    return DEFAULT_WORKSPACE_SETTINGS;
  }
}

export function writeWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(settings));
  // Keep the editor's existing keys in sync so the next editor session picks
  // up the preference without needing an extra lookup.
  window.localStorage.setItem(EDITOR_THEME_KEY, settings.defaultEditorTheme);
  window.localStorage.setItem(EDITOR_AUTOSAVE_KEY, settings.autosave ? '1' : '0');
}
