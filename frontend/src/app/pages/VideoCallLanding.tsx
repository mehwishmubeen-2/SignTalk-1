// src/app/pages/VideoCallLanding.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Video, LogIn, Plus, Link2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../../lib/supabase";

const SESSION_CODE_KEY = "vc_pending_code";

export function VideoCallLanding() {
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [starting, setStarting] = useState(false);

  // Restore a code that was saved before redirecting to /auth
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_CODE_KEY);
    if (saved) {
      setJoinCode(saved);
      sessionStorage.removeItem(SESSION_CODE_KEY);
    }
  }, []);

  // ── Authenticate helper ────────────────────────────────────────────────────
  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // Redirect to login, preserving intent so user returns here after sign-in
  const redirectToAuth = (pendingCode?: string) => {
    if (pendingCode) sessionStorage.setItem(SESSION_CODE_KEY, pendingCode);
    navigate("/auth?returnTo=/video-call");
  };

  // ── Start a brand-new meeting ──────────────────────────────────────────────
  const startMeeting = async () => {
    const token = await getAccessToken();
    if (!token) { redirectToAuth(); return; }

    setStarting(true);
    try {
      const res = await fetch("http://localhost:8000/meetings/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { redirectToAuth(); return; }
      if (!res.ok) throw new Error("Failed to create meeting");

      const { room_id } = await res.json();
      navigate(`/call/${room_id}`);
    } catch (err) {
      console.error(err);
      alert("Could not start meeting. Is the backend running?");
    } finally {
      setStarting(false);
    }
  };

  // ── Join an existing meeting by code ───────────────────────────────────────
  const joinMeeting = async () => {
    setJoinError("");
    let input = joinCode.trim();

    // Accept full invite URLs: http://localhost:5173/call/abc-defg-hij
    try {
      const url = new URL(input);
      const parts = url.pathname.split("/").filter(Boolean);
      // pathname → ['call', 'abc-defg-hij']
      if (parts.length >= 2 && parts[0] === "call") {
        input = parts[1];
      }
    } catch {
      // Not a URL — treat input as a plain code
    }

    const code = input.toLowerCase();
    if (!code) { setJoinError("Please enter a meeting code or paste the invite link."); return; }

    const token = await getAccessToken();
    if (!token) { redirectToAuth(joinCode); return; }

    navigate(`/call/${code}`);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-700 via-emerald-500 to-orange-400 flex items-center justify-center shadow-lg shadow-teal-900/15">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">Video Calls</h1>
          <p className="text-slate-600 text-sm">
            Start a new meeting or join one with a code
          </p>
        </div>

        {/* Start new meeting */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            onClick={startMeeting}
            disabled={starting}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-teal-900/10 bg-gradient-to-br from-white to-teal-50/60 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-900/10 transition-all text-left group disabled:opacity-60"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-500 flex items-center justify-center shadow flex-shrink-0 group-hover:scale-105 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {starting ? "Creating meeting…" : "New meeting"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate a unique meeting code to share
              </p>
            </div>
          </button>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-slate-400 text-xs">
          <div className="flex-1 h-px bg-teal-900/10" />
          or join with a code
          <div className="flex-1 h-px bg-teal-900/10" />
        </div>

        {/* Join with code */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 rounded-2xl border-2 border-teal-900/10 bg-white/90 focus-within:border-teal-400 focus-within:shadow-md focus-within:shadow-teal-900/10 transition-all">
            <Link2 className="w-5 h-5 text-teal-700/50 flex-shrink-0" />
            <input
              type="text"
              placeholder="Code (abc-defg-hij) or paste full invite link"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>

          {joinError && (
            <p className="text-red-500 text-xs px-1">{joinError}</p>
          )}

          <Button
            onClick={joinMeeting}
            className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-white py-5 text-base rounded-xl shadow-md shadow-teal-900/15"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Join meeting
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400">
          The person who shares the code must start the meeting first.
        </p>
      </motion.div>
    </div>
  );
}
