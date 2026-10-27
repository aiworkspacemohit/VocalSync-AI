import { useState, useRef, useCallback, useEffect } from 'react';
import { getWsBaseUrl } from '../config/api';

const DEFAULT_WS_URL = getWsBaseUrl('/ws/meeting');

export function useMeetingSocket(url = DEFAULT_WS_URL) {
  const [status, setStatus] = useState('DISCONNECTED'); // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('Guest');
  const [activeConfidence, setActiveConfidence] = useState(0);
  const [totalTurns, setTotalTurns] = useState(0);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isExplicitDisconnect = useRef(false);
  const pendingQueueRef = useRef([]);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isExplicitDisconnect.current = false;
    setStatus('CONNECTING');
    console.log(`[VocalSync WS] Connecting to ${url}...`);

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setStatus('CONNECTED');
        console.log('[VocalSync WS] Gateway connected.');

        // Flush any queued audio slices
        while (pendingQueueRef.current.length > 0) {
          const item = pendingQueueRef.current.shift();
          try {
            ws.send(item);
            console.log('[VocalSync WS] Flushed pending audio chunk:', item.byteLength, 'bytes');
          } catch (e) {
            console.warn('[VocalSync WS] Failed to flush queued chunk:', e);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TRANSCRIPT_CHUNK') {
            console.log(`[VocalSync WS] Received speech chunk -> [${data.speaker} (${data.confidence}%)]: "${data.text}"`);
            const newChunk = {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              speaker: data.speaker || 'Unknown Guest',
              confidence: data.confidence ?? 0,
              text: data.text || '',
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              isContinuity: Boolean(data.is_continuity)
            };

            setActiveSpeaker(newChunk.speaker);
            setActiveConfidence(newChunk.confidence);
            setTotalTurns(prev => prev + 1);

            setTranscriptHistory((prev) => [...prev, newChunk]);
          } else if (data.type === 'PONG') {
            console.debug('[VocalSync WS] Pong received');
          }
        } catch (err) {
          console.warn('[VocalSync WS] Failed to parse message JSON:', event.data, err);
        }
      };

      ws.onerror = (err) => {
        console.error('[VocalSync WS] Socket error:', err);
        setStatus('ERROR');
      };

      ws.onclose = () => {
        console.log('[VocalSync WS] Socket closed.');
        setStatus('DISCONNECTED');
        socketRef.current = null;
      };
    } catch (err) {
      console.error('[VocalSync WS] Connect exception:', err);
      setStatus('ERROR');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    isExplicitDisconnect.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    pendingQueueRef.current = [];
    setStatus('DISCONNECTED');
    console.log('[VocalSync WS] Manually disconnected.');
  }, []);

  const sendAudioChunk = useCallback(async (audioData) => {
    try {
      let buffer = null;
      if (audioData instanceof Blob) {
        buffer = await audioData.arrayBuffer();
      } else if (audioData instanceof ArrayBuffer) {
        buffer = audioData;
      }

      if (!buffer || buffer.byteLength === 0) {
        return false;
      }

      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.warn(`[VocalSync WS] Socket state is ${socketRef.current?.readyState ?? 'null'}. Queueing audio chunk (${buffer.byteLength} bytes)...`);
        pendingQueueRef.current.push(buffer);
        return true;
      }

      socketRef.current.send(buffer);
      console.log(`[VocalSync WS] Sent audio chunk (${buffer.byteLength} bytes) to server`);
      return true;
    } catch (err) {
      console.error('[VocalSync WS] Error sending audio chunk:', err);
      return false;
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscriptHistory([]);
    setTotalTurns(0);
    setActiveSpeaker('Guest');
    setActiveConfidence(0);
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    isConnected: status === 'CONNECTED',
    transcriptHistory,
    activeSpeaker,
    activeConfidence,
    totalTurns,
    connect,
    disconnect,
    sendAudioChunk,
    clearTranscript
  };
}
