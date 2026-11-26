import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const existing = await prisma.projectGroup.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });

  const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
  if (!name) return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
  if (name.length > 80) {
    return NextResponse.json({ error: 'Folder name must be 80 characters or fewer.' }, { status: 400 });
  }

  const parentId = Object.prototype.hasOwnProperty.call(body ?? {}, 'parentId')
    ? (typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null)
    : existing.parentId;
  if (parentId) {
    const groups = await prisma.projectGroup.findMany({
      where: { userId: session.user.id },
      select: { id: true, parentId: true },
    });
    const byId = new Map(groups.map((group) => [group.id, group]));
    let ancestorId: string | null = parentId;
    while (ancestorId) {
      if (ancestorId === id) {
        return NextResponse.json({ error: 'A folder cannot be moved inside itself.' }, { status: 400 });
      }
      ancestorId = byId.get(ancestorId)?.parentId ?? null;
    }
    if (!byId.has(parentId)) {
      return NextResponse.json({ error: 'Parent folder not found.' }, { status: 404 });
    }
  }

  const duplicate = await prisma.projectGroup.findFirst({
    where: { userId: session.user.id, parentId, name, id: { not: id } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'A folder with that name already exists here.' }, { status: 409 });
  }

  const group = await prisma.projectGroup.update({
    where: { id },
    data: { name, parentId },
  });
  return NextResponse.json({ id: group.id, name: group.name, parentId: group.parentId });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const group = await prisma.projectGroup.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, parentId: true },
  });
  if (!group) return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });

  await prisma.$transaction([
    prisma.projectGroup.updateMany({
      where: { parentId: id, userId: session.user.id },
      data: { parentId: group.parentId },
    }),
    prisma.project.updateMany({
      where: { groupId: id, userId: session.user.id },
      data: { groupId: group.parentId },
    }),
    prisma.projectGroup.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
