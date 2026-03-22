'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { applyVoiceEffect, playSound, VoiceEffect } from '@/lib/audioEffects';
import { filterProfanity } from '@/lib/moderation';

// STUN servers to help peers connect over the internet
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
}

export function useAudioChat(roomCode: string | null, username: string, role: UserRole = 'kid') {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [id: string]: { name: string, role: UserRole } }>({});
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

  const [activeMinigame, setActiveMinigame] = useState<{ type: string, starter: string } | null>(null);

  const [myId] = useState(() => Math.random().toString(36).substring(2, 15));
  const myIdRef = useRef(myId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const actionHistory = useRef<{ type: 'text' | 'sound' | 'reaction', timestamp: number, content?: string }[]>([]);

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
          payload: { peerId: myIdRef.current, peerName: username, peerRole: role }
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
        setTimeout(() => {
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

  const checkSpam = (type: 'text' | 'sound' | 'reaction', content?: string) => {
    const now = Date.now();
    actionHistory.current.push({ type, timestamp: now, content });
    actionHistory.current = actionHistory.current.filter(a => now - a.timestamp < 10000); // keep last 10s

    const recentSameType = actionHistory.current.filter(a => a.type === type);

    if (type === 'sound' && recentSameType.length > 6) return "spamming sounds 📢";
    if (type === 'reaction' && recentSameType.length > 8) return "spamming reactions 😂";
    if (type === 'text') {
      if (recentSameType.length > 6) return "sending too many messages 💬";
      const last3 = recentSameType.slice(-3);
      if (last3.length === 3 && last3.every(m => m.content === content)) return "repeating yourself 🦜";
    }
    return null;
  };

  const applyTimeout = (reason: string) => {
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

  useEffect(() => {
    if (!roomCode) return;

    let mounted = true;

    const initChat = async () => {
      try {
        // 1. Check room max members in DB
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('max_members')
          .eq('code', roomCode)
          .single();

        if (roomError || !roomData) {
          setError('Invalid room code or room has expired.');
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
          const processedStream = applyVoiceEffect(stream, voiceEffect);
          processedStreamRef.current = processedStream;
          
          setLocalStream(stream); // keep original for muting
        }

        // 3. Join Supabase Channel for signaling
        const channel = supabase.channel(`room-${roomCode}`, {
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
            const { peerId, peerName, peerRole } = payload;
            if (peerId === myIdRef.current) return;
            
            setPeerNames(prev => ({ ...prev, [peerId]: { name: peerName || 'Kid', role: peerRole || 'kid' } }));

            // A new peer joined, let's create a connection and send an offer
            const pc = createPeerConnection(peerId, processedStreamRef.current, channel);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { target: peerId, sender: myIdRef.current, senderName: username, senderRole: role, signal: { type: 'offer', sdp: offer } }
            });
          })
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const { target, sender, senderName, senderRole, signal } = payload;
            if (target !== myIdRef.current) return;

            if (senderName) {
              setPeerNames(prev => ({ ...prev, [sender]: { name: senderName, role: senderRole || 'kid' } }));
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
            setFloatingReactions(prev => [...prev, { id: Math.random().toString(), emoji: payload.emoji, x: Math.random() * 80 + 10 }]);
          })
          .on('broadcast', { event: 'sound' }, ({ payload }) => {
            playSound(payload.soundId);
          })
          .on('broadcast', { event: 'minigame' }, ({ payload }) => {
            setActiveMinigame({ type: payload.gameType, starter: payload.starter });
            setTimeout(() => setActiveMinigame(null), 10000); // Hide after 10s
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
                payload: { peerId: myIdRef.current, peerName: username, peerRole: role }
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
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!originalStreamRef.current || role === 'observer') return;
    
    // Apply new effect
    const newStream = applyVoiceEffect(originalStreamRef.current, voiceEffect);
    processedStreamRef.current = newStream;
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

  const sendReaction = (emoji: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    const spamReason = checkSpam('reaction');
    if (spamReason) {
      applyTimeout(spamReason);
      return;
    }

    channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
    setFloatingReactions(prev => [...prev, { id: Math.random().toString(), emoji, x: Math.random() * 80 + 10 }]);
  };

  const triggerSound = (soundId: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    const spamReason = checkSpam('sound');
    if (spamReason) {
      applyTimeout(spamReason);
      return;
    }

    channelRef.current.send({ type: 'broadcast', event: 'sound', payload: { soundId } });
    playSound(soundId);
  };

  const triggerMinigame = (gameType: string) => {
    if (!channelRef.current || !isConnected) return;
    if (timeoutUntil && Date.now() < timeoutUntil) return;

    channelRef.current.send({ type: 'broadcast', event: 'minigame', payload: { gameType, starter: username } });
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
