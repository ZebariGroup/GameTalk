'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { applyVoiceEffect, playSound, VoiceEffect } from '@/lib/audioEffects';
import { filterProfanity } from '@/lib/moderation';
import { normalizeRoomCode } from '@/lib/roomCode';

// STUN servers to help peers connect over the internet
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // In production, you should use a paid TURN service (e.g. Twilio, Metered)
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
};

export type UserRole = 'kid' | 'observer';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface Reaction {
  id: string;
  emoji: string;
  x: number;
  type?: 'emoji' | 'sticker';
  text?: string;
  rotate?: number;
}

export function useAudioChat(roomCode: string | null, username: string, role: UserRole = 'kid', avatarVariant: 'beam' | 'marble' | 'pixel' | 'sunset' | 'ring' | 'bauhaus' = 'beam', avatarColors: string[] = ['#34d399', '#38bdf8', '#818cf8', '#c084fc', '#fbbf24']) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [id: string]: { name: string, role: UserRole, avatarVariant?: 'beam' | 'marble' | 'pixel' | 'sunset' | 'ring' | 'bauhaus', avatarColors?: string[] } }>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<Reaction[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffect>('none');
  const [timeoutUntil, setTimeoutUntil] = useState<number | null>(null);
  const [timeoutReason, setTimeoutReason] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [peerVolumes, setPeerVolumes] = useState<{ [id: string]: number }>({});
  const [peerQuality, setPeerQuality] = useState<{ [id: string]: 'good' | 'fair' | 'poor' }>({});
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [activeMinigame, setActiveMinigame] = useState<{ type: string, starter: string, word?: string, guesses?: string[] } | null>(null);

  const [myId] = useState(() => Math.random().toString(36).substring(2, 15));
  const myIdRef = useRef(myId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const disconnectTimers = useRef<{ [id: string]: NodeJS.Timeout }>({});
  const actionHistory = useRef<{ type: 'text' | 'sound' | 'reaction', timestamp: number, content?: string }[]>([]);
  const timeoutCount = useRef(0);

  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(true);
      
      // Re-announce presence to trigger WebRTC reconnections
      if (channelRef.current && isConnected) {
        channelRef.current.track({ role });
        channelRef.current.send({
          type: 'broadcast',
          event: 'peer-joined',
          payload: { peerId: myIdRef.current, peerName: username, peerRole: role, avatarVariant, avatarColors }
        });
      }
      
      setTimeout(() => setIsReconnecting(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, role, username]);

  const removePeer = (peerId: string) => {
    if (disconnectTimers.current[peerId]) {
      clearTimeout(disconnectTimers.current[peerId]);
      delete disconnectTimers.current[peerId];
    }
    if (peerConnections.current[peerId]) {
      peerConnections.current[peerId].close();
      delete peerConnections.current[peerId];
    }
    setPeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[peerId];
      return newPeers;
    });
  };

  const createPeerConnection = (peerId: string, stream: MediaStream | null, channel: RealtimeChannel) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[peerId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { target: peerId, sender: myIdRef.current, signal: { candidate: event.candidate } }
        });
      }
    };

    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    pc.oniceconnectionstatechange = async () => {
      if (pc.iceConnectionState === 'failed') {
        console.log(`ICE connection failed for ${peerId}, attempting restart...`);
        try {
          // Attempt ICE restart to recover the connection
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { target: peerId, sender: myIdRef.current, senderName: username, senderRole: role, signal: { type: 'offer', sdp: offer } }
          });
        } catch (err) {
          console.error('ICE restart failed', err);
          removePeer(peerId);
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        // Don't remove immediately, give it a chance to recover (7 seconds)
        if (disconnectTimers.current[peerId]) {
          clearTimeout(disconnectTimers.current[peerId]);
        }
        disconnectTimers.current[peerId] = setTimeout(() => {
          if (peerConnections.current[peerId]?.iceConnectionState === 'disconnected') {
            removePeer(peerId);
          }
        }, 7000);
      } else if (pc.iceConnectionState === 'closed') {
        removePeer(peerId);
      }
    };

    return pc;
  };

  useEffect(() => {
    if (!timeoutUntil) {
      setTimeLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.ceil((timeoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeoutUntil(null);
        setTimeoutReason(null);
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [timeoutUntil]);

  const getSpamThreshold = () => {
    const count = timeoutCount.current;
    if (count === 0) return 50;
    if (count === 1) return 40;
    if (count === 2) return 30;
    if (count === 3) return 20;
    return 10;
  };

  const checkSpam = (type: 'text' | 'sound' | 'reaction', content?: string) => {
    const now = Date.now();
    actionHistory.current.push({ type, timestamp: now, content });
    actionHistory.current = actionHistory.current.filter(a => now - a.timestamp < 10000); // keep last 10s

    const recentSameType = actionHistory.current.filter(a => a.type === type);
    const threshold = getSpamThreshold();

    if (type === 'sound' && recentSameType.length > threshold) return "spamming sounds 📢";
    if (type === 'reaction' && recentSameType.length > threshold) return "spamming reactions 😂";
    if (type === 'text') {
      if (recentSameType.length > threshold) return "sending too many messages 💬";
      const last3 = recentSameType.slice(-3);
      if (last3.length === 3 && last3.every(m => m.content === content)) return "repeating yourself 🦜";
    }
    return null;
  };

  const applyTimeout = (reason: string) => {
    timeoutCount.current += 1;
    setTimeoutUntil(Date.now() + 15000); // 15 seconds
    setTimeoutReason(reason);
    
    if (channelRef.current && isConnected) {
      const sysMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderId: 'system',
        senderName: '🤖 ChatBot',
        text: `🚨 ${username} is in TIMEOUT for ${reason}! 🚨`,
        timestamp: Date.now(),
      };
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: sysMsg
      });
      setChatMessages(prev => [...prev, sysMsg]);
    }
    playSound('buzzer');
  };
  
  const originalStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const effectCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let mounted = true;

    const initChat = async () => {
      try {
        const normalizedInputCode = normalizeRoomCode(roomCode);
        if (!normalizedInputCode) {
          setError('Invalid room code.');
          return;
        }

        // 1. Check room max members and expiration in DB
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('code, max_members, expires_at')
          .ilike('code', normalizedInputCode)
          .maybeSingle();

        if (roomError || !roomData) {
          setError('Invalid room code.');
          return;
        }

        const canonicalRoomCode = roomData.code;

        if (roomData.expires_at && new Date(roomData.expires_at) < new Date()) {
          setError('This room has expired. Please create a new one.');
          return;
        }

        const maxMembers = roomData.max_members;

        // 2. Get local audio (ONLY if not observer)
        let stream: MediaStream | null = null;
        if (role === 'kid') {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }, 
            video: false 
          });
          if (!mounted) return;
          
          originalStreamRef.current = stream;
          const { stream: processedStream, cleanup } = applyVoiceEffect(stream, voiceEffect);
          processedStreamRef.current = processedStream;
          effectCleanupRef.current = cleanup;
          
          setLocalStream(stream); // keep original for muting
        }

        // 3. Join Supabase Channel for signaling
        const channel = supabase.channel(`room-${canonicalRoomCode}`, {
          config: {
            presence: {
              key: myIdRef.current,
            },
          },
        });
        channelRef.current = channel;

        channel
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            let kidCount = 0;
            for (const key in state) {
              const presenceArray = state[key] as unknown as { role: UserRole }[];
              if (presenceArray[0]?.role === 'kid') {
                kidCount++;
              }
            }
            
            // If we are a kid and we pushed the count over the limit, we must leave
            if (role === 'kid' && kidCount > maxMembers) {
              setError(`This room is full (Max ${maxMembers} kids).`);
              channel.unsubscribe();
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
            }
          })
          .on('broadcast', { event: 'peer-joined' }, async ({ payload }) => {
            const { peerId, peerName, peerRole, avatarVariant: peerAvatarVariant, avatarColors: peerAvatarColors } = payload;
            if (peerId === myIdRef.current) return;
            
            setPeerNames(prev => ({ ...prev, [peerId]: { name: peerName || 'Kid', role: peerRole || 'kid', avatarVariant: peerAvatarVariant || 'beam', avatarColors: peerAvatarColors } }));

            // A new peer joined, let's create a connection and send an offer
            const pc = createPeerConnection(peerId, processedStreamRef.current, channel);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { target: peerId, sender: myIdRef.current, senderName: username, senderRole: role, avatarVariant, avatarColors, signal: { type: 'offer', sdp: offer } }
            });
          })
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const { target, sender, senderName, senderRole, avatarVariant: senderAvatarVariant, avatarColors: senderAvatarColors, signal } = payload;
            if (target !== myIdRef.current) return;

            if (senderName) {
              setPeerNames(prev => ({ ...prev, [sender]: { name: senderName, role: senderRole || 'kid', avatarVariant: senderAvatarVariant || 'beam', avatarColors: senderAvatarColors } }));
            }

            let pc = peerConnections.current[sender];
            
            if (signal.type === 'offer') {
              if (!pc) {
                pc = createPeerConnection(sender, processedStreamRef.current, channel);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { target: sender, sender: myIdRef.current, senderName: username, senderRole: role, signal: { type: 'answer', sdp: answer } }
              });
            } else if (signal.type === 'answer') {
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              }
            } else if (signal.candidate) {
              if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              }
            }
          })
          .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
            setChatMessages(prev => [...prev, payload]);
          })
          .on('broadcast', { event: 'reaction' }, ({ payload }) => {
            setFloatingReactions(prev => [...prev, { id: Math.random().toString(), emoji: payload.emoji, x: Math.random() * 80 + 10, type: payload.type, text: payload.text, rotate: Math.random() * 40 - 20 }]);
          })
          .on('broadcast', { event: 'sound' }, ({ payload }) => {
            if (payload.soundId === 'custom' && payload.audioData) {
              // Limit custom audio data size (approx 500KB)
              if (typeof payload.audioData === 'string' && payload.audioData.length < 500000) {
                const audio = new Audio(payload.audioData);
                audio.play().catch(e => console.error("Error playing custom sound:", e));
              }
            } else {
              playSound(payload.soundId);
            }
          })
          .on('broadcast', { event: 'minigame' }, ({ payload }) => {
            if (payload.action === 'start') {
              setActiveMinigame({ type: payload.gameType, starter: payload.starter, word: payload.word, guesses: [] });
            } else if (payload.action === 'guess') {
              setActiveMinigame(prev => {
                if (!prev || prev.type !== 'word_guess') return prev;
                return { ...prev, guesses: [...(prev.guesses || []), payload.letter] };
              });
            } else if (payload.action === 'end') {
              setActiveMinigame(null);
            }
          })
          .on('broadcast', { event: 'peer-left' }, ({ payload }) => {
            const { peerId } = payload;
            removePeer(peerId);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setIsReconnecting(false);
              
              // Track presence for counting max members
              await channel.track({ role });

              // Announce we have joined for WebRTC signaling
              channel.send({
                type: 'broadcast',
                event: 'peer-joined',
                payload: { peerId: myIdRef.current, peerName: username, peerRole: role, avatarVariant, avatarColors }
              });
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              setIsReconnecting(true);
            }
          });

      } catch (err) {
        console.error('Error joining chat:', err);
        setError(err instanceof Error ? err.message : 'Failed to access microphone');
      }
    };

    initChat();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'peer-left',
          payload: { peerId: myIdRef.current }
        });
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
      
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      
      Object.values(disconnectTimers.current).forEach(timer => clearTimeout(timer));
      disconnectTimers.current = {};
      
      if (effectCleanupRef.current) {
        effectCleanupRef.current();
        effectCleanupRef.current = null;
      }
      
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
        originalStreamRef.current = null;
      }
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => track.stop());
        processedStreamRef.current = null;
      }
      setLocalStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!originalStreamRef.current || role === 'observer') return;
    
    if (effectCleanupRef.current) {
      effectCleanupRef.current();
    }
    
    // Apply new effect
    const { stream: newStream, cleanup } = applyVoiceEffect(originalStreamRef.current, voiceEffect);
    processedStreamRef.current = newStream;
    effectCleanupRef.current = cleanup;
    
    const newAudioTrack = newStream.getAudioTracks()[0];
    
    // Replace track in all active peer connections
    Object.values(peerConnections.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        sender.replaceTrack(newAudioTrack);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEffect]);


  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const sendMessage = (text: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;
    
    const spamReason = checkSpam('text', text);
    if (spamReason) {
      applyTimeout(spamReason);
      return;
    }

    const { cleanText } = filterProfanity(text);
    
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: myIdRef.current,
      senderName: username,
      text: cleanText,
      timestamp: Date.now(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message
    });

    setChatMessages(prev => [...prev, message]);
  };

  const sendReaction = (emoji: string, type: 'emoji' | 'sticker' = 'emoji', text?: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    const spamReason = checkSpam('reaction');
    if (spamReason) {
      applyTimeout(spamReason);
      return;
    }

    const rotate = Math.random() * 40 - 20;

    channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: { emoji, type, text, rotate } });
    setFloatingReactions(prev => [...prev, { id: Math.random().toString(), emoji, x: Math.random() * 80 + 10, type, text, rotate }]);
  };

  const triggerSound = (soundId: string, audioData?: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    if (audioData && audioData.length > 500000) {
      console.warn("Custom audio too large");
      return;
    }

    const spamReason = checkSpam('sound');
    if (spamReason) {
      applyTimeout(spamReason);
      return;
    }

    channelRef.current.send({ type: 'broadcast', event: 'sound', payload: { soundId, audioData } });
    
    if (soundId === 'custom' && audioData) {
      if (typeof audioData === 'string' && audioData.length < 500000) {
        const audio = new Audio(audioData);
        audio.play().catch(e => console.error("Error playing custom sound:", e));
      }
    } else {
      playSound(soundId);
    }
  };

  const triggerMinigame = (gameType: string, action: 'start' | 'guess' | 'end' = 'start', data?: { word?: string, letter?: string }) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    const payload: { gameType: string, action: string, starter: string, word?: string, letter?: string } = { gameType, action, starter: username };
    if (action === 'start' && data?.word) payload.word = data.word;
    if (action === 'guess' && data?.letter) payload.letter = data.letter;

    channelRef.current.send({ type: 'broadcast', event: 'minigame', payload });
    
    // Optimistic update for local user
    if (action === 'start') {
      setActiveMinigame({ type: gameType, starter: username, word: data?.word, guesses: [] });
    } else if (action === 'guess' && data?.letter) {
      setActiveMinigame(prev => {
        if (!prev || prev.type !== 'word_guess') return prev;
        return { ...prev, guesses: [...(prev.guesses || []), data.letter as string] };
      });
    } else if (action === 'end') {
      setActiveMinigame(null);
    }
  };

  const removeReaction = (id: string) => {
    setFloatingReactions(prev => prev.filter(r => r.id !== id));
  };

  const setPeerVolume = (peerId: string, volume: number) => {
    setPeerVolumes(prev => ({ ...prev, [peerId]: volume }));
  };

  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 256;
    
    sourceRef.current = ctx.createMediaStreamSource(localStream);
    sourceRef.current.connect(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkVolume = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      setIsSpeaking(average > 10 && !isMuted);
      
      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };

    checkVolume();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    };
  }, [localStream, isMuted]);

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(async () => {
      const qualities: { [id: string]: 'good' | 'fair' | 'poor' } = {};
      for (const [peerId, pc] of Object.entries(peerConnections.current)) {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          try {
            const stats = await pc.getStats();
            let packetLoss = 0;
            stats.forEach(report => {
              if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                const lost = report.packetsLost || 0;
                const total = report.packetsReceived || 0;
                if (total > 0) {
                  packetLoss = lost / total;
                }
              }
            });
            if (packetLoss > 0.05) qualities[peerId] = 'poor';
            else if (packetLoss > 0.01) qualities[peerId] = 'fair';
            else qualities[peerId] = 'good';
          } catch (e) {
            qualities[peerId] = 'good';
          }
        } else {
          qualities[peerId] = 'poor';
        }
      }
      setPeerQuality(qualities);
    }, 3000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    localStream,
    peers,
    peerNames,
    peerVolumes,
    setPeerVolume,
    peerQuality,
    isMuted,
    toggleMute,
    error,
    isConnected,
    chatMessages,
    sendMessage,
    voiceEffect,
    setVoiceEffect,
    sendReaction,
    triggerSound,
    triggerMinigame,
    activeMinigame,
    floatingReactions,
    removeReaction,
    timeoutUntil,
    timeoutReason,
    timeLeft,
    isSpeaking,
    isOnline,
    isReconnecting
  };
}
