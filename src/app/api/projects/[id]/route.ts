import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isPrismaError, toProjectSummary } from '@/lib/project-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      include: { paper: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    return NextResponse.json({
      project: toProjectSummary(project),
      paper: project.paper?.data ?? null,
    });
  } catch (error) {
    console.error('Failed to load project', error);
    return NextResponse.json({ error: 'Failed to load project.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body?.subject === 'string' && body.subject.trim()) data.subject = body.subject.trim();
    if (typeof body?.class === 'string' && body.class.trim()) data.classLevel = body.class.trim();
    if (typeof body?.classLevel === 'string' && body.classLevel.trim()) data.classLevel = body.classLevel.trim();

    const project = await prisma.project.update({ where: { id }, data });
    return NextResponse.json(toProjectSummary(project));
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    console.error('Failed to update project', error);
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await prisma.project.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete project', error);
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 });
  }
}
