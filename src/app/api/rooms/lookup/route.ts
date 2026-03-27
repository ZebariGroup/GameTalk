import { NextResponse } from 'next/server';
import { lookupRoomByCode } from '@/lib/roomsServer';
import { normalizeRoomCode } from '@/lib/roomCode';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('code') ?? '';
  const code = normalizeRoomCode(raw);
  if (!code) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const result = await lookupRoomByCode(code);
  if (result.error === 'not_found') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (result.error === 'expired') {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  return NextResponse.json({
    code: result.room.code,
    max_members: result.room.max_members,
    expires_at: result.room.expires_at,
  });
}
