/**
 * Real-time sign detection via WebSocket connection to the PyTorch backend.
 * Captures frames from the LOCAL camera video element, sends them as JPEG
 * (base64) and turns the server's predictions into captions shared through
 * the LiveKit data channel.
 *
 * Classes: bye, hello, how_are_you, i_am_fine, i_dont_know, i_know,
 * nice_to_meet_you, no_sign, see_you_later, what_is_your_name, whats_up
 */

import { useEffect, useRef } from "react";
import type React from "react";
import { useRoomContext } from "@livekit/components-react";
import type { CaptionMessage } from "../types/video";

type PredictionResponse = {
  type: "prediction";
  sign: string;
  confidence: number;
  processing_time_ms: number;
  hand_detected: boolean;
  prediction_number: number;
};

type ErrorResponse = {
  type: "error";
  message: string;
};

type SignStartMessage = {
  type: "sign_start";
};

type Status = "loading" | "ready" | "detecting" | "error";

// ---- MUST match how the training data was captured ------------------------
const FRAME_RATE = 30; // training FPS
const SEND_WIDTH = 640; // frame size the model saw during training
const SEND_HEIGHT = 480;
const MIRROR_FRAMES = false; // true if training frames were flipped (cv2.flip)
// ---------------------------------------------------------------------------

const WS_BASE = "ws://localhost:8000";
const JPEG_QUALITY = 0.8;
const MAX_BUFFERED_BYTES = 512 * 1024; // skip frames if the socket is backed up
const CONFIDENCE_THRESHOLD = 0.4;
const CAPTION_HOLD_MS = 3000; // keep caption visible after the hand leaves
const DEBUG = false;

const log = (msg: string, data?: unknown) => {
  if (DEBUG) console.log(`[sign-detection-ws] ${msg}`, data ?? "");
};

const formatSign = (sign: string) =>
  sign.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const useSignDetectionWebSocket = (
  videoEl: HTMLVideoElement | null,
  enabled: boolean,
  _canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onCaptionUpdate: (msg: CaptionMessage) => void,
  onStatus?: (status: Status) => void,
  onLetterPreview?: (letter: string | null) => void,
  roomId?: string,
  authToken?: string
) => {
  const room = useRoomContext();

  // Always read the latest callbacks/room from refs so WebSocket handlers
  // never run with stale props.
  const cbRef = useRef({ onCaptionUpdate, onStatus, onLetterPreview });
  cbRef.current = { onCaptionUpdate, onStatus, onLetterPreview };
  const roomRef = useRef(room);
  roomRef.current = room;

  const lastStatusRef = useRef<Status | "">("");
  const lastPreviewRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitStatus = (s: Status) => {
    if (lastStatusRef.current === s) return;
    lastStatusRef.current = s;
    cbRef.current.onStatus?.(s);
  };

  const emitPreview = (word: string | null) => {
    if (lastPreviewRef.current === word) return;
    lastPreviewRef.current = word;
    cbRef.current.onLetterPreview?.(word);
  };

  const broadcast = (text: string, isFinal: boolean) => {
    const r = roomRef.current;
    
    console.log("════════════════════════════════════════");
    console.log("🚀 BROADCAST FUNCTION CALLED");
    console.log("════════════════════════════════════════");
    console.log("Text:", text);
    console.log("IsFinal:", isFinal);
    console.log("Room object exists:", !!r);
    console.log("Room.localParticipant:", r?.localParticipant);
    console.log("Room.participants:", r?.participants);
    console.log("Room.participants count:", r?.participants?.length);
    
    if (r?.participants?.length > 0) {
      console.log("Remote participant IDs:", r.participants.map(p => p.identity));
    }
    
    const localIdentity = r?.localParticipant?.identity || "unknown";
    const msg: CaptionMessage = {
      topic: "caption",
      type: "sign",
      text,
      isFinal,
      identity: localIdentity,
    };
    
    console.log("Message to broadcast:", msg);
    cbRef.current.onCaptionUpdate(msg);
    console.log("✅ Local caption update called");
    
    try {
      const participant = r?.localParticipant;
      if (!participant) {
        console.error("❌ ERROR: localParticipant is null/undefined!");
        console.error("Room details:", {
          roomExists: !!r,
          localParticipantExists: !!r?.localParticipant,
          localParticipantType: typeof r?.localParticipant
        });
        return;
      }
      
      const encoded = new TextEncoder().encode(JSON.stringify(msg));
      const remoteParticipants = r?.participants || [];
      const destinationIds = remoteParticipants.map(p => p.identity);
      
      console.log("Publishing details:");
      console.log("  - Encoded bytes:", encoded.byteLength);
      console.log("  - Remote participants count:", remoteParticipants.length);
      console.log("  - Destination IDs:", destinationIds);
      
      if (destinationIds.length === 0) {
        console.warn("⚠️ WARNING: No remote participants! Caption won't be sent to anyone.");
      }
      
      console.log("Calling publishData with options:", {
        reliable: true,
        topic: "caption",
        destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
      });
      
      participant.publishData(encoded, { 
        reliable: true, 
        topic: "caption",
        destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
      });
      
      console.log("✅ publishData() succeeded");
      console.log("════════════════════════════════════════");
    } catch (err) {
      console.error("❌ publishData() failed:", err);
      console.error("Error details:", {
        message: (err as Error).message,
        stack: (err as Error).stack
      });
      console.log("════════════════════════════════════════");
    }
  };

  const scheduleClear = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null;
      emitPreview(null);
      broadcast("", true);
    }, CAPTION_HOLD_MS);
  };

  // The server now sends ONE prediction per finished sign (whole sign,
  // resampled to 32 frames), so no per-frame voting is needed here.
  const handleMessage = (event: MessageEvent) => {
    let data: PredictionResponse | ErrorResponse | SignStartMessage;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      log("Failed to parse message", err);
      return;
    }

    console.log("📥 PREDICTION RECEIVED:", data);

    if (data.type === "error") {
      log("Server error", data.message);
      emitStatus("error");
      return;
    }

    // Hand appeared: a sign is being recorded.
    if (data.type === "sign_start") {
      console.log("🖐️ Hand detected - recording sign...");
      emitPreview("Signing\u2026");
      return;
    }

    if (data.type !== "prediction") return;

    console.log(
      `✅ SIGN PREDICTION: ${data.sign} (${data.confidence.toFixed(2)}) server=${data.processing_time_ms}ms`
    );

    // Flicker / non-sign segment: just clear the "Signing..." preview.
    if (data.sign === "no_sign") {
      console.log("❌ No sign detected");
      emitPreview(null);
      return;
    }

    const pct = Math.round(data.confidence * 100);

    // Low confidence: tentative preview only, never committed to the caption.
    if (data.confidence < CONFIDENCE_THRESHOLD) {
      console.log(`⚠️ Low confidence (${pct}%) - not broadcasting`);
      emitPreview(`${formatSign(data.sign)} ${pct}%?`);
      return;
    }

    console.log(`🚀 Broadcasting sign: ${formatSign(data.sign)}`);
    emitPreview(`${formatSign(data.sign)} ${pct}%`);
    broadcast(formatSign(data.sign), false); // classes are whole sentences: replace, don't append
    scheduleClear();
  };

  useEffect(() => {
    if (!enabled || !videoEl || !roomId || !authToken) {
      emitStatus("ready");
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let captureTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let statTimer: ReturnType<typeof setInterval> | null = null;
    let seq = 0;
    let sentInWindow = 0;

    // One fixed-size offscreen canvas: every frame has identical dimensions.
    const canvas = document.createElement("canvas");
    canvas.width = SEND_WIDTH;
    canvas.height = SEND_HEIGHT;
    const ctx = canvas.getContext("2d");

    const captureAndSend = (socket: WebSocket) => {
      if (!ctx || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        console.warn("⚠️ WebSocket buffered amount exceeded:", socket.bufferedAmount);
        return; // backpressure
      }
      if (videoEl.readyState < 2 || videoEl.videoWidth === 0) {
        console.warn("⚠️ Video element not ready:", {
          readyState: videoEl.readyState,
          videoWidth: videoEl.videoWidth
        });
        return;
      }

      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;

      // Center-crop the source to the training aspect ratio (no stretching).
      const target = SEND_WIDTH / SEND_HEIGHT;
      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      if (vw / vh > target) {
        sw = vh * target;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / target;
        sy = (vh - sh) / 2;
      }

      if (MIRROR_FRAMES) {
        ctx.save();
        ctx.translate(SEND_WIDTH, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, SEND_WIDTH, SEND_HEIGHT);
        ctx.restore();
      } else {
        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, SEND_WIDTH, SEND_HEIGHT);
      }

      // Synchronous encode keeps frames strictly in order.
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

      emitStatus("detecting");
      const frameMsg = { type: "frame", data: base64, ts: Date.now(), seq: seq++ };
      socket.send(JSON.stringify(frameMsg));
      sentInWindow += 1;
      
      if (seq % 30 === 0) {  // Log every 30 frames (roughly once per second at 30 FPS)
        console.log(`📤 Frame #${seq}: sent ${base64.length} bytes, buffered: ${socket.bufferedAmount}`);
      }
    };

    const stopCapture = () => {
      if (captureTimer) {
        clearInterval(captureTimer);
        captureTimer = null;
      }
    };

    const connect = () => {
      if (disposed) return;
      emitStatus("loading");

      const url = `${WS_BASE}/meetings/ws/${roomId}/sign-detect?token=${encodeURIComponent(authToken)}`;
      console.log("🔌 WebSocket connecting to:", `${WS_BASE}/meetings/ws/${roomId}/sign-detect`);
      console.log("Full URL (with token):", url);
      const socket = new WebSocket(url);
      ws = socket;

      socket.onopen = () => {
        console.log("✅ WebSocket OPENED - Ready to send frames");
        log("WebSocket connected");
        emitStatus("ready");
        stopCapture();
        captureTimer = setInterval(() => captureAndSend(socket), 1000 / FRAME_RATE);
        console.log(`📹 Capture started at ${FRAME_RATE} FPS`);
      };
      
      socket.onmessage = (event) => {
        console.log("📩 WebSocket message received, parsing...");
        handleMessage(event);
      };
      
      socket.onerror = (err) => {
        console.error("❌ WebSocket ERROR:", err);
        emitStatus("error");
      };
      
      socket.onclose = () => {
        console.log("❌ WebSocket CLOSED");
        log("WebSocket closed");
        stopCapture();
        if (disposed) return;
        emitStatus("error");
        console.log("🔄 Reconnecting in 2 seconds...");
        retryTimer = setTimeout(connect, 2000); // simple auto-reconnect
      };
    };

    if (DEBUG) {
      statTimer = setInterval(() => {
        log(`Effective send rate: ${(sentInWindow / 2).toFixed(1)} fps`);
        sentInWindow = 0;
      }, 2000);
    }

    connect();

    return () => {
      disposed = true;
      stopCapture();
      if (retryTimer) clearTimeout(retryTimer);
      if (statTimer) clearInterval(statTimer);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoEl, roomId, authToken]);
};