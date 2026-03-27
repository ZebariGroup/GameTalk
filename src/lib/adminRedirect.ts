/**
 * Prevent open redirects (e.g. `?next=//evil.com`) after admin login.
 * Only same-app paths under `/admin` are allowed.
 */
export function getSafeAdminRedirectPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith('/')) {
    return '/admin';
  }
  if (nextParam === '/admin' || nextParam.startsWith('/admin/')) {
    return nextParam;
  }
  if (nextParam.startsWith('/admin?')) {
    return nextParam;
  }
  return '/admin';
}
