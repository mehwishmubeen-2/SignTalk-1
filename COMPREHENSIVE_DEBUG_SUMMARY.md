# Comprehensive Caption Broadcasting Debug Summary

## Problem Statement
Captions from sign language detection are not being received by other participants when 3+ people are in a call, even though the sign button is turned on.

## Root Cause Analysis
Based on the session history, the issue is in the `broadcast()` function in `useSignDetectionWebSocket.ts`. The function needs to:
1. Explicitly include all remote participants in the `destinationIdentities` parameter
2. Ensure the LiveKit room object is properly populated with participants
3. Verify `room.localParticipant` is available

## Changes Made Today

### 1. Enhanced Debugging in useSignDetectionWebSocket.ts

**File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts`

#### Changed sections:

**A. broadcast() function (Lines 88-150 approx):**
- Added comprehensive logging showing:
  - Room state (exists, has participants)
  - Participant list with identities
  - Message being broadcast
  - Destination IDs for publishData
  - Success/failure of publishData
  
**B. handleMessage() function:**
- Added detailed logs for each step:
  - When predictions are received
  - Confidence level and threshold checks
  - Whether sign will be broadcast or is low-confidence
  
**C. WebSocket connection (Lines ~310-335):**
- Added logs for connection lifecycle:
  - WebSocket connecting
  - Connection opened/closed/error
  - Frame capture starting/stopping
  
**D. captureAndSend() function:**
- Added logs every 30 frames showing:
  - Frame sequence number
  - Base64 data size
  - WebSocket buffered amount (backpressure indicator)

### 2. Enhanced Debugging in VideoCall.tsx

**File:** `frontend/src/app/pages/VideoCall.tsx`

**Changed: RoomEvent.DataReceived handler (Lines ~130-180):**
- Added comprehensive logging showing:
  - When DataReceived event fires
  - Payload size
  - Decoded message content
  - Whether caption is being displayed
  - Auto-clear timeout setup

### 3. Enhanced Debugging in useSpeechCaptions.ts

**File:** `frontend/src/app/hooks/useSpeechCaptions.ts`

**Changed sections:**

**A. clearCaption() function:**
- Added logs for speech caption clearing
- Shows destination participants
- Logs success/failure

**B. recognition.onresult handler:**
- Added logs for detected speech
- Shows final vs interim results
- Shows broadcast to participants

### 4. Created Comprehensive Debug Guide

**File:** `DEBUG_GUIDE.md`

A complete guide showing:
- Expected console log flow at each step
- What to check at each step (✅ success, ❌ failure indicators)
- Common issues and solutions
- Debug checklist
- Test scenarios with 2+ participants
- Network and LiveKit server checks

---

## What the Logs Will Show

### On Sender's Machine (Person performing sign)

#### When sign mode is enabled:
```
🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/ROOM_ID/sign-detect
✅ WebSocket OPENED - Ready to send frames
📹 Capture started at 30 FPS
```

#### When frames are being sent (every ~1 second):
```
📤 Frame #30: sent 12345 bytes, buffered: 0
📤 Frame #60: sent 12340 bytes, buffered: 0
```

#### When a sign is detected:
```
📥 PREDICTION RECEIVED: {type: "prediction", sign: "HELLO", confidence: 0.85, ...}
✅ SIGN PREDICTION: HELLO (0.85) server=45ms
🚀 Broadcasting sign: HELLO
════════════════════════════════════════
🚀 BROADCAST FUNCTION CALLED
Room object exists: true
Room.participants count: 2
Remote participant IDs: ["user-456", "user-789"]
Destination IDs: ["user-456", "user-789"]
✅ publishData() succeeded
════════════════════════════════════════
```

### On Receiver's Machine (Other participant)

#### When caption is broadcast:
```
════════════════════════════════════════
📨 DataReceived event triggered!
Payload size: 156 bytes
Decoded text: {"topic":"caption",...,"text":"HELLO",...}
✅ Caption from user-123: "HELLO"
Updating captions state with new message
════════════════════════════════════════
```

---

## How to Test the Fix

### Prerequisites:
1. Both machines have latest code changes
2. Backend is running: `python main.py`
3. Frontend is running: `npm run dev`
4. Both browsers have DevTools open (F12)
5. Both have console tab open

### Test Procedure:

#### Setup:
1. Person A: Open video call, enable sign mode
2. Person B: Join same call
3. (Optional) Person C: Join same call to test 3-person scenario

#### Test Step 1 - Check Connection:
**On Person A's console:**
- Look for `✅ WebSocket OPENED`
- Look for `📹 Capture started at 30 FPS`
- Look for periodic `📤 Frame #...` logs

✅ PASS: All three logs appear
❌ FAIL: Missing any of these logs → WebSocket connection issue

#### Test Step 2 - Check Backend Processing:
**On Person A's console:**
- Perform a clear sign (e.g., "HELLO", "THANK YOU")
- Look for `📥 PREDICTION RECEIVED`
- Look for `✅ SIGN PREDICTION: ... (0.XX)`

✅ PASS: Prediction received with confidence ≥ 0.75
❌ FAIL: No prediction or confidence < 0.75

#### Test Step 3 - Check Broadcasting:
**On Person A's console:**
- Same sign as Step 2
- Look for `🚀 Broadcasting sign:`
- Look for `🚀 BROADCAST FUNCTION CALLED`
- Look for `Room.participants count: 1` (or more if 3+ in call)
- Look for `Remote participant IDs: [...]` (should not be empty)
- Look for `✅ publishData() succeeded`

✅ PASS: All logs appear, participants count > 0, publishData succeeds
❌ FAIL: 
- No broadcast logs → confidence was too low
- participants count = 0 → room not connected
- publishData fails → LiveKit issue

#### Test Step 4 - Check Reception:
**On Person B's console:**
- Same sign as Step 2-3
- Look for `📨 DataReceived event triggered!`
- Look for `✅ Caption from user-123: "HELLO"` (where user-123 is Person A)
- Look for caption appearing below Person A's video in UI

✅ PASS: DataReceived fires, caption text matches, UI shows caption
❌ FAIL:
- No DataReceived → LiveKit data channel not working
- Caption text wrong → serialization issue
- No UI update → React state issue

#### Test Step 5 - Check Caption Clearing:
**On Person A's console:**
- Look for `⏰ Auto-clearing caption for user-123 after 4 seconds`

**On Person B's UI:**
- Caption should disappear after ~4 seconds

✅ PASS: Caption clears automatically
❌ FAIL: Caption stuck or clears too early/late

#### Test Step 6 - Test 3+ Participants:
Repeat all steps with 3 people to verify:
- Person A's `Room.participants count: 2` (B and C)
- Person A's `Remote participant IDs: ["user-B", "user-C"]`
- Both Person B AND Person C receive caption

---

## If Tests Fail

### Issue: WebSocket connection fails
**Logs to check:**
```
❌ WebSocket ERROR: ...
❌ WebSocket CLOSED
```

**Debugging steps:**
1. Check if backend is running: `python main.py`
2. Check if WS_BASE is correct in useSignDetectionWebSocket.ts
3. Check if network allows WebSocket connections
4. Check browser console for CORS errors

### Issue: No predictions received
**Logs to check:**
- Frames being sent (`📤 Frame #...`)
- But no predictions (`📥 PREDICTION RECEIVED`)

**Debugging steps:**
1. Check backend logs for errors
2. Verify WebSocket frames are being received by backend
3. Check if Python models are loading correctly
4. Verify video input is valid (not all black/white)

### Issue: Prediction received but not broadcast
**Logs to check:**
- Prediction: `✅ SIGN PREDICTION`
- But no broadcast: missing `🚀 BROADCAST FUNCTION CALLED`

**Debugging steps:**
1. Check confidence level: `✅ SIGN PREDICTION: HELLO (0.45)` - if < 0.75, won't broadcast
2. Perform signs more clearly to increase confidence

### Issue: Broadcast called but publishData fails
**Logs to check:**
```
🚀 BROADCAST FUNCTION CALLED
...
❌ publishData() failed: Error: ...
```

**Debugging steps:**
1. Check if `Room.participants count:` is > 0
2. Check LiveKit token has data publish permission
3. Check if room object is properly initialized
4. Try closing/reopening the call

### Issue: Broadcast succeeds but receiver doesn't get caption
**Logs to check:**

**On Sender:** ✅ All logs show success
**On Receiver:** ❌ No `📨 DataReceived event triggered!`

**Debugging steps:**
1. Check if receiver is in same room (should see sender's video)
2. Check if LiveKit data channel is working (test with non-caption message)
3. Try closing/reopening on receiver side
4. Check browser console for errors

---

## Code Files Modified

1. **frontend/src/app/hooks/useSignDetectionWebSocket.ts**
   - Lines ~88-150: broadcast() function with detailed logging
   - Lines ~165-230: handleMessage() with prediction logging
   - Lines ~310-335: WebSocket connection with lifecycle logging
   - Lines ~245-295: captureAndSend() with frame sending logs

2. **frontend/src/app/pages/VideoCall.tsx**
   - Lines ~130-180: RoomEvent.DataReceived handler with reception logging

3. **frontend/src/app/hooks/useSpeechCaptions.ts**
   - Lines ~16-35: clearCaption() with speech clear logging
   - Lines ~70-105: recognition.onresult with speech recognition logging

4. **DEBUG_GUIDE.md (NEW)**
   - Complete debugging guide with expected logs, test scenarios, common issues

5. **COMPREHENSIVE_DEBUG_SUMMARY.md (NEW - THIS FILE)**
   - Summary of all changes and test procedures

---

## Key Points to Remember

1. **Empty `room.participants`** is normal if you're the only person. When others join, it should populate.

2. **Low confidence predictions** (< 0.75) will NOT be broadcast. Make signs more deliberate.

3. **destinationIdentities must not be empty** for captions to reach others. If empty, no one gets the caption.

4. **publishData() succeeds != broadcast received**. publishData sends to LiveKit server, but receiver must be listening to DataReceived event.

5. **Each step has distinct logs**. If a log is missing, that step failed.

---

## Quick Reference: What Each Log Means

| Log | Location | Meaning | Next Action |
|-----|----------|---------|------------|
| `🔌 WebSocket connecting` | Sender | Attempting to connect to backend | Wait for OPENED |
| `✅ WebSocket OPENED` | Sender | Connected successfully | Should see `📹 Capture started` |
| `📹 Capture started` | Sender | Frames will now be sent | Should see periodic `📤 Frame` logs |
| `📤 Frame #X` | Sender | Frame sent to backend | Should see predictions after ~0.5s |
| `📥 PREDICTION RECEIVED` | Sender | Backend returned prediction | Check confidence, should > 0.75 |
| `✅ SIGN PREDICTION` | Sender | High-confidence sign detected | Should see `🚀 Broadcasting` |
| `⚠️ Low confidence` | Sender | Prediction below 0.75 | Not broadcast, will not reach others |
| `🚀 BROADCAST FUNCTION CALLED` | Sender | About to send caption via LiveKit | Check: room.participants count, destination IDs |
| `Room.participants count: 0` | Sender | No remote participants | Join with another person |
| `Room.participants count: 2` | Sender | Caption will go to 2 people | ✅ Good - should reach them |
| `❌ publishData() failed` | Sender | LiveKit publish error | Check token, room connection, permissions |
| `✅ publishData() succeeded` | Sender | Caption sent to LiveKit | Should see DataReceived on receivers |
| `🔗 Registering RoomEvent.DataReceived` | Receiver | Listening for captions | ✅ Should be ready to receive |
| `📨 DataReceived event triggered` | Receiver | LiveKit sent caption data | Check payload is valid JSON |
| `✅ Caption from user-123` | Receiver | Caption successfully received | Should appear in UI |
| `🗑️ Clearing caption` | Receiver | Auto-clear timeout fired | ✅ Normal after ~4 seconds |

---

## Final Checklist Before Testing

- [ ] Latest code pulled/updated
- [ ] `npm run dev` executed and running
- [ ] `python main.py` executed and running
- [ ] Browser DevTools (F12) open on both machines
- [ ] Console tab visible and ready to read logs
- [ ] Both machines on same network (or VPN for local testing)
- [ ] LiveKit server accessible
- [ ] At least 2 participants in video call

---

## Next Actions

1. **Run the test procedure** (see Test Procedure section above)
2. **Collect all console logs** from both sender and receiver
3. **Compare against expected logs** (see What the Logs Will Show section)
4. **Identify exactly which step fails** using the debugging checklist
5. **Share logs** if issue persists - the logs will clearly show where the problem is

The comprehensive logging will pinpoint exactly where the issue occurs. Each step of the caption flow has clear, distinct logs that make debugging straightforward.
