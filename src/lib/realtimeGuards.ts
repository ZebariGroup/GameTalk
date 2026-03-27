/** Defensive limits for untrusted Realtime broadcast payloads. */

export const MAX_CHAT_MESSAGE_CHARS = 2000;
export const MAX_CUSTOM_AUDIO_BASE64_CHARS = 500_000;
export const MAX_SDP_CHARS = 200_000;
export const MAX_ICE_CANDIDATES_PER_BATCH = 64;
export const MAX_BROADCAST_JSON_CHARS = 600_000;

export function truncateChatText(text: string): string {
  if (text.length <= MAX_CHAT_MESSAGE_CHARS) return text;
  return text.slice(0, MAX_CHAT_MESSAGE_CHARS);
}

function sdpSize(signal: { sdp?: unknown }): number {
  const desc = signal.sdp;
  if (desc && typeof desc === 'object' && desc !== null && 'sdp' in desc) {
    const raw = (desc as RTCSessionDescriptionInit).sdp;
    return typeof raw === 'string' ? raw.length : 0;
  }
  return 0;
}

export function isSignalPayloadReasonable(signal: unknown): boolean {
  if (!signal || typeof signal !== 'object') return false;
  const s = signal as Record<string, unknown>;
  if (s.type === 'offer' || s.type === 'answer') {
    return sdpSize(s) <= MAX_SDP_CHARS;
  }
  if (s.candidates && Array.isArray(s.candidates)) {
    return s.candidates.length <= MAX_ICE_CANDIDATES_PER_BATCH;
  }
  if (s.candidate && typeof s.candidate === 'object') {
    return true;
  }
  return false;
}

export function isChatMessagePayloadReasonable(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const text = p.text;
  return typeof text === 'string' && text.length <= MAX_CHAT_MESSAGE_CHARS;
}

export function isSoundPayloadReasonable(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.soundId !== 'custom') return typeof p.soundId === 'string' && p.soundId.length < 64;
  const ad = p.audioData;
  return typeof ad === 'string' && ad.length <= MAX_CUSTOM_AUDIO_BASE64_CHARS;
}

export function isReactionPayloadReasonable(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.emoji === 'string' && p.emoji.length < 32;
}

export function isMinigamePayloadReasonable(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const action = p.action;
  if (action !== 'start' && action !== 'guess' && action !== 'end') return false;
  if (p.gameType !== undefined && (typeof p.gameType !== 'string' || p.gameType.length > 64)) return false;
  if (p.starter !== undefined && (typeof p.starter !== 'string' || p.starter.length > 128)) return false;
  if (p.word !== undefined && (typeof p.word !== 'string' || p.word.length > 128)) return false;
  if (p.letter !== undefined && (typeof p.letter !== 'string' || p.letter.length > 8)) return false;
  return true;
}
