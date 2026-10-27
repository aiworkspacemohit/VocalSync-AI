import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  ArrowRight, 
  Sparkles, 
  Plus, 
  Keyboard, 
  ArrowLeft,
  ShieldCheck,
  Users
} from 'lucide-react';

export default function LobbyScreen({
  userName,
  setUserName,
  onJoinMeeting,
  onCreateMeeting,
  onBackToStudio,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}) {
  const [meetingCodeInput, setMeetingCodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isMicActive, setIsMicActive] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const videoRef = useRef(null);

  // Acquire camera preview on mount
  useEffect(() => {
    let streamRef = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef = stream;
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.warn('Could not initialize camera preview:', err);
      });

    return () => {
      if (streamRef) {
        streamRef.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const toggleCam = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsCameraActive(track.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMicActive(track.enabled);
      }
    }
  };

  const handleStartNewMeeting = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'VocalSync Video Conference' })
      });
      if (res.ok) {
        const data = await res.json();
        onCreateMeeting(data.room_id, userName, localStream);
      } else {
        alert('Could not generate meeting code on server.');
      }
    } catch (e) {
      console.error('Error creating meeting:', e);
      alert('Backend connection error: ' + e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinWithCode = (e) => {
    e.preventDefault();
    const clean = meetingCodeInput.trim();
    if (!clean) return;
    onJoinMeeting(clean, userName, localStream);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#fafafa] text-zinc-900 min-h-screen overflow-y-auto">
      {/* Top Navigation Back to Studio */}
      <div className="w-full max-w-4xl mb-5 flex items-center justify-between">
        <button
          onClick={onBackToStudio}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-800 hover:text-black px-3.5 py-1.5 rounded-lg bg-white border border-zinc-700 hover:bg-zinc-50 shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Biometric Studio</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">VocalSync Meet Ready</span>
        </div>
      </div>

      {/* Main 2-Column Lobby Card (Kuro Reference Aesthetic with Dark Visible Border) */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white p-7 md:p-9 rounded-2xl border border-zinc-800 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {/* Left Column: Live Camera Preview & Media Toggles (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full aspect-video rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden relative shadow-inner flex items-center justify-center">
            {isCameraActive && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-2xl font-bold text-white">
                  {(userName || 'U')[0].toUpperCase()}
                </div>
                <p className="text-xs text-zinc-400 font-mono">Camera is off</p>
              </div>
            )}

            {/* Quick Media Toggles Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 backdrop-blur-md p-1.5 rounded-full bg-black/75 border border-zinc-700 shadow-lg">
              <button
                onClick={toggleMic}
                className={`p-2.5 rounded-full transition-all ${
                  isMicActive
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    : 'bg-rose-500 text-white'
                }`}
                title={isMicActive ? 'Mute Mic' : 'Unmute Mic'}
              >
                {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleCam}
                className={`p-2.5 rounded-full transition-all ${
                  isCameraActive
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    : 'bg-rose-500 text-white'
                }`}
                title={isCameraActive ? 'Turn Off Video' : 'Turn On Video'}
              >
                {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono mt-2.5">
            Preview camera and microphone before joining
          </p>
        </div>

        {/* Right Column: Name & Join Actions (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
              VIDEO CONFERENCE
            </span>
            <h2 className="text-2xl font-black text-black tracking-tight mt-0.5">
              Ready to Join.
            </h2>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
              Supports up to 20+ attendees with real-time biometric speaker identification and Google Meet controls.
            </p>
          </div>

          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 font-mono">
              Your Display Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-50 border border-zinc-700 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
            />
          </div>

          {/* Action 1: Start Instant Meeting (Solid Black Kuro Block) */}
          <button
            onClick={handleStartNewMeeting}
            disabled={isCreating}
            className="w-full py-3 px-5 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 border border-black"
          >
            <Plus className="w-4 h-4" />
            <span>{isCreating ? 'Generating Code...' : 'Start New Video Meeting'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 font-bold">
              or enter code
            </span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {/* Action 2: Join Existing Code */}
          <form onSubmit={handleJoinWithCode} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. vcl-842-mpt"
                value={meetingCodeInput}
                onChange={e => setMeetingCodeInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-700 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!meetingCodeInput.trim()}
              className="px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-900 font-bold text-xs flex items-center gap-1.5 transition-all border border-zinc-700 shadow-xs"
            >
              <span>Join</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Highlights Info */}
          <div className="pt-3 border-t border-dashed border-zinc-700 flex items-center justify-between text-[11px] text-zinc-600 font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-900" />
              <span className="font-bold">Biometric 2.0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-900" />
              <span className="font-bold">20+ Attendees</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
