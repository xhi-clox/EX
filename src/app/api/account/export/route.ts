import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getPaperStats } from '@/lib/project-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        projects: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            subject: true,
            classLevel: true,
            createdAt: true,
            updatedAt: true,
            paper: { select: { data: true } },
          },
        },
      },
    });

    if (!user) {
      return Response.json({ error: 'Account not found.' }, { status: 404 });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email },
      projects: user.projects.map((project) => ({
        id: project.id,
        name: project.name,
        subject: project.subject,
        class: project.classLevel,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        stats: getPaperStats(project.paper?.data),
        paper: project.paper?.data ?? null,
      })),
    };

    const filename = `exampro-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to export projects', error);
    return Response.json({ error: 'Failed to export projects.' }, { status: 500 });
  }
}
