import React from 'react';
import { 
  Play, 
  Square, 
  Mic, 
  MicOff, 
  PhoneOff, 
  FileText, 
  Cpu, 
  Users, 
  Loader2 
} from 'lucide-react';

export default function MeetingControls({
  isRecording = false,
  isMuted = false,
  isConnected = false,
  isGeneratingReport = false,
  enrolledCount = 0,
  hardwareInfo = null,
  onStartSession,
  onStopSession,
  onToggleMute,
  onDisconnect,
  onEndAndDebrief,
  onOpenEnrollment
}) {
  return (
    <div className="w-full bg-white border border-zinc-800 rounded-xl px-5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-4">
      {/* Left: System Status & Hardware Badges */}
      <div className="flex items-center gap-3">
        {/* Hardware acceleration badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 border border-zinc-700 text-xs font-semibold text-zinc-900 font-mono">
          <Cpu className="w-3.5 h-3.5 text-zinc-700" />
          <span>
            {hardwareInfo?.device === 'cuda'
              ? `${hardwareInfo.device_name || 'NVIDIA GPU'} (CUDA)`
              : 'CPU Mode'}
          </span>
        </div>

        {/* Enrolled Team Badge */}
        <button
          onClick={onOpenEnrollment}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-700 text-xs font-semibold text-zinc-900 transition-colors shadow-xs"
          title="Click to enroll new participant voice profile"
        >
          <Users className="w-3.5 h-3.5 text-zinc-700" />
          <span>{enrolledCount} Voiceprints</span>
          <span className="text-[10px] text-zinc-900 font-bold uppercase tracking-wider ml-1 px-1.5 py-0.2 rounded bg-white border border-zinc-700">
            + Enroll
          </span>
        </button>

        {/* Session Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-50 border border-zinc-700 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isRecording
                ? 'bg-emerald-500 animate-pulse'
                : isConnected
                  ? 'bg-blue-500'
                  : 'bg-zinc-400'
            }`}
          />
          <span className="text-zinc-700 font-medium">
            {isRecording
              ? 'Streaming Audio (3.0s Slices)'
              : isConnected
                ? 'Gateway Ready'
                : 'Offline'}
          </span>
        </div>
      </div>

      {/* Right: Operational Actions Dock */}
      <div className="flex items-center gap-2.5">
        {/* Start / Stop Toggle */}
        {!isRecording ? (
          <button
            onClick={onStartSession}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold shadow-sm transition-all border border-black"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Session</span>
          </button>
        ) : (
          <button
            onClick={onStopSession}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 border border-zinc-700 text-xs font-semibold transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-current text-amber-600" />
            <span>Pause Stream</span>
          </button>
        )}

        {/* Mic Mute / Unmute */}
        <button
          onClick={onToggleMute}
          disabled={!isRecording}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
            !isRecording
              ? 'opacity-40 cursor-not-allowed bg-zinc-50 border-zinc-600 text-zinc-400'
              : isMuted
                ? 'bg-amber-50 text-amber-700 border-amber-600 hover:bg-amber-100'
                : 'bg-white hover:bg-zinc-50 border-zinc-700 text-zinc-900'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4 text-amber-600" /> : <Mic className="w-4 h-4 text-emerald-600" />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Disconnect Call */}
        {isConnected && (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors"
            title="Disconnect WebSocket stream"
          >
            <PhoneOff className="w-3.5 h-3.5 text-rose-600" />
            <span>Leave Call</span>
          </button>
        )}

        {/* End & Generate Debrief */}
        <button
          onClick={onEndAndDebrief}
          disabled={isGeneratingReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isGeneratingReport ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Analyzing Intent...</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>End & Generate Debrief</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
