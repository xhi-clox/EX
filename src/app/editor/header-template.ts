import { formatClassOrdinal } from '@/lib/school-classes';

export type HeaderCellKind =
  | 'text'
  | 'school'
  | 'examTitle'
  | 'subject'
  | 'grade'
  | 'time'
  | 'marks'
  | 'notes';

export type HeaderAlign = 'left' | 'center' | 'right';

// 'spread'  -> columns stretch edge-to-edge (flex: 1)
// 'center'  -> columns sit next to each other, centered as a group
export type HeaderRowLayout = 'spread' | 'center';

export interface HeaderCell {
  id: string;
  kind: HeaderCellKind;
  text?: string;
  align?: HeaderAlign;
  bold?: boolean;
  underline?: boolean;
  size?: number;
}

export interface HeaderRow {
  id: string;
  cells: HeaderCell[];
  layout?: HeaderRowLayout;
}

export const HEADER_ROW_LAYOUTS: { value: HeaderRowLayout; label: string }[] = [
  { value: 'spread', label: 'ছড়ানো' },
  { value: 'center', label: 'মাঝে' },
];

export const HEADER_LAYOUT_VERSION = 2;

export interface HeaderFieldSource {
  schoolName: string;
  examTitle: string;
  subject: string;
  grade: string;
  timeAllowed: string;
  totalMarks: string | number;
  notes?: string;
}

export const HEADER_SIZES = [
  { label: 'XS', value: 10 },
  { label: 'SM', value: 11 },
  { label: 'Base', value: 12 },
  { label: 'LG', value: 14 },
  { label: 'XL', value: 16 },
  { label: '2XL', value: 20 },
  { label: '3XL', value: 24 },
];

export const HEADER_KINDS: { value: HeaderCellKind; label: string; text: boolean }[] = [
  { value: 'text', label: 'Text', text: true },
  { value: 'school', label: 'School', text: false },
  { value: 'examTitle', label: 'Exam Title', text: false },
  { value: 'subject', label: 'Subject', text: false },
  { value: 'grade', label: 'Class', text: false },
  { value: 'time', label: 'Time', text: false },
  { value: 'marks', label: 'Full Marks', text: false },
  { value: 'notes', label: 'Notes', text: false },
];

const subjectMap: { [key: string]: string } = {
  bangla: 'বাংলা',
  english: 'English',
  math: 'গণিত',
  science: 'বিজ্ঞান',
};

export const subjectLabel = (key: string) => subjectMap[key] || key;
export const gradeLabel = (key: string) => formatClassOrdinal(key);

let idCounter = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}${++idCounter}`;

export const defaultHeaderTemplate = (): HeaderRow[] => [
  {
    id: newId('hr'),
    layout: 'center',
    cells: [{ id: newId('hc'), kind: 'school', align: 'center', bold: true, size: 20 }],
  },
  {
    id: newId('hr'),
    layout: 'center',
    cells: [{ id: newId('hc'), kind: 'examTitle', align: 'center', size: 12 }],
  },
  {
    id: newId('hr'),
    layout: 'center',
    cells: [
      { id: newId('hc'), kind: 'grade', align: 'center', size: 12 },
      { id: newId('hc'), kind: 'subject', align: 'center', size: 12 },
    ],
  },
  {
    id: newId('hr'),
    layout: 'spread',
    cells: [
      { id: newId('hc'), kind: 'time', align: 'left', size: 12 },
      { id: newId('hc'), kind: 'marks', align: 'right', size: 12 },
    ],
  },
];

const legacyDefaultSignature = 'school|examTitle|subject,marks|grade,time';

const headerSignature = (rows: HeaderRow[]) =>
  rows.map((row) => row.cells.map((cell) => cell.kind).join(',')).join('|');

// Upgrades papers saved with the old default layout (subject/marks on one
// spread row, class/time on the next) to the centered reference layout, and
// makes sure every row has an explicit layout. When `resetBrandStyling` is set
// the school name is restored to the plain (non-underlined) brand style.
export const normalizeHeaderTemplate = (
  rows?: HeaderRow[] | null,
  resetBrandStyling = false
): HeaderRow[] => {
  if (!rows || rows.length === 0) return defaultHeaderTemplate();

  if (headerSignature(rows) === legacyDefaultSignature) {
    const [schoolRow, examRow, subjectMarksRow, gradeTimeRow] = rows;
    const schoolCell = schoolRow.cells[0];
    const examCell = examRow.cells[0];
    const subjectCell = subjectMarksRow.cells.find((cell) => cell.kind === 'subject');
    const marksCell = subjectMarksRow.cells.find((cell) => cell.kind === 'marks');
    const gradeCell = gradeTimeRow.cells.find((cell) => cell.kind === 'grade');
    const timeCell = gradeTimeRow.cells.find((cell) => cell.kind === 'time');

    if (schoolCell && examCell && subjectCell && marksCell && gradeCell && timeCell) {
      return [
        {
          id: schoolRow.id,
          layout: 'center',
          cells: [{ ...schoolCell, align: 'center', bold: true, underline: false, size: 20 }],
        },
        {
          id: examRow.id,
          layout: 'center',
          cells: [{ ...examCell, align: 'center', size: 12 }],
        },
        {
          id: newId('hr'),
          layout: 'center',
          cells: [
            { ...gradeCell, align: 'center', size: 12 },
            { ...subjectCell, align: 'center', size: 12 },
          ],
        },
        {
          id: newId('hr'),
          layout: 'spread',
          cells: [
            { ...timeCell, align: 'left', size: 12 },
            { ...marksCell, align: 'right', size: 12 },
          ],
        },
      ];
    }
  }

  const normalized = rows.map((row) => ({ ...row, layout: row.layout ?? 'spread' }));
  if (!resetBrandStyling) return normalized;

  return normalized.map((row) => ({
    ...row,
    cells: row.cells.map((cell) =>
      cell.kind === 'school'
        ? {
            ...cell,
            align: 'center',
            bold: true,
            underline: false,
            size: cell.size && cell.size > 20 ? cell.size : 20,
          }
        : cell
    ),
  }));
};

export const headerFieldText = (kind: HeaderCellKind, p: HeaderFieldSource): string => {
  switch (kind) {
    case 'school':
      return p.schoolName;
    case 'examTitle':
      return p.examTitle;
    case 'subject':
      return `বিষয় : ${subjectLabel(p.subject)}`;
    case 'grade':
      return `শ্রেণি : ${gradeLabel(p.grade)}`;
    case 'time':
      return `সময় : ${p.timeAllowed}`;
    case 'marks':
      return `পূর্ণমান : ${p.totalMarks}`;
    case 'notes':
      return p.notes ?? '';
    case 'text':
      return '';
  }
};