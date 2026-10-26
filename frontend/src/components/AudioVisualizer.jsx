import React, { useMemo } from 'react';
import { Mic, MicOff, Activity } from 'lucide-react';

export default function AudioVisualizer({ isRecording, isMuted, audioEnergy = 0, activeSpeaker = 'Guest' }) {
  // Generate 18 dynamic bars with varying height based on energy
  const bars = useMemo(() => {
    return Array.from({ length: 18 }, (_, index) => {
      const centerFactor = 1 - Math.abs(index - 8.5) / 9;
      const rawHeight = isRecording && !isMuted 
        ? Math.max(6, Math.min(36, Math.round((audioEnergy * 0.45 * centerFactor) + 6 + (Math.sin(index + audioEnergy * 0.2) * 4))))
        : 4;
      return rawHeight;
    });
  }, [audioEnergy, isRecording, isMuted]);

  return (
    <div className="flex items-center gap-3.5 px-3.5 py-2 rounded-xl bg-white border border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Mic Status Icon */}
      <div className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
        !isRecording 
          ? 'bg-zinc-100 text-zinc-500 border border-zinc-700' 
          : isMuted 
            ? 'bg-amber-50 text-amber-700 border border-amber-600' 
            : 'bg-emerald-50 text-emerald-700 border border-emerald-600'
      }`}>
        {!isRecording ? (
          <Activity className="w-4 h-4 text-zinc-400" />
        ) : isMuted ? (
          <MicOff className="w-4 h-4 text-amber-600" />
        ) : (
          <Mic className="w-4 h-4 text-emerald-600 animate-pulse" />
        )}
      </div>

      {/* Audio Waveform Bars */}
      <div className="flex items-center gap-1 h-7 px-1">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              !isRecording
                ? 'bg-zinc-200'
                : isMuted
                  ? 'bg-zinc-300'
                  : audioEnergy > 25
                    ? 'bg-emerald-500'
                    : 'bg-zinc-800'
            }`}
            style={{
              height: `${height}px`,
              opacity: isRecording && !isMuted ? 0.75 + (height / 36) * 0.25 : 0.4
            }}
          />
        ))}
      </div>

      {/* Speaker / Active Status Label */}
      <div className="text-right ml-auto flex flex-col justify-center pl-2">
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 font-mono">
          BIOMETRIC SENSOR
        </span>
        <span className="text-xs font-semibold text-zinc-900 truncate max-w-[140px]">
          {isRecording 
            ? (isMuted ? 'Muted' : activeSpeaker || 'Listening...') 
            : 'Sensor Standby'}
        </span>
      </div>
    </div>
  );
}
