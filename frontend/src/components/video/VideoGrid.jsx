import React, { useState } from 'react';
import VideoCard from './VideoCard';
import { MonitorUp, Users } from 'lucide-react';

export default function VideoGrid({
  participants = [],
  selfInfo = null,
  localStream = null,
  remoteStreams = {},
  screenStream = null,
  activeSpeaker = null,
  transcriptHistory = [],
  userName = 'You'
}) {
  const [pinnedPeerId, setPinnedPeerId] = useState(null);

  // Build the list of all video cards (self + remote peers)
  // Ensure self card is first
  const selfParticipant = {
    peer_id: selfInfo?.peer_id || 'self',
    user_name: userName || 'You',
    is_muted: selfInfo?.is_muted || false,
    is_camera_off: selfInfo?.is_camera_off || false,
    is_hand_raised: selfInfo?.is_hand_raised || false,
    color: selfInfo?.color || {
      border: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)',
      glow: 'rgba(16, 185, 129, 0.4)'
    }
  };

  // Filter out self if present in participants list
  const remoteParticipants = participants.filter(
    p => p.peer_id !== selfParticipant.peer_id && p.peer_id !== 'self'
  );

  const allAttendees = [selfParticipant, ...remoteParticipants];
  const totalCount = allAttendees.length;

  // Determine optimal responsive grid class based on participant count
  const getGridClass = (count) => {
    if (pinnedPeerId || screenStream) {
      return 'grid-cols-1 md:grid-cols-4'; // Pinned layout: 3 cols main + 1 col strip
    }
    if (count <= 1) return 'grid-cols-1 max-w-3xl mx-auto h-full max-h-[75vh]';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto h-full max-h-[75vh]';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto h-full max-h-[78vh]';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (count <= 9) return 'grid-cols-2 md:grid-cols-3';
    if (count <= 12) return 'grid-cols-3 md:grid-cols-4';
    if (count <= 16) return 'grid-cols-4';
    // 17 to 20+ participants
    return 'grid-cols-4 md:grid-cols-5';
  };

  // Helper to extract the latest spoken sentence for a participant
  const getLatestCaption = (p) => {
    const chunk = transcriptHistory
      .slice()
      .reverse()
      .find(c => c.peer_id === p.peer_id || c.speaker?.toLowerCase() === p.user_name?.toLowerCase());
    return chunk ? chunk.text : null;
  };

  // Screen Share View
  if (screenStream) {
    return (
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden h-full">
        {/* Main Screen Share View */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-md">
          <video
            autoPlay
            playsInline
            ref={el => { if (el && screenStream) el.srcObject = screenStream; }}
            className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white/95 border border-zinc-700 text-xs font-bold text-zinc-900 flex items-center gap-2 backdrop-blur-md shadow-sm">
            <MonitorUp className="w-3.5 h-3.5 text-black" />
            <span>Presenting Screen</span>
          </div>
        </div>

        {/* Side Strip of Participants */}
        <div className="w-full md:w-64 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 max-h-full">
          {allAttendees.map(p => {
            const isSelf = p.peer_id === selfParticipant.peer_id;
            const isSpeaking = activeSpeaker?.peer_id === p.peer_id || activeSpeaker?.speaker?.toLowerCase() === p.user_name?.toLowerCase();
            const stream = isSelf ? localStream : (remoteStreams[p.peer_id] || null);

            return (
              <div key={p.peer_id} className="h-36 md:h-40 w-48 md:w-full shrink-0">
                <VideoCard
                  participant={p}
                  isSelf={isSelf}
                  stream={stream}
                  isSpeaking={isSpeaking}
                  latestCaption={getLatestCaption(p)}
                  isPinned={pinnedPeerId === p.peer_id}
                  onPin={() => setPinnedPeerId(pinnedPeerId === p.peer_id ? null : p.peer_id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Spotlight / Pinned Participant View
  if (pinnedPeerId) {
    const pinnedParticipant = allAttendees.find(p => p.peer_id === pinnedPeerId) || allAttendees[0];
    const otherParticipants = allAttendees.filter(p => p.peer_id !== pinnedParticipant.peer_id);
    const isPinnedSelf = pinnedParticipant.peer_id === selfParticipant.peer_id;
    const isPinnedSpeaking = activeSpeaker?.peer_id === pinnedParticipant.peer_id || activeSpeaker?.speaker?.toLowerCase() === pinnedParticipant.user_name?.toLowerCase();
    const pinnedStream = isPinnedSelf ? localStream : (remoteStreams[pinnedParticipant.peer_id] || null);

    return (
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden h-full">
        {/* Large Main Stage */}
        <div className="flex-1 h-full min-h-0">
          <VideoCard
            participant={pinnedParticipant}
            isSelf={isPinnedSelf}
            stream={pinnedStream}
            isSpeaking={isPinnedSpeaking}
            latestCaption={getLatestCaption(pinnedParticipant)}
            isPinned={true}
            onPin={() => setPinnedPeerId(null)}
          />
        </div>

        {/* Side Rail for Remaining Participants */}
        <div className="w-full md:w-64 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 max-h-full">
          {otherParticipants.map(p => {
            const isSelf = p.peer_id === selfParticipant.peer_id;
            const isSpeaking = activeSpeaker?.peer_id === p.peer_id || activeSpeaker?.speaker?.toLowerCase() === p.user_name?.toLowerCase();
            const stream = isSelf ? localStream : (remoteStreams[p.peer_id] || null);

            return (
              <div key={p.peer_id} className="h-36 md:h-40 w-48 md:w-full shrink-0">
                <VideoCard
                  participant={p}
                  isSelf={isSelf}
                  stream={stream}
                  isSpeaking={isSpeaking}
                  latestCaption={getLatestCaption(p)}
                  isPinned={false}
                  onPin={() => setPinnedPeerId(p.peer_id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Normal Dynamic Responsive Grid (Shows only connected participants)
  return (
    <div className="flex-1 p-3 md:p-4 overflow-y-auto flex items-center justify-center">
      <div className={`grid gap-3 md:gap-4 w-full auto-rows-fr ${getGridClass(totalCount)}`}>
        {allAttendees.map(p => {
          const isSelf = p.peer_id === selfParticipant.peer_id;
          const isSpeaking = activeSpeaker?.peer_id === p.peer_id || activeSpeaker?.speaker?.toLowerCase() === p.user_name?.toLowerCase();
          const stream = isSelf ? localStream : (remoteStreams[p.peer_id] || null);

          return (
            <div key={p.peer_id} className="min-h-[180px] md:min-h-[220px] w-full h-full">
              <VideoCard
                participant={p}
                isSelf={isSelf}
                stream={stream}
                isSpeaking={isSpeaking}
                latestCaption={getLatestCaption(p)}
                isPinned={false}
                onPin={() => setPinnedPeerId(p.peer_id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
