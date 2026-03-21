'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { applyVoiceEffect, playSound, VoiceEffect } from '@/lib/audioEffects';

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

  const myId = useRef(Math.random().toString(36).substring(2, 15));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  
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
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
              key: myId.current,
            },
          },
        });
        channelRef.current = channel;

        channel
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            let kidCount = 0;
            for (const key in state) {
              const presenceArray = state[key] as any[];
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
            if (peerId === myId.current) return;
            
            setPeerNames(prev => ({ ...prev, [peerId]: { name: peerName || 'Kid', role: peerRole || 'kid' } }));

            // A new peer joined, let's create a connection and send an offer
            const pc = createPeerConnection(peerId, processedStreamRef.current, channel);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { target: peerId, sender: myId.current, senderName: username, senderRole: role, signal: { type: 'offer', sdp: offer } }
            });
          })
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const { target, sender, senderName, senderRole, signal } = payload;
            if (target !== myId.current) return;

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
                payload: { target: sender, sender: myId.current, senderName: username, senderRole: role, signal: { type: 'answer', sdp: answer } }
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
          .on('broadcast', { event: 'peer-left' }, ({ payload }) => {
            const { peerId } = payload;
            removePeer(peerId);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              
              // Track presence for counting max members
              await channel.track({ role });

              // Announce we have joined for WebRTC signaling
              channel.send({
                type: 'broadcast',
                event: 'peer-joined',
                payload: { peerId: myId.current, peerName: username, peerRole: role }
              });
            }
          });

      } catch (err: any) {
        console.error('Error joining chat:', err);
        setError(err.message || 'Failed to access microphone');
      }
    };

    initChat();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'peer-left',
          payload: { peerId: myId.current }
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
  }, [voiceEffect]);

  const createPeerConnection = (peerId: string, stream: MediaStream | null, channel: RealtimeChannel) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[peerId] = pc;

    if (stream) {
      // Add local tracks if we are a kid
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    } else {
      // If observer, we just want to receive audio
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { target: peerId, sender: myId.current, signal: { candidate: event.candidate } }
        });
      }
    };

    // Handle incoming audio stream
    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removePeer(peerId);
      }
    };

    return pc;
  };

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
    
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: myId.current,
      senderName: username,
      text,
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
    channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
    setFloatingReactions(prev => [...prev, { id: Math.random().toString(), emoji, x: Math.random() * 80 + 10 }]);
  };

  const triggerSound = (soundId: string) => {
    if (!channelRef.current || !isConnected) return;
    channelRef.current.send({ type: 'broadcast', event: 'sound', payload: { soundId } });
    playSound(soundId);
  };

  const removeReaction = (id: string) => {
    setFloatingReactions(prev => prev.filter(r => r.id !== id));
  };

  return {
    localStream,
    peers,
    peerNames,
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
    floatingReactions,
    removeReaction
  };
}
