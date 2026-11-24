// Single source of truth for every editor keyboard shortcut.
// Shortcuts match on the *physical* key (event.code) so they keep working with
// the Bangla keyboard layout (Avro / Bijoy) as well as English.

export type ShiftMode = boolean | 'any';

export interface Combo {
  /** Ctrl on Windows/Linux, ⌘ on Mac */
  mod?: boolean;
  alt?: boolean;
  shift?: ShiftMode;
  /** physical key, e.g. 'KeyK', 'Digit1', 'ArrowUp' */
  code?: string;
  /** produced character, only for symbols such as '?' */
  key?: string;
}

export interface ShortcutDef {
  id: string;
  combo: Combo;
  label: string;
  group: string;
  /** hidden from the cheat-sheet (aliases) */
  hidden?: boolean;
}

export const SHORTCUT_GROUPS = ['সাধারণ', 'প্রশ্ন যোগ করুন', 'প্রশ্ন সম্পাদনা', 'দৃশ্য'] as const;

const G = { general: 'সাধারণ', insert: 'প্রশ্ন যোগ করুন', edit: 'প্রশ্ন সম্পাদনা', view: 'দৃশ্য' };

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'save', combo: { mod: true, code: 'KeyS' }, label: 'সংরক্ষণ করুন', group: G.general },
  { id: 'undo', combo: { mod: true, code: 'KeyZ' }, label: 'পূর্বাবস্থায় ফিরুন', group: G.general },
  { id: 'redo', combo: { mod: true, shift: true, code: 'KeyZ' }, label: 'আবার করুন', group: G.general },
  { id: 'redo-y', combo: { mod: true, code: 'KeyY' }, label: 'আবার করুন', group: G.general, hidden: true },
  { id: 'palette', combo: { mod: true, code: 'KeyK' }, label: 'কমান্ড প্যালেট (সব কিছু খুঁজুন)', group: G.general },
  { id: 'help', combo: { mod: true, code: 'Slash' }, label: 'শর্টকাট তালিকা', group: G.general },
  { id: 'help-q', combo: { key: '?', shift: 'any' }, label: 'শর্টকাট তালিকা', group: G.general, hidden: true },
  { id: 'download', combo: { mod: true, shift: true, code: 'KeyE' }, label: 'PDF ডাউনলোড', group: G.general },

  { id: 'insert-mcq', combo: { alt: true, code: 'Digit1' }, label: 'বহুনির্বাচনী (MCQ)', group: G.insert },
  { id: 'insert-short', combo: { alt: true, code: 'Digit2' }, label: 'সংক্ষিপ্ত প্রশ্ন', group: G.insert },
  { id: 'insert-creative', combo: { alt: true, code: 'Digit3' }, label: 'সৃজনশীল প্রশ্ন', group: G.insert },
  { id: 'insert-passage', combo: { alt: true, code: 'Digit4' }, label: 'অনুচ্ছেদ', group: G.insert },
  { id: 'insert-fill', combo: { alt: true, code: 'Digit5' }, label: 'শূন্যস্থান পূরণ', group: G.insert },
  { id: 'insert-essay', combo: { alt: true, code: 'Digit6' }, label: 'রচনামূলক প্রশ্ন', group: G.insert },
  { id: 'insert-table', combo: { alt: true, code: 'Digit7' }, label: 'সারণী', group: G.insert },
  { id: 'insert-section', combo: { alt: true, code: 'Digit8' }, label: 'বিভাগ শিরোনাম', group: G.insert },
  { id: 'insert-or', combo: { alt: true, code: 'Digit9' }, label: '“অথবা” বিভাজক', group: G.insert },
  { id: 'insert-textbox', combo: { alt: true, code: 'Digit0' }, label: 'টেক্সট বক্স', group: G.insert },
  { id: 'insert-image', combo: { alt: true, code: 'KeyI' }, label: 'ছবি যোগ করুন', group: G.insert },
  { id: 'add-question-menu', combo: { mod: true, alt: true, shift: true, code: 'Enter' }, label: 'প্রশ্ন যোগ মেনু খুলুন', group: G.insert },

  { id: 'add-sub-question', combo: { mod: true, code: 'Enter' }, label: 'বর্তমান প্রশ্নে উপপ্রশ্ন যোগ', group: G.edit },
  { id: 'add-sub-question-alt', combo: { alt: true, code: 'Enter' }, label: 'বর্তমান প্রশ্নে উপপ্রশ্ন যোগ', group: G.edit, hidden: true },
  { id: 'add-option', combo: { alt: true, shift: true, code: 'Enter' }, label: 'MCQ অপশন যোগ', group: G.edit },
  { id: 'duplicate', combo: { mod: true, code: 'KeyD' }, label: 'প্রশ্ন কপি করুন', group: G.edit },
  { id: 'move-up', combo: { alt: true, code: 'ArrowUp' }, label: 'প্রশ্ন উপরে সরান', group: G.edit },
  { id: 'move-down', combo: { alt: true, code: 'ArrowDown' }, label: 'প্রশ্ন নিচে সরান', group: G.edit },
  { id: 'delete', combo: { alt: true, code: 'KeyX' }, label: 'প্রশ্ন মুছুন (Undo করা যাবে)', group: G.edit },

  { id: 'preview', combo: { alt: true, code: 'KeyP' }, label: 'এডিট ↔ প্রিভিউ', group: G.view },
  { id: 'tools', combo: { mod: true, code: 'Backslash' }, label: 'টুল প্যানেল দেখান/লুকান', group: G.view },
  { id: 'theme', combo: { mod: true, shift: true, code: 'KeyL' }, label: 'লাইট / ডার্ক মোড পরিবর্তন', group: G.view },
];

export const getShortcut = (id: string) => SHORTCUTS.find((s) => s.id === id);

export function matchCombo(e: KeyboardEvent, c: Combo): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!!c.mod !== mod) return false;
  if (!!c.alt !== e.altKey) return false;
  if (c.shift !== 'any' && !!c.shift !== e.shiftKey) return false;
  if (c.code && e.code !== c.code) return false;
  if (c.key && e.key !== c.key) return false;
  return !!(c.code || c.key);
}

const CODE_LABEL: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backspace: '⌫', Enter: '↵', Backslash: '\\', Slash: '/', Escape: 'Esc',
};

export function comboKeys(c: Combo, mac: boolean): string[] {
  const out: string[] = [];
  if (c.mod) out.push(mac ? '⌘' : 'Ctrl');
  if (c.alt) out.push(mac ? '⌥' : 'Alt');
  if (c.shift === true) out.push(mac ? '⇧' : 'Shift');
  if (c.code) {
    out.push(
      CODE_LABEL[c.code] ??
        c.code.replace(/^Key/, '').replace(/^Digit/, '')
    );
  } else if (c.key) out.push(c.key);
  return out;
}

export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return !!el?.closest?.(
    'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]'
  );
};
