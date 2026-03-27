import { describe, expect, it } from 'vitest';
import { getSafeAdminRedirectPath } from '@/lib/adminRedirect';

describe('getSafeAdminRedirectPath', () => {
  it('allows /admin and subpaths', () => {
    expect(getSafeAdminRedirectPath('/admin')).toBe('/admin');
    expect(getSafeAdminRedirectPath('/admin/')).toBe('/admin/');
    expect(getSafeAdminRedirectPath('/admin?tab=stats')).toBe('/admin?tab=stats');
  });

  it('blocks protocol-relative and other origins', () => {
    expect(getSafeAdminRedirectPath('//evil.example')).toBe('/admin');
    expect(getSafeAdminRedirectPath('https://evil.example')).toBe('/admin');
    expect(getSafeAdminRedirectPath('/')).toBe('/admin');
  });

  it('handles null', () => {
    expect(getSafeAdminRedirectPath(null)).toBe('/admin');
  });
});
