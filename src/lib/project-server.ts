import { Prisma } from '@prisma/client';
import { getPaperStats } from '@/lib/project-utils';

export type ProjectSummary = {
  id: string;
  name: string;
  class: string;
  subject: string;
  lastUpdated: string;
  completed: boolean;
  questionCount: number;
  totalMarks: number;
  hasPaper: boolean;
  groupId: string | null;
  groupName: string | null;
};

export function toProjectSummary(
  project: {
    id: string;
    name: string;
    classLevel: string;
    subject: string;
    completed?: boolean;
    updatedAt: Date;
  },
  paperData?: unknown
): ProjectSummary {
  const stats = getPaperStats(paperData);

  return {
    id: project.id,
    name: project.name,
    class: project.classLevel,
    subject: project.subject,
    lastUpdated: project.updatedAt.toISOString(),
    completed: project.completed ?? false,
    questionCount: stats.questionCount,
    totalMarks: stats.totalMarks,
    hasPaper: stats.hasPaper,
    groupId: 'groupId' in project ? (project as { groupId?: string | null }).groupId ?? null : null,
    groupName: 'group' in project
      ? ((project as { group?: { name?: string } | null }).group?.name ?? null)
      : null,
  };
}

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
