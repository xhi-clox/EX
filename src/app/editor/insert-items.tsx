import type { LucideIcon } from 'lucide-react';
import {
  ListOrdered, PenLine, BookMarked, BookOpenText, TextCursorInput, ScrollText,
  Table2, Heading, SeparatorHorizontal, SquareDashed,
} from 'lucide-react';
import type { Question } from './page';

export interface InsertItem {
  type: Question['type'];
  label: string;
  hint: string;
  icon: LucideIcon;
  shortcutId: string;
  group: 'question' | 'structure';
}

export const INSERT_ITEMS: InsertItem[] = [
  { type: 'mcq', label: 'MCQ', hint: 'বহুনির্বাচনী', icon: ListOrdered, shortcutId: 'insert-mcq', group: 'question' },
  { type: 'short', label: 'সংক্ষিপ্ত', hint: 'সংক্ষিপ্ত প্রশ্ন', icon: PenLine, shortcutId: 'insert-short', group: 'question' },
  { type: 'creative', label: 'সৃজনশীল', hint: 'ক খ গ ঘ', icon: BookMarked, shortcutId: 'insert-creative', group: 'question' },
  { type: 'passage', label: 'অনুচ্ছেদ', hint: 'পড়ে উত্তর দাও', icon: BookOpenText, shortcutId: 'insert-passage', group: 'question' },
  { type: 'fill-in-the-blanks', label: 'শূন্যস্থান', hint: 'শূন্যস্থান পূরণ', icon: TextCursorInput, shortcutId: 'insert-fill', group: 'question' },
  { type: 'essay', label: 'রচনামূলক', hint: 'রচনামূলক প্রশ্ন', icon: ScrollText, shortcutId: 'insert-essay', group: 'question' },
  { type: 'table', label: 'সারণী', hint: 'টেবিল', icon: Table2, shortcutId: 'insert-table', group: 'structure' },
  { type: 'section-header', label: 'বিভাগ', hint: 'ক বিভাগ শিরোনাম', icon: Heading, shortcutId: 'insert-section', group: 'structure' },
  { type: 'or', label: 'অথবা', hint: 'বিকল্প বিভাজক', icon: SeparatorHorizontal, shortcutId: 'insert-or', group: 'structure' },
  { type: 'text-box', label: 'টেক্সট বক্স', hint: 'ফ্রেমে লেখা', icon: SquareDashed, shortcutId: 'insert-textbox', group: 'structure' },
];

export const TYPE_LABEL: Record<string, string> = {
  mcq: 'MCQ', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল', passage: 'অনুচ্ছেদ',
  'fill-in-the-blanks': 'শূন্যস্থান', essay: 'রচনামূলক', table: 'সারণী',
  'section-header': 'বিভাগ', or: 'অথবা', 'text-box': 'টেক্সট বক্স', image: 'ছবি',
};
