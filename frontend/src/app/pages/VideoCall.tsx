// src/pages/VideoCallPage.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent } from "livekit-client";
import { supabase } from "../../lib/supabase";
import { logActivityEvent } from "../../lib/activityApi";
import ParticipantVideoTile from "../components/ui/ParticipantVideoTile";
import CallControls from "../components/ui/CallControls";
import type { CaptionMessage } from "../types/video";

// ─── Main page: fetches token then mounts LiveKitRoom ────────────────────────

export default function VideoCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard: if there's no roomId in the URL, redirect home immediately
  useEffect(() => {
    if (!roomId) {
      navigate("/", { replace: true });
    }
  }, [roomId, navigate]);

  useEffect(() => {
    if (!roomId) return;

    const fetchToken = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Not authenticated");

        const res = await fetch(
          `http://localhost:8000/meetings/${roomId}/token`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (res.status === 401) throw new Error("Session expired — please sign in again");
        if (!res.status.toString().startsWith("2")) throw new Error("Failed to get meeting token");
        const data = await res.json();
        setToken(data.token);
        setServerUrl(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    };

    fetchToken();
  }, [roomId]);

  if (error) return <ErrorScreen message={error} onBack={() => navigate("/")} />;
  if (!token || !serverUrl) return <LoadingScreen />;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={{ resolution: { width: 640, height: 480, frameRate: 30 } }}
      audio={true}
      onDisconnected={() => navigate("/")}
      onError={(err) => setError(err.message)}
      style={{ height: "100vh", background: "radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 32%), linear-gradient(135deg,#fffaf0 0%,#f2fbf8 48%,#fff3ed 100%)" }}
    >
      <CallRoom roomId={roomId!} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── CallRoom: lives inside LiveKitRoom so it can access room context ─────────

function CallRoom({ roomId }: { roomId: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // caption state: keyed by participant identity → latest caption text
  const [captions, setCaptions] = useState<Record<string, CaptionMessage>>({});

  // ── Log call duration for the Dashboard once this room session ends ─────────
  useEffect(() => {
    const start = Date.now();
    return () => {
      const duration_seconds = (Date.now() - start) / 1000;
      if (duration_seconds >= 5) {
        logActivityEvent('video_call', { duration_seconds });
      }
    };
  }, []);

  // mic / camera / sign-mode controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [signMode, setSignMode] = useState(false);
  const [speechMode, setSpeechMode] = useState(false);

  // ── Receive captions from remote participants via LiveKit data channel ──────
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as CaptionMessage;
        if (msg.topic !== "caption") return;

        // If empty text received, clear caption immediately
        if (!msg.text) {
          setCaptions((prev) => {
            const next = { ...prev };
            delete next[msg.identity];
            return next;
          });
          return;
        }

        setCaptions((prev) => ({ ...prev, [msg.identity]: msg }));

        // Auto-clear after 4 seconds of no update
        setTimeout(() => {
          setCaptions((prev) => {
            if (prev[msg.identity]?.text === msg.text) {
              const next = { ...prev };
              delete next[msg.identity];
              return next;
            }
            return prev;
          });
        }, 4000);
      } catch {
        // malformed packet
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!micEnabled);
    setMicEnabled((v) => !v);
  }, [localParticipant, micEnabled]);

  // ── Toggle camera ───────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    await localParticipant.setCameraEnabled(!cameraEnabled);
    setCameraEnabled((v) => !v);
  }, [localParticipant, cameraEnabled]);

  // ── Leave call ──────────────────────────────────────────────────────────────
  const leaveCall = useCallback(async () => {
    await room.disconnect();
  }, [room]);

  // ── Local caption handler ────────────────────────────────────────────────────
  const handleLocalCaption = useCallback((msg: CaptionMessage) => {
    // Clear if empty
    if (!msg.text) {
      setCaptions((prev) => {
        const next = { ...prev };
        delete next[msg.identity];
        return next;
      });
      return;
    }
    setCaptions((prev) => ({ ...prev, [msg.identity]: msg }));
  }, []);

  // ── Copy invite link ─────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const copyInviteLink = useCallback(() => {
    const link = `${window.location.origin}/call/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  return (
    <div style={styles.page}>
      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={styles.roomLabel}>Meeting code:</span>
          <code style={styles.roomCode}>{roomId}</code>
          <button onClick={copyInviteLink} style={styles.copyBtn}>
            {copied ? "✓ Copied!" : "Copy invite link"}
          </button>
        </div>
        <span style={styles.participantCount}>
          {participants.length} participant{participants.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Video grid ── */}
      <div style={styles.videoGrid(tracks.length)}>
        {tracks.map((track) => (
          <ParticipantVideoTile
            key={track.participant.identity}
            trackRef={track}
            caption={captions[track.participant.identity] ?? null}
            isLocal={track.participant.identity === localParticipant.identity}
            signMode={signMode}
            speechMode={speechMode}
            onCaptionUpdate={handleLocalCaption}
          />
        ))}
      </div>

      {/* ── Controls ── */}
      <CallControls
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        signMode={signMode}
        speechMode={speechMode}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleSign={() => {
          setSignMode((v) => {
            const newMode = !v;
            // if turning OFF sign mode, clear local caption immediately
            if (!newMode) {
              setCaptions((prev) => {
                const next = { ...prev };
                delete next[localParticipant.identity];
                return next;
              });
            }
            return newMode;
          });
        }}
        onToggleSpeech={() => setSpeechMode((v) => !v)}
        onLeave={leaveCall}
      />
    </div>
  );
}

// ─── Utility screens ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={styles.centeredScreen}>
      <style>{`@keyframes lk-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.spinner} />
      <p style={{ color: "#475569", marginTop: 16 }}>Connecting to meeting...</p>
    </div>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={styles.centeredScreen}>
      <p style={{ color: "#e11d48", marginBottom: 12 }}>{message}</p>
      <button onClick={onBack} style={styles.backBtn}>← Go back</button>
    </div>
  );
}

// ─── Styles (plain objects, no extra lib needed) ──────────────────────────────

const styles = {
  page: {
    display: "flex" as const,
    flexDirection: "column" as const,
    height: "100vh",
    background: "radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 32%), linear-gradient(135deg,#fffaf0 0%,#f2fbf8 48%,#fff3ed 100%)",
    color: "#0f172a",
    fontFamily: "inherit",
  },
  topBar: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    padding: "10px 20px",
    background: "rgba(255,255,255,0.88)",
    borderBottom: "1px solid rgba(19,78,74,0.12)",
    boxShadow: "0 12px 35px rgba(15,23,42,0.07)",
    backdropFilter: "blur(18px)",
    fontSize: 13,
    color: "#475569",
  },
  roomLabel: { color: "#0f172a", fontWeight: 500 },
  roomCode: {
    background: "#ecfdf5",
    color: "#0f766e",
    padding: "2px 10px",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 14,
    letterSpacing: "0.08em",
    border: "1px solid rgba(15,118,110,0.22)",
  },
  copyBtn: {
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid rgba(249,115,22,0.28)",
    borderRadius: 6,
    padding: "3px 12px",
    cursor: "pointer",
    fontSize: 12,
    transition: "color 0.2s",
  },
  participantCount: { color: "#64748b" },
  videoGrid: (count: number) => ({
    flex: 1,
    display: "grid" as const,
    gridTemplateColumns: count <= 1
      ? "1fr"
      : count <= 2
      ? "1fr 1fr"
      : count <= 4
      ? "1fr 1fr"
      : "repeat(3, 1fr)",
    gridTemplateRows: count <= 2 ? "1fr" : "1fr 1fr",
    gap: 8,
    padding: 8,
    overflow: "hidden" as const,
  }),
  centeredScreen: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: "100vh",
    background: "radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 32%), linear-gradient(135deg,#fffaf0 0%,#f2fbf8 48%,#fff3ed 100%)",
    color: "#0f172a",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(15,118,110,0.14)",
    borderTop: "3px solid #f97316",
    borderRadius: "50%",
    animation: "lk-spin 0.9s linear infinite",
  },
  backBtn: {
    background: "linear-gradient(90deg,#0f766e,#10b981,#f97316)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    cursor: "pointer",
    fontSize: 14,
  },
};