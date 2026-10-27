import React, { useState, useCallback } from 'react';
import { useVideoCall } from '../hooks/useVideoCall';
import LobbyScreen from '../components/video/LobbyScreen';
import VideoGrid from '../components/video/VideoGrid';
import MeetingBottomBar from '../components/video/MeetingBottomBar';
import MeetingSideDrawer from '../components/video/MeetingSideDrawer';
import { AudioWaveform, ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react';
import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

export default function VideoMeeting({ onNavigateToStudio }) {
  const [roomId, setRoomId] = useState(null);
  const [userName, setUserName] = useState('Alex Morgan');
  const [activeDrawer, setActiveDrawer] = useState(null); // 'transcript' | 'people' | 'chat' | 'info' | 'debrief'
  const [localStream, setLocalStream] = useState(null);
  const [debrief, setDebrief] = useState(null);
  const [isGeneratingDebrief, setIsGeneratingDebrief] = useState(false);

  // Video call hook
  const {
    isConnected,
    participants,
    selfInfo,
    remoteStreams,
    activeSpeaker,
    transcriptHistory,
    chatMessages,
    screenStream,
    isMuted,
    isCameraOff,
    isHandRaised,
    isScreenSharing,
    toggleMute,
    toggleCamera,
    toggleHandRaise,
    toggleScreenShare,
    sendChatMessage
  } = useVideoCall({
    roomId,
    userName,
    initialLocalStream: localStream
  });

  // Lobby Handlers
  const handleJoinMeeting = (code, name, stream) => {
    setRoomId(code);
    if (name) setUserName(name);
    if (stream) setLocalStream(stream);
  };

  const handleCreateMeeting = (code, name, stream) => {
    setRoomId(code);
    if (name) setUserName(name);
    if (stream) setLocalStream(stream);
  };

  const handleToggleDrawer = (tab) => {
    if (activeDrawer === tab) {
      setActiveDrawer(null);
    } else {
      setActiveDrawer(tab);
    }
  };

  // Summarize meeting with Gemini
  const handleGenerateDebrief = useCallback(async () => {
    if (transcriptHistory.length === 0) {
      alert('No speech recorded in the meeting yet to summarize. Speak into your microphone or simulate speech to record turns.');
      return;
    }

    setIsGeneratingDebrief(true);
    setActiveDrawer('debrief');

    try {
      const response = await fetch(`${API_BASE_URL}/api/meeting/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptHistory,
          meeting_title: `Video Conference Debrief: ${roomId || 'VocalSync AI'} (${new Date().toLocaleDateString()})`
        })
      });

      if (!response.ok) {
        throw new Error('Summarization request failed.');
      }

      const result = await response.json();
      setDebrief(result);
    } catch (err) {
      console.error('Debrief error:', err);
      alert('Error generating debrief: ' + err.message);
    } finally {
      setIsGeneratingDebrief(false);
    }
  }, [transcriptHistory, roomId]);

  // End Call Handler
  const handleEndCall = () => {
    if (transcriptHistory.length > 0) {
      if (window.confirm('Would you like to generate the executive debrief before leaving the meeting?')) {
        handleGenerateDebrief();
        return;
      }
    }
    setRoomId(null);
  };

  // If not yet in room, show Google Meet style lobby
  if (!roomId) {
    return (
      <LobbyScreen
        userName={userName}
        setUserName={setUserName}
        onJoinMeeting={handleJoinMeeting}
        onCreateMeeting={handleCreateMeeting}
        onBackToStudio={onNavigateToStudio}
        apiBaseUrl={API_BASE_URL}
      />
    );
  }

  // Active In-Call Room View
  return (
    <div className="flex flex-col h-screen bg-[#fafafa] text-zinc-900 overflow-hidden font-sans select-none">
      {/* 1. COMPACT TOP HEADER (KURO REFERENCE STYLE WITH DARK BORDERS) */}
      <header className="h-14 px-5 bg-white border-b border-zinc-800 flex items-center justify-between shrink-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToStudio}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors border border-zinc-700"
            title="Go to Biometric Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-black text-black tracking-tight flex items-center">
              vocalsync<span className="text-zinc-400">.</span>
              <span className="text-xs font-semibold text-zinc-500 ml-1">meet</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-600 text-[10px] font-bold font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>

        {/* Center: Active Speaker Announcement */}
        {activeSpeaker && (
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all"
            style={{
              backgroundColor: activeSpeaker.color?.bg || '#ecfdf5',
              border: `1.5px solid ${activeSpeaker.color?.border || '#10b981'}`,
              color: activeSpeaker.color?.border || '#059669'
            }}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            <span>Active Speaker: {activeSpeaker.speaker}</span>
            {activeSpeaker.confidence > 0 && (
              <span className="text-[10px] font-mono opacity-80">
                ({activeSpeaker.confidence}% verified)
              </span>
            )}
          </div>
        )}

        {/* Right Info: Attendees Counter */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono bg-zinc-100 text-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-700 font-bold">
            {Math.max(1, participants.length)} Attendee{Math.max(1, participants.length) !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* 2. MAIN STAGE (GRID + OPTIONAL DRAWER) */}
      <main className="flex-1 flex overflow-hidden relative bg-[#f4f4f5]">
        {/* Dynamic Video Grid (Shows only connected participants) */}
        <VideoGrid
          participants={participants}
          selfInfo={selfInfo}
          localStream={localStream}
          remoteStreams={remoteStreams}
          screenStream={screenStream}
          activeSpeaker={activeSpeaker}
          transcriptHistory={transcriptHistory}
          userName={userName}
        />

        {/* Right Google Meet Side Drawer */}
        <MeetingSideDrawer
          isOpen={Boolean(activeDrawer)}
          activeTab={activeDrawer || 'transcript'}
          roomId={roomId}
          participants={participants}
          selfInfo={selfInfo}
          userName={userName}
          transcriptHistory={transcriptHistory}
          chatMessages={chatMessages}
          activeSpeaker={activeSpeaker}
          debrief={debrief}
          isGeneratingDebrief={isGeneratingDebrief}
          apiBaseUrl={API_BASE_URL}
          onClose={() => setActiveDrawer(null)}
          onChangeTab={tab => setActiveDrawer(tab)}
          onSendMessage={sendChatMessage}
          onGenerateDebrief={handleGenerateDebrief}
        />
      </main>

      {/* 3. GOOGLE MEET BOTTOM CONTROL DOCK */}
      <MeetingBottomBar
        roomId={roomId}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isHandRaised={isHandRaised}
        isScreenSharing={isScreenSharing}
        activeDrawer={activeDrawer}
        participantCount={Math.max(1, participants.length)}
        unreadChatCount={0}
        onToggleMic={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleHand={toggleHandRaise}
        onToggleScreenShare={toggleScreenShare}
        onToggleDrawer={handleToggleDrawer}
        onEndCall={handleEndCall}
        onOpenSummarizer={handleGenerateDebrief}
      />
    </div>
  );
}
