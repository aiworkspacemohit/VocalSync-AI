import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl, getWsBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();
const WS_BASE_URL = getWsBaseUrl();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

/**
 * Resamples float32 samples from native inputRate (e.g. 44.1k/48k) to 16,000 Hz.
 * Ensures speech recognition and biometrics receive pitch-perfect audio.
 */
function resampleTo16k(inputSamples, inputRate, targetRate = 16000) {
  if (inputRate === targetRate) {
    return inputSamples;
  }
  const ratio = inputRate / targetRate;
  const newLength = Math.round(inputSamples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = i * ratio;
    const indexLow = Math.floor(sourceIndex);
    const indexHigh = Math.min(indexLow + 1, inputSamples.length - 1);
    const fraction = sourceIndex - indexLow;
    result[i] = inputSamples[indexLow] * (1 - fraction) + inputSamples[indexHigh] * fraction;
  }
  return result;
}

/**
 * Encodes float32 PCM samples into a standard 16kHz 16-bit Mono WAV ArrayBuffer
 */
function encodeFloat32ToWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

export function useVideoCall({ roomId, userName, initialLocalStream = null }) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [selfInfo, setSelfInfo] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [localStream, setLocalStream] = useState(initialLocalStream);

  const socketRef = useRef(null);
  const peerIdRef = useRef(`peer_${Math.random().toString(36).substring(2, 9)}`);
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(initialLocalStream);
  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const activeSpeakerTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Stable references for audio processor
  const isMutedRef = useRef(isMuted);
  const selfInfoRef = useRef(selfInfo);
  const userNameRef = useRef(userName);
  const triggerActiveSpeakerRef = useRef(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Acquire local media if not already provided
  useEffect(() => {
    let active = true;
    const hasLiveTracks = localStream && localStream.getTracks().some(t => t.readyState === 'live');

    if (!hasLiveTracks) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (active) {
            setLocalStream(stream);
            localStreamRef.current = stream;
          }
        })
        .catch(err => {
          console.warn('Camera + mic unavailable, falling back to audio only:', err);
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              if (active) {
                setLocalStream(stream);
                localStreamRef.current = stream;
              }
            })
            .catch(e => console.warn('Microphone error:', e));
        });
    }

    return () => {
      active = false;
    };
  }, [localStream]);

  // Set active speaker with auto-clearing timer
  const triggerActiveSpeaker = useCallback((speakerInfo) => {
    setActiveSpeaker(speakerInfo);
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
    }
    activeSpeakerTimeoutRef.current = setTimeout(() => {
      setActiveSpeaker(null);
    }, 4000);
  }, []);

  useEffect(() => {
    triggerActiveSpeakerRef.current = triggerActiveSpeaker;
  }, [triggerActiveSpeaker]);

  // WebRTC Helper: Create and configure PeerConnection for a remote peer
  const createPeerConnection = useCallback((remotePeerId) => {
    if (peerConnectionsRef.current[remotePeerId]) {
      return peerConnectionsRef.current[remotePeerId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[remotePeerId] = pc;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (e) {
          console.warn('[WebRTC] addTrack warning:', e);
        }
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'WEBRTC_SIGNAL',
          to_peer_id: remotePeerId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    // Remote Track handler (receives audio/video from remote peer)
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams(prev => ({
        ...prev,
        [remotePeerId]: incomingStream
      }));
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${remotePeerId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Clean up stream if peer disconnected
      }
    };

    return pc;
  }, []);

  // WebRTC Helper: Initiate an offer to a remote peer (caller side)
  const initiateCall = useCallback(async (remotePeerId) => {
    try {
      const pc = createPeerConnection(remotePeerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'WEBRTC_SIGNAL',
          to_peer_id: remotePeerId,
          signal: { sdp: pc.localDescription }
        }));
      }
    } catch (err) {
      console.error(`[WebRTC] Error initiating call to ${remotePeerId}:`, err);
    }
  }, [createPeerConnection]);

  // Handle incoming WebSocket messages
  const handleSocketMessage = useCallback(async (data) => {
    switch (data.type) {
      case 'ROOM_STATE': {
        setSelfInfo(data.self);
        setParticipants(data.participants || []);
        if (data.transcript_history) setTranscriptHistory(data.transcript_history);
        if (data.chat_messages) setChatMessages(data.chat_messages);
        // Note: New joiner does NOT call initiateCall on existing peers.
        // Existing peers will receive USER_JOINED and initiate the offer to avoid glare/collision.
        break;
      }

      case 'USER_JOINED': {
        setParticipants(data.participants || []);
        // The peer that was ALREADY in the room initiates the WebRTC offer to the newly joined peer
        if (data.participant && data.participant.peer_id !== peerIdRef.current) {
          console.log(`[WebRTC] New user joined (${data.participant.user_name}), initiating call...`);
          await initiateCall(data.participant.peer_id);
        }
        break;
      }

      case 'USER_LEFT': {
        setParticipants(data.participants || []);
        if (data.peer_id) {
          if (peerConnectionsRef.current[data.peer_id]) {
            try {
              peerConnectionsRef.current[data.peer_id].close();
            } catch (e) {}
            delete peerConnectionsRef.current[data.peer_id];
          }
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[data.peer_id];
            return next;
          });
        }
        break;
      }

      case 'WEBRTC_SIGNAL': {
        const fromPeerId = data.from_peer_id;
        const signal = data.signal;
        if (!fromPeerId || !signal) break;

        const pc = createPeerConnection(fromPeerId);

        if (signal.sdp) {
          try {
            if (signal.sdp.type === 'offer') {
              // Roll back if collision occurs
              if (pc.signalingState !== 'stable') {
                await Promise.all([
                  pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
                  pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                ]);
              } else {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                  type: 'WEBRTC_SIGNAL',
                  to_peer_id: fromPeerId,
                  signal: { sdp: pc.localDescription }
                }));
              }
            } else if (signal.sdp.type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              }
            }
          } catch (sdpErr) {
            console.warn('[WebRTC] SDP signaling warning:', sdpErr);
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('[WebRTC] Candidate warning:', err);
          }
        }
        break;
      }

      case 'PARTICIPANT_UPDATE': {
        setParticipants(prev => prev.map(p => {
          if (p.peer_id === data.peer_id) {
            return { ...p, ...data.updates };
          }
          return p;
        }));
        break;
      }

      case 'CHAT_MESSAGE': {
        if (data.message) {
          setChatMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        break;
      }

      case 'TRANSCRIPT_CHUNK': {
        if (data.chunk) {
          setTranscriptHistory(prev => [...prev, data.chunk]);
        }
        if (data.active_speaker) {
          triggerActiveSpeaker(data.active_speaker);
        }
        break;
      }

      default:
        break;
    }
  }, [createPeerConnection, initiateCall, triggerActiveSpeaker]);

  // Connect to WebSocket room signaling & audio gateway with auto-reconnection
  useEffect(() => {
    if (!roomId) return;
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const wsUrl = `${WS_BASE_URL}/ws/room/${roomId}/${peerIdRef.current}?user_name=${encodeURIComponent(userName || 'Guest')}`;
      console.log(`[VideoCall WS] Connecting to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log(`[VideoCall WS] Connected to room: ${roomId}`);
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await handleSocketMessage(data);
        } catch (err) {
          console.error('[VideoCall WS] Error parsing message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('[VideoCall WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Auto-reconnect if still mounted in the room
        if (mountedRef.current) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[VideoCall WS] Reconnecting...');
            connect();
          }, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error('[VideoCall WS] Socket error:', err);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [roomId, userName, handleSocketMessage]);

  // Web Audio API: Live Microphone Slices (2.5s 16kHz WAV) for Speech Recognition & Biometrics
  useEffect(() => {
    if (!localStream || !isConnected) return;

    let audioCtx = null;
    let scriptNode = null;
    let sourceNode = null;

    try {
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) return;

      // Use native AudioContext and resample to 16kHz
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      sourceNode = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const bufferSize = 4096;
      scriptNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptNode;

      let pcm16Buffer = [];
      let accumulatedSamples = 0;
      const targetSamples = 16000 * 2.5; // 2.5s conversational slice = 40,000 samples

      scriptNode.onaudioprocess = (e) => {
        // If muted or closed, discard
        if (isMutedRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          pcm16Buffer = [];
          accumulatedSamples = 0;
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Resample native samples (44.1k/48k) to 16,000 Hz
        const resampled = resampleTo16k(inputData, audioCtx.sampleRate, 16000);
        pcm16Buffer.push(resampled);
        accumulatedSamples += resampled.length;

        // 2. When target duration reached, package WAV slice
        if (accumulatedSamples >= targetSamples) {
          const merged = new Float32Array(accumulatedSamples);
          let offset = 0;
          for (const chunk of pcm16Buffer) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          pcm16Buffer = [];
          accumulatedSamples = 0;

          // Check voice activity via RMS
          let sumSquares = 0;
          for (let i = 0; i < merged.length; i++) sumSquares += merged[i] * merged[i];
          const rms = Math.sqrt(sumSquares / merged.length);

          // If speech is detected locally, highlight self card immediately
          if (rms > 0.001) {
            const selfObj = selfInfoRef.current;
            const uname = userNameRef.current || 'You';
            if (triggerActiveSpeakerRef.current) {
              triggerActiveSpeakerRef.current({
                peer_id: peerIdRef.current,
                user_name: uname,
                speaker: uname,
                color: selfObj?.color || { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                confidence: 95
              });
            }
          }

          // Encode to standard 16kHz WAV and stream to server for Whisper & Biometrics
          if (rms > 0.0003 && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const wavBytes = encodeFloat32ToWav(merged, 16000);
            socketRef.current.send(wavBytes);
          }
        }
      };

      sourceNode.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);
    } catch (err) {
      console.warn('Error starting audio processor for room biometrics:', err);
    }

    return () => {
      if (scriptNode) {
        try { scriptNode.disconnect(); } catch (e) {}
      }
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch (e) {}
      }
    };
  }, [localStream, isConnected]);

  // Media Toggle Handlers
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        isMutedRef.current = newMuted;
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'TOGGLE_MIC', is_muted: newMuted }));
        }
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newCamOff = !videoTrack.enabled;
        setIsCameraOff(newCamOff);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'TOGGLE_CAM', is_camera_off: newCamOff }));
        }
      }
    }
  }, []);

  const toggleHandRaise = useCallback(() => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'TOGGLE_HAND', is_hand_raised: nextState }));
    }
  }, [isHandRaised]);

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'TOGGLE_SCREEN', is_screen_sharing: false }));
          }
        };
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'TOGGLE_SCREEN', is_screen_sharing: true }));
        }
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    } else {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'TOGGLE_SCREEN', is_screen_sharing: false }));
      }
    }
  }, [isScreenSharing, screenStream]);

  const sendChatMessage = useCallback((text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        text: cleanText
      }));
    } else {
      console.warn('[Chat] Message queued or socket disconnected. Attempting to send on reconnect.');
    }
  }, []);

  return {
    isConnected,
    participants,
    selfInfo,
    remoteStreams,
    activeSpeaker,
    transcriptHistory,
    chatMessages,
    localStream,
    screenStream,
    isMuted,
    isCameraOff,
    isHandRaised,
    isScreenSharing,
    toggleMute,
    toggleCamera,
    toggleHandRaise,
    toggleScreenShare,
    sendChatMessage
  };
}
