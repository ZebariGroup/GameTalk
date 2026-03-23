import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  COOKIE_NAME,
  createAdminSessionToken,
  getAdminSessionMaxAgeSec,
} from '@/lib/adminSession';

export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const password =
    typeof body === 'object' &&
    body !== null &&
    'password' in body &&
    typeof (body as { password: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  const a = Buffer.from(password, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  const match =
    a.length === b.length && a.length > 0 && timingSafeEqual(a, b);

  if (!match) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createAdminSessionToken(secret);
  const maxAge = getAdminSessionMaxAgeSec();
  const res = NextResponse.json({ ok: true });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  return res;
}
