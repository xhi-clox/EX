import { Prisma } from '@prisma/client';

export type ProjectSummary = {
  id: string;
  name: string;
  class: string;
  subject: string;
  lastUpdated: string;
};

export function toProjectSummary(project: {
  id: string;
  name: string;
  classLevel: string;
  subject: string;
  updatedAt: Date;
}): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    class: project.classLevel,
    subject: project.subject,
    lastUpdated: project.updatedAt.toISOString(),
  };
}

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
