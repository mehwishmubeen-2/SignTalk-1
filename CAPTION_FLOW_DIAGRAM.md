# SignTalk Caption Broadcasting - Complete Flow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPTION BROADCASTING FLOW                     │
└─────────────────────────────────────────────────────────────────┘

SENDER (Person A performing sign)
┌───────────────────────────────────┐
│ 1. Enable Sign Detection Mode      │  ✅ Sign button toggled ON
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 2. WebSocket Connect              │  📍 LOG: 🔌 WebSocket connecting
│    to Backend                      │  📍 LOG: ✅ WebSocket OPENED
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 3. Capture Video Frame             │  📍 LOG: 📹 Capture started at 30 FPS
│    from Camera                      │  📍 LOG: 📤 Frame #X: sent ... bytes
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 4. Send Frame via WebSocket        │  🌐 Frame travels over network
│    to Backend                      │
└───────────────────────────────────┘
              │
              ▼  (Backend Processing)
┌───────────────────────────────────┐
│ 5. Backend Processes Frame:        │
│    • Extract hand pose             │  🔧 PyTorch inference
│    • Run through ML models         │  🔧 Ensemble prediction
│    • Generate prediction           │  🔧 Calculate confidence
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 6. Send Prediction back to         │  🌐 WebSocket message returned
│    Frontend via WebSocket          │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 7. Receive Prediction              │  📍 LOG: 📥 PREDICTION RECEIVED
│    Check Confidence                │  📍 LOG: ✅ SIGN PREDICTION: HELLO (0.85)
└───────────────────────────────────┘
              │
      ┌───────┴───────┐
      │               │
      ▼ (≥ 0.75)      ▼ (< 0.75)
  ✅ BROADCAST   ⚠️ LOW CONFIDENCE
      │               │
      ▼               ▼
   BROADCAST       PREVIEW ONLY
   TO ROOM       (not sent to others)
      │
      ▼
┌───────────────────────────────────┐
│ 8. Format Caption Message          │  📍 LOG: Message to broadcast: {topic: "caption", ...}
│    {                               │
│      topic: "caption",             │
│      type: "sign",                 │
│      text: "HELLO",                │
│      identity: "user-123"          │
│    }                               │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 9. Encode Message                  │  📍 LOG: Encoded bytes: 156
│    (JSON → UTF-8 bytes)            │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 10. Get Remote Participants        │  📍 LOG: Room.participants count: 2
│     from LiveKit Room              │  📍 LOG: Remote participant IDs: ["user-456", "user-789"]
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 11. Create Destination List        │  📍 LOG: Destination IDs: ["user-456", "user-789"]
│     destinationIdentities:         │
│     ["user-456", "user-789"]       │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 12. Call publishData() on          │  📍 LOG: 🚀 BROADCAST FUNCTION CALLED
│     LocalParticipant with          │  📍 LOG: Calling publishData with options: ...
│     destinationIdentities          │
└───────────────────────────────────┘
              │
      ┌───────┴───────┐
      │               │
      ▼ (Success)     ▼ (Error)
   ✅ Published    ❌ Failed
      │               │
      ▼               ▼
   TO LIVEKIT    LOG ERROR
   SERVER        & Return
      │
      ▼
   📍 LOG: ✅ publishData() succeeded

═══════════════════════════════════════════════════════════════════
                      LIVEKIT SERVER
         (Routes message to all destination participants)
═══════════════════════════════════════════════════════════════════

RECEIVER (Other participants - Person B, Person C, etc.)
      ▼
┌───────────────────────────────────┐
│ 1. Listening for Data              │  📍 LOG: 🔗 Registering RoomEvent.DataReceived listener
│    from LiveKit Room               │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 2. LiveKit Server Sends Data       │  🌐 Data channel message delivered
│    to Receiver                     │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 3. RoomEvent.DataReceived          │  📍 LOG: 📨 DataReceived event triggered!
│    Event Fires                     │  📍 LOG: Payload size: 156 bytes
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 4. Decode Payload                  │  📍 LOG: Decoded text: {topic: "caption", ...}
│    (UTF-8 bytes → JSON)            │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 5. Parse JSON Message              │  📍 LOG: Parsed message: {topic: "caption", text: "HELLO", ...}
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 6. Check Message Topic             │  📍 LOG: ✅ Caption from user-123: "HELLO"
│    (should be "caption")           │  📍 LOG: ⏭️ Ignoring non-caption message (if other topic)
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 7. Update React Caption State      │  📍 LOG: Updating captions state with new message
│    setCaptions({                   │
│      [identity]: captionMessage    │
│    })                              │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 8. React Re-renders                │  🎨 Caption appears below sender's video tile
│    ParticipantVideoTile            │     (via ParticipantVideoTile component)
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 9. Set Auto-Clear Timeout          │  ⏰ 4-second timer starts
│    (4 seconds)                     │
└───────────────────────────────────┘
              │
        (4 seconds pass)
              │
              ▼
┌───────────────────────────────────┐
│ 10. Auto-Clear Fires               │  📍 LOG: ⏰ Auto-clearing caption for user-123 after 4 seconds
│     Delete caption from state      │
└───────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────┐
│ 11. React Re-renders               │  🎨 Caption disappears from screen
│     Caption Removed                │
└───────────────────────────────────┘
```

---

## Detailed Step Breakdown

### SENDER SIDE - Detailed Steps with Logs

#### Connection Phase (Steps 1-3)

```
USER ACTION: Click "Enable Sign Mode" button
             ▼
       VideoCall.tsx detects signMode = true
             ▼
       useSignDetectionWebSocket hook initializes
             ▼
       WebSocket connection starts
             │
    📍 LOG OUTPUT:
    🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/ROOM_ID/sign-detect
    Full URL (with token): ws://localhost:8000/...sign-detect?token=abc123xyz
             │
    (WebSocket handshake with backend)
             │
       Connection established ✅
             │
    📍 LOG OUTPUT:
    ✅ WebSocket OPENED - Ready to send frames
    📹 Capture started at 30 FPS
```

#### Frame Capture & Sending (Steps 4-5)

```
VIDEO LOOP (runs at 30 FPS = every 33ms):
             │
    FOR EACH FRAME:
      • Draw video element to canvas
      • Center-crop to training aspect ratio
      • Encode as JPEG (0.8 quality)
      • Convert to base64
      • Send via WebSocket
             │
    EVERY 30 FRAMES (~1 second):
    📍 LOG OUTPUT:
    📤 Frame #30: sent 12345 bytes, buffered: 0
    📤 Frame #60: sent 12340 bytes, buffered: 0
             │
    (frames sent to backend over network)
```

#### Backend Processing (Step 6)

```
BACKEND RECEIVES FRAME:
  • Extract hand pose using MediaPipe Holistic
  • Buffer frames in queue (32-frame window)
  • When buffer full, run through PyTorch ensemble
  • Generate prediction with confidence score
  • Send prediction back to frontend
             │
    ✓ Takes ~100-200ms per frame
    ✓ Batches 32 frames for inference
```

#### Prediction Reception & Decision (Steps 7-8)

```
FRONTEND RECEIVES PREDICTION:
             │
    📍 LOG OUTPUT:
    📥 PREDICTION RECEIVED: {
      type: "prediction",
      sign: "HELLO",
      confidence: 0.85,
      processing_time_ms: 45
    }
             │
    CHECK PREDICTION TYPE:
      • prediction → continue
      • error → log error, return
      • sign_start → show "Signing...", return
             │
    CHECK SIGN:
      • "no_sign" → clear preview, return
      • actual sign → continue
             │
    📍 LOG OUTPUT:
    ✅ SIGN PREDICTION: HELLO (0.85) server=45ms
             │
    CHECK CONFIDENCE:
      • ≥ 0.75 → BROADCAST
      • < 0.75 → preview only, return
             │
    📍 LOG OUTPUT (if ≥ 0.75):
    🚀 Broadcasting sign: HELLO
             │
    📍 LOG OUTPUT (if < 0.75):
    ⚠️ Low confidence (45%) - not broadcasting
```

#### Caption Formatting & Publishing (Steps 9-12)

```
BROADCAST TRIGGERED (confidence ≥ 0.75):
             │
    🚀 BROADCAST FUNCTION CALLED
             │
    📍 LOG BLOCK STARTS:
    ════════════════════════════════════════
    🚀 BROADCAST FUNCTION CALLED
    ════════════════════════════════════════
    Text: HELLO
    IsFinal: false
    Room object exists: true
    Room.localParticipant: Participant { identity: "user-123", ... }
    Room.participants: [Participant, Participant]
    Room.participants count: 2
    Remote participant IDs: ["user-456", "user-789"]
    Message to broadcast: {
      topic: "caption",
      type: "sign",
      text: "HELLO",
      isFinal: false,
      identity: "user-123"
    }
    ✅ Local caption update called
             │
    FORMAT MESSAGE:
      {
        topic: "caption",
        type: "sign",
        text: "HELLO",
        isFinal: false,
        identity: "user-123"
      }
             │
    ENCODE MESSAGE:
      JSON.stringify() → UTF-8 encode → 156 bytes
             │
    📍 LOG OUTPUT:
    Publishing details:
      - Encoded bytes: 156
      - Remote participants count: 2
      - Destination IDs: ["user-456", "user-789"]
             │
    CALL LiveKit API:
      room.localParticipant.publishData(
        encoded_bytes,
        {
          reliable: true,
          topic: "caption",
          destinationIdentities: ["user-456", "user-789"]
        }
      )
             │
    📍 LOG OUTPUT:
    Calling publishData with options: {
      reliable: true,
      topic: "caption",
      destinationIdentities: ["user-456", "user-789"]
    }
             │
    (LiveKit processes & routes to destinations)
             │
    📍 LOG OUTPUT (Success):
    ✅ publishData() succeeded
    ════════════════════════════════════════
             │
    📍 LOG OUTPUT (Error):
    ❌ publishData() failed: Error: Cannot publish data
    ════════════════════════════════════════
```

---

### RECEIVER SIDE - Detailed Steps with Logs

#### Reception Phase

```
LIVEKIT DATA CHANNEL LISTENING:
             │
    📍 LOG OUTPUT (when hook initializes):
    🔗 Registering RoomEvent.DataReceived listener
             │
    (waiting for data...)
             │
    
SENDER PUBLISHES CAPTION:
             │
    (LiveKit server routes to destinations)
             │
    
LIVEKIT DELIVERS TO RECEIVER:
             │
    RoomEvent.DataReceived event fires
             │
    📍 LOG BLOCK STARTS:
    ════════════════════════════════════════
    📨 DataReceived event triggered!
    Payload size: 156 bytes
    Decoded text: {
      "topic":"caption",
      "type":"sign",
      "text":"HELLO",
      "isFinal":false,
      "identity":"user-123"
    }
    Parsed message: {
      topic: "caption",
      type: "sign",
      text: "HELLO",
      isFinal: false,
      identity: "user-123"
    }
             │
    CHECK MESSAGE TOPIC:
      • "caption" → process caption
      • other → ignore, return
             │
    📍 LOG OUTPUT:
    ✅ Caption from user-123: "HELLO"
             │
    CHECK IF TEXT EMPTY:
      • empty → clear caption for this user
      • has text → display caption
             │
    UPDATE REACT STATE:
      setCaptions(prev => ({
        ...prev,
        ["user-123"]: captionMessage
      }))
             │
    📍 LOG OUTPUT:
    Updating captions state with new message
             │
    START 4-SECOND AUTO-CLEAR TIMER:
      setTimeout(() => {
        setCaptions(prev => {
          delete prev["user-123"]
          return prev
        })
      }, 4000)
    ════════════════════════════════════════
             │
    (React re-renders)
             │
    CAPTION DISPLAYS:
      ParticipantVideoTile re-renders
      Caption text appears below video
```

#### Auto-Clear Phase

```
4 SECONDS PASS...
             │
    📍 LOG OUTPUT:
    ⏰ Auto-clearing caption for user-123 after 4 seconds
             │
    REMOVE FROM STATE:
      setCaptions(prev => {
        delete prev["user-123"]
        return prev
      })
             │
    (React re-renders)
             │
    CAPTION DISAPPEARS:
      ParticipantVideoTile updates
      Caption no longer displayed
```

---

## Error Scenarios & Log Patterns

### Scenario 1: WebSocket Won't Connect

```
❌ PATTERN:
🔌 WebSocket connecting to: ws://localhost:8000/...
❌ WebSocket ERROR: WebSocket is closed before the connection is established
❌ WebSocket CLOSED

🔄 RESULT: No frames sent, no predictions, no captions

✅ FIX:
  1. Check backend is running (python main.py)
  2. Check WS_BASE is correct (localhost:8000)
  3. Restart backend and frontend
  4. Retry
```

### Scenario 2: Frames Sent but No Predictions

```
❌ PATTERN:
✅ WebSocket OPENED
📹 Capture started at 30 FPS
📤 Frame #30: sent 12345 bytes   ← Frames are being sent
❌ But NO: 📥 PREDICTION RECEIVED   ← Backend not responding

🔄 RESULT: No predictions, no captions

✅ FIX:
  1. Check backend console for errors
  2. Verify PyTorch models loaded
  3. Check video is being captured (you see your video)
  4. Restart backend with: python main.py
```

### Scenario 3: Prediction Received but Low Confidence

```
⚠️ PATTERN:
📥 PREDICTION RECEIVED: {sign: "HELLO", confidence: 0.45}
✅ SIGN PREDICTION: HELLO (0.45) server=45ms
⚠️ Low confidence (45%) - not broadcasting
❌ NO: 🚀 Broadcasting sign

🔄 RESULT: No caption sent (confidence < 0.75 threshold)

✅ FIX:
  1. Make signs clearer and more deliberate
  2. Improve lighting so hands are visible
  3. Position hands in center of frame
  4. Practice to increase confidence (feedback training)
```

### Scenario 4: publishData Fails

```
❌ PATTERN:
🚀 BROADCAST FUNCTION CALLED
Room.participants count: 1
Remote participant IDs: ["user-456"]
❌ publishData() failed: Error: Cannot publish data

🔄 RESULT: Message sent to LiveKit but fails

✅ FIX:
  1. Verify room is connected (can see other person's video)
  2. Check LiveKit token has publish permission
  3. Verify network connectivity
  4. Restart call
```

### Scenario 5: No DataReceived on Receiver

```
❌ PATTERN (on Sender):
✅ publishData() succeeded

❌ PATTERN (on Receiver):
🔗 Registering RoomEvent.DataReceived listener
❌ But NO: 📨 DataReceived event triggered!

🔄 RESULT: Message sent but not received by LiveKit

✅ FIX:
  1. Verify receiver is in same room (can see sender's video)
  2. Refresh receiver's browser
  3. Restart LiveKit server
  4. Check network connectivity
```

### Scenario 6: Caption Appears but Wrong Text

```
❌ PATTERN:
Sender says: "HELLO"
Receiver sees: "HEL" or garbage text

🔄 RESULT: Message truncated or corrupted

✅ FIX:
  1. Increase sign confidence (clearer signs)
  2. Check backend is completing full sign detection
  3. Verify network is stable (no packet loss)
  4. Restart both sender and receiver
```

---

## State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   CAPTION STATE MACHINE                      │
└─────────────────────────────────────────────────────────────┘

SENDER STATE:

  IDLE
    │ Sign mode toggled on
    ▼
  WEBSOCKET_CONNECTING
    │ Connection established
    ▼
  READY (listening for frames)
    │ Frame captured
    ▼
  DETECTING (frame sent to backend)
    │ Prediction received
    ├──────────────────┐
    │                  │
    ▼ (confidence ≥ 0.75)  ▼ (confidence < 0.75)
  BROADCASTING        PREVIEW_ONLY
    │                  │ (not sent to others)
    ▼                  ▼
  Message sent to      (continues listening)
  LiveKit             ◄──┘
    │
    ▼
  READY (continues listening)


RECEIVER STATE:

  CONNECTED (listening)
    │ Message from LiveKit
    ▼
  RECEIVED
    │ Message parsed
    ▼
  DISPLAYING (caption shown)
    │ 4 seconds pass
    ▼
  AUTO_CLEAR
    │ Caption removed
    ▼
  CONNECTED (listening for next caption)
```

---

## Timing Expectations

```
┌─────────────────────────────────────────────────────────────┐
│                    TIMING BREAKDOWN                          │
└─────────────────────────────────────────────────────────────┘

1. Frame capture:           ~33ms per frame (30 FPS)
2. Network (frontend→backend): ~10-50ms
3. Backend processing:       ~100-200ms (depends on hand visibility)
4. Backend→frontend latency: ~10-50ms
5. prediction→broadcast:    ~10-20ms
6. Network (LiveKit route):  ~10-50ms
7. Receiver processes data: ~5-10ms
8. React render:            ~50-100ms

TOTAL (best case):          ~250-400ms
TOTAL (typical):            ~300-500ms
TOTAL (worst case):         ~500-800ms

CAPTION AUTO-CLEAR:         4000ms (4 seconds)

EXPECTED USER EXPERIENCE:
- Perform sign
- See "Signing..." preview locally (immediate)
- Other person sees caption within ~1 second
- Caption auto-clears after ~4 seconds
```

---

## Summary

The caption flow is:
1. **Sender captures video** → sends frames to backend
2. **Backend processes** → returns prediction
3. **Sender broadcasts** → publishes to LiveKit
4. **LiveKit routes** → sends to remote participants
5. **Receiver processes** → updates UI
6. **Caption displays** → auto-clears after 4 seconds

**Each step has distinct logs.** If a log is missing, that step failed.

Use this diagram + the console logs to pinpoint exactly where the issue occurs.
