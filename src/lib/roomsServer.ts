import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateRoomCode } from '@/lib/generateCode';

export type JoinRoomResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'expired' | 'full' | 'invalid_role' | 'invalid_member' | 'rpc_error' };

export async function createRoomRow(maxMembers: number, expiresAtIso: string): Promise<{ code: string } | null> {
  const sb = getSupabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const { error } = await sb.from('rooms').insert([
      { code: candidate, max_members: maxMembers, expires_at: expiresAtIso },
    ]);
    if (!error) {
      return { code: candidate };
    }
    if (error.code !== '23505') {
      console.error('createRoomRow insert error', error);
      return null;
    }
  }
  return null;
}

/** Case-insensitive match; returns the DB `code` value for FKs and Realtime channel names. */
export async function resolveRoomRow(normalizedCode: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('rooms')
    .select('code, max_members, expires_at')
    .ilike('code', normalizedCode)
    .maybeSingle();

  if (error) {
    console.error('resolveRoomRow', error);
    return null;
  }
  return data;
}

export async function lookupRoomByCode(normalizedCode: string) {
  const data = await resolveRoomRow(normalizedCode);
  if (!data) {
    return { error: 'not_found' as const };
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: 'expired' as const };
  }
  return { room: data };
}

export async function tryJoinRoomRpc(
  code: string,
  memberId: string,
  role: 'kid' | 'observer',
): Promise<JoinRoomResult> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('try_join_room', {
    p_code: code,
    p_member_id: memberId,
    p_role: role,
  });

  if (error) {
    console.error('try_join_room rpc', error);
    return { ok: false, error: 'rpc_error' };
  }

  const row = data as { ok?: boolean; error?: string } | null;
  if (!row || row.ok !== true) {
    const err = row?.error;
    if (err === 'not_found') return { ok: false, error: 'not_found' };
    if (err === 'expired') return { ok: false, error: 'expired' };
    if (err === 'full') return { ok: false, error: 'full' };
    if (err === 'invalid_role') return { ok: false, error: 'invalid_role' };
    if (err === 'invalid_member') return { ok: false, error: 'invalid_member' };
    return { ok: false, error: 'rpc_error' };
  }

  return { ok: true };
}

export async function leaveRoomRpc(code: string, memberId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('leave_room', { p_code: code, p_member_id: memberId });
  if (error) {
    console.error('leave_room rpc', error);
  }
}
