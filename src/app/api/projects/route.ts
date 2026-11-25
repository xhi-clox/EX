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
    });
    return NextResponse.json(projects.map(toProjectSummary));
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

    if (!name || !subject || !classLevel) {
      return NextResponse.json(
        { error: 'Name, subject and class are required.' },
        { status: 400 }
      );
    }

    // An explicit id is accepted so data from the previous localStorage version
    // can be migrated without changing the paper's project reference.
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : undefined;

    const project = await prisma.project.create({
      data: {
        ...(id ? { id } : {}),
        name,
        subject,
        classLevel,
        userId: session.user.id,
      },
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
