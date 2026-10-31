# Code Changes - Diff Summary

## File 1: frontend/src/app/hooks/useSignDetectionWebSocket.ts

### Location: Lines 92-128 (broadcast function)

#### BEFORE:
```typescript
  const broadcast = (text: string, isFinal: boolean) => {
    const r = roomRef.current;
    const msg: CaptionMessage = {
      topic: "caption",
      type: "sign",
      text,
      isFinal,
      identity: r.localParticipant?.identity || "unknown",
    };
    cbRef.current.onCaptionUpdate(msg);
    try {
      r.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(msg)),
        { reliable: true, topic: "caption" }
      );
    } catch (err) {
      log("broadcast failed", err);
    }
  };
```

#### AFTER:
```typescript
  const broadcast = (text: string, isFinal: boolean) => {
    const r = roomRef.current;
    const localIdentity = r.localParticipant?.identity || "unknown";
    const msg: CaptionMessage = {
      topic: "caption",
      type: "sign",
      text,
      isFinal,
      identity: localIdentity,
    };
    
    console.log(`[useSignDetectionWebSocket] broadcast() called: identity=${localIdentity}, text="${text}", isFinal=${isFinal}`);
    cbRef.current.onCaptionUpdate(msg);
    
    try {
      const participant = r.localParticipant;
      if (!participant) {
        console.error("[useSignDetectionWebSocket] broadcast failed: localParticipant is null/undefined");
        console.log("[useSignDetectionWebSocket] room.localParticipant:", r.localParticipant);
        console.log("[useSignDetectionWebSocket] room object keys:", Object.keys(r || {}));
        return;
      }
      const encoded = new TextEncoder().encode(JSON.stringify(msg));
      const remoteParticipants = r.participants || [];
      const destinationIds = remoteParticipants.map(p => p.identity);
      console.log(`[useSignDetectionWebSocket] publishing ${encoded.byteLength} bytes to ${remoteParticipants.length} remote participants: ${destinationIds.join(", ")}`);
      
      participant.publishData(encoded, { 
        reliable: true, 
        topic: "caption",
        destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
      });
      console.log("[useSignDetectionWebSocket] publishData() succeeded");
    } catch (err) {
      console.error("[useSignDetectionWebSocket] publishData() failed:", err);
    }
  };
```

#### Key Changes:
- ✅ Added `destinationIdentities` parameter to `publishData()`
- ✅ Extract remote participant list and map to identity array
- ✅ Added detailed console logging
- ✅ Improved error handling with explicit null checks

---

## File 2: frontend/src/app/hooks/useSpeechCaptions.ts

### Location 1: Lines 16-35 (clearCaption function)

#### BEFORE:
```typescript
  const clearCaption = () => {
    const msg: CaptionMessage = {
      topic: "caption",
      type: "speech",
      text: "",
      isFinal: true,
      identity: room.localParticipant.identity,
    };

    onCaptionUpdate(msg);

    try {
      const payload = new TextEncoder().encode(JSON.stringify(msg));
      room.localParticipant.publishData(payload, {
        reliable: true,
        topic: "caption",
      });
    } catch (err) {
      console.error("Failed to publish speech caption clear:", err);
    }
  };
```

#### AFTER:
```typescript
  const clearCaption = () => {
    const msg: CaptionMessage = {
      topic: "caption",
      type: "speech",
      text: "",
      isFinal: true,
      identity: room.localParticipant.identity,
    };

    onCaptionUpdate(msg);

    try {
      const remoteParticipants = room.participants || [];
      const destinationIds = remoteParticipants.map(p => p.identity);
      const payload = new TextEncoder().encode(JSON.stringify(msg));
      room.localParticipant.publishData(payload, {
        reliable: true,
        topic: "caption",
        destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
      });
    } catch (err) {
      console.error("Failed to publish speech caption clear:", err);
    }
  };
```

#### Key Changes:
- ✅ Added destination participant extraction
- ✅ Added `destinationIdentities` parameter

### Location 2: Lines 70-95 (recognition.onresult handler)

#### BEFORE:
```typescript
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text: string = result[0].transcript.trim();
      const isFinal: boolean = result.isFinal;

      if (!text) return;

      const msg: CaptionMessage = {
        topic: "caption",
        type: "speech",
        text,
        isFinal,
        identity: room.localParticipant.identity,
      };

      // Show on local screen immediately
      onCaptionUpdate(msg);

      // Broadcast to all participants via LiveKit data channel
      try {
        const payload = new TextEncoder().encode(JSON.stringify(msg));
        room.localParticipant.publishData(payload, {
          reliable: true,
          topic: "caption",
        });
      } catch (err) {
        console.error("Failed to publish speech caption:", err);
      }

      // Reset the silence timer: clear caption if nothing new is said for 5s
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(clearCaption, SILENCE_CLEAR_MS);
    };
```

#### AFTER:
```typescript
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text: string = result[0].transcript.trim();
      const isFinal: boolean = result.isFinal;

      if (!text) return;

      const msg: CaptionMessage = {
        topic: "caption",
        type: "speech",
        text,
        isFinal,
        identity: room.localParticipant.identity,
      };

      // Show on local screen immediately
      onCaptionUpdate(msg);

      // Broadcast to all participants via LiveKit data channel
      try {
        const remoteParticipants = room.participants || [];
        const destinationIds = remoteParticipants.map(p => p.identity);
        const payload = new TextEncoder().encode(JSON.stringify(msg));
        room.localParticipant.publishData(payload, {
          reliable: true,
          topic: "caption",
          destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined
        });
      } catch (err) {
        console.error("Failed to publish speech caption:", err);
      }

      // Reset the silence timer: clear caption if nothing new is said for 5s
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(clearCaption, SILENCE_CLEAR_MS);
    };
```

#### Key Changes:
- ✅ Added destination participant extraction
- ✅ Added `destinationIdentities` parameter

---

## File 3: frontend/src/app/pages/VideoCall.tsx

### Location 1: Lines 130-175 (DataReceived event handler)

#### BEFORE:
```typescript
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
```

#### AFTER:
```typescript
  // ── Receive captions from remote participants via LiveKit data channel ──────
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as CaptionMessage;
        console.log("📨 Received data message:", msg);
        if (msg.topic !== "caption") {
          console.log("📨 Ignoring non-caption message, topic:", msg.topic);
          return;
        }

        console.log(`📨 Caption from ${msg.identity}: "${msg.text}"`);

        // If empty text received, clear caption immediately
        if (!msg.text) {
          console.log(`📨 Clearing caption for ${msg.identity}`);
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
      } catch (err) {
        console.error("📨 Error parsing data message:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);
```

#### Key Changes:
- ✅ Added detailed console logging with 📨 prefix
- ✅ Better error reporting
- ✅ Visibility into message processing

### Location 2: Lines 189-201 (handleLocalCaption)

#### BEFORE:
```typescript
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
```

#### AFTER:
```typescript
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
```

#### Key Changes:
- ✅ Added console logging
- ✅ Easier debugging of local caption updates

---

## File 4: backend/app/emotion/router.py

### Location: Line 16

#### BEFORE:
```python
print("[emotion] ✅ Emotion model ready")
```

#### AFTER:
```python
print("[emotion] [OK] Emotion model ready")
```

#### Key Changes:
- ✅ Fixed Windows Unicode emoji encoding error

---

## File 5: backend/app/grammar/router.py

### Location: Line 26

#### BEFORE:
```python
print("[grammar] ✅ Grammar-correction model ready")
```

#### AFTER:
```python
print("[grammar] [OK] Grammar-correction model ready")
```

#### Key Changes:
- ✅ Fixed Windows Unicode emoji encoding error

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Files Modified | 5 |
| Total Lines Changed | ~55 |
| New Code Added | ~30 lines |
| Code Removed | ~5 lines |
| Net Addition | ~25 lines |
| Complexity Added | Minimal |
| Performance Impact | Negligible |
| Breaking Changes | None |

---

## Change Categories

### Critical Fixes (Core Bug)
- useSignDetectionWebSocket.ts: Add destinationIdentities ✅
- useSpeechCaptions.ts: Add destinationIdentities (2 places) ✅

### Quality Improvements (Logging)
- VideoCall.tsx: Enhanced logging ✅
- useSignDetectionWebSocket.ts: Added error logging ✅

### Compatibility Fixes (Backend)
- emotion/router.py: Fix emoji encoding ✅
- grammar/router.py: Fix emoji encoding ✅

---

## Testing Impact

These changes should be tested with:
- ✅ 2 participants signing
- ✅ 3+ participants signing
- ✅ Speech mode with 2+ participants
- ✅ Late participant joining
- ✅ Console logging verification
