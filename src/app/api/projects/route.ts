import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isPrismaError, toProjectSummary } from '@/lib/project-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        paper: { select: { data: true } },
        group: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(
      projects.map((project) => toProjectSummary(project, project.paper?.data))
    );
  } catch (error) {
    console.error('Failed to list projects', error);
    return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();
    const subject = String(body?.subject ?? '').trim();
    const classLevel = String(body?.class ?? body?.classLevel ?? '').trim();
    const groupId = typeof body?.groupId === 'string' && body.groupId.trim()
      ? body.groupId.trim()
      : null;

    if (!name || !subject || !classLevel) {
      return NextResponse.json(
        { error: 'Name, subject and class are required.' },
        { status: 400 }
      );
    }

    // An explicit id is accepted so data from the previous localStorage version
    // can be migrated without changing the paper's project reference.
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : undefined;

    if (groupId) {
      const ownedGroup = await prisma.projectGroup.findFirst({
        where: { id: groupId, userId: session.user.id },
        select: { id: true },
      });
      if (!ownedGroup) {
        return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
      }
    }

    const project = await prisma.project.create({
      data: {
        ...(id ? { id } : {}),
        name,
        subject,
        classLevel,
        userId: session.user.id,
        ...(groupId ? { groupId } : {}),
      },
      include: { group: { select: { id: true, name: true } } },
    });

    return NextResponse.json(toProjectSummary(project), { status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      return NextResponse.json({ error: 'Project already exists.' }, { status: 409 });
    }
    console.error('Failed to create project', error);
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
  }
}

/** Removes every project (and its paper) owned by the signed-in user. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await prisma.project.deleteMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    console.error('Failed to delete projects', error);
    return NextResponse.json({ error: 'Failed to delete projects.' }, { status: 500 });
  }
}
