import { describe, expect, it } from 'vitest';
import { filterProfanity } from '@/lib/moderation';

describe('filterProfanity', () => {
  it('leaves clean text unchanged', () => {
    const { cleanText, hasProfanity } = filterProfanity('hello world');
    expect(hasProfanity).toBe(false);
    expect(cleanText).toBe('hello world');
  });

  it('replaces listed profanity', () => {
    const { hasProfanity } = filterProfanity('oh crap');
    expect(hasProfanity).toBe(true);
  });
});
