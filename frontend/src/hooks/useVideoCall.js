import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl, getWsBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();
const WS_BASE_URL = getWsBaseUrl();

// 20 realistic participants for instant demo/testing of the 20-people layout
const DEMO_PARTICIPANTS = [
  { name: 'Mohit', role: 'Engineering Lead' },
  { name: 'Vishesh', role: 'Product Manager' },
  { name: 'Hardeep', role: 'Security Architect' },
  { name: 'Rahul', role: 'Backend Engineer' },
  { name: 'Sachin', role: 'Frontend Specialist' },
  { name: 'Ayush Yadav', role: 'Data Scientist' },
  { name: 'Stanlee', role: 'DevOps Lead' },
  { name: 'Sarah Jenkins', role: 'VP Operations' },
  { name: 'David Chen', role: 'UX Designer' },
  { name: 'Elena Rostova', role: 'QA Lead' },
  { name: 'Marcus Brody', role: 'Scrum Master' },
  { name: 'Priya Sharma', role: 'Cloud Architect' },
  { name: 'Alexandre Dubois', role: 'Solutions Engineer' },
  { name: 'Maya Lin', role: 'Product Marketing' },
  { name: 'Carlos Mendez', role: 'Database Admin' },
  { name: 'Fatima Al-Sayed', role: 'Compliance Officer' },
  { name: 'Tetsuo Tanaka', role: 'Mobile Lead' },
  { name: 'Hannah Schmidt', role: 'Customer Success' },
  { name: 'Liam O’Connor', role: 'Site Reliability' }
];

export function useVideoCall({ roomId, userName, initialLocalStream = null }) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [selfInfo, setSelfInfo] = useState(null);
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
  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const activeSpeakerTimeoutRef = useRef(null);

  // Initialize or capture local media
  useEffect(() => {
    let mounted = true;
    if (!localStream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (mounted) setLocalStream(stream);
        })
        .catch(err => {
          console.warn('Could not acquire default video/audio stream:', err);
          // Fallback to audio only
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => { if (mounted) setLocalStream(stream); })
            .catch(e => console.warn('Audio fallback error:', e));
        });
    }

    return () => {
      mounted = false;
    };
  }, [localStream]);

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

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
      } catch (err) {
        console.error('[VideoCall WS] Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[VideoCall WS] Disconnected');
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('[VideoCall WS] Error:', err);
    };

    return () => {
      ws.close();
    };
  }, [roomId, userName]);

  // Handle incoming WebSocket messages
  const handleSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'ROOM_STATE':
        setSelfInfo(data.self);
        setParticipants(data.participants || []);
        if (data.transcript_history) setTranscriptHistory(data.transcript_history);
        if (data.chat_messages) setChatMessages(data.chat_messages);
        break;

      case 'USER_JOINED':
        setParticipants(data.participants || []);
        break;

      case 'USER_LEFT':
        setParticipants(data.participants || []);
        break;

      case 'PARTICIPANT_UPDATE':
        setParticipants(prev => prev.map(p => {
          if (p.peer_id === data.peer_id) {
            return { ...p, ...data.updates };
          }
          return p;
        }));
        break;

      case 'CHAT_MESSAGE':
        setChatMessages(prev => [...prev, data.message]);
        break;

      case 'TRANSCRIPT_CHUNK':
        if (data.chunk) {
          setTranscriptHistory(prev => [...prev, data.chunk]);
        }
        if (data.active_speaker) {
          triggerActiveSpeaker(data.active_speaker);
        }
        break;

      default:
        break;
    }
  }, []);

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
          if (rms > 0.002 && selfInfo) {
            triggerActiveSpeaker({
              peer_id: peerIdRef.current,
              user_name: userName,
              speaker: userName,
              color: selfInfo.color,
              confidence: 95
            });
          }

          // Encode to standard 16kHz PCM WAV
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

  // Demo Feature: Fill room up to 20 attendees for testing multi-user active speaker highlights
  const addSimulatedParticipants = useCallback((count = 19) => {
    const PALETTE = [
      { name: "Cyan", border: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)", glow: "rgba(6, 182, 212, 0.4)" },
      { name: "Indigo", border: "#6366f1", bg: "rgba(99, 102, 241, 0.15)", glow: "rgba(99, 102, 241, 0.4)" },
      { name: "Purple", border: "#a855f7", bg: "rgba(168, 85, 247, 0.15)", glow: "rgba(168, 85, 247, 0.4)" },
      { name: "Amber", border: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", glow: "rgba(245, 158, 11, 0.4)" },
      { name: "Rose", border: "#f43f5e", bg: "rgba(244, 63, 94, 0.15)", glow: "rgba(244, 63, 94, 0.4)" },
      { name: "Teal", border: "#14b8a6", bg: "rgba(20, 184, 166, 0.15)", glow: "rgba(20, 184, 166, 0.4)" },
      { name: "Sky", border: "#0ea5e9", bg: "rgba(14, 165, 233, 0.15)", glow: "rgba(14, 165, 233, 0.4)" },
      { name: "Fuchsia", border: "#d946ef", bg: "rgba(217, 70, 239, 0.15)", glow: "rgba(217, 70, 239, 0.4)" },
      { name: "Lime", border: "#84cc16", bg: "rgba(132, 204, 22, 0.15)", glow: "rgba(132, 204, 22, 0.4)" },
      { name: "Orange", border: "#f97316", bg: "rgba(249, 115, 22, 0.15)", glow: "rgba(249, 115, 22, 0.4)" },
      { name: "Blue", border: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", glow: "rgba(59, 130, 246, 0.4)" },
      { name: "Pink", border: "#ec4899", bg: "rgba(236, 72, 153, 0.15)", glow: "rgba(236, 72, 153, 0.4)" },
      { name: "Violet", border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", glow: "rgba(139, 92, 246, 0.4)" },
      { name: "Yellow", border: "#eab308", bg: "rgba(234, 179, 8, 0.15)", glow: "rgba(234, 179, 8, 0.4)" },
      { name: "Emerald", border: "#10b981", bg: "rgba(16, 185, 129, 0.15)", glow: "rgba(16, 185, 129, 0.4)" }
    ];

    const currentCount = participants.length;
    const toAdd = DEMO_PARTICIPANTS.slice(0, count).map((item, idx) => ({
      peer_id: `sim_peer_${idx}_${Date.now()}`,
      user_name: item.name,
      role: item.role,
      color: PALETTE[(currentCount + idx) % PALETTE.length],
      is_muted: idx % 3 === 0,
      is_camera_off: idx % 4 === 0,
      is_hand_raised: idx === 1 || idx === 7,
      is_screen_sharing: false,
      joined_at: new Date().toISOString()
    }));

    setParticipants(prev => {
      // Filter out duplicates
      const existingIds = new Set(prev.map(p => p.peer_id));
      const fresh = toAdd.filter(p => !existingIds.has(p.peer_id));
      return [...prev, ...fresh];
    });
  }, [participants]);

  // Demo: Simulate speech from a participant with unique active speaker highlight & transcript
  const simulateParticipantSpeech = useCallback((speakerName, text) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const match = participants.find(p => p.user_name.toLowerCase() === speakerName.toLowerCase());
      socketRef.current.send(JSON.stringify({
        type: 'SIMULATE_SPEECH',
        speaker: speakerName,
        peer_id: match ? match.peer_id : `peer_sim_${speakerName}`,
        text: text
      }));
    }
  }, [participants]);

  return {
    isConnected,
    participants,
    selfInfo,
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
    sendChatMessage,
    addSimulatedParticipants,
    simulateParticipantSpeech
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
