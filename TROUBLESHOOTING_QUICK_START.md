# SignTalk Caption Troubleshooting - Quick Start

## TL;DR - Just Test This

### Step 1: Clear Everything
```bash
# Stop all processes (Ctrl+C in both terminals)
# Close all browser tabs with SignTalk

# Clear browser cache:
# Chrome: DevTools (F12) → Right-click reload button → "Empty cache and hard refresh"
```

### Step 2: Start Clean
```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Step 3: Open Both Browsers
- Browser 1 (Person A): `localhost:3000`
- Browser 2 (Person B): `localhost:3000` (same browser or different device)

### Step 4: Check Console Logs
- **Both browsers:** Open DevTools → Console tab
- **Person A console:** Should see `✅ WebSocket OPENED`
- **Person B console:** Should see `🔗 Registering RoomEvent.DataReceived`

### Step 5: Run Test
1. Person A: Join call, enable **sign mode** (should see toggle)
2. Person A: Perform a clear sign (e.g., wave hand, point)
3. Person A's console: Look for `✅ SIGN PREDICTION`
4. Person A's console: Look for `✅ publishData() succeeded`
5. Person B's console: Look for `📨 DataReceived event triggered!`
6. Person B's screen: Caption should appear below Person A's video

**✅ PASS:** Caption appears on Person B's screen
**❌ FAIL:** See "Debugging by Error" section below

---

## Debugging by Error

### Error: "WebSocket Connection Failed"

**Person A's console shows:**
```
❌ WebSocket ERROR: ...
❌ WebSocket CLOSED
```

**Fix:**
1. Check backend is running: `python main.py` (should say "Uvicorn running on...")
2. Check frontend is running: `npm run dev` (should say "ready on ...")
3. Check WS_BASE in code:
   ```javascript
   // File: frontend/src/app/hooks/useSignDetectionWebSocket.ts
   // Line ~30, should be:
   const WS_BASE = "ws://localhost:8000";  // or your backend URL
   ```
4. Restart both servers

---

### Error: "No Predictions Received"

**Person A's console shows:**
```
✅ WebSocket OPENED
📹 Capture started at 30 FPS
📤 Frame #30: sent ... (frames sending)
❌ But NO: 📥 PREDICTION RECEIVED
```

**Fix:**
1. Check backend console for errors:
   ```
   [Error] Failed to process frame...
   ```
2. Verify PyTorch models loaded:
   - Backend should print model loading messages on startup
   - If missing, models may not be installed: `pip install torch torchvision`
3. Ensure good lighting (hand visibility)
4. Check video is being captured (Person A should see own video)

---

### Error: "Prediction Too Low Confidence"

**Person A's console shows:**
```
📥 PREDICTION RECEIVED: {sign: "HELLO", confidence: 0.45}
⚠️ Low confidence (45%) - not broadcasting
```

**Why:** Confidence < 0.75, so won't be broadcast

**Fix:**
1. Make signs more **deliberate and clear**
2. Ensure **good lighting** on hands
3. Position hands in the **center of screen**
4. Signs should be **distinctive** (not partial/unclear)
5. Confidence should increase with practice

---

### Error: "publishData() Failed"

**Person A's console shows:**
```
🚀 BROADCAST FUNCTION CALLED
...
❌ publishData() failed: Error: Cannot publish data
```

**Fix:**
1. Check room.participants count:
   ```
   Room.participants count: 2  ✅ Good
   Room.participants count: 0  ❌ Problem - no one else in call
   ```
2. Ensure LiveKit room is connected (should see other person's video)
3. Check LiveKit token has data publish permission
4. Restart the call

---

### Error: "Caption Not Received by Other Person"

**Person A's console shows:**
```
✅ publishData() succeeded
```

**But Person B's console shows:**
```
❌ NO "📨 DataReceived event triggered!" message
```

**Fix:**

**Option 1: Check Receiving Setup**
```javascript
// File: frontend/src/app/pages/VideoCall.tsx
// Should see this log in Person B's console:
🔗 Registering RoomEvent.DataReceived listener
```
If not, LiveKit data channel might not be initialized.

**Option 2: Restart Receiver**
- Person B: Close video call
- Person B: Refresh browser (F5)
- Person B: Rejoin call
- Try sending caption again

**Option 3: Check LiveKit Connection**
- Person B should see Person A's video
- If not seeing video, LiveKit connection is broken
- Restart LiveKit server or check network

---

### Error: "Caption Appears but Doesn't Match"

**Example:**
- Person A signs "HELLO"
- Person B sees caption "HEL" or garbage text

**Fix:**
1. Increase sign confidence (make signs clearer)
2. Check if backend is processing complete signs:
   - Backend should wait for full sign completion before sending prediction
   - If cutting off early, might be timing issue in backend

---

## Console Log Quick Reference

### On Sender (Person Performing Sign)

Look for these in order:

1. **Connection:**
   ```
   ✅ WebSocket OPENED
   📹 Capture started at 30 FPS
   ```

2. **Frame Sending** (should appear continuously):
   ```
   📤 Frame #30: sent 12345 bytes
   ```

3. **Prediction Received:**
   ```
   ✅ SIGN PREDICTION: HELLO (0.85)
   ```

4. **Broadcasting:**
   ```
   🚀 BROADCAST FUNCTION CALLED
   Room.participants count: 1
   ✅ publishData() succeeded
   ```

### On Receiver (Other Person)

Look for this when sender broadcasts:

```
📨 DataReceived event triggered!
✅ Caption from user-123: "HELLO"
```

---

## One-Minute Sanity Check

Copy-paste this entire test:

1. Open 2 browser tabs (same or different devices)
2. Both join same video call
3. Open DevTools (F12) on both
4. In **Person A** console, paste:
   ```javascript
   console.log("TEST: Person A ready")
   ```
5. In **Person B** console, paste:
   ```javascript
   console.log("TEST: Person B ready")
   ```
6. Person A: Enable sign mode, perform sign
7. Person A console: Search for `BROADCAST FUNCTION CALLED`
   - If found: `✅ Sender is working`
   - If not found: `❌ Backend issue`
8. Person B console: Search for `DataReceived`
   - If found: `✅ Receiver is working`
   - If not found: `❌ LiveKit data channel issue`

---

## If Still Broken After These Steps

**Collect this info and share:**

1. **Person A's console output:**
   - Right-click console → Save as → console-a.txt
   - Include at least one complete sign detection attempt

2. **Person B's console output:**
   - Same as above → console-b.txt

3. **Backend console output:**
   - Copy last 50 lines from terminal where `python main.py` is running

4. **System info:**
   - Browser version (Chrome, Edge, Firefox, Safari?)
   - OS (Windows, Mac, Linux?)
   - Network (local, cloud, VPN?)

**Then:**
- Share all 3 files
- Include steps you took to test
- Include error messages exactly as shown

With this info, the exact issue can be diagnosed.

---

## Most Common Issues & Quick Fixes

| Symptom | Most Likely Cause | Quick Fix |
|---------|-------------------|-----------|
| No WebSocket connection | Backend not running | `python main.py` |
| No predictions | Bad video input or backend error | Check lighting, restart backend |
| Predictions but not broadcast | Low confidence | Make signs clearer |
| publishData fails | Room not connected | Ensure call is active |
| No DataReceived on receiver | Receiving handler not registered | Refresh receiver's browser |
| Caption text wrong/garbled | Serialization issue | Restart call |
| Caption appears very late (>2s) | Network lag or buffering | Check network, check buffered amount in logs |
| Caption not clearing | Auto-clear timer issue | Restart call |

---

## If Logs Show Everything is Working But UI Shows Nothing

**The issue is likely in React rendering.**

Person B can see caption in console but not in UI?

**Check:**
1. Is sign detection mode enabled for Person B? (toggle might be required)
2. Is Person B's browser theme correct? (caption might be invisible color)
3. Check DevTools → Elements → Find caption div
4. Check CSS in ParticipantVideoTile.tsx

**If you see caption div in DevTools but not on screen:**
```
// Likely CSS issue - caption is there but invisible
// Check: color, display, position, z-index
```

---

## Still Stuck?

**Run this diagnostic in browser console:**

```javascript
// Check if LiveKit is loaded
console.log("LiveKit version:", window.LivekitClient?.VERSION)

// Check if room exists
console.log("Room connected:", window.room?.isConnected)

// Check local participant
console.log("Local participant:", window.room?.localParticipant?.identity)

// Check remote participants
console.log("Remote count:", window.room?.participants?.length)
```

Share output of this with the debug logs above.

The extensive logging added to the code means every step of the caption flow is now visible. Use the logs to narrow down exactly which step is failing, then the fixes are usually straightforward.
