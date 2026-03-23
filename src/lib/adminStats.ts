import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type RoomRow = {
  code: string;
  max_members: number;
  created_at: string;
  expires_at: string | null;
};

export type RoomAnalytics = {
  totalRooms: number;
  /** Rooms whose expiry is null or in the future (still within the hosted window). */
  openRooms: number;
  createdLast24h: number;
  createdLast7d: number;
  recentRooms: RoomRow[];
  fetchedAt: string;
};

export async function getRoomAnalytics(): Promise<RoomAnalytics> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const d24 = new Date(Date.now() - 86_400_000).toISOString();
  const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [totalRes, openRes, h24Res, h7Res, recentRes] = await Promise.all([
    sb.from('rooms').select('*', { count: 'exact', head: true }),
    sb
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    sb.from('rooms').select('*', { count: 'exact', head: true }).gte('created_at', d24),
    sb.from('rooms').select('*', { count: 'exact', head: true }).gte('created_at', d7),
    sb
      .from('rooms')
      .select('code, max_members, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const err =
    totalRes.error ||
    openRes.error ||
    h24Res.error ||
    h7Res.error ||
    recentRes.error;
  if (err) {
    throw err;
  }

  return {
    totalRooms: totalRes.count ?? 0,
    openRooms: openRes.count ?? 0,
    createdLast24h: h24Res.count ?? 0,
    createdLast7d: h7Res.count ?? 0,
    recentRooms: (recentRes.data ?? []) as RoomRow[],
    fetchedAt: new Date().toISOString(),
  };
}
