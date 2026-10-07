// frontend/src/app/components/ui/ParticipantVideoTile.tsx
import { useRef, useEffect, useState } from "react";
import { VideoTrack } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { useSignCaptions } from "../../hooks/useSignCaptions";
import { useSpeechCaptions } from "../../hooks/useSpeechCaptions";
import type { CaptionMessage } from "../../types/video";

interface Props {
  trackRef: TrackReferenceOrPlaceholder;
  caption: CaptionMessage | null;
  isLocal: boolean;
  signMode: boolean;
  speechMode: boolean;
  onCaptionUpdate: (msg: CaptionMessage) => void;
}

export default function ParticipantVideoTile({
  trackRef,
  caption,
  isLocal,
  signMode,
  speechMode,
  onCaptionUpdate,
}: Props) {
  const participant = trackRef.participant;
  const tileRef     = useRef<HTMLDivElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // Canvas ref for landmark drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status + letter preview from sign hook
  const [signStatus, setSignStatus]       = useState<string>("");
  const [letterPreview, setLetterPreview] = useState<string | null>(null);

  // ── Find video element using interval — more reliable than useEffect ──────
  // Keeps polling until the <video> tag is rendered by LiveKit
  useEffect(() => {
    if (!isLocal) return; // only need video el for local tile (inference runs locally)

    const interval = setInterval(() => {
      if (!tileRef.current) return;
      const vid = tileRef.current.querySelector("video");
      if (vid) {
        const videoElement = vid as HTMLVideoElement;
        console.log(
          "✅ Video element found, readyState:",
          videoElement.readyState,
          "signMode:", signMode
        );
        setVideoEl(videoElement);
        clearInterval(interval);
      }
    }, 200); // check every 200ms until found

    return () => clearInterval(interval);
  }, [isLocal]); // run once when component mounts for local tile

  // ── Sign captions hook ────────────────────────────────────────────────────
  useSignCaptions(
    isLocal && signMode ? videoEl : null,
    isLocal && signMode,
    canvasRef,
    onCaptionUpdate,
    (status) => setSignStatus(status),
    (letter) => setLetterPreview(letter)
  );

  // ── Speech captions hook ──────────────────────────────────────────────────
  useSpeechCaptions(isLocal && speechMode, onCaptionUpdate);

  // ── Display name + initials ───────────────────────────────────────────────
  const displayName = participant.name ?? participant.identity ?? "?";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={tileRef} style={styles.tile}>

      {/* ── Video or avatar placeholder ── */}
      {trackRef.publication ? (
        <VideoTrack trackRef={trackRef} style={styles.video} />
      ) : (
        <div style={styles.avatarWrapper}>
          <div style={styles.avatarCircle}>{initials}</div>
        </div>
      )}

      {/* ── Canvas overlay for landmark drawing ── */}
      {isLocal && signMode && (
        <canvas ref={canvasRef} style={styles.canvas} />
      )}

      {/* ── Name badge ── */}
      <div style={styles.nameBadge}>
        {displayName}
        {isLocal && (
          <span style={{ color: "#888", marginLeft: 4 }}>(you)</span>
        )}
      </div>

      {/* ── Caption bar ── */}
      {caption?.text && (
        <div style={styles.captionBar}>
          <span
            style={{
              ...styles.captionLabel,
              color: caption.type === "sign" ? "#99f6e4" : "#fdba74",
            }}
          >
            {caption.type === "sign" ? "✦ SIGN" : "🎤 SPEECH"}
          </span>
          {caption.text}
        </div>
      )}

      {/* ── Predicted word / letter preview ── */}
      {isLocal && signMode && letterPreview && (
        <div style={styles.letterPreview}>Detected: {letterPreview}</div>
      )}

      {/* ── Mode + status badges ── */}
      {isLocal && (
        <div style={styles.badges}>
          {signMode && (
            <span
              style={{
                ...styles.badge,
                borderColor: "#0f766e",
                color:
                  signStatus === "detecting" ? "#99f6e4" : "#ccfbf1",
              }}
            >
              ✦{" "}
              {signStatus === "loading"
                ? "Loading..."
                : signStatus === "detecting"
                ? "Detecting"
                : signStatus === "error"
                ? "Error"
                : "Sign ON"}
            </span>
          )}
          {speechMode && (
            <span
              style={{
                ...styles.badge,
                borderColor: "#f97316",
                color: "#fed7aa",
              }}
            >
              🎤 Speech ON
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  tile: {
    position: "relative" as const,
    background: "linear-gradient(135deg,#0f172a,#134e4a)",
    borderRadius: 10,
    overflow: "hidden" as const,
    border: "1px solid rgba(19,78,74,0.18)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
    minHeight: 180,
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block" as const,
  },
  canvas: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none" as const,
  },
  avatarWrapper: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "100%",
    height: "100%",
    minHeight: 200,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#0f766e,#10b981,#f97316)",
    color: "#ffffff",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontSize: 26,
    fontWeight: 600,
  },
  nameBadge: {
    position: "absolute" as const,
    top: 10,
    left: 12,
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 5,
    zIndex: 2,
  },
  captionBar: {
    position: "absolute" as const,
    bottom: 10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.75)",
    color: "#fff",
    fontSize: 13,
    lineHeight: 1.5,
    padding: "5px 16px",
    borderRadius: 6,
    maxWidth: "88%",
    textAlign: "center" as const,
    whiteSpace: "pre-wrap" as const,
    zIndex: 2,
  },
  captionLabel: {
    display: "block" as const,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
  },
  letterPreview: {
    position: "absolute" as const,
    bottom: 55,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,118,110,0.9)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    padding: "6px 14px",
    borderRadius: 999,
    zIndex: 3,
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  },
  badges: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 4,
    alignItems: "flex-end" as const,
    zIndex: 2,
  },
  badge: {
    fontSize: 10,
    padding: "2px 7px",
    borderRadius: 4,
    border: "1px solid",
    background: "rgba(0,0,0,0.4)",
  },
};