# SignTalk Caption Broadcasting Debug Guide

## Overview
This guide walks you through the complete flow of how captions are sent and received, with detailed console logs at each step.

## Expected Console Log Flow

### Step 1: WebSocket Connection (Sender Side)
When the video call starts and sign mode is enabled:

```
🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/ROOM_ID/sign-detect
Full URL (with token): ws://localhost:8000/meetings/ws/ROOM_ID/sign-detect?token=...
✅ WebSocket OPENED - Ready to send frames
📹 Capture started at 30 FPS
```

**What to check:**
- ✅ WebSocket should connect successfully
- ✅ Capture should start at 30 FPS
- ❌ If you see "WebSocket ERROR" or "CLOSED", the connection failed

---

### Step 2: Frame Capture & Sending (Sender Side)
Every 30 frames (approximately once per second), you should see:

```
📤 Frame #30: sent 12345 bytes, buffered: 0
📤 Frame #60: sent 12340 bytes, buffered: 0
```

**What to check:**
- ✅ Frames should be sent continuously
- ✅ Buffered amount should stay near 0 (< 10000)
- ❌ If buffered amount grows (e.g., 50000, 100000+), frames are queuing up and backend can't keep up

---

### Step 3: Backend Processes Frame (Backend Console)
You should see backend logs showing sign detection (from FastAPI/Python backend):

```
[Backend] Processing frame #30...
[Backend] Predictions: HELLO (0.85 confidence)
```

**What to check:**
- ✅ Backend should receive frames
- ✅ Predictions should have confidence scores
- ❌ If backend doesn't receive frames, WebSocket connection might be failing

---

### Step 4: Sign Detected & Broadcast (Sender Side)
When a sign is recognized with confidence ≥ 0.75:

```
📥 PREDICTION RECEIVED: {
  type: "prediction",
  sign: "HELLO",
  confidence: 0.85,
  processing_time_ms: 45
}
✅ SIGN PREDICTION: HELLO (0.85) server=45ms
🚀 Broadcasting sign: HELLO
════════════════════════════════════════
🚀 BROADCAST FUNCTION CALLED
════════════════════════════════════════
Text: HELLO
IsFinal: false
Room object exists: true
Room.localParticipant: Participant { identity: "user-123", ... }
Room.participants: [Participant, Participant]  // Remote participants
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
Publishing details:
  - Encoded bytes: 156
  - Remote participants count: 2
  - Destination IDs: ["user-456", "user-789"]
Calling publishData with options: {
  reliable: true,
  topic: "caption",
  destinationIdentities: ["user-456", "user-789"]
}
✅ publishData() succeeded
════════════════════════════════════════
```

**What to check:**
- ✅ Prediction confidence should be ≥ 0.75
- ✅ Room.participants should NOT be empty
- ✅ Destination IDs should list all remote participants
- ✅ publishData() should succeed
- ❌ If "Room.participants: []", LiveKit room is not properly set up
- ❌ If "destinationIds.length === 0", captions won't reach anyone
- ❌ If publishData() fails, check the error message

---

### Step 5: Remote Participant Receives Caption (Receiver Side)
The other participant(s) should see these console logs:

```
════════════════════════════════════════
📨 DataReceived event triggered!
Payload size: 156 bytes
Decoded text: {"topic":"caption","type":"sign","text":"HELLO","isFinal":false,"identity":"user-123"}
Parsed message: {
  topic: "caption",
  type: "sign",
  text: "HELLO",
  isFinal: false,
  identity: "user-123"
}
✅ Caption from user-123: "HELLO"
Updating captions state with new message
════════════════════════════════════════
```

**What to check:**
- ✅ DataReceived event should trigger
- ✅ Payload should be decoded correctly
- ✅ Caption should appear below the sender's video tile
- ❌ If no "DataReceived event" appears, LiveKit data channel isn't working
- ❌ If decoded text is corrupted, there's a serialization issue

---

### Step 6: Caption Display (Receiver Side)
The caption should appear in the UI below the sender's video.

**What to check:**
- ✅ Caption text should match what was signed
- ✅ Caption should auto-clear after 4 seconds
- ❌ If caption doesn't appear, check the React state updates in browser DevTools

---

## Debugging Checklist

### If captions don't reach remote participants:

#### 1. Check Sender's broadcast() output:
```javascript
// In browser console on sender's machine
// Look for: "Room.participants count:"
// - If 0: Room not properly connected to LiveKit
// - If > 0: Remote participants exist, should work

// Look for: "destinationIds:"
// - Should be an array of participant identities
// - If empty: No one will receive the caption

// Look for: "publishData() succeeded"
// - If error: LiveKit publish failed
```

#### 2. Check Receiver's DataReceived:
```javascript
// In browser console on receiver's machine
// Look for: "DataReceived event triggered!"
// - If never appears: LiveKit data channel not working
// - If appears: Should have valid caption message
```

#### 3. Check browser console for errors:
```
❌ Error parsing data message: ...
❌ publishData() failed: ...
```

#### 4. Check network:
- Open DevTools Network tab
- Filter by "sign-detect" WebSocket
- Should see continuous frame messages
- Should see prediction responses

#### 5. Check LiveKit server:
- Is LiveKit server running?
- Is it accessible from frontend?
- Are participants actually connected to the room?

---

## Common Issues & Solutions

### Issue: "Room.participants: []"
**Cause:** LocalParticipant is not in the participants array; only remote participants are listed.
**Solution:** This is normal! Empty array means you're alone. When others join, array should populate.

### Issue: "Room object exists: false"
**Cause:** useRoomContext() returned null (not connected to LiveKit).
**Solution:** Check if VideoCall is inside `<LiveKitRoom>` component.

### Issue: "publishData() failed: Error: Cannot publish data"
**Cause:** LocalParticipant not properly connected or permissions issue.
**Solution:** Check LiveKit token has data publish permission.

### Issue: DataReceived never fires
**Cause:** LiveKit data channel not working, or subscription to event failed.
**Solution:** 
1. Verify room.on() is being called
2. Check if room is properly initialized
3. Try closing and reopening call

### Issue: Frames sent but no predictions returned
**Cause:** Backend not receiving WebSocket messages, or processing failed.
**Solution:**
1. Check backend logs for errors
2. Verify WebSocket connection is open (bufferedAmount should be low)
3. Check if backend server is running

---

## Debug Mode Setup

All logging is already enabled in the latest code. To focus on specific issues:

### For Sender-side issues:
Open sender's browser console and search for:
- `🚀 BROADCAST` - Shows when broadcast is attempted
- `publishData()` - Shows if publish succeeded
- `Room.participants` - Shows how many remote participants exist

### For Receiver-side issues:
Open receiver's browser console and search for:
- `📨 DataReceived` - Shows when data received
- `Caption from` - Shows captions being received
- `Auto-clearing` - Shows caption cleanup

### To check WebSocket:
1. DevTools → Network tab
2. Filter by "sign-detect"
3. Click on the WebSocket connection
4. Messages tab shows all frame/prediction exchanges

---

## Test Scenario

### Setup:
1. Start backend: `python main.py`
2. Start frontend: `npm run dev`
3. Open browser DevTools on both machines
4. Create a video call with 2+ participants

### Test 1: Two participants
1. **Person A:** Join call, enable sign mode
2. **Person A's console:** Should see `WebSocket OPENED`, frames being sent
3. **Person A:** Perform a clear sign (e.g., HELLO, THANK YOU)
4. **Person A's console:** Should see `✅ SIGN PREDICTION`, `🚀 Broadcasting`
5. **Person B's console:** Should see `📨 DataReceived`, `✅ Caption from...`
6. **Person B's screen:** Caption should appear below Person A's video

### Test 2: Three or more participants
Same as Test 1, but:
- **Person A's broadcast():** Should show `Room.participants count: 2` (or more)
- **Person A's broadcast():** Should show both remote participant IDs in `Destination IDs`
- **Both Person B and Person C:** Should receive the caption

### Test 3: Caption timing
1. Person A signs a word
2. Check timestamp in console
3. Caption should appear < 1 second later on receiver
4. Caption should auto-clear after 4 seconds

---

## Log Levels

All logs use emoji prefixes for quick scanning:

| Prefix | Meaning | Action |
|--------|---------|--------|
| 🔌 | Connection event | Check if WebSocket connects |
| ✅ | Success | Verify expected result occurred |
| ❌ | Error | Indicates failure, check error message |
| ⚠️ | Warning | May indicate issue, verify expected state |
| 📤 | Sending | Frame/data being sent |
| 📥 | Receiving | Prediction/message being received |
| 📨 | Data received | Caption received by remote participant |
| 🚀 | Broadcasting | Caption being sent to room |
| 🖐️ | Hand detected | Sign detection started |
| 🗑️ | Clear | Caption being cleared |
| ⏰ | Timeout | Auto-clear happening |
| ⏭️ | Skip | Message ignored (e.g., wrong topic) |

---

## Next Steps If Issue Persists

1. **Collect logs:**
   - Save console output from both sender and receiver
   - Include timestamps and all log messages

2. **Share debug info:**
   - Screenshot of console on each machine
   - Note how many participants in call
   - Note which signs work/don't work

3. **Test independently:**
   - Test with simple data message (not caption)
   - Test LiveKit publishData with dummy data
   - Verify WebSocket frames are being sent

---

## Code Changes for Debugging

If logs still aren't helpful, add a breakpoint in the browser DevTools:

**In sender's broadcast() function:**
```javascript
// DevTools → Sources → useSignDetectionWebSocket.ts
// Line where broadcast() starts
// Set breakpoint and step through
// Check: room, room.participants, room.localParticipant
```

**In receiver's DataReceived handler:**
```javascript
// DevTools → Sources → VideoCall.tsx
// Line where handleData() is defined
// Set breakpoint and step through
// Check: payload, decoded message, setCaptions
```

---

## Summary

The flow is:
1. Sender connects WebSocket → frames → backend
2. Backend detects sign → sends prediction
3. Sender calls broadcast() → publishes to LiveKit
4. LiveKit routes to remote participants
5. Receiver's DataReceived fires → updates UI

Each step has detailed console logs. Use them to identify exactly where the issue occurs.
