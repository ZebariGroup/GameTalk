import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, verifyAdminSessionToken } from '@/lib/adminSession';
import { getRoomAnalytics } from '@/lib/adminStats';
import { AdminDashboard } from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const secret = process.env.ADMIN_SECRET;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !(await verifyAdminSessionToken(token, secret))) {
    redirect('/admin/login');
  }

  let initial = null;
  let loadError: string | null = null;
  try {
    initial = await getRoomAnalytics();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load stats';
  }

  return <AdminDashboard initial={initial} loadError={loadError} />;
}
