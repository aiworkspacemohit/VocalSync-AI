import React, { useEffect, useRef, useState } from 'react';
import { User, ShieldCheck, Clock, ArrowDown, Sparkles } from 'lucide-react';

export default function LiveTranscriptFeed({
  transcriptHistory = [],
  isConnected = false,
  isRecording = false
}) {
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll on new transcript items if enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptHistory, autoScroll]);

  // Dynamic Kuro badge generator with subtle colored dot indicators
  const getSpeakerStyle = (speaker) => {
    const s = (speaker || '').toLowerCase().trim();
    if (s.includes('mohit')) {
      return { dot: 'bg-indigo-500', badge: 'bg-indigo-50/60 text-indigo-900 border-indigo-200/70' };
    }
    if (s.includes('vishesh')) {
      return { dot: 'bg-blue-500', badge: 'bg-blue-50/60 text-blue-900 border-blue-200/70' };
    }
    if (s.includes('sachin')) {
      return { dot: 'bg-purple-500', badge: 'bg-purple-50/60 text-purple-900 border-purple-200/70' };
    }
    if (s.includes('hardeep')) {
      return { dot: 'bg-emerald-500', badge: 'bg-emerald-50/60 text-emerald-900 border-emerald-200/70' };
    }
    if (s.includes('ayush')) {
      return { dot: 'bg-cyan-500', badge: 'bg-cyan-50/60 text-cyan-900 border-cyan-200/70' };
    }
    if (s.includes('rahul')) {
      return { dot: 'bg-sky-500', badge: 'bg-sky-50/60 text-sky-900 border-sky-200/70' };
    }
    if (s.includes('stanlee')) {
      return { dot: 'bg-violet-500', badge: 'bg-violet-50/60 text-violet-900 border-violet-200/70' };
    }
    if (s.includes('guest') || s.includes('unknown')) {
      return { dot: 'bg-zinc-400', badge: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
    }
    return { dot: 'bg-teal-500', badge: 'bg-teal-50/60 text-teal-900 border-teal-200/70' };
  };

  const getConfidenceBadge = (confidence, isGuest) => {
    if (isGuest) {
      return {
        classes: 'bg-zinc-100 text-zinc-600 border-zinc-200',
        iconClass: 'text-zinc-500',
        label: `${confidence}% match`
      };
    }
    if (confidence >= 85) {
      return {
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        iconClass: 'text-emerald-600',
        label: `${confidence}% verified`
      };
    }
    if (confidence >= 70) {
      return {
        classes: 'bg-zinc-100 text-zinc-800 border-zinc-200 font-semibold',
        iconClass: 'text-indigo-600',
        label: `${confidence}% match`
      };
    }
    return {
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
      iconClass: 'text-amber-600',
      label: `${confidence}% match`
    };
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header bar with Dark Separator */}
      <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-mono block">
              AUDIO STREAM
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-zinc-900 tracking-tight">
                Live Biometric Stream.
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black text-white">
                {transcriptHistory.length} turns
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors border ${
            autoScroll
              ? 'bg-zinc-100 text-zinc-900 border-zinc-700 hover:bg-zinc-200'
              : 'bg-white text-zinc-500 border-zinc-700 hover:text-zinc-900'
          }`}
          title="Toggle automatic downward scrolling"
        >
          <ArrowDown className={`w-3 h-3 ${autoScroll ? 'text-black' : 'text-zinc-500'}`} />
          Auto-scroll {autoScroll ? 'On' : 'Paused'}
        </button>
      </div>

      {/* Transcript Scroll Container */}
      <div
        ref={scrollRef}
        className="flex-1 p-5 overflow-y-auto space-y-3 text-sm bg-[#fafafa]"
      >
        {transcriptHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-zinc-700 flex items-center justify-center text-zinc-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-zinc-800">
                {isRecording ? 'Listening for speech...' : 'Session Ready.'}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                {isRecording
                  ? 'Speak naturally into your microphone. Enrolled speaker identities will be separated in real time.'
                  : 'Click "Start Session" in the dock below to stream live audio to the biometric engine.'}
              </p>
            </div>
          </div>
        ) : (
          transcriptHistory.map((turn) => {
            const style = getSpeakerStyle(turn.speaker);
            return (
              <div
                key={turn.id}
                className="group p-4 rounded-xl bg-white border border-zinc-700 hover:border-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${style.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <User className="w-3 h-3" />
                      {turn.speaker}
                    </span>

                    {/* Confidence Pill */}
                    {turn.confidence > 0 && (() => {
                      const isGuest = (turn.speaker || '').toLowerCase().includes('guest') || (turn.speaker || '').toLowerCase().includes('unknown');
                      const confMeta = getConfidenceBadge(turn.confidence, isGuest);
                      return (
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1.5 transition-colors ${confMeta.classes}`}>
                          <ShieldCheck className={`w-3 h-3 ${confMeta.iconClass}`} />
                          {confMeta.label}
                        </span>
                      );
                    })()}

                    {turn.isContinuity && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Inertia
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-zinc-400 text-[11px] font-mono">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {turn.timestamp}
                  </div>
                </div>

                {/* Spoken Utterance Text */}
                <p className="text-zinc-800 leading-relaxed font-normal pl-0.5">
                  {turn.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
