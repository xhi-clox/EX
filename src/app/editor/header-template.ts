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
}

export interface HeaderFieldSource {
  schoolName: string;
  examTitle: string;
  subject: string;
  grade: string;
  timeAllowed: string;
  totalMarks: number;
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

const gradeMap: { [key: string]: string } = {
  '9': 'নবম',
  '10': 'দশম',
};

export const subjectLabel = (key: string) => subjectMap[key] || key;
export const gradeLabel = (key: string) => gradeMap[key] || key;

let idCounter = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}${++idCounter}`;

export const defaultHeaderTemplate = (): HeaderRow[] => [
  {
    id: newId('hr'),
    cells: [{ id: newId('hc'), kind: 'school', align: 'center', bold: true, size: 16 }],
  },
  {
    id: newId('hr'),
    cells: [{ id: newId('hc'), kind: 'examTitle', align: 'center', size: 12 }],
  },
  {
    id: newId('hr'),
    cells: [
      { id: newId('hc'), kind: 'subject', align: 'left', size: 12 },
      { id: newId('hc'), kind: 'marks', align: 'right', size: 12 },
    ],
  },
  {
    id: newId('hr'),
    cells: [
      { id: newId('hc'), kind: 'grade', align: 'left', size: 12 },
      { id: newId('hc'), kind: 'time', align: 'right', size: 12 },
    ],
  },
];

export const headerFieldText = (kind: HeaderCellKind, p: HeaderFieldSource): string => {
  switch (kind) {
    case 'school':
      return p.schoolName;
    case 'examTitle':
      return p.examTitle;
    case 'subject':
      return `বিষয়: ${subjectLabel(p.subject)}`;
    case 'grade':
      return `শ্রেণি: ${gradeLabel(p.grade)}`;
    case 'time':
      return `সময়: ${p.timeAllowed}`;
    case 'marks':
      return `পূর্ণমান: ${p.totalMarks}`;
    case 'notes':
      return p.notes ?? '';
    case 'text':
      return '';
  }
};