import { describe, expect, it } from 'vitest';
import { normalizeRoomCode } from '@/lib/roomCode';

describe('normalizeRoomCode', () => {
  it('trims and lowercases', () => {
    expect(normalizeRoomCode('  Happy-Lion  ')).toBe('happy-lion');
  });

  it('maps spaces and underscores to hyphen', () => {
    expect(normalizeRoomCode('Blue Tiger')).toBe('blue-tiger');
    expect(normalizeRoomCode('blue__tiger')).toBe('blue-tiger');
  });

  it('returns empty for unusable input', () => {
    expect(normalizeRoomCode('!!!')).toBe('');
  });
});
