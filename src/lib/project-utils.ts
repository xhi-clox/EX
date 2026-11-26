/**
 * Helpers shared by the API routes and the client-side dashboard.
 * Kept free of Prisma imports so it can safely run in the browser too.
 */

const QUESTION_TYPES = new Set([
  'passage',
  'fill-in-the-blanks',
  'short',
  'mcq',
  'essay',
  'table',
  'creative',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Counts every actual question, including nested sub-questions. */
export function countQuestions(questions: unknown): number {
  let count = 0;

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    if (typeof node.type === 'string' && QUESTION_TYPES.has(node.type)) {
      count += 1;
    }

    if (Array.isArray(node.subQuestions)) walk(node.subQuestions);
  };

  walk(questions);
  return count;
}

/** Sums question marks; creative marks are assigned to their sub-questions. */
export function sumQuestionMarks(questions: unknown): number {
  let marks = 0;

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    if (typeof node.type === 'string' && QUESTION_TYPES.has(node.type) && node.type !== 'creative') {
      const value = asNumber(node.marks);
      if (value !== null) marks += value;
    }

    if (Array.isArray(node.subQuestions)) walk(node.subQuestions);
  };

  walk(questions);
  return Math.round(marks);
}

export interface PaperStats {
  questionCount: number;
  totalMarks: number;
  hasPaper: boolean;
}

export function getPaperStats(paper: unknown): PaperStats {
  if (!isRecord(paper)) {
    return { questionCount: 0, totalMarks: 0, hasPaper: false };
  }

  const questions = paper.questions;
  const computedMarks = sumQuestionMarks(questions);
  const paperMarks = asNumber(paper.totalMarks);

  return {
    questionCount: countQuestions(questions),
    totalMarks: computedMarks > 0 ? computedMarks : paperMarks ?? 0,
    hasPaper: true,
  };
}

/** A tiny, deterministic colour token for a subject badge. */
export function subjectTone(subject: string): {
  badge: string;
  dot: string;
  bar: string;
} {
  const palettes = [
    { badge: 'bg-[#e3f2ee] text-[#397d73]', dot: 'bg-[#4ca783]', bar: 'bg-[#75bdb0]' },
    { badge: 'bg-[#e8eefb] text-[#3d5f9a]', dot: 'bg-[#5f83c7]', bar: 'bg-[#8aa6d8]' },
    { badge: 'bg-[#fbe8e4] text-[#a65346]', dot: 'bg-[#d97766]', bar: 'bg-[#e5a294]' },
    { badge: 'bg-[#fff1dc] text-[#a66b1d]', dot: 'bg-[#d9912e]', bar: 'bg-[#e8b56f]' },
    { badge: 'bg-[#f0e9fb] text-[#6d4fa3]', dot: 'bg-[#9270c8]', bar: 'bg-[#b7a0db]' },
  ];

  let hash = 0;
  for (let index = 0; index < subject.length; index += 1) {
    hash = (hash * 31 + subject.charCodeAt(index)) >>> 0;
  }

  return palettes[hash % palettes.length];
}

export function formatMarks(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
