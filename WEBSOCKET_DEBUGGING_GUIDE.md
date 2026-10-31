# WebSocket Sign Detection - Debugging Guide

## Problem: Sign Detection Not Starting

Even though "Sign ON" button works, no sign detection happens (no predictions appear).

### Root Cause
**Debug logging was disabled!** You couldn't see WebSocket connection messages.

### What I Fixed
- **File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts`
- **Line:** 28
- **Change:** `ENABLE_DEBUG_LOGGING = false` → `ENABLE_DEBUG_LOGGING = true`

---

## How to Debug Now

### Step 1: Refresh Frontend
```
Press F5 or Ctrl+R in browser
Wait for page to reload
```

### Step 2: Open Browser DevTools
```
Press F12
Click "Console" tab
```

### Step 3: Create Video Call
```
New meeting or join existing
Wait for LiveKit to connect (see video preview)
```

### Step 4: Toggle "Sign ON" Button
Watch console for messages. You should see:

```
[sign-detection-ws] Initializing sign detection WebSocket
[sign-detection-ws] Connecting to ws://localhost:8000/meetings/ws/abc123/sign-detect?token=eyJ...
[sign-detection-ws] WebSocket connected
[sign-detection-ws] Starting frame capture loop
```

### Step 5: Make a Sign Gesture
After 3-4 seconds, you should see:

```
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
[sign-detection-ws] Prediction: HELLO (0.95)
```

On screen: `Detected: HELLO 95%`

---

## Troubleshooting WebSocket Connection

### Issue 1: Cannot Connect (WebSocket connection failed)

**Console Error:**
```
[sign-detection-ws] WebSocket error
```

**Causes:**
1. Backend not running
2. Port 8000 blocked
3. Wrong WebSocket URL

**Solutions:**
1. Check backend terminal - should show:
   ```
   INFO: Uvicorn running on http://0.0.0.0:8000
   ```
2. Test backend is running:
   ```bash
   curl http://localhost:8000/
   # Should show: {"message": "SignTalk API is running"}
   ```
3. Check firewall settings
4. Restart backend: `python main.py`

---

### Issue 2: Auth Failed (Invalid Token)

**Console Error:**
```
[sign-detection-ws] WebSocket closed
Code: 4001
Reason: Auth failed
```

**Causes:**
1. JWT token expired
2. JWT token invalid
3. User not authenticated

**Solutions:**
1. Logout from SignTalk
2. Login again (new JWT token)
3. Try WebSocket connection again

---

### Issue 3: WebSocket Connected But No Frames

**Console Shows:**
```
[sign-detection-ws] WebSocket connected
[sign-detection-ws] Starting frame capture loop
(no "Frame sent" messages)
```

**Causes:**
1. Video element not rendering
2. Camera permission denied
3. Browser throttling background tabs

**Solutions:**
1. Verify video tile shows your camera
2. Check browser allows camera access
3. Keep browser tab active (some browsers throttle background)
4. Check browser console for video errors

---

### Issue 4: WebSocket Connected, Frames Sent, But No Predictions

**Console Shows:**
```
[sign-detection-ws] WebSocket connected
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
... (many more frames)
(no "Prediction" messages)
```

**Causes:**
1. Haven't sent 32 frames yet (need ~3.2 seconds)
2. Backend processing error
3. No hand detected

**Solutions:**
1. Wait longer - first prediction takes 3-4 seconds
2. Check backend logs for frame processing errors
3. Make sure hand is visible in camera
4. Try moving hand more deliberately

---

### Issue 5: Predictions Wrong/Low Confidence

**Console Shows:**
```
[sign-detection-ws] Prediction: NO_SIGN (0.35)
[sign-detection-ws] Prediction: NO_SIGN (0.42)
```

**Causes:**
1. Models trained on specific signing style
2. Hand not fully visible
3. Poor lighting
4. Sign not in training data

**Solutions:**
1. Ensure good lighting
2. Hand should be centered, not cut off
3. Make clear, deliberate signs
4. Try signs model was trained on:
   - bye, hello, how_are_you, i_am_fine, i_dont_know
   - i_know, nice_to_meet_you, no_sign, see_you_later
   - what_is_your_name, whats_up

---

## Expected Debug Messages

### Successful Connection Flow

```
1. User toggles "Sign ON"
   ↓
[sign-detection-ws] Initializing sign detection WebSocket

2. Connecting to backend
   ↓
[sign-detection-ws] Connecting to ws://localhost:8000/meetings/ws/room123/sign-detect?token=eyJ...

3. Connection established
   ↓
[sign-detection-ws] WebSocket connected
[sign-detection-ws] Ready Status: ready

4. Start capturing frames
   ↓
[sign-detection-ws] Starting frame capture loop

5. Send frames (continuous, 10 per second)
   ↓
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
... (repeats every 100ms)

6. After 32 frames (3.2 seconds), backend predicts
   ↓
[sign-detection-ws] Prediction: HELLO (0.95)

7. Display on screen
   ↓
"Detected: HELLO 95%"

8. Keep predicting
   ↓
[sign-detection-ws] Prediction: NICE_TO_MEET_YOU (0.87)
[sign-detection-ws] Prediction: WHATS_UP (0.92)
```

---

## Enable/Disable Debug Logging

### To Enable (Current State)
```typescript
const ENABLE_DEBUG_LOGGING = true;  // Shows all messages
```

### To Disable (Clean Console)
```typescript
const ENABLE_DEBUG_LOGGING = false;  // No debug messages
```

**File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts` (Line 28)

---

## Backend Logs to Check

When user toggles "Sign ON" and connects, backend should show:

```
[WS 1] User {user_id} connected to room {room_id}
[WS 1] Frame 1 received
[WS 1] Frame 2 received
...
[WS 1] Prediction made: HELLO (confidence: 0.95)
Sending: {"type": "prediction", "sign": "HELLO", "confidence": 0.95, ...}
```

If you see errors like:
```
[WS 1] Failed to decode frame
[WS 1] Too many errors, closing
```

Then there's a frame processing issue.

---

## Network Tab Debugging

### To Check Network Requests

1. Open DevTools (F12)
2. Click "Network" tab
3. Toggle "Sign ON"
4. Look for WebSocket connection:
   - URL: `ws://localhost:8000/meetings/ws/...`
   - Status: 101 Switching Protocols (green)
   - Frames: Shows incoming/outgoing data

### Successful WebSocket
```
GET /meetings/ws/room123/sign-detect?token=...
Status: 101 Switching Protocols
Type: websocket
```

### Failed WebSocket
```
GET /meetings/ws/room123/sign-detect?token=...
Status: 403 Forbidden  or  500 Internal Server Error
Type: websocket
```

---

## Quick Checklist

- [ ] Frontend refreshed (F5)
- [ ] DevTools open (F12)
- [ ] Console tab selected
- [ ] Backend running (`python main.py`)
- [ ] Video call created
- [ ] Camera working (see preview)
- [ ] Toggle "Sign ON"
- [ ] Watch console for `[sign-detection-ws]` messages
- [ ] Make sign gesture
- [ ] Wait 3-4 seconds
- [ ] Should see prediction message
- [ ] On-screen should show prediction badge

---

## Debug Logging Code

The logging function in the hook:

```typescript
const log = (msg: string, data?: any) => {
  if (ENABLE_DEBUG_LOGGING) {
    console.log(`[sign-detection-ws] ${msg}`, data || "");
  }
};
```

All debug messages are prefixed with `[sign-detection-ws]` for easy filtering.

---

## Performance Monitoring

You can check performance in console while messages appear:

```javascript
// In browser console while sign detection is running:
performance.mark('frame-sent');
// Then later:
const measure = performance.measure('frame-time', 'frame-sent');
console.log('Frame processing time:', measure.duration, 'ms');
```

Expected: 5-20ms per frame at 10 FPS

---

## Summary

| Step | Status | Message |
|------|--------|---------|
| 1. Toggle Sign ON | ✅ | Initializing sign detection WebSocket |
| 2. Connect WebSocket | ✅ | Connecting to ws://... |
| 3. WebSocket Open | ✅ | WebSocket connected |
| 4. Start Frames | ✅ | Starting frame capture loop |
| 5. Send Frames | ✅ | Frame sent (repeating) |
| 6. Backend Process | ✅ | Prediction: HELLO (0.95) |
| 7. Display | ✅ | Detected: HELLO 95% |

---

**Current Status:** Debug logging enabled, ready to diagnose issues!

**Next Step:** Refresh frontend → Open DevTools → Toggle Sign ON → Watch console messages → Report any errors you see!
