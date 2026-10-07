// frontend/src/app/pages/VoiceToText.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Copy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { logActivityEvent } from '../../lib/activityApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmotionResult {
  code:  string;
  label: string;
  emoji: string;
  color: string;
  score: number;
}

interface TranscriptEntry {
  id:      number;
  text:    string;
  emotion: EmotionResult | null; // null = still detecting
}

const EMOTION_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  joy:      { label: "Happy",     emoji: "😊", color: "#22c55e" },
  sadness:  { label: "Sad",       emoji: "😢", color: "#3b82f6" },
  anger:    { label: "Angry",     emoji: "😠", color: "#ef4444" },
  fear:     { label: "Fear",      emoji: "😨", color: "#f97316" },
  surprise: { label: "Surprised", emoji: "😲", color: "#eab308" },
  disgust:  { label: "Disgust",   emoji: "🤢", color: "#a855f7" },
  neutral:  { label: "Neutral",   emoji: "😐", color: "#94a3b8" },
};

const FALLBACK_EMOTION: EmotionResult = {
  code: "neutral", label: "Neutral",
  emoji: "😐", color: "#94a3b8", score: 100,
};

const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
];

// ─────────────────────────────────────────────────────────────────────────────

export function VoiceToText() {
  const [isListening,       setIsListening]      = useState(false);
  const [entries,           setEntries]           = useState<TranscriptEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel,        setAudioLevel]        = useState(0);
  const [selectedLanguage,  setSelectedLanguage]  = useState("en-US");
  const [detectingEmotion,  setDetectingEmotion]  = useState(false);

  const recognitionRef  = useRef<any>(null);
  const entryCounterRef = useRef(0);
  const listenStartRef  = useRef<number | null>(null);

  // ── Audio level animation ─────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isListening) {
      interval = setInterval(() => setAudioLevel(Math.random() * 100), 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  // ── Detect emotion via backend → HuggingFace ─────────────────────────────
  const detectEmotion = useCallback(async (
    text: string,
    entryId: number
  ) => {
    if (!text || text.trim().length < 3) {
      setEntries((prev) =>
        prev.map((e) => e.id === entryId ? { ...e, emotion: FALLBACK_EMOTION } : e)
      );
      return;
    }

    setDetectingEmotion(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/emotion/detect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        }
      );

      if (!res.ok) throw new Error(`Backend error: ${res.status}`);

      const data = await res.json();
      console.log("[emotion] result:", data);

      const emotion: EmotionResult = {
        code:  data.code  ?? "neutral",
        label: data.label ?? "Neutral",
        emoji: data.emoji ?? "😐",
        color: data.color ?? "#94a3b8",
        score: data.score ?? 100,
      };

      setEntries((prev) =>
        prev.map((e) => e.id === entryId ? { ...e, emotion } : e)
      );

    } catch (err) {
      console.error("[emotion] detection failed:", err);
      // On failure show neutral instead of keeping spinner forever
      setEntries((prev) =>
        prev.map((e) => e.id === entryId ? { ...e, emotion: FALLBACK_EMOTION } : e)
      );
    } finally {
      setDetectingEmotion(false);
    }
  }, []);

  // ── START LISTENING ───────────────────────────────────────────────────────
  const handleStartListening = useCallback(() => {
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        toast.error("Speech recognition not supported. Use Chrome or Edge.");
        return;
      }

      const recognition          = new SpeechRecognition();
      recognition.lang           = selectedLanguage;
      recognition.continuous     = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        listenStartRef.current = Date.now();
        toast.success("Listening... Speak now");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final   = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += text;
          else interim += text;
        }

        if (final) {
          const trimmed = final.trim();
          const id      = ++entryCounterRef.current;

          // Add entry immediately with spinner (emotion: null)
          setEntries((prev) => [...prev, { id, text: trimmed, emotion: null }]);

          // Detect emotion in background
          detectEmotion(trimmed, id);
        }

        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error:", event.error);
        toast.error("Speech recognition error");
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        if (listenStartRef.current) {
          const duration_seconds = (Date.now() - listenStartRef.current) / 1000;
          listenStartRef.current = null;
          if (duration_seconds >= 1) {
            logActivityEvent('voice_to_text', { duration_seconds });
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch {
      toast.error("Could not access microphone");
      setIsListening(false);
    }
  }, [selectedLanguage, detectEmotion]);

  // ── STOP LISTENING ────────────────────────────────────────────────────────
  const handleStopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
    toast.info("Stopped listening");
  }, []);

  // ── CLEAR ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setEntries([]);
    setInterimTranscript("");
  }, []);

  const fullTranscript = entries.map((e) => e.text).join(" ");

  const emotionCounts = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.emotion) acc[e.emotion.label] = (acc[e.emotion.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="relative max-w-6xl mx-auto space-y-6 px-4 sm:px-0">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">Voice to Text</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Speak and convert voice to text with AI emotion detection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Input Card ── */}
        <Card className="border-2 border-white/70 bg-white/90 shadow-xl shadow-teal-900/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">Voice Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="text-center py-2">
              {isListening ? (
                <Mic className="w-16 h-16 text-orange-500 mx-auto animate-pulse" />
              ) : (
                <MicOff className="w-16 h-16 text-teal-700/45 mx-auto" />
              )}
              <p className="mt-2 text-sm text-slate-500">
                {isListening ? "Listening..." : "Click Start to begin"}
              </p>
            </div>

            {isListening && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Audio Level</p>
                <Progress value={audioLevel} />
              </div>
            )}

            {/* Emotion detecting indicator */}
            {detectingEmotion && (
              <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Analysing emotion...
              </div>
            )}

            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 w-full">
              {!isListening ? (
                <Button onClick={handleStartListening} className="flex-1 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 text-white shadow-md shadow-teal-900/15 hover:opacity-90">
                  <Mic className="w-4 h-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button onClick={handleStopListening} variant="destructive" className="flex-1">
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button variant="outline" onClick={handleClear} className="border-teal-900/20 bg-white/70 px-4 text-teal-800 hover:bg-teal-50">
                Clear
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* ── Output Card ── */}
        <Card className="border-2 border-white/70 bg-white/90 shadow-xl shadow-teal-900/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="min-h-[200px] max-h-[350px] overflow-y-auto rounded-lg border border-teal-900/10 bg-gradient-to-br from-white to-teal-50/40 p-3 space-y-2">
              {entries.length === 0 && !interimTranscript ? (
                <p className="text-slate-400 text-center text-sm pt-12">
                  Your transcript with emotion labels will appear here
                </p>
              ) : (
                <>
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-teal-900/10 bg-white p-3 shadow-sm"
                    >
                      {/* Emotion badge */}
                      <div className="flex-shrink-0 text-center min-w-[52px]">
                        {entry.emotion ? (
                          <>
                            <div className="text-2xl">{entry.emotion.emoji}</div>
                            <div
                              className="text-[10px] font-semibold mt-0.5"
                              style={{ color: entry.emotion.color }}
                            >
                              {entry.emotion.label}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {entry.emotion.score}%
                            </div>
                          </>
                        ) : (
                          // Spinner while backend is detecting
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <div className="w-6 h-6 border-2 border-teal-200 border-t-orange-500 rounded-full animate-spin" />
                            <span className="text-[9px] text-slate-400">detecting</span>
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <p className="text-sm text-slate-800 leading-relaxed pt-1 flex-1">
                        {entry.text}
                      </p>
                    </div>
                  ))}

                  {interimTranscript && (
                    <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <div className="text-xl mt-1">🎤</div>
                      <p className="text-sm text-slate-500 italic leading-relaxed pt-1">
                        {interimTranscript}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {entries.length > 0 && (
              <>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{fullTranscript.split(" ").filter(Boolean).length} words</span>
                  <Badge variant="outline">
                    {entries.length} sentence{entries.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-teal-900/20 bg-white/70 text-teal-800 hover:bg-teal-50"
                  onClick={() => {
                    navigator.clipboard.writeText(fullTranscript);
                    toast.success("Copied to clipboard!");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Full Transcript
                </Button>
              </>
            )}

          </CardContent>
        </Card>
      </div>

      {/* ── Emotion Summary ── */}
      {Object.keys(emotionCounts).length > 0 && (
        <Card className="border-2 border-white/70 bg-white/90 shadow-xl shadow-teal-900/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Emotion Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(emotionCounts).map(([label, count]) => {
                const info = Object.values(EMOTION_INFO).find((m) => m.label === label);
                return (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: `${info?.color}22`,
                      border: `1px solid ${info?.color}55`,
                      color: info?.color,
                    }}
                  >
                    <span>{info?.emoji}</span>
                    <span>{label}</span>
                    <span
                      className="rounded-full px-1.5 text-xs font-bold"
                      style={{ background: `${info?.color}33` }}
                    >
                      {count}×
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Powered by j-hartmann/emotion-english-distilroberta-base ·{" "}
              {entries.length} sentence{entries.length !== 1 ? "s" : ""} analysed
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}