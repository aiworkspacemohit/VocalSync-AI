import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Hand, Pin, Sparkles, Volume2 } from 'lucide-react';

export default function VideoCard({
  participant,
  isSelf = false,
  stream = null,
  isSpeaking = false,
  latestCaption = null,
  isPinned = false,
  onPin = null
}) {
  const videoRef = useRef(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  // Monitor video track presence and status
  useEffect(() => {
    const updateTrackStatus = () => {
      if (stream && stream.getVideoTracks().length > 0) {
        const vt = stream.getVideoTracks()[0];
        setHasVideoTrack(vt.enabled && vt.readyState === 'live');
      } else {
        setHasVideoTrack(false);
      }
    };

    updateTrackStatus();

    if (stream) {
      const tracks = stream.getVideoTracks();
      tracks.forEach(t => {
        t.addEventListener('mute', updateTrackStatus);
        t.addEventListener('unmute', updateTrackStatus);
        t.addEventListener('ended', updateTrackStatus);
      });

      return () => {
        tracks.forEach(t => {
          t.removeEventListener('mute', updateTrackStatus);
          t.removeEventListener('unmute', updateTrackStatus);
          t.removeEventListener('ended', updateTrackStatus);
        });
      };
    }
  }, [stream]);

  // Bind media stream to video element and handle playback
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(err => {
        // Handled silently for autoplay policy
        console.debug('Autoplay interaction pending:', err);
      });
    } else {
      el.srcObject = null;
    }
  }, [stream, hasVideoTrack]);

  const name = participant?.user_name || (isSelf ? 'You' : 'Participant');
  const isMuted = participant?.is_muted;
  const isCameraOff = participant?.is_camera_off || !hasVideoTrack;
  const isHandRaised = participant?.is_hand_raised;
  const colorStyle = participant?.color || {
    border: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    glow: 'rgba(16, 185, 129, 0.4)'
  };

  // Extract initials
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 flex items-center justify-center select-none group w-full h-full ${
        isSpeaking
          ? 'scale-[1.01] z-10'
          : 'border-zinc-800/80 hover:border-zinc-700/80'
      }`}
      style={{
        borderColor: isSpeaking ? colorStyle.border : undefined,
        boxShadow: isSpeaking
          ? `0 0 0 3px ${colorStyle.border}, 0 10px 25px -5px ${colorStyle.glow}`
          : undefined
      }}
    >
      {/* 1. Live Video Stream (Always in DOM to retain stream binding, hidden when camera is off) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf} // Always mute self to avoid acoustic echo
        className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''} ${
          !isCameraOff ? 'block' : 'hidden'
        }`}
      />

      {/* 2. Camera Off: Premium Initial Avatar */}
      {isCameraOff && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-4">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-bold text-xl md:text-2xl shadow-xl transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundColor: colorStyle.bg,
              border: `2px solid ${colorStyle.border}`,
              color: colorStyle.border
            }}
          >
            {initials || 'VS'}
          </div>
        </div>
      )}

      {/* 3. Speaking Indicator Banner (Top Right) */}
      {isSpeaking && (
        <div
          className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-md backdrop-blur-md animate-pulse z-10"
          style={{
            backgroundColor: colorStyle.bg,
            border: `1px solid ${colorStyle.border}`,
            color: colorStyle.border
          }}
        >
          {/* Animated Mini Equalizer Bars */}
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 h-3 rounded-full animate-bounce" style={{ backgroundColor: colorStyle.border, animationDelay: '0ms' }} />
            <span className="w-0.5 h-2 rounded-full animate-bounce" style={{ backgroundColor: colorStyle.border, animationDelay: '150ms' }} />
            <span className="w-0.5 h-3.5 rounded-full animate-bounce" style={{ backgroundColor: colorStyle.border, animationDelay: '300ms' }} />
          </div>
          <span>Speaking</span>
        </div>
      )}

      {/* 4. Live Spoken Transcription Subtitle (Written on the speaker's card) */}
      {isSpeaking && latestCaption && (
        <div className="absolute bottom-14 left-3 right-3 px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-md text-white text-xs font-medium border border-white/20 text-center truncate shadow-lg z-10">
          "{latestCaption}"
        </div>
      )}

      {/* 5. Hand Raised Badge (Top Left) */}
      {isHandRaised && (
        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1 shadow-lg backdrop-blur-md animate-bounce z-10">
          <Hand className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* 6. Pin Video Overlay Button */}
      {onPin && (
        <button
          onClick={onPin}
          className={`absolute top-2.5 ${isHandRaised ? 'left-32' : 'left-2.5'} p-1.5 rounded-lg bg-white/90 hover:bg-white text-zinc-800 border border-zinc-200/90 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md shadow-sm z-10`}
          title={isPinned ? 'Unpin participant' : 'Pin to main view'}
        >
          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-black text-black' : ''}`} />
        </button>
      )}

      {/* 7. Bottom Participant Name Pill & Mic Status */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 max-w-[80%]">
          <div className="px-2.5 py-1 rounded-lg bg-white/95 border border-zinc-700 backdrop-blur-md flex items-center gap-2 shadow-sm text-xs font-bold text-zinc-900 truncate">
            {/* Color Identity Dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colorStyle.border }}
            />
            <span className="truncate">
              {name} {isSelf && '(You)'}
            </span>
          </div>
        </div>

        {/* Mic Indicator */}
        <div
          className={`p-1.5 rounded-lg backdrop-blur-md border shadow-sm ${
            isMuted
              ? 'bg-rose-50 border-rose-600 text-rose-700'
              : 'bg-white/95 border-zinc-700 text-emerald-600'
          }`}
          title={isMuted ? 'Muted' : 'Microphone Active'}
        >
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-emerald-600" />
          )}
        </div>
      </div>
    </div>
  );
}
