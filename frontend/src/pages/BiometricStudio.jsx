import React, { useState, useEffect, useCallback } from 'react';
import { 
  AudioWaveform, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  UserPlus, 
  Activity, 
  Server,
  RefreshCw,
  Video
} from 'lucide-react';

import { useMeetingSocket } from '../hooks/useMeetingSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import LiveTranscriptFeed from '../components/LiveTranscriptFeed';
import MeetingControls from '../components/MeetingControls';
import EnrollmentModal from '../components/EnrollmentModal';
import ReportViewer from '../components/ReportViewer';
import AudioVisualizer from '../components/AudioVisualizer';
import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

export default function BiometricStudio({ onNavigateToMeet }) {
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [enrolledSpeakers, setEnrolledSpeakers] = useState([]);
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [debrief, setDebrief] = useState(null);
  const [isGeneratingDebrief, setIsGeneratingDebrief] = useState(false);

  // WebSocket Hook
  const {
    status: socketStatus,
    isConnected,
    transcriptHistory,
    activeSpeaker,
    activeConfidence,
    connect: connectSocket,
    disconnect: disconnectSocket,
    sendAudioChunk,
    clearTranscript
  } = useMeetingSocket();

  // Audio Chunk Handler: forward slices to WebSocket
  const handleAudioChunk = useCallback((chunkBlob) => {
    sendAudioChunk(chunkBlob);
  }, [sendAudioChunk]);

  // Audio Recorder Hook
  const {
    isRecording,
    isMuted,
    audioEnergy,
    error: recorderError,
    startRecording,
    stopRecording,
    toggleMute
  } = useAudioRecorder({
    onAudioChunk: handleAudioChunk,
    sliceIntervalMs: 3000
  });

  // Fetch registered speakers and hardware status
  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHardwareInfo(data.hardware);
        if (data.enrolled_speakers) {
          setEnrolledSpeakers(data.enrolled_speakers.map(s => s.name));
        }
      }
    } catch (err) {
      console.warn('Backend offline or health check failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchSystemInfo();
  }, [fetchSystemInfo]);

  // Controls Handlers
  const handleStartSession = async () => {
    connectSocket();
    const success = await startRecording();
    if (!success) {
      alert('Microphone access could not be initialized. Please check browser microphone permissions.');
    }
  };

  const handleStopSession = () => {
    stopRecording();
  };

  const handleDisconnect = () => {
    stopRecording();
    disconnectSocket();
  };

  const handleEndAndDebrief = async () => {
    stopRecording();
    disconnectSocket();

    if (transcriptHistory.length === 0) {
      alert('No speech was detected during this session to summarize.');
      return;
    }

    setIsGeneratingDebrief(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/meeting/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptHistory,
          meeting_title: `Executive Biometric Intelligence Brief (${new Date().toLocaleDateString()})`
        })
      });

      if (!response.ok) {
        throw new Error('Summarization failed on server.');
      }

      const result = await response.json();
      setDebrief(result);
    } catch (err) {
      console.error('Debrief generation error:', err);
      alert('Error generating debrief: ' + err.message);
    } finally {
      setIsGeneratingDebrief(false);
    }
  };

  const handleEnrollmentSuccess = () => {
    fetchSystemInfo();
  };

  return (
    <div className="flex flex-col h-screen bg-[#fafafa] text-zinc-900 overflow-hidden font-sans">
      {/* 1. TOP HEADER (KURO REFERENCE STYLE WITH DARK BORDERS) */}
      <header className="h-16 px-6 border-b border-zinc-800 bg-white flex items-center justify-between shrink-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-black tracking-tighter">
              vocalsync<span className="text-zinc-400">.</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-800 text-[10px] font-bold text-zinc-800 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              STUDIO
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700 hidden sm:block" />

          <p className="text-xs text-zinc-500 hidden sm:block">
            ECAPA-TDNN Multi-Speaker Biometrics & Streaming Meeting Intelligence
          </p>
        </div>

        {/* Center / Audio Visualizer Bar */}
        <div className="hidden md:flex items-center">
          <AudioVisualizer
            isRecording={isRecording}
            isMuted={isMuted}
            audioEnergy={audioEnergy}
            activeSpeaker={activeSpeaker}
          />
        </div>

        {/* Right Action Icons & Multipage Navigation */}
        <div className="flex items-center gap-2.5">
          {/* Multipage Switcher Button to Video Call (Solid Black Kuro Block) */}
          <button
            onClick={onNavigateToMeet}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold shadow-sm transition-all border border-black"
            title="Launch Google Meet style video conference room"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Call (Meet)</span>
          </button>

          <button
            onClick={() => setIsEnrollmentOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 border border-zinc-800 text-xs font-semibold transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 text-zinc-800" />
            <span>Enroll</span>
          </button>

          <button
            onClick={fetchSystemInfo}
            className="p-2 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-800 text-zinc-700 hover:text-black transition-colors"
            title="Refresh system status & voiceprints"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN 2-PANEL DASHBOARD (58% / 42%) */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4 bg-[#fafafa]">
        {/* Left Panel: Live Transcript Stream */}
        <section className="w-full lg:w-[58%] flex flex-col h-full">
          <LiveTranscriptFeed
            transcriptHistory={transcriptHistory}
            isConnected={isConnected}
            isRecording={isRecording}
          />
        </section>

        {/* Right Panel: Debrief View & Team Roster */}
        <section className="hidden lg:flex lg:w-[42%] flex-col h-full gap-4">
          {/* Registered Team Roster Card (Kuro Metric Style with Dark Border) */}
          <div className="px-4 py-3 rounded-xl bg-white border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-700" />
                Active Biometric Profiles ({enrolledSpeakers.length})
              </span>
              <span className="text-[10px] text-zinc-500 font-mono font-semibold">
                192-D Centroids
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {enrolledSpeakers.length > 0 ? (
                enrolledSpeakers.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-50 text-zinc-900 border border-zinc-700 shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-400 italic">
                  No enrolled profiles found in storage.
                </span>
              )}
            </div>
          </div>

          {/* Report Viewer / Debrief */}
          <div className="flex-1 overflow-hidden">
            <ReportViewer
              debrief={debrief}
              transcriptHistory={transcriptHistory}
              isLoading={isGeneratingDebrief}
              apiBaseUrl={API_BASE_URL}
            />
          </div>
        </section>
      </main>

      {/* 3. BOTTOM CONTROL DOCK */}
      <footer className="px-4 pb-4 pt-1 shrink-0 z-20 bg-[#fafafa]">
        <MeetingControls
          isRecording={isRecording}
          isMuted={isMuted}
          isConnected={isConnected}
          isGeneratingReport={isGeneratingDebrief}
          enrolledCount={enrolledSpeakers.length}
          hardwareInfo={hardwareInfo}
          onStartSession={handleStartSession}
          onStopSession={handleStopSession}
          onToggleMute={toggleMute}
          onDisconnect={handleDisconnect}
          onEndAndDebrief={handleEndAndDebrief}
          onOpenEnrollment={() => setIsEnrollmentOpen(true)}
        />
      </footer>

      {/* 4. 3-STEP ENROLLMENT MODAL */}
      <EnrollmentModal
        isOpen={isEnrollmentOpen}
        onClose={() => setIsEnrollmentOpen(false)}
        onEnrollmentSuccess={handleEnrollmentSuccess}
        apiBaseUrl={API_BASE_URL}
      />
    </div>
  );
}
