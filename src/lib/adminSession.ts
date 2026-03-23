const COOKIE_NAME = 'gt_admin_session';

export { COOKIE_NAME };

const SESSION_MAX_AGE_SEC_DEFAULT = 60 * 60 * 24 * 7; // 7 days

export function getAdminSessionMaxAgeSec(): number {
  const raw = process.env.ADMIN_SESSION_MAX_AGE_SEC;
  if (!raw) return SESSION_MAX_AGE_SEC_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 60 ? n : SESSION_MAX_AGE_SEC_DEFAULT;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Token shape: `{expUnixSeconds}.{hexHmac}` where HMAC is over exp string. */
export async function createAdminSessionToken(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + getAdminSessionMaxAgeSec();
  const expStr = String(exp);
  const mac = await hmacSha256Hex(secret, expStr);
  return `${expStr}.${mac}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || expStr !== String(exp)) return false;
  if (Date.now() / 1000 > exp) return false;
  const expected = await hmacSha256Hex(secret, expStr);
  return timingSafeEqualHex(mac.toLowerCase(), expected.toLowerCase());
}
