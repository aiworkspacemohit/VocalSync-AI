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

  // Keep localStreamRef synchronized
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize or acquire local media
  useEffect(() => {
    let mounted = true;

    // Check if initial stream has active tracks
    const hasLiveTracks = localStream && localStream.getTracks().some(t => t.readyState === 'live');

    if (!hasLiveTracks) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (mounted) {
            setLocalStream(stream);
            localStreamRef.current = stream;
          }
        })
        .catch(err => {
          console.warn('Could not acquire camera + mic, trying audio only:', err);
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              if (mounted) {
                setLocalStream(stream);
                localStreamRef.current = stream;
              }
            })
            .catch(e => console.warn('Audio fallback error:', e));
        });
    }

    return () => {
      mounted = false;
    };
  }, [localStream]);

  // Set active speaker with auto-clearing timer
  const triggerActiveSpeaker = useCallback((speakerInfo) => {
    setActiveSpeaker(speakerInfo);
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
    }
    // Highlight remains for 3.5 seconds
    activeSpeakerTimeoutRef.current = setTimeout(() => {
      setActiveSpeaker(null);
    }, 3500);
  }, []);

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
        pc.addTrack(track, localStreamRef.current);
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
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log(`[WebRTC] Peer ${remotePeerId} connection state:`, pc.connectionState);
      }
    };

    return pc;
  }, []);

  // WebRTC Helper: Initiate an offer to a remote peer
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

  // Connect to WebSocket room signaling & audio gateway
  useEffect(() => {
    if (!roomId) return;

    const wsUrl = `${WS_BASE_URL}/ws/room/${roomId}/${peerIdRef.current}?user_name=${encodeURIComponent(userName || 'Guest')}`;
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

    ws.onclose = () => {
      console.log('[VideoCall WS] Disconnected');
      setIsConnected(false);
      // Clean up peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      setRemoteStreams({});
    };

    ws.onerror = (err) => {
      console.error('[VideoCall WS] Error:', err);
    };

    return () => {
      ws.close();
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [roomId, userName]);

  // Handle incoming WebSocket messages
  const handleSocketMessage = useCallback(async (data) => {
    switch (data.type) {
      case 'ROOM_STATE': {
        setSelfInfo(data.self);
        setParticipants(data.participants || []);
        if (data.transcript_history) setTranscriptHistory(data.transcript_history);
        if (data.chat_messages) setChatMessages(data.chat_messages);

        // Initiate WebRTC peer connection to any peers already present in the room
        const existingPeers = (data.participants || []).filter(p => p.peer_id !== peerIdRef.current);
        for (const peer of existingPeers) {
          await initiateCall(peer.peer_id);
        }
        break;
      }

      case 'USER_JOINED': {
        setParticipants(data.participants || []);
        // The peer that was already in the room initiates the WebRTC offer to the newly joined peer
        if (data.participant && data.participant.peer_id !== peerIdRef.current) {
          await initiateCall(data.participant.peer_id);
        }
        break;
      }

      case 'USER_LEFT': {
        setParticipants(data.participants || []);
        if (data.peer_id) {
          if (peerConnectionsRef.current[data.peer_id]) {
            peerConnectionsRef.current[data.peer_id].close();
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
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: 'WEBRTC_SIGNAL',
                to_peer_id: fromPeerId,
                signal: { sdp: pc.localDescription }
              }));
            }
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('[WebRTC] Error adding ICE candidate:', err);
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
        setChatMessages(prev => [...prev, data.message]);
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

  // Web Audio API: Stream live microphone slices (3.0s WAV) to WebSocket for Biometric ASR
  useEffect(() => {
    if (!localStream || !isConnected || isMuted) return;

    try {
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) return;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const bufferSize = 4096;
      const scriptNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptNode;

      let recordedSamples = [];
      const samplesTarget = 16000 * 3.0; // 3.0s conversational slice

      scriptNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        recordedSamples.push(new Float32Array(inputData));

        let currentTotal = recordedSamples.reduce((acc, curr) => acc + curr.length, 0);
        if (currentTotal >= samplesTarget) {
          const merged = new Float32Array(currentTotal);
          let offset = 0;
          for (const chunk of recordedSamples) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          recordedSamples = [];

          // Local voice activity detection
          let sumSquares = 0;
          for (let i = 0; i < merged.length; i++) sumSquares += merged[i] * merged[i];
          const rms = Math.sqrt(sumSquares / merged.length);

          // If local speech detected, highlight self card immediately
          if (rms > 0.003 && selfInfo) {
            triggerActiveSpeaker({
              peer_id: peerIdRef.current,
              user_name: userName,
              speaker: userName,
              color: selfInfo.color,
              confidence: 95
            });
          }

          // Encode to standard 16kHz PCM WAV and stream to server
          const wavBytes = encodeFloat32ToWav(merged, 16000);
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(wavBytes);
          }
        }
      };

      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);
    } catch (err) {
      console.warn('Error starting audio processor for room biometrics:', err);
    }

    return () => {
      if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [localStream, isConnected, isMuted, selfInfo, userName, triggerActiveSpeaker]);

  // Media Toggle Handlers
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'TOGGLE_MIC', is_muted: newMuted }));
        }
      }
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newCamOff = !videoTrack.enabled;
        setIsCameraOff(newCamOff);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'TOGGLE_CAM', is_camera_off: newCamOff }));
        }
      }
    }
  }, [localStream]);

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
    if (!text || !text.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      text: text.trim()
    }));
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

// Utility: Encodes float32 PCM array into 16kHz WAV format with 44-byte RIFF header
function encodeFloat32ToWav(samples, sampleRate) {
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
