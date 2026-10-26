import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, CheckCircle2, AlertCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';

const PROMPTS = [
  {
    step: 1,
    title: 'Statement Cadence',
    type: 'Prosody & Pitch',
    text: "Good morning everyone, let's review the project updates and deadlines today."
  },
  {
    step: 2,
    title: 'Interrogative Query',
    type: 'Inflection & Formants',
    text: "Could you clarify the technical requirements for the next release schedule?"
  },
  {
    step: 3,
    title: 'Numeric Articulation',
    type: 'Phonetic Anchor',
    text: "One, two, three, four, five, six, seven, eight, nine, ten."
  }
];

export default function EnrollmentModal({
  isOpen,
  onClose,
  onEnrollmentSuccess,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}) {
  const [speakerName, setSpeakerName] = useState('');
  const [currentStep, setCurrentStep] = useState(1); // 1, 2, 3
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [samples, setSamples] = useState([null, null, null]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [micEnergy, setMicEnergy] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (!isOpen) {
      cleanupStreams();
      setSpeakerName('');
      setCurrentStep(1);
      setSamples([null, null, null]);
      setStatusMessage(null);
      setIsRecording(false);
    }
  }, [isOpen]);

  const cleanupStreams = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicEnergy(0);
  };

  const startSampleRecording = async () => {
    if (!speakerName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a participant name first.' });
      return;
    }
    setStatusMessage(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setMicEnergy(Math.min(100, Math.round(avg * 1.5)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setSamples((prev) => {
          const next = [...prev];
          next[currentStep - 1] = audioBlob;
          return next;
        });
        cleanupStreams();
        setIsRecording(false);
      };

      recorder.start(250);
      setIsRecording(true);
      setCountdown(5);

      let timeLeft = 5;
      timerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(timerRef.current);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone for enrollment:', err);
      setStatusMessage({ type: 'error', text: 'Could not access microphone.' });
      cleanupStreams();
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    setSamples((prev) => {
      const next = [...prev];
      next[currentStep - 1] = null;
      return next;
    });
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSubmitEnrollment = async () => {
    if (!speakerName.trim()) {
      setStatusMessage({ type: 'error', text: 'Speaker name is required.' });
      return;
    }
    if (!samples.every(Boolean)) {
      setStatusMessage({ type: 'error', text: 'All 3 voice prompts must be recorded.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('speaker_name', speakerName.trim());
      formData.append('sample1', samples[0], 'sample1.webm');
      formData.append('sample2', samples[1], 'sample2.webm');
      formData.append('sample3', samples[2], 'sample3.webm');

      const response = await fetch(`${apiBaseUrl}/api/enroll`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Voiceprint enrolled successfully! Profile persisted.`
        });
        if (onEnrollmentSuccess) {
          onEnrollmentSuccess(speakerName.trim());
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.detail || data.message || 'Failed to process voice enrollment.'
        });
      }
    } catch (err) {
      console.error('Enrollment API error:', err);
      setStatusMessage({ type: 'error', text: 'Network error contacting enrollment service.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentPrompt = PROMPTS[currentStep - 1];
  const stepSample = samples[currentStep - 1];
  const allRecorded = samples.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-white border-2 border-zinc-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono block">
              BIOMETRIC CALIBRATION
            </span>
            <h3 className="text-base font-extrabold text-zinc-900 tracking-tight">
              Voiceprint Registration.
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              3-prompt acoustic calibration for accurate cosine centroid extraction
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-[#fafafa]">
          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 font-mono">
              Participant Full Name
            </label>
            <input
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="e.g. Mohit Singh"
              disabled={isRecording || isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-zinc-700 focus:border-black focus:ring-1 focus:ring-black text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all shadow-sm"
            />
          </div>

          {/* 3 Steps Progress Bar (Kuro style solid black when active) */}
          <div className="grid grid-cols-3 gap-2">
            {PROMPTS.map((p) => {
              const isDone = Boolean(samples[p.step - 1]);
              const isCurrent = currentStep === p.step;
              return (
                <button
                  key={p.step}
                  onClick={() => !isRecording && setCurrentStep(p.step)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isCurrent
                      ? 'bg-black border-black text-white shadow-sm'
                      : isDone
                        ? 'bg-zinc-100 border-zinc-700 text-zinc-900'
                        : 'bg-white border-zinc-700 text-zinc-500 hover:border-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-0.5">
                    <span>Sample {p.step}</span>
                    {isDone && <CheckCircle2 className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-emerald-600'}`} />}
                  </div>
                  <div className={`text-[10px] truncate ${isCurrent ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {p.type}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Prompt Box */}
          <div className="p-5 rounded-xl bg-white border border-zinc-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span className="font-bold text-zinc-900">
                Step {currentStep}: {currentPrompt.title}
              </span>
              <span>5-Second Slice</span>
            </div>

            <p className="text-sm text-zinc-800 font-semibold leading-relaxed italic px-1">
              "{currentPrompt.text}"
            </p>

            {/* Audio Energy / Progress */}
            {isRecording && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Recording sample...
                  </span>
                  <span>{countdown}s remaining</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.max(10, micEnergy)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            {!stepSample ? (
              <button
                onClick={startSampleRecording}
                disabled={isRecording || isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-black hover:bg-zinc-800 active:scale-[0.99] text-white text-xs font-semibold shadow-sm disabled:opacity-40 transition-all"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>{isRecording ? `Recording (${countdown}s)...` : `Record Sample ${currentStep}`}</span>
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <button
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold border border-zinc-200 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                {currentStep < 3 ? (
                  <button
                    onClick={handleNextStep}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-black hover:bg-zinc-800 text-white text-xs font-semibold transition-colors"
                  >
                    <span>Proceed to Sample {currentStep + 1}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="text-xs text-emerald-700 font-semibold px-2 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>All 3 samples recorded!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2.5 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-white flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-black font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmitEnrollment}
            disabled={!allRecorded || isSubmitting || !speakerName.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Computing Centroid...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Register Biometric Profile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
