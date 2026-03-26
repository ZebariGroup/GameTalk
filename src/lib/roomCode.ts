export function normalizeRoomCode(code: string): string {
  return code
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .toLowerCase();
}
