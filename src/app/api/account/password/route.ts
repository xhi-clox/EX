import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return NextResponse.json(
        { error: 'New password must be between 8 and 72 characters.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            'This account signs in with Google, so it does not have a password to change.',
        },
        { status: 400 }
      );
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to change password', error);
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
}
