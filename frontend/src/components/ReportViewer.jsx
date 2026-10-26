import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  CheckSquare, 
  ListTodo, 
  Users, 
  Sparkles, 
  Loader2, 
  Copy, 
  Check, 
  ChevronRight 
} from 'lucide-react';

export default function ReportViewer({
  debrief,
  transcriptHistory = [],
  isLoading = false,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}) {
  const [activeTab, setActiveTab] = useState('executive'); // 'executive' | 'intents' | 'actions' | 'markdown'
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadDocx = async () => {
    if (!debrief) return;
    setIsDownloading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/meeting/export-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          debrief,
          transcript_history: transcriptHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to download executive DOCX report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VocalSync_Executive_Report_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading DOCX report:', err);
      alert('Error downloading report: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyMarkdown = () => {
    if (debrief?.raw_markdown) {
      navigator.clipboard.writeText(debrief.raw_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-zinc-800 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-600 flex items-center justify-center text-purple-600">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">
            Synthesizing Executive Intelligence...
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Google Gemini is compiling multi-speaker intent, core decisions, and deliverables into the debrief.
          </p>
        </div>
      </div>
    );
  }

  if (!debrief) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-zinc-800 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-700 flex items-center justify-center text-zinc-600">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
            EXECUTIVE INTELLIGENCE
          </span>
          <p className="font-extrabold text-zinc-900 text-sm mt-0.5">Debrief Standby.</p>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">
            When your conversation concludes, click "End & Generate Debrief" to compile the intent analysis and export the DOCX brief.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Top Bar with Navigation Tabs and Export Button */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-white flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs (Kuro style segmented controls with Dark Border) */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-700">
          <button
            onClick={() => setActiveTab('executive')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'executive'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('intents')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'intents'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Intents ({debrief.speaker_intents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'actions'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Decisions
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'markdown'
                ? 'bg-black text-white shadow-sm'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Markdown
          </button>
        </div>

        {/* DOCX Download Button */}
        <button
          onClick={handleDownloadDocx}
          disabled={isDownloading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold shadow-sm transition-all"
          title="Export executive report to Microsoft Word format"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Formatting DOCX...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Download DOCX</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5 text-sm bg-[#fafafa]">
        {/* TAB 1: EXECUTIVE BRIEF */}
        {activeTab === 'executive' && (
          <div className="space-y-4">
            {/* Title & Banner */}
            <div className="p-4 rounded-xl bg-white border border-zinc-700 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">
                STRATEGIC INTELLIGENCE BRIEF
              </span>
              <h2 className="text-base font-extrabold text-zinc-900 mt-0.5 tracking-tight">
                {debrief.meeting_title || 'Executive Biometric Sync.'}
              </h2>
            </div>

            {/* Objective (Purple Banner in Kuro Style with Visible Dark Border) */}
            <div className="p-3.5 rounded-xl border-2 border-purple-600 bg-purple-50/50 space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-700 font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Meeting Objective
              </span>
              <p className="text-zinc-900 text-xs leading-relaxed font-medium">
                {debrief.objective || 'General operational briefing and multi-speaker synchronization.'}
              </p>
            </div>

            {/* Executive Summary */}
            <div className="p-4 rounded-xl bg-white border border-zinc-700 space-y-1.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">
                Executive Synthesis
              </span>
              <p className="text-zinc-800 leading-relaxed text-xs">
                {debrief.executive_summary}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: SPEAKER INTENT MATRIX */}
        {activeTab === 'intents' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span className="font-semibold text-zinc-700">
                ATTRIBUTION MATRIX
              </span>
              <span>{debrief.speaker_intents?.length || 0} Identified</span>
            </div>

            <div className="space-y-2.5">
              {debrief.speaker_intents?.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white border border-zinc-700 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-600" />
                      {item.speaker}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-700 font-semibold">
                      {item.role_or_identity}
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5">
                    <span className="text-zinc-500 font-medium">Contributions:</span>
                    <p className="text-zinc-800">{item.key_contributions}</p>
                  </div>

                  <div className="text-xs space-y-0.5 pt-1.5 border-t border-zinc-300">
                    <span className="text-purple-700 font-semibold">Underlying Motive:</span>
                    <p className="text-zinc-700 italic">{item.underlying_intent}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DECISIONS & ACTIONS */}
        {activeTab === 'actions' && (
          <div className="space-y-5">
            {/* Decisions */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                Key Decisions Made
              </span>
              <div className="space-y-2">
                {debrief.key_decisions?.length > 0 ? (
                  debrief.key_decisions.map((dec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 border border-emerald-600 text-zinc-900 text-xs shadow-xs"
                    >
                      <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span className="font-semibold">{dec}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 italic">No formal decisions logged.</p>
                )}
              </div>
            </div>

            {/* Action Items */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-zinc-700" />
                Action Items & Deliverables
              </span>
              <div className="space-y-2">
                {debrief.action_items?.length > 0 ? (
                  debrief.action_items.map((act, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-zinc-700 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-zinc-500 text-black focus:ring-0"
                        />
                        <span className="text-zinc-900 font-semibold">{act.task}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <span className="font-bold text-zinc-800 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-700">
                          {act.owner}
                        </span>
                        <span className="text-zinc-500">
                          {act.deadline}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 italic">No action items assigned.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RAW MARKDOWN */}
        {activeTab === 'markdown' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={copyMarkdown}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-zinc-700 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Markdown'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-white border border-zinc-200 font-mono text-xs text-zinc-800 leading-relaxed overflow-x-auto whitespace-pre-wrap shadow-inner">
              {debrief.raw_markdown || 'No raw markdown generated.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
