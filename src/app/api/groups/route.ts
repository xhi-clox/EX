import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const groups = await prisma.projectGroup.findMany({
    where: { userId: session.user.id },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json(groups.map(({ id, name, parentId }) => ({ id, name, parentId })));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Group name is required.' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'Group name must be 80 characters or fewer.' }, { status: 400 });
  }
  const parentId = typeof body?.parentId === 'string' && body.parentId.trim()
    ? body.parentId.trim()
    : null;

  try {
    if (parentId) {
      const parent = await prisma.projectGroup.findFirst({
        where: { id: parentId, userId: session.user.id },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: 'Parent folder not found.' }, { status: 404 });
    }

    const duplicate = await prisma.projectGroup.findFirst({
      where: { userId: session.user.id, parentId, name },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A folder with that name already exists here.' }, { status: 409 });

    const group = await prisma.projectGroup.create({
      data: { name, userId: session.user.id, parentId },
    });
    return NextResponse.json(
      { id: group.id, name: group.name, parentId: group.parentId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create project group', error);
    return NextResponse.json({ error: 'Could not create the group.' }, { status: 500 });
  }
}
