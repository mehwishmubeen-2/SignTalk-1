# Sign Detection End-to-End Test Guide

## 🐛 Bug Fixed

**Critical React hook bug fixed!** 

The frame capture effect had a broken dependency array that used a ref (`wsRef.current`) instead of a state variable. Refs don't trigger React effects, so the frame loop never started even though WebSocket connected successfully.

**Solution:** Added `useState` to track WebSocket readiness (`wsReady`), and updated the dependency array so frame capture starts when WebSocket opens.

---

## ✅ Step-by-Step Test

### 1. Refresh Frontend (Load Fixed Code)

```
Press F5 in browser
Wait for page to load
```

### 2. Open Browser DevTools

```
Press F12
Click "Console" tab
```

### 3. Create Video Call

```
Click "New Meeting" (or join existing room)
Wait for video preview to appear
Wait for LiveKit to connect (you should see your camera)
```

### 4. Toggle "Sign ON" Button

```
Look for "Sign ON" button in bottom controls
Click it
Watch the console closely
```

### 5. Expected Console Messages

You should now see a sequence of messages:

```
[sign-detection-ws] Initializing sign detection WebSocket
[sign-detection-ws] Connecting to ws://localhost:8000/meetings/ws/...
[sign-detection-ws] WebSocket connected
[sign-detection-ws] Starting frame capture loop
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
[sign-detection-ws] Frame sent
(repeating every 100ms)
```

**After 3-4 seconds**, you should see:

```
[sign-detection-ws] Prediction: HELLO (0.95)
```

### 6. Make a Sign Gesture

```
Wave your hand or make a sign (HELLO, GOODBYE, etc.)
Wait 3-4 seconds
Should see prediction appear
```

### 7. On-Screen Display

Should show a badge like:

```
Detected: HELLO 95%
```

---

## 🔍 What to Look For

### Good Signs (✅)

- Console shows `[sign-detection-ws] WebSocket connected` 
- Console shows `[sign-detection-ws] Frame sent` (many times)
- After ~3 seconds: `[sign-detection-ws] Prediction: ...`
- On-screen badge appears with sign name and confidence
- Make different signs, predictions change

### Problems (❌)

| Problem | Console Shows | Solution |
|---------|---|----------|
| No WebSocket at all | No [sign-detection-ws] messages | Browser not running debug code - press F5 |
| Connects then closes | WebSocket connected + WebSocket closed | Auth or backend error - check backend logs |
| Connects but no frames | WebSocket connected, then nothing | Frame capture loop not starting (should be fixed now) |
| Frames but no predictions | Frame sent (many), but no Prediction | Backend still processing or models not ready |

---

## 🖥️ Backend Status

### Start Backend

```bash
cd C:\Users\DELL\Downloads\SignTalk\SignTalk-master\backend
python main.py
```

### Expected Startup Output

```
INFO: Created TensorFlow Lite XNNPACK delegate for CPU
[emotion] ✅ Emotion model ready
[grammar] ✅ Grammar-correction model ready
[startup] ✅ Video call router loaded
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Backend Logs When Sign ON Clicked

Should see something like:

```
WebSocket connection attempt to /ws/{room_id}/sign-detect
Token received: eyJ...
✅ User {user_id} authenticated
[WS 1] User {user_id} connected to room {room_id}
[WS 1] Frame 1 received
[WS 1] Frame 2 received
... (many frames)
[WS 1] Prediction made: HELLO (confidence: 0.95)
Sending: {"type": "prediction", "sign": "HELLO", ...}
```

### If Backend Shows Timeout

```
[WS 1] Timeout (no frames for 30s)
```

This means WebSocket connected but NO frames arrived. The bug fix should solve this.

---

## 🚀 Full End-to-End Flow

```
1. Browser loads → Frontend hook initialized
2. Click "Sign ON" → enabled = true
3. useEffect runs → connectWebSocket() called
4. WebSocket opens → setWsReady(true)
5. Frame effect sees wsReady=true → starts frame loop
6. Frame loop sends frames every 100ms (10 FPS)
7. Backend receives frame → adds to buffer
8. After 32 frames (3.2 sec) → prediction made
9. Backend sends prediction via WebSocket
10. Frontend receives → displays on screen
```

---

## 🧪 Testing Different Signs

The model recognizes these 11 sign classes:

- ✋ **bye** - Wave goodbye
- 👋 **hello** - Wave hello
- 🤔 **how_are_you** - Hand to chin
- 😊 **i_am_fine** - Thumbs up
- 🤷 **i_dont_know** - Shrug shoulders
- 💡 **i_know** - Point to head
- 🤝 **nice_to_meet_you** - Handshake motion
- ✋ **no_sign** - Open hand (or resting)
- 👋 **see_you_later** - Wiggle fingers goodbye
- ❓ **what_is_your_name** - Point to person
- 🆙 **whats_up** - Thumbs up gesture

Make each sign clearly and wait 3-4 seconds for prediction.

---

## 📊 Performance Metrics

### Expected Numbers

- **Frame rate:** 10 FPS (100ms per frame)
- **Buffer accumulation:** 32 frames = 3.2 seconds
- **Backend processing:** ~100-200ms per prediction
- **Total latency:** 3.5-4 seconds from sign to prediction
- **Bandwidth:** ~100 KB/s per user (JPEG compressed)

### Check in Console

```javascript
// In browser console:
// Watch for prediction frequency and timing
// Should see one prediction every 3.2 seconds
// Each prediction should take ~100-200ms to process
```

---

## ⚠️ Troubleshooting

### Issue: Console shows "WebSocket connected" then immediately "WebSocket closed"

**Cause:** Auth token expired or invalid

**Solution:** 
1. Logout from SignTalk
2. Login again (new JWT token)
3. Try WebSocket connection again

### Issue: WebSocket never connects

**Cause:** Backend not running or port 8000 blocked

**Solution:**
1. Check backend terminal is showing "Uvicorn running on http://0.0.0.0:8000"
2. Test: `curl http://localhost:8000/` in PowerShell
3. Restart backend if needed

### Issue: Frames sent but no predictions

**Cause:** Model still processing (normal)

**Solution:** Wait longer - first prediction takes 3-4 seconds

### Issue: Predictions all "no_sign"

**Cause:** 
- Hand not fully visible in camera
- Lighting is poor
- Sign not in training set

**Solution:**
- Ensure good lighting
- Keep hand centered in camera
- Make clear, deliberate signs
- Check sign is in the 11 supported classes

---

## 🔐 Authentication Flow

WebSocket connection requires JWT token:

```
1. User logs in via Supabase
2. Frontend stores access_token
3. When creating video call:
   - Pass token to CallRoom component
   - Pass to ParticipantVideoTile component
   - Pass to useSignDetectionWebSocket hook
4. When connecting WebSocket:
   - ws://localhost:8000/meetings/ws/{roomId}/sign-detect?token={accessToken}
5. Backend validates token with Supabase
6. If valid: connection accepted, frame processing begins
7. If invalid: connection rejected (WebSocket closes)
```

If seeing "Auth failed", token is expired - logout and login again.

---

## 📝 Debug Logging

### Enable/Disable Debug Messages

**File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts` (Line 28)

```typescript
// To see ALL debug messages
const ENABLE_DEBUG_LOGGING = true;

// To hide debug messages (clean console)
const ENABLE_DEBUG_LOGGING = false;
```

Currently set to: **true** (debug messages ON)

All messages prefixed with `[sign-detection-ws]` for easy filtering.

---

## ✅ Checklist Before Testing

- [ ] Backend running: `python main.py` shows "Uvicorn running"
- [ ] Frontend refreshed: F5 pressed
- [ ] DevTools open: F12 → Console tab
- [ ] Logged in: Must have valid Supabase session
- [ ] Camera working: Video preview visible in call
- [ ] Good lighting: Can see hands clearly
- [ ] Browser active: Not minimized or in background

---

## 📞 Need Help?

If sign detection isn't working:

1. **Check browser console** - Look for `[sign-detection-ws]` messages
2. **Check backend logs** - Look for `[WS 1]` messages
3. **Check WebSocket in Network tab** - Should see WebSocket connection
4. **Verify camera** - Should see video preview
5. **Test auth** - Logout and login again

Report exact error messages when asking for help!

---

## Success Criteria

Sign detection is working correctly when:

✅ WebSocket connects (console shows "WebSocket connected")  
✅ Frames are sent (console shows "Frame sent" repeating)  
✅ After 3-4 seconds: "Prediction" message appears  
✅ On-screen badge shows detected sign name and confidence  
✅ Different signs show different predictions  
✅ Confidence >= 60% for accepted predictions  

---

**Summary:** The critical React hook bug has been fixed. The frame capture loop should now start immediately when WebSocket connects. Test by clicking "Sign ON" and watching for console messages!
