// src/components/ui/MinimizedCallPreview.tsx
import { useNavigate } from "react-router";
import { X, Maximize2 } from "lucide-react";
import { useActiveCall } from "../../context/ActiveCallContext";

export function MinimizedCallPreview() {
  const navigate = useNavigate();
  const { activeCall, endCall } = useActiveCall();

  if (!activeCall || !activeCall.isMinimized) {
    return null;
  }

  const handleRestore = () => {
    console.log("📞 Restoring call from minimized state");
    navigate(`/call/${activeCall.roomId}`);
  };

  const handleClose = () => {
    console.log("📞 Closing minimized call preview");
    endCall();
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Background blur preview */}
        <div style={styles.preview}>
          <div style={styles.blur} />
          <p style={styles.previewText}>Call in progress...</p>
        </div>

        {/* Header with room code */}
        <div style={styles.header}>
          <span style={styles.roomCode}>Room: {activeCall.roomId}</span>
          <div style={styles.actions}>
            <button
              onClick={handleRestore}
              title="Restore call"
              style={styles.btn}
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={handleClose}
              title="Close minimized preview"
              style={styles.btn}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Restore button */}
        <button
          onClick={handleRestore}
          style={styles.restoreBtn}
        >
          ← Return to Call
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    bottom: 20,
    right: 20,
    zIndex: 1000,
    animation: "slideIn 0.3s ease-out",
  },
  wrapper: {
    width: 280,
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(255,255,255,0.95)",
    border: "2px solid #14b8a6",
    boxShadow: "0 20px 40px rgba(15,23,42,0.25)",
    backdropFilter: "blur(8px)",
  },
  preview: {
    position: "relative" as const,
    height: 160,
    background: "linear-gradient(135deg, #134e4a 0%, #0f766e 100%)",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    cursor: "pointer" as const,
    transition: "opacity 0.2s ease" as const,
  },
  blur: {
    position: "absolute" as const,
    inset: 0,
    background: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"noise\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\"/></filter></svg>#noise')",
    opacity: 0.3,
  },
  previewText: {
    position: "relative" as const,
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: 500,
    zIndex: 1,
  },
  header: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    padding: "10px 12px",
    borderBottom: "1px solid rgba(19,78,74,0.1)",
    background: "rgba(15,118,110,0.05)",
  },
  roomCode: {
    fontSize: 12,
    color: "#0f766e",
    fontWeight: 600,
    fontFamily: "monospace",
  },
  actions: {
    display: "flex" as const,
    gap: 6,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "none",
    background: "#ecfdf5",
    color: "#0f766e",
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    transition: "all 0.15s ease" as const,
  },
  restoreBtn: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    background: "linear-gradient(135deg, #0f766e 0%, #0d6b62 100%)",
    color: "white",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer" as const,
    transition: "all 0.15s ease" as const,
  },
};

// Add slideIn animation to page
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0) translateY(0);
    }
  }
  
  button[style*="restoreBtn"]:hover {
    opacity: 0.9;
  }
`;
if (typeof document !== "undefined") {
  document.head.appendChild(styleSheet);
}
