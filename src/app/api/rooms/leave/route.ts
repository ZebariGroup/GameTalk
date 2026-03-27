import { NextResponse } from 'next/server';
import { leaveRoomRpc, resolveRoomRow } from '@/lib/roomsServer';
import { normalizeRoomCode } from '@/lib/roomCode';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const rawCode = typeof obj?.code === 'string' ? obj.code : '';
  const memberId = typeof obj?.memberId === 'string' ? obj.memberId : '';

  const normalized = normalizeRoomCode(rawCode);
  if (!normalized || !memberId.trim()) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const row = await resolveRoomRow(normalized);
  if (!row) {
    return NextResponse.json({ ok: true });
  }

  await leaveRoomRpc(row.code, memberId.trim());
  return NextResponse.json({ ok: true });
}
