import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getPaperStats } from '@/lib/project-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            subject: true,
            classLevel: true,
            paper: { select: { data: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const subjects = new Set<string>();
    const classes = new Set<string>();
    let questionCount = 0;
    let totalMarks = 0;
    let paperCount = 0;

    for (const project of user.projects) {
      subjects.add(project.subject);
      classes.add(project.classLevel);
      const stats = getPaperStats(project.paper?.data);
      questionCount += stats.questionCount;
      totalMarks += stats.totalMarks;
      if (stats.hasPaper) paperCount += 1;
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      hasPassword: Boolean(user.passwordHash),
      stats: {
        projects: user.projects.length,
        papers: paperCount,
        questions: questionCount,
        marks: totalMarks,
        subjects: subjects.size,
        classes: classes.size,
      },
    });
  } catch (error) {
    console.error('Failed to load account', error);
    return NextResponse.json({ error: 'Failed to load account.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const data: { name?: string; image?: string | null } = {};

    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json(
          { error: 'Name must be between 2 and 80 characters.' },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body?.image === null || typeof body?.image === 'string') {
      const image = typeof body.image === 'string' ? body.image.trim() : '';
      if (image && !/^https?:\/\//i.test(image)) {
        return NextResponse.json(
          { error: 'Photo URL must start with http:// or https://.' },
          { status: 400 }
        );
      }
      if (image.length > 1000) {
        return NextResponse.json({ error: 'Photo URL is too long.' }, { status: 400 });
      }
      data.image = image || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update account', error);
    return NextResponse.json({ error: 'Failed to update account.' }, { status: 500 });
  }
}
