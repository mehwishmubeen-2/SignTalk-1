// frontend/src/app/hooks/useSignCaptions.ts
// Word-level ASL recognition — MediaPipe HandLandmarker runs client-side
// (every video frame), Flask only classifies the finished 12-frame sequence.
// Classes: yes, no, please, thank you, hello

import { useEffect, useRef } from "react";
import type React from "react";
import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useRoomContext } from "@livekit/components-react";
import type { CaptionMessage } from "../types/video";

// ── Flask classification service ──────────────────────────────────────────────
const FLASK_BASE   = "http://localhost:5001";
const HEALTH_URL   = `${FLASK_BASE}/health`;
const SEQUENCE_URL = `${FLASK_BASE}/predict_sequence`;

// Same model asset + thresholds used to train the classifier (Python side),
// served locally so detection never depends on network latency.
const WASM_BASE_URL   = "/tasks-vision-wasm";
const MODEL_ASSET_URL = "/models/hand_landmarker.task";

type ClassifyResponse = {
  label:      string | null;
  confidence: number;
  error?:     string;
};

// ── Tuning constants ──────────────────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 0.55;  // minimum confidence to show prediction
const SMOOTH_N             = 4;     // vote over last N predictions
const HOLD_FRAMES_REQUIRED = 5;     // same word N times to commit
const COOLDOWN_FRAMES      = 20;    // wait before same word fires again
const NO_HAND_MS_CLEAR     = 3000;  // clear caption after 3s no hand
const MISS_TOLERANCE       = 4;     // brief motion-blur dropouts before giving up
const CLASSIFY_THROTTLE_MS = 150;   // min gap between classify requests

// ── Hand connections for drawing ─────────────────────────────────────────────
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// ── Draw landmarks using RENDERED video size (fixes stuck landmarks) ──────────
function drawLandmarks(
  canvas: HTMLCanvasElement | null,
  videoEl: HTMLVideoElement | null,
  landmarks: Array<{ x: number; y: number }> | null
) {
  if (!canvas || !videoEl) return;

  // Use rendered CSS size, not stream resolution — this fixes landmarks stuck
  const rect = videoEl.getBoundingClientRect();
  const W    = rect.width  > 0 ? rect.width  : (videoEl.videoWidth  || 640);
  const H    = rect.height > 0 ? rect.height : (videoEl.videoHeight || 480);

  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  if (!landmarks?.length) return;

  // No CSS mirroring on the local video element — draw landmarks as-is.
  const pts = landmarks.map((p) => ({ x: p.x * W, y: p.y * H }));

  ctx.strokeStyle = "rgba(255,165,0,0.85)";
  ctx.lineWidth   = 2;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  });
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#facc15" : "#00ffff";
    ctx.fill();
  });
}

// Wrist-relative, max-abs-scale normalization — must match the Python
// training pipeline exactly (flask_sign/app.py extract_landmarks_from_frame).
function normalizeLandmarks(landmarks: NormalizedLandmark[]): Float32Array {
  const wrist = landmarks[0];
  const rel = new Float32Array(landmarks.length * 3);
  let idx = 0;
  for (const lm of landmarks) {
    rel[idx++] = lm.x - wrist.x;
    rel[idx++] = lm.y - wrist.y;
    rel[idx++] = lm.z - wrist.z;
  }
  let maxAbs = 0;
  for (let i = 0; i < rel.length; i++) {
    const v = Math.abs(rel[i]);
    if (v > maxAbs) maxAbs = v;
  }
  const scale = maxAbs + 1e-6;
  for (let i = 0; i < rel.length; i++) rel[i] /= scale;
  return rel;
}

// ─────────────────────────────────────────────────────────────────────────────

export const useSignCaptions = (
  videoEl: HTMLVideoElement | null,
  enabled: boolean,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onCaptionUpdate: (msg: CaptionMessage) => void,
  onStatus?: (status: "loading" | "ready" | "detecting" | "error") => void,
  onLetterPreview?: (letter: string | null) => void
) => {
  const room = useRoomContext();

  const rafIdRef      = useRef<number | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const inFlightRef   = useRef(false);

  // Rolling sequence of normalized per-frame feature vectors, built client-side.
  const sequenceBufferRef    = useRef<Float32Array[]>([]);
  const consecutiveMissesRef = useRef(0);
  const lastFeaturesRef      = useRef<Float32Array | null>(null);
  const lastLandmarksRef     = useRef<Array<{ x: number; y: number }> | null>(null);
  const framesRequiredRef    = useRef(12);
  const lastClassifyTimeRef  = useRef(0);

  const smoothBufRef  = useRef<string[]>([]);
  const confBufRef    = useRef<number[]>([]);
  const holdLabelRef  = useRef<string | null>(null);
  const holdCountRef  = useRef(0);
  const cooldownRef   = useRef(0);

  const sentenceRef    = useRef<string>("");
  const clearTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastStatusRef  = useRef<string>("");
  const lastPreviewRef = useRef<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const emitStatus = (s: "loading"|"ready"|"detecting"|"error") => {
    if (lastStatusRef.current === s) return;
    lastStatusRef.current = s;
    onStatus?.(s);
  };

  const emitPreview = (word: string | null) => {
    if (lastPreviewRef.current === word) return;
    lastPreviewRef.current = word;
    onLetterPreview?.(word);
  };

  const broadcast = (text: string, isFinal: boolean) => {
    const msg: CaptionMessage = {
      topic:    "caption",
      type:     "sign",
      text,
      isFinal,
      identity: room.localParticipant.identity,
    };
    onCaptionUpdate(msg);
    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(msg)),
        { reliable: true, topic: "caption" }
      );
    } catch (err) {
      console.error("[sign-captions] broadcast failed:", err);
    }
  };

  const resetClearTimer = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      sentenceRef.current = "";
      emitPreview(null);
      broadcast("", true);
    }, NO_HAND_MS_CLEAR);
  };

  const resetSequenceAndSmoothing = () => {
    sequenceBufferRef.current    = [];
    consecutiveMissesRef.current = 0;
    lastFeaturesRef.current      = null;
    lastLandmarksRef.current     = null;
    holdLabelRef.current         = null;
    holdCountRef.current         = 0;
    smoothBufRef.current         = [];
    confBufRef.current           = [];
  };

  // ── Process a classification response (label smoothing / hold / commit) ───
  const processClassification = (result: ClassifyResponse) => {
    if (!result.label) return;

    const label      = result.label;
    const confidence = result.confidence;

    if (confidence < CONFIDENCE_THRESHOLD) {
      emitPreview(`${label} ${Math.round(confidence * 100)}%?`);
      return;
    }

    // Temporal smoothing over the sliding-window sequence — majority vote
    // across recent predictions, each paired with its real model confidence.
    smoothBufRef.current.push(label);
    confBufRef.current.push(confidence);
    if (smoothBufRef.current.length > SMOOTH_N) smoothBufRef.current.shift();
    if (confBufRef.current.length > SMOOTH_N) confBufRef.current.shift();

    const freq: Record<string, number> = {};
    smoothBufRef.current.forEach((l) => { freq[l] = (freq[l] || 0) + 1; });
    const [smoothed, votes] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    const agreement = votes / smoothBufRef.current.length;

    // Real confidence = average model confidence over the frames that
    // actually predicted the majority word — this is what gets displayed,
    // not just how many frames agreed with each other.
    const matchingConf = smoothBufRef.current
      .map((l, i) => (l === smoothed ? confBufRef.current[i] : null))
      .filter((c): c is number => c !== null);
    const avgConfidence = matchingConf.reduce((a, b) => a + b, 0) / matchingConf.length;
    const confPct       = Math.round(avgConfidence * 100);

    if (agreement < 0.5) {
      emitPreview(`${smoothed} ${confPct}%?`);
      return;
    }

    // Hold detection — require temporal stability before committing a word.
    if (smoothed === holdLabelRef.current) {
      holdCountRef.current++;
    } else {
      holdLabelRef.current = smoothed;
      holdCountRef.current = 1;
    }

    emitPreview(`${smoothed} ${confPct}%`);

    if (cooldownRef.current > 0) { cooldownRef.current--; return; }

    // Commit word
    if (holdCountRef.current >= HOLD_FRAMES_REQUIRED) {
      holdCountRef.current = 0;
      cooldownRef.current  = COOLDOWN_FRAMES;
      emitPreview(`${smoothed} ${confPct}%`);
      setTimeout(() => emitPreview(null), 500);

      sentenceRef.current = (sentenceRef.current + " " + smoothed).trim();
      broadcast(sentenceRef.current, false);
      console.log(`[sign-captions] ✅ Word committed: "${smoothed}" (${confPct}% confidence) → "${sentenceRef.current}"`);
    }
  };

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !videoEl) return;

    let cancelled = false;
    emitStatus("loading");

    // Offscreen canvas snapshot of the raw (unflipped) video frame — there is
    // no CSS mirroring on this element, so no orientation correction is needed.
    const offscreen = document.createElement("canvas");
    const offCtx    = offscreen.getContext("2d")!;

    const classifySequence = async (frames: Float32Array[]) => {
      inFlightRef.current = true;
      try {
        const sequence = new Array(frames.length * 63);
        let idx = 0;
        for (const f of frames) for (let i = 0; i < f.length; i++) sequence[idx++] = f[i];

        const res = await fetch(SEQUENCE_URL, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sequence }),
        });

        if (!res.ok) {
          console.error("[sign-captions] Flask error:", res.status);
          return;
        }

        const result: ClassifyResponse = await res.json();
        if (!cancelled) processClassification(result);
      } catch (err) {
        console.error("[sign-captions] Network error:", err);
      } finally {
        inFlightRef.current = false;
      }
    };

    const runDetection = () => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      offscreen.width  = videoEl.videoWidth;
      offscreen.height = videoEl.videoHeight;
      offCtx.drawImage(videoEl, 0, 0, offscreen.width, offscreen.height);

      const result = landmarker.detect(offscreen);
      const hand = result.landmarks?.[0];

      if (!hand) {
        consecutiveMissesRef.current++;
        // Give up only once the sequence is empty or misses exceed tolerance —
        // fast hand motion causes brief blur misses even mid-sign.
        if (sequenceBufferRef.current.length === 0 || consecutiveMissesRef.current > MISS_TOLERANCE) {
          drawLandmarks(canvasRef.current, videoEl, null);
          emitPreview(null);
          emitStatus("ready");
          resetSequenceAndSmoothing();
          if (cooldownRef.current > 0) cooldownRef.current--;
          return;
        }
        // Brief dropout — hold the last known pose so the sequence keeps going.
        drawLandmarks(canvasRef.current, videoEl, lastLandmarksRef.current);
        if (lastFeaturesRef.current) {
          sequenceBufferRef.current.push(lastFeaturesRef.current);
          if (sequenceBufferRef.current.length > framesRequiredRef.current) sequenceBufferRef.current.shift();
        }
      } else {
        consecutiveMissesRef.current = 0;
        const features = normalizeLandmarks(hand);
        lastFeaturesRef.current  = features;
        lastLandmarksRef.current = hand.map((p) => ({ x: p.x, y: p.y }));
        drawLandmarks(canvasRef.current, videoEl, lastLandmarksRef.current);
        sequenceBufferRef.current.push(features);
        if (sequenceBufferRef.current.length > framesRequiredRef.current) sequenceBufferRef.current.shift();
      }

      emitStatus("detecting");
      resetClearTimer();

      const have  = sequenceBufferRef.current.length;
      const total = framesRequiredRef.current;
      if (have < total) {
        emitPreview(`... ${have}/${total}`);
        return;
      }

      const now = performance.now();
      if (!inFlightRef.current && now - lastClassifyTimeRef.current >= CLASSIFY_THROTTLE_MS) {
        lastClassifyTimeRef.current = now;
        void classifySequence([...sequenceBufferRef.current]);
      }
    };

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const baseOptions = {
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          runningMode: "IMAGE" as const,
        };

        let landmarker: HandLandmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...baseOptions,
            baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate: "CPU" },
          });
        } catch (cpuErr) {
          console.warn("[sign-captions] CPU delegate failed, falling back to GPU:", cpuErr);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...baseOptions,
            baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate: "GPU" },
          });
        }

        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        try {
          const res = await fetch(HEALTH_URL);
          const health = await res.json();
          if (health?.frames_required) framesRequiredRef.current = health.frames_required;
        } catch {
          // keep default frame count
        }

        emitStatus("ready");
        console.log(`[sign-captions] Client-side HandLandmarker ready, frames_required=${framesRequiredRef.current}`);

        const tick = () => {
          if (cancelled) return;
          runDetection();
          rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[sign-captions] HandLandmarker init failed:", err);
        emitStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (clearTimerRef.current)     clearTimeout(clearTimerRef.current);
      rafIdRef.current    = null;
      inFlightRef.current = false;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      resetSequenceAndSmoothing();
      cooldownRef.current    = 0;
      sentenceRef.current    = "";
      const c = canvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      emitStatus("ready");
      emitPreview(null);
      lastStatusRef.current  = "";
      lastPreviewRef.current = null;
      console.log("[sign-captions] Word mode stopped");
    };
  }, [enabled, videoEl]);
};