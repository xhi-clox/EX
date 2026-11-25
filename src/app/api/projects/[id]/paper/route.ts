import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isPrismaError } from '@/lib/project-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const paper = await request.json();

    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) {
      return NextResponse.json({ error: 'Invalid paper payload.' }, { status: 400 });
    }

    const existing = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const payload = paper as Record<string, unknown>;
    const name =
      typeof payload.examTitle === 'string' && payload.examTitle.trim()
        ? payload.examTitle
        : existing.name;
    const subject =
      typeof payload.subject === 'string' && payload.subject.trim()
        ? payload.subject
        : existing.subject;
    const classLevel =
      typeof payload.grade === 'string' && payload.grade.trim()
        ? payload.grade
        : existing.classLevel;

    await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: { name, subject, classLevel },
      }),
      prisma.paper.upsert({
        where: { projectId: id },
        create: { projectId: id, data: paper as Prisma.InputJsonValue },
        update: { data: paper as Prisma.InputJsonValue },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaError(error, 'P2003') || isPrismaError(error, 'P2025')) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    console.error('Failed to save paper', error);
    return NextResponse.json({ error: 'Failed to save paper.' }, { status: 500 });
  }
}
