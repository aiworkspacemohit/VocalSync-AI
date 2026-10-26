import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  Hand, 
  Subtitles, 
  PhoneOff, 
  Users, 
  MessageSquare, 
  Info, 
  Sparkles, 
  Copy, 
  Check,
  UserPlus
} from 'lucide-react';

export default function MeetingBottomBar({
  roomId = '',
  isMuted = false,
  isCameraOff = false,
  isHandRaised = false,
  isScreenSharing = false,
  activeDrawer = null,
  participantCount = 1,
  unreadChatCount = 0,
  onToggleMic,
  onToggleCamera,
  onToggleHand,
  onToggleScreenShare,
  onToggleDrawer,
  onEndCall,
  onAddDemoAttendees,
  onOpenSummarizer
}) {
  const [copied, setCopied] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="h-20 px-6 bg-white border-t border-zinc-800 flex items-center justify-between shrink-0 select-none z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
      {/* 1. LEFT: Meeting Code & Time */}
      <div className="flex items-center gap-3.5 min-w-[200px]">
        <span className="text-sm font-semibold text-zinc-900 font-mono">
          {timeStr}
        </span>
        <span className="text-zinc-400 font-mono">|</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-700 text-xs font-mono font-bold text-zinc-900 transition-all group shadow-xs"
          title="Click to copy meeting code"
        >
          <span>{roomId}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900" />
          )}
        </button>
      </div>

      {/* 2. CENTER: Google Meet Controls Cluster (Kuro Minimalist Style with Dark Borders) */}
      <div className="flex items-center gap-2.5 md:gap-3">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleMic}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-600 shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700'
          }`}
          title={isMuted ? 'Turn on microphone (M)' : 'Turn off microphone (M)'}
        >
          {isMuted ? <MicOff className="w-5 h-5 text-rose-600" /> : <Mic className="w-5 h-5 text-zinc-900" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isCameraOff
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-600 shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700'
          }`}
          title={isCameraOff ? 'Turn on camera (V)' : 'Turn off camera (V)'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5 text-rose-600" /> : <Video className="w-5 h-5 text-zinc-900" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isScreenSharing
              ? 'bg-black text-white shadow-sm border border-black'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700'
          }`}
          title={isScreenSharing ? 'Stop presenting' : 'Present now'}
        >
          <MonitorUp className="w-5 h-5" />
        </button>

        {/* Raise Hand */}
        <button
          onClick={onToggleHand}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isHandRaised
              ? 'bg-amber-50 text-amber-700 border-2 border-amber-600 shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700'
          }`}
          title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className={`w-5 h-5 ${isHandRaised ? 'fill-amber-600 text-amber-600' : ''}`} />
        </button>

        {/* Captions / Live Transcript Drawer */}
        <button
          onClick={() => onToggleDrawer('transcript')}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            activeDrawer === 'transcript'
              ? 'bg-black text-white shadow-sm border border-black'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700'
          }`}
          title="Turn on live biometric transcript captions"
        >
          <Subtitles className="w-5 h-5" />
        </button>

        {/* Demo Helper: Add up to 20 Attendees */}
        {participantCount < 20 && onAddDemoAttendees && (
          <button
            onClick={onAddDemoAttendees}
            className="hidden sm:flex items-center gap-1.5 px-3.5 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700 text-xs font-bold transition-all shadow-xs"
            title="Simulate 20 attendees in meeting to test the 20-people grid & active speaker borders"
          >
            <UserPlus className="w-4 h-4 text-zinc-700" />
            <span>20 Attendees</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="px-5 h-11 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center gap-2 shadow-sm transition-all font-bold text-xs"
          title="Leave call & generate executive debrief"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>

      {/* 3. RIGHT: Google Meet Info & Drawer Toggles */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        {/* Executive Debrief Button (Kuro Solid Black Block) */}
        <button
          onClick={onOpenSummarizer}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            activeDrawer === 'debrief'
              ? 'bg-black text-white shadow-sm border border-black'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-700 shadow-xs'
          }`}
          title="Summarize call into executive debrief"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
          <span className="hidden md:inline">AI Summarize</span>
        </button>

        {/* Meeting Details Button */}
        <button
          onClick={() => onToggleDrawer('info')}
          className={`p-2 rounded-lg border transition-colors ${
            activeDrawer === 'info'
              ? 'bg-black text-white border-black'
              : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-700'
          }`}
          title="Meeting details"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* People Button */}
        <button
          onClick={() => onToggleDrawer('people')}
          className={`relative p-2 rounded-lg border transition-colors ${
            activeDrawer === 'people'
              ? 'bg-black text-white border-black'
              : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-700'
          }`}
          title="People"
        >
          <Users className="w-4 h-4" />
          <span className={`absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            activeDrawer === 'people' ? 'bg-white text-black border border-black' : 'bg-black text-white'
          }`}>
            {participantCount}
          </span>
        </button>

        {/* Chat Button */}
        <button
          onClick={() => onToggleDrawer('chat')}
          className={`relative p-2 rounded-lg border transition-colors ${
            activeDrawer === 'chat'
              ? 'bg-black text-white border-black'
              : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-700'
          }`}
          title="Chat with everyone"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
      </div>
    </footer>
  );
}
