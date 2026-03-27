import { NextResponse } from 'next/server';
import { resolveRoomRow, tryJoinRoomRpc } from '@/lib/roomsServer';
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
  const role = obj?.role === 'observer' ? 'observer' : obj?.role === 'kid' ? 'kid' : null;

  const normalized = normalizeRoomCode(rawCode);
  if (!normalized || !memberId.trim() || !role) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const row = await resolveRoomRow(normalized);
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }

  const result = await tryJoinRoomRpc(row.code, memberId.trim(), role);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      code: row.code,
      max_members: row.max_members,
      expires_at: row.expires_at,
    });
  }

  const status =
    result.error === 'not_found'
      ? 404
      : result.error === 'expired'
        ? 410
        : result.error === 'full'
          ? 403
          : 500;

  return NextResponse.json({ ok: false, error: result.error }, { status });
}
