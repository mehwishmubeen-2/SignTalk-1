// frontend/src/app/hooks/useSpeechCaptions.ts
import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import type { CaptionMessage } from "../types/video";

const SILENCE_CLEAR_MS = 5000;

export const useSpeechCaptions = (
  enabled: boolean,
  onCaptionUpdate: (msg: CaptionMessage) => void
) => {
  const room = useRoomContext();
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCaption = () => {
    console.log("🗑️ CLEARING SPEECH CAPTION");
    const msg: CaptionMessage = {
      topic: "caption",
      type: "speech",
      text: "",
      isFinal: true,
      identity: room.localParticipant.identity,
    };

    console.log("Local caption clear message:", msg);
    onCaptionUpdate(msg);

    try {
      const remoteParticipants = room.participants || [];
      const destinationIds = remoteParticipants.map(p => p.identity);
      console.log("Publishing speech clear to", destinationIds.length, "participants:", destinationIds);
      const payload = new TextEncoder().encode(JSON.stringify(msg));
      room.localParticipant.publishData(payload, {
        reliable: true,
        topic: "caption",
        destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
      });
      console.log("✅ Speech caption clear published");
    } catch (err) {
      console.error("❌ Failed to publish speech caption clear:", err);
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      // Turning speech captions off should clear any caption immediately
      clearCaption();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser. Use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text: string = result[0].transcript.trim();
      const isFinal: boolean = result.isFinal;

      if (!text) return;

      console.log(`🎤 SPEECH RECOGNIZED: "${text}" (final: ${isFinal})`);

      const msg: CaptionMessage = {
        topic: "caption",
        type: "speech",
        text,
        isFinal,
        identity: room.localParticipant.identity,
      };

      // Show on local screen immediately
      console.log("Updating local speech caption:", msg);
      onCaptionUpdate(msg);

      // Broadcast to all participants via LiveKit data channel
      try {
        const remoteParticipants = room.participants || [];
        const destinationIds = remoteParticipants.map(p => p.identity);
        console.log("Publishing speech to", destinationIds.length, "participants:", destinationIds);
        const payload = new TextEncoder().encode(JSON.stringify(msg));
        room.localParticipant.publishData(payload, {
          reliable: true,
          topic: "caption",
          destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
        });
        console.log("✅ Speech caption published");
      } catch (err) {
        console.error("❌ Failed to publish speech caption:", err);
      }

      // Reset the silence timer: clear caption if nothing new is said for 5s
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(clearCaption, SILENCE_CLEAR_MS);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
    };

    // Auto-restart if stops due to silence
    recognition.onend = () => {
      if (enabled && recognitionRef.current) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled, room]);
};