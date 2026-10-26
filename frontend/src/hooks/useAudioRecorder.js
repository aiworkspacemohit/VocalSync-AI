import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Encodes Float32Array PCM samples to a 16kHz 16-bit Mono WAV Blob.
 */
function encodeWavBlob(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);           // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true);  // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true); // ByteRate (16000 * 1 * 2)
  view.setUint16(32, 2, true);           // BlockAlign (1 * 2)
  view.setUint16(34, 16, true);          // BitsPerSample (16)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM 16-bit integer samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Resamples float32 samples from native inputRate to 16,000 Hz.
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

export function useAudioRecorder({ onAudioChunk, sliceIntervalMs = 3000 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0); // 0 - 100 for visualizer
  const [error, setError] = useState(null);

  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const pcmBufferRef = useRef([]);
  const accumulatedSamplesRef = useRef(0);
  const isMutedRef = useRef(false);
  const onAudioChunkRef = useRef(onAudioChunk);

  const targetSamplesPerChunk = Math.round(16000 * (sliceIntervalMs / 1000)); // 48,000 samples for 3s

  useEffect(() => {
    onAudioChunkRef.current = onAudioChunk;
  }, [onAudioChunk]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopRecording = useCallback(() => {
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }

    pcmBufferRef.current = [];
    accumulatedSamplesRef.current = 0;
    setIsRecording(false);
    setIsMuted(false);
    setAudioEnergy(0);
    console.log('[AudioRecorder] Recording stopped.');
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      console.log('[AudioRecorder] Requesting microphone access...');
      // Safe constraints without strict sampleRate to prevent OverconstrainedError on Windows
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      console.log(`[AudioRecorder] AudioContext initialized at native sample rate: ${audioCtx.sampleRate} Hz`);

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // ScriptProcessor for frame-by-frame PCM accumulation
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      pcmBufferRef.current = [];
      accumulatedSamplesRef.current = 0;

      processor.onaudioprocess = (e) => {
        if (!mediaStreamRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Calculate RMS energy for visualizer
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        const energy = Math.min(100, Math.round(rms * 450));
        setAudioEnergy(isMutedRef.current ? 0 : energy);

        // 2. If muted, skip saving samples
        if (isMutedRef.current) return;

        // 3. Resample native samples (e.g. 44.1k/48k) to 16kHz
        const resampled = resampleTo16k(inputData, audioCtx.sampleRate, 16000);
        pcmBufferRef.current.push(resampled);
        accumulatedSamplesRef.current += resampled.length;

        // 4. Emit WAV slice when buffer reaches slice target (~3.0 seconds = 48,000 samples)
        if (accumulatedSamplesRef.current >= targetSamplesPerChunk) {
          const totalLength = accumulatedSamplesRef.current;
          const merged = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of pcmBufferRef.current) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }

          // Reset accumulator
          pcmBufferRef.current = [];
          accumulatedSamplesRef.current = 0;

          // Encode to standard 16kHz 16-bit mono WAV Blob
          const wavBlob = encodeWavBlob(merged, 16000);
          console.log(`[AudioRecorder] Emitted 16kHz WAV slice: ${wavBlob.size} bytes (${(totalLength / 16000).toFixed(2)}s)`);

          if (onAudioChunkRef.current) {
            onAudioChunkRef.current(wavBlob);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
      setIsMuted(false);
      console.log('[AudioRecorder] Recording active. Streaming audio slices every 3000ms.');
      return true;
    } catch (err) {
      console.error('[AudioRecorder] Microphone capture failed:', err);
      setError(err.message || 'Microphone access denied or unavailable.');
      stopRecording();
      return false;
    }
  }, [sliceIntervalMs, targetSamplesPerChunk, stopRecording]);

  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    mediaStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    if (nextMuted) {
      setAudioEnergy(0);
    }
    console.log(`[AudioRecorder] Microphone ${nextMuted ? 'muted' : 'unmuted'}`);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    isMuted,
    audioEnergy,
    error,
    startRecording,
    stopRecording,
    toggleMute
  };
}
