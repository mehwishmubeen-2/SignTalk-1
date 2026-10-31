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
import { useActiveCall } from "../context/ActiveCallContext";
import type { CaptionMessage } from "../types/video";

// ─── Main page: fetches token then mounts LiveKitRoom ────────────────────────

export default function VideoCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { setActiveCall, endCall } = useActiveCall();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

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

        setAuthToken(accessToken);

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

  // Handle browser back button — navigate to video-call landing (not -1)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log("📞 Back button pressed — minimizing call and going to video-call page");
      if (token && serverUrl && roomId) {
        // Store the call info for later restoration
        setActiveCall({
          roomId,
          token,
          serverUrl,
          isMinimized: true,
        });
      }
      // Navigate to video-call landing page (where user started the call)
      navigate("/video-call");
    };

    // Listen for browser back button
    window.addEventListener("popstate", handlePopState);
    
    // Push state to enable back button handling
    window.history.pushState({ callPage: true }, "");

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [token, serverUrl, roomId, navigate, setActiveCall]);

  if (error) return <ErrorScreen message={error} onBack={() => navigate("/")} />;
  if (!token || !serverUrl) return <LoadingScreen />;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={{ resolution: { width: 640, height: 480, frameRate: 30 } }}
      audio={true}
      onDisconnected={() => {
        console.log("📞 Call disconnected by server/user");
        endCall();
        navigate("/");
      }}
      onError={(err) => setError(err.message)}
      style={{ height: "100vh", background: "radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 32%), linear-gradient(135deg,#fffaf0 0%,#f2fbf8 48%,#fff3ed 100%)" }}
    >
      <CallRoom roomId={roomId!} authToken={authToken || ""} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── CallRoom: lives inside LiveKitRoom so it can access room context ─────────

function CallRoom({ roomId, authToken }: { roomId: string; authToken: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const navigate = useNavigate();
  const { setActiveCall } = useActiveCall();
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

  // ── DEBUG: Track signMode changes ──────────────────────────────────────────
  useEffect(() => {
    console.log("🎯 CallRoom MOUNTED");
    return () => console.log("🎯 CallRoom UNMOUNTED");
  }, []);

  useEffect(() => {
    console.log("🎯 signMode changed:", signMode);
  }, [signMode]);

  // ── Text-to-Speech Voice-Over for Captions ──────────────────────────────────
  const playVoiceOver = (text: string) => {
    // Cancel any ongoing speech
    window.speechSynthesis?.cancel();
    
    console.log("🔊 Playing voice-over:", text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;      // Normal speed
    utterance.pitch = 1.0;     // Normal pitch
    utterance.volume = 1.0;    // Full volume
    utterance.lang = "en-US";  // English
    
    utterance.onstart = () => {
      console.log("🔊 Voice-over started");
    };
    
    utterance.onend = () => {
      console.log("🔊 Voice-over completed");
    };
    
    utterance.onerror = (event) => {
      console.error("🔊 Voice-over error:", event.error);
    };
    
    window.speechSynthesis?.speak(utterance);
  };

  // ── Receive captions from remote participants via LiveKit data channel ──────
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      console.log("════════════════════════════════════════");
      console.log("📨 DataReceived event triggered!");
      console.log("Payload size:", payload.byteLength, "bytes");
      
      try {
        const decoded = new TextDecoder().decode(payload);
        console.log("Decoded text:", decoded);
        
        const msg = JSON.parse(decoded) as CaptionMessage;
        console.log("Parsed message:", msg);
        
        if (msg.topic !== "caption") {
          console.log("⏭️ Ignoring non-caption message, topic:", msg.topic);
          console.log("════════════════════════════════════════");
          return;
        }

        console.log(`✅ Caption from ${msg.identity}: "${msg.text}"`);

        // If empty text received, clear caption immediately
        if (!msg.text) {
          console.log(`🗑️ Clearing caption for ${msg.identity}`);
          // Cancel any ongoing voice-over
          window.speechSynthesis?.cancel();
          console.log("🔊 Voice-over cancelled");
          
          setCaptions((prev) => {
            const next = { ...prev };
            delete next[msg.identity];
            return next;
          });
          console.log("════════════════════════════════════════");
          return;
        }

        console.log("Updating captions state with new message");
        setCaptions((prev) => ({ ...prev, [msg.identity]: msg }));
        
        // Play voice-over ONLY for sign captions, not speech
        if (msg.type === "sign") {
          console.log("🔊 Voice-over triggered for sign caption");
          playVoiceOver(msg.text);
        } else {
          console.log("🔊 Voice-over skipped for speech caption");
        }

        // Auto-clear after 4 seconds of no update
        const timeout = setTimeout(() => {
          console.log(`⏰ Auto-clearing caption for ${msg.identity} after 4 seconds`);
          // Cancel voice-over when clearing
          window.speechSynthesis?.cancel();
          console.log("🔊 Voice-over cancelled (auto-clear)");
          
          setCaptions((prev) => {
            if (prev[msg.identity]?.text === msg.text) {
              const next = { ...prev };
              delete next[msg.identity];
              return next;
            }
            return prev;
          });
        }, 4000);
        
        console.log("════════════════════════════════════════");
      } catch (err) {
        console.error("❌ Error parsing data message:", err);
        console.error("Raw payload (first 200 bytes):", payload.slice(0, 200));
        console.log("════════════════════════════════════════");
      }
    };

    console.log("🔗 Registering RoomEvent.DataReceived listener");
    room.on(RoomEvent.DataReceived, handleData);
    
    return () => { 
      console.log("🔌 Unregistering RoomEvent.DataReceived listener");
      room.off(RoomEvent.DataReceived, handleData); 
    };
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

  // ── Minimize call and return to video-call landing ──────────────────────────
  const minimizeCall = useCallback(() => {
    console.log("📞 Minimize button clicked — storing call and going to video-call page");
    if (room) {
      // Store call info for later restoration
      setActiveCall({
        roomId,
        token: "", // We don't have direct access to token here, but room stays connected
        serverUrl: "", // Same as above
        isMinimized: true,
      });
    }
    // Navigate to video-call landing page
    navigate("/video-call");
  }, [roomId, navigate, setActiveCall, room]);

  // ── Local caption handler ────────────────────────────────────────────────────
  const handleLocalCaption = useCallback((msg: CaptionMessage) => {
    console.log(`[VideoCall] handleLocalCaption called:`, msg);
    // Clear if empty
    if (!msg.text) {
      console.log(`[VideoCall] clearing caption for ${msg.identity}`);
      setCaptions((prev) => {
        const next = { ...prev };
        delete next[msg.identity];
        return next;
      });
      return;
    }
    console.log(`[VideoCall] setting caption for ${msg.identity}: "${msg.text}"`);
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
            roomId={roomId}
            authToken={authToken}
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
          console.log("🎯 onToggleSign clicked, current signMode:", signMode);
          setSignMode((v) => {
            const newMode = !v;
            console.log("🎯 Setting signMode to:", newMode);
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
        onMinimize={minimizeCall}
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