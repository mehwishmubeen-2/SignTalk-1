// frontend/src/app/hooks/useSpeechEmotion.ts
import { useState, useRef, useCallback } from "react";

const EMOTION_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  hap: { label: "Happy",   emoji: "😊", color: "#22c55e" },
  sad: { label: "Sad",     emoji: "😢", color: "#3b82f6" },
  ang: { label: "Angry",   emoji: "😠", color: "#ef4444" },
  neu: { label: "Neutral", emoji: "😐", color: "#94a3b8" },
  dis: { label: "Disgust", emoji: "🤢", color: "#a855f7" },
  fea: { label: "Fear",    emoji: "😨", color: "#f97316" },
  exc: { label: "Excited", emoji: "🤩", color: "#eab308" },
};

export interface EmotionResult {
  code:   string;
  label:  string;
  emoji:  string;
  color:  string;
  score:  number;
}

export const useSpeechEmotion = () => {
  const [emotion, setEmotion]     = useState<EmotionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const mediaRecorderRef          = useRef<MediaRecorder | null>(null);
  const chunksRef                 = useRef<Blob[]>([]);

  // ── Start recording audio ───────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      setError("Microphone access denied");
    }
  }, []);

  // ── Stop recording and detect emotion ───────────────────────────────────
  const stopAndDetect = useCallback((): Promise<EmotionResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(null); return; }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // need at least 1 second of audio
        if (audioBlob.size < 1000) { resolve(null); return; }

        setDetecting(true);
        setError(null);

        try {
          const HF_TOKEN = import.meta.env.VITE_HF_TOKEN;

          const response = await fetch(
            "https://api-inference.huggingface.co/models/speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/octet-stream",
              },
              body: audioBlob,
            }
          );

          if (!response.ok) throw new Error(`API error: ${response.status}`);

          const data = await response.json();
          console.log("[emotion] raw response:", data);

          // HuggingFace returns array sorted by score descending
          // e.g. [{ label: "hap", score: 0.87 }, { label: "neu", score: 0.10 }, ...]
          if (!Array.isArray(data) || data.length === 0) {
            resolve(null);
            return;
          }

          const top   = data[0];
          const code  = top.label?.toLowerCase() ?? "neu";
          const info  = EMOTION_MAP[code] ?? EMOTION_MAP["neu"];

          const result: EmotionResult = {
            code,
            label: info.label,
            emoji: info.emoji,
            color: info.color,
            score: Math.round(top.score * 100),
          };

          setEmotion(result);
          resolve(result);

        } catch (err) {
          console.error("[emotion] detection failed:", err);
          setError("Emotion detection failed");
          resolve(null);
        } finally {
          setDetecting(false);
        }

        // Stop all tracks to release mic
        recorder.stream.getTracks().forEach((t) => t.stop());
      };

      recorder.stop();
    });
  }, []);

  const clearEmotion = useCallback(() => setEmotion(null), []);

  return {
    emotion,
    detecting,
    error,
    startRecording,
    stopAndDetect,
    clearEmotion,
  };
};