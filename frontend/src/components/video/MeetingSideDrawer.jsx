import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Users, 
  MessageSquare, 
  Info, 
  Subtitles, 
  Sparkles, 
  Copy, 
  Check, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Hand, 
  Send,
  Download,
  ShieldCheck,
  Clock,
  User,
  UserPlus,
  Play
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';

export default function MeetingSideDrawer({
  isOpen = false,
  activeTab = 'transcript',
  roomId = '',
  participants = [],
  selfInfo = null,
  userName = 'You',
  transcriptHistory = [],
  chatMessages = [],
  activeSpeaker = null,
  debrief = null,
  isGeneratingDebrief = false,
  apiBaseUrl = getApiBaseUrl(),
  onClose,
  onChangeTab,
  onSendMessage,
  onGenerateDebrief,
  onAddDemoAttendees,
  onSimulateSpeech
}) {
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const chatBottomRef = useRef(null);
  const transcriptBottomRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
    if (activeTab === 'transcript' && transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollTop = transcriptBottomRef.current.scrollHeight;
    }
  }, [chatMessages, transcriptHistory, activeTab]);

  if (!isOpen) return null;

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/meet/${roomId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredParticipants = participants.filter(p =>
    (p.user_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-full sm:w-96 md:w-[410px] h-full bg-white border-l border-zinc-800 flex flex-col shrink-0 select-none z-20 shadow-2xl transition-all">
      {/* 1. DRAWER TOP HEADER (KURO NAVIGATION WITH DARK BORDER) */}
      <div className="h-16 px-4 border-b border-zinc-800 flex items-center justify-between bg-white">
        {/* Navigation Tabs (Kuro style segmented controls with Dark Border) */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-700">
          <button
            onClick={() => onChangeTab('transcript')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'transcript'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>Transcript</span>
          </button>

          <button
            onClick={() => onChangeTab('people')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'people'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>People ({participants.length})</span>
          </button>

          <button
            onClick={() => onChangeTab('chat')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onChangeTab('debrief')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              activeTab === 'debrief'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
            title="Executive AI Debrief"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Debrief</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors border border-zinc-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. DRAWER BODY */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#fafafa]">
        {/* ==================================================== */}
        {/* TAB 1: LIVE BIOMETRIC TRANSCRIPT STREAM              */}
        {/* ==================================================== */}
        {activeTab === 'transcript' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header sub-bar */}
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-white flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                Biometric Stream ({transcriptHistory.length} turns)
              </span>
              {activeSpeaker && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 animate-pulse"
                  style={{
                    backgroundColor: activeSpeaker.color?.bg || 'rgba(16, 185, 129, 0.1)',
                    color: activeSpeaker.color?.border || '#10b981',
                    border: `1px solid ${activeSpeaker.color?.border || '#10b981'}`
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {activeSpeaker.speaker} is speaking
                </span>
              )}
            </div>

            {/* Transcript scroll feed */}
            <div
              ref={transcriptBottomRef}
              className="flex-1 p-4 overflow-y-auto space-y-3 text-sm"
            >
              {transcriptHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
                  <Subtitles className="w-8 h-8 text-zinc-400" />
                  <p className="font-semibold text-zinc-800">No speech recorded yet</p>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Speak into your microphone. Words are transcribed and biometric identity is matched in real time.
                  </p>
                </div>
              ) : (
                transcriptHistory.map((chunk, idx) => {
                  const color = chunk.speaker_color || {
                    border: '#10b981',
                    bg: 'rgba(16, 185, 129, 0.15)'
                  };
                  return (
                    <div
                      key={chunk.id || idx}
                      className="p-3.5 rounded-xl bg-white border border-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-zinc-900 transition-all space-y-1.5"
                      style={{ borderLeftColor: color.border, borderLeftWidth: '3.5px' }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color.border }}
                          />
                          <span>{chunk.speaker}</span>
                          {chunk.confidence > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-800 border border-zinc-700 font-semibold">
                              {chunk.confidence}% verified
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {chunk.timestamp}
                        </span>
                      </div>
                      <p className="text-zinc-800 leading-relaxed text-xs font-normal">
                        {chunk.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: PARTICIPANTS LIST (UP TO 20+ PEOPLE)          */}
        {/* ==================================================== */}
        {activeTab === 'people' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-3">
            {/* Search Box & 20-People Demo Trigger */}
            <div className="space-y-2 shrink-0">
              <input
                type="text"
                placeholder="Search attendees..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-700 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black transition-colors"
              />


            </div>

            {/* Attendees Roster (Kuro Style with Dark Borders) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredParticipants.map(p => {
                const isSelf = p.peer_id === selfInfo?.peer_id || p.peer_id === 'self';
                const isSpeaking = activeSpeaker?.peer_id === p.peer_id;
                const color = p.color || { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };

                return (
                  <div
                    key={p.peer_id}
                    className="p-2.5 rounded-lg bg-white border border-zinc-700 flex items-center justify-between hover:border-zinc-900 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          backgroundColor: color.bg,
                          color: color.border,
                          border: `1.5px solid ${color.border}`
                        }}
                      >
                        {(p.user_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {p.user_name} {isSelf && '(You)'}
                          </p>
                          {isSpeaking && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase"
                              style={{ backgroundColor: color.bg, color: color.border }}
                            >
                              Speaking
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate font-mono">
                          {p.role || (isSelf ? 'Meeting Host' : 'Participant')}
                        </p>
                      </div>
                    </div>

                    {/* Status Icons */}
                    <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                      {p.is_hand_raised && (
                        <Hand className="w-3.5 h-3.5 text-amber-500 fill-amber-500" title="Hand raised" />
                      )}
                      {p.is_muted ? (
                        <MicOff className="w-3.5 h-3.5 text-rose-500" title="Muted" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-emerald-600" title="Microphone Active" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: IN-CALL CHAT                                  */}
        {/* ==================================================== */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div
              ref={chatBottomRef}
              className="flex-1 p-4 overflow-y-auto space-y-3 text-xs"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-300" />
                  <p className="font-semibold text-zinc-800">Messages will appear here</p>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Send a message to everyone in the video call meeting.
                  </p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.peer_id === selfInfo?.peer_id || msg.user_name?.toLowerCase() === userName?.toLowerCase();
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span className="font-bold text-zinc-800">{msg.user_name}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                          isMe
                            ? 'bg-black text-white rounded-br-none shadow-sm border border-black'
                            : 'bg-white border border-zinc-700 text-zinc-900 rounded-bl-none shadow-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="p-3 border-t border-zinc-800 flex gap-2 bg-white">
              <input
                type="text"
                placeholder="Send a message to everyone..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-700 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black transition-colors"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-lg bg-black hover:bg-zinc-800 disabled:opacity-30 text-white transition-all shadow-sm border border-black"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: EXECUTIVE AI DEBRIEF                          */}
        {/* ==================================================== */}
        {activeTab === 'debrief' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-4">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
                  AI DEBRIEF
                </span>
                <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Executive Synthesis.
                </h3>
              </div>

              <button
                onClick={onGenerateDebrief}
                disabled={isGeneratingDebrief || transcriptHistory.length === 0}
                className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all border border-black"
              >
                <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isGeneratingDebrief ? 'animate-spin' : ''}`} />
                <span>{isGeneratingDebrief ? 'Analyzing...' : 'Summarize'}</span>
              </button>
            </div>

            {/* Debrief Content Container (Kuro Style) */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
              {!debrief ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-3">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                  <p className="font-semibold text-zinc-800">Debrief Standby</p>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Click "Summarize" above to transform current speech transcripts into an executive brief with objectives, decisions, and action items.
                  </p>
                </div>
              ) : (
                <>
                  {/* Executive Summary */}
                  {debrief.executive_summary && (
                    <div className="p-3.5 rounded-xl bg-white border border-zinc-700 space-y-1.5 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
                        Executive Summary
                      </span>
                      <p className="text-zinc-800 leading-relaxed text-[11px]">
                        {debrief.executive_summary}
                      </p>
                    </div>
                  )}

                  {/* Key Decisions (Emerald Highlight in Kuro Style with Dark Border) */}
                  {debrief.key_decisions && debrief.key_decisions.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-600 space-y-2 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 font-mono block">
                        Key Decisions
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-zinc-900 font-medium">
                        {debrief.key_decisions.map((dec, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-700 font-bold shrink-0">✓</span>
                            <span>{dec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {debrief.action_items && debrief.action_items.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-white border border-zinc-700 space-y-2 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
                        Action Items & Deliverables
                      </span>
                      <div className="space-y-1.5">
                        {debrief.action_items.map((act, i) => (
                          <div key={i} className="p-2 rounded-lg bg-zinc-50 border border-zinc-700 text-[11px]">
                            <p className="font-semibold text-zinc-900">{act.task}</p>
                            <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-1 font-mono font-medium">
                              <span>Owner: {act.owner}</span>
                              <span>Due: {act.deadline}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download DOCX Button (Kuro Solid Emerald / Black Button) */}
                  <form
                    action={`${apiBaseUrl}/api/meeting/export-docx`}
                    method="POST"
                    target="_blank"
                    className="pt-2"
                  >
                    <input
                      type="hidden"
                      name="request_json"
                      value={JSON.stringify({ debrief, transcript_history: transcriptHistory })}
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-all text-xs border border-emerald-700"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Executive DOCX Brief</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 5: MEETING INFO                                  */}
        {/* ==================================================== */}
        {activeTab === 'info' && (
          <div className="flex-1 p-5 space-y-5 text-xs text-zinc-700">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
                MEETING INFO
              </span>
              <h3 className="text-sm font-extrabold text-black tracking-tight mt-0.5">
                Meeting Details.
              </h3>
              <p className="text-zinc-600 text-xs mt-1">
                Share this link or meeting code with anyone you want in the call.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-700 space-y-3.5 shadow-xs">
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider">
                  Meeting Code
                </span>
                <p className="text-lg font-mono font-black text-black">
                  {roomId}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider">
                  Joining Link
                </span>
                <p className="text-xs text-zinc-600 break-all font-mono mt-0.5">
                  {window.location.origin}/meet/{roomId}
                </p>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-3 rounded-lg bg-black hover:bg-zinc-800 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Joining Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
