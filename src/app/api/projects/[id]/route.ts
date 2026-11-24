import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isPrismaError, toProjectSummary } from '@/lib/project-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
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
  try {
    const { id } = await params;
    const body = await request.json();

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
  try {
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    console.error('Failed to delete project', error);
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 });
  }
}
