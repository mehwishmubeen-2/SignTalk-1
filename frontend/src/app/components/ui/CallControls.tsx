// src/components/video/CallControls.tsx
import { Mic, MicOff, Video, VideoOff, Hand } from "lucide-react";
import { CallEndIcon } from "./CallEndIcon";

interface Props {
  micEnabled: boolean;
  cameraEnabled: boolean;
  signMode: boolean;
  speechMode: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSign: () => void;
  onToggleSpeech: () => void;
  onLeave: () => void;
}

export default function CallControls({
  micEnabled,
  cameraEnabled,
  signMode,
  speechMode,
  onToggleMic,
  onToggleCamera,
  onToggleSign,
  onToggleSpeech,
  onLeave,
}: Props) {
  return (
    <div style={styles.bar}>
      {/* ── Left side: caption toggles ── */}
      <div style={styles.section}>
        <ControlButton
          onClick={onToggleSign}
          active={signMode}
          activeColor="#0f766e"
          title={signMode ? "Turn off sign captions" : "Turn on sign captions"}
          label="Sign"
          icon={<Hand size={18} />}
        />
        <ControlButton
          onClick={onToggleSpeech}
          active={speechMode}
          activeColor="#f97316"
          title={speechMode ? "Turn off speech captions" : "Turn on speech captions"}
          label="Speech"
          icon={<Mic size={18} />}
        />
      </div>

      {/* ── Centre: core call controls ── */}
      <div style={styles.section}>
        <IconButton
          onClick={onToggleMic}
          active={!micEnabled}
          dangerWhenActive
          title={micEnabled ? "Mute mic" : "Unmute mic"}
          icon={micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        />
        <IconButton
          onClick={onToggleCamera}
          active={!cameraEnabled}
          dangerWhenActive
          title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
          icon={cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        />
        <button
          onClick={onLeave}
          title="Leave call"
          style={{ ...styles.iconBtn, width: 56, background: "#e11d48", border: "none", color: "#fff" }}
        >
          <CallEndIcon size={20} />
        </button>
      </div>

      {/* ── Right side: placeholder for future (screen share etc.) ── */}
      <div style={styles.section} />
    </div>
  );
}

function IconButton({
  onClick,
  active,
  dangerWhenActive,
  title,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  dangerWhenActive?: boolean;
  title: string;
  icon: React.ReactNode;
}) {
  const isDanger = active && dangerWhenActive;
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...styles.iconBtn,
        background: isDanger ? "#e11d48" : "#3c4043",
        border: "none",
        color: "#ffffff",
      }}
    >
      {icon}
    </button>
  );
}

function ControlButton({
  onClick,
  active,
  activeColor,
  title,
  label,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  activeColor: string;
  title: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...styles.textBtn,
        background: active ? activeColor + "22" : "#ffffff",
        border: active ? `1px solid ${activeColor}` : "1px solid rgba(19,78,74,0.12)",
        color: active ? activeColor : "#475569",
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  );
}

const styles = {
  bar: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "10px 24px",
    background: "rgba(255,255,255,0.88)",
    borderTop: "1px solid rgba(19,78,74,0.12)",
    boxShadow: "0 -12px 35px rgba(15,23,42,0.07)",
    backdropFilter: "blur(18px)",
    height: 70,
  },
  section: {
    display: "flex" as const,
    gap: 10,
    alignItems: "center" as const,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    boxShadow: "0 8px 18px rgba(15,23,42,0.15)",
    transition: "background 0.15s ease",
  },
  textBtn: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 2,
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    minWidth: 56,
    height: 44,
    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
  },
};