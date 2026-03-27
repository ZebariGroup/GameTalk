import { NextResponse } from 'next/server';
import { createRoomRow } from '@/lib/roomsServer';

const MAX_MEMBERS_MIN = 2;
const MAX_MEMBERS_MAX = 6;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const maxMembersRaw =
    typeof body === 'object' &&
    body !== null &&
    'maxMembers' in body &&
    typeof (body as { maxMembers: unknown }).maxMembers === 'number'
      ? (body as { maxMembers: number }).maxMembers
      : NaN;

  if (
    !Number.isInteger(maxMembersRaw) ||
    maxMembersRaw < MAX_MEMBERS_MIN ||
    maxMembersRaw > MAX_MEMBERS_MAX
  ) {
    return NextResponse.json(
      { error: `maxMembers must be an integer between ${MAX_MEMBERS_MIN} and ${MAX_MEMBERS_MAX}` },
      { status: 400 },
    );
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const created = await createRoomRow(maxMembersRaw, expiresAt.toISOString());
  if (!created) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }

  return NextResponse.json({ code: created.code });
}
