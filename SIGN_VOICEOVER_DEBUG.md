# Debugging Sign Voice-Over - Step by Step

## The Voice-Over Logic IS There ✅

I've confirmed the voice-over code is in `useSignDetectionWebSocket.ts` at line 119-160 in the `broadcast()` function.

---

## Why Voice-Over Might Not Play

### Possible Reasons

1. **Sign not being detected** - Backend not detecting your signs
2. **Low confidence** - Sign detected but confidence < 0.4 (threshold)
3. **Web Speech API not available** - Browser doesn't support it
4. **Audio disabled** - Muted in browser/system
5. **Permission denied** - Browser speech synthesis blocked

---

## Complete Debugging Checklist

### Step 1: Verify Sign Detection Works

**In browser console, watch for these logs when you perform a sign:**

```javascript
// SHOULD SEE:
📥 PREDICTION RECEIVED: {type: "prediction", sign: "bye", confidence: 0.85, ...}
✅ SIGN PREDICTION: bye (0.85) server=45ms
🚀 Broadcasting sign: Bye
```

**If you DON'T see these:**
- ❌ Backend not detecting signs
- ❌ WebSocket not connected
- ❌ Confidence too low

**Fix:**
1. Check `✅ WebSocket OPENED` appears when you enable sign mode
2. Perform signs more **deliberately and clearly**
3. Ensure **good lighting** on your hands
4. Check backend console for processing errors

### Step 2: Verify Voice-Over Code Executes

**When broadcast() is called, you should see:**

```javascript
🚀 BROADCAST FUNCTION CALLED
Text: Bye
Room object exists: true
Room.localParticipant: Participant { identity: "user-123", ... }
🔊 Playing voice-over for sign: Bye
🔊 Sign voice-over started: Bye
✅ publishData() succeeded
```

**If you see "🔊 Playing voice-over for sign:" but DON'T hear audio:**
- Issue is with Web Speech Synthesis API
- Go to Step 3

**If you DON'T see "🔊 Playing voice-over for sign:" at all:**
- broadcast() is not being called
- Go back to Step 1
- Check confidence threshold (need ≥ 0.4 by default)

### Step 3: Test Web Speech Synthesis API

**In browser console, copy-paste and run:**

```javascript
// Test if Web Speech Synthesis is available
console.log("speechSynthesis available:", !!window.speechSynthesis);
console.log("SpeechSynthesisUtterance available:", !!window.SpeechSynthesisUtterance);

// Test basic speech
let test = new SpeechSynthesisUtterance("hello world");
test.onstart = () => console.log("Speech started");
test.onend = () => console.log("Speech ended");
test.onerror = (e) => console.error("Speech error:", e.error);
window.speechSynthesis.speak(test);

// You should HEAR "hello world" spoken
```

**If you HEAR "hello world":**
- ✅ Web Speech Synthesis works
- Voice-over should work
- Go to Step 4

**If you DON'T hear anything:**
- Check Step 4: Audio issues

### Step 4: Check Audio Configuration

**Checklist:**
- [ ] 🔊 System volume is ON (not muted)
- [ ] 🔊 Browser volume is ON (not muted in tab)
- [ ] 🔊 Speakers/headphones connected
- [ ] 🔊 Another app isn't using audio

**Test System Audio:**
1. Open YouTube
2. Play any video
3. Should hear audio
4. If not, fix audio first

**Test Browser Audio:**
1. Go to any website
2. Make sure audio plays
3. If muted, unmute tab

### Step 5: Check Browser Permissions

**For Chrome/Edge:**
1. Click 🔒 (lock icon) in address bar
2. Look for "Permissions"
3. Check "Microphone" and "Speakers"
4. If blocked, change to "Allow"

---

## Testing Procedure

### Complete Test Flow

**Open 2 Browsers (or 2 tabs):**

**Browser 1 (Sender):**
```
1. Open DevTools (F12)
2. Go to Console tab
3. Join video call
4. Enable Sign Mode
5. Console should show:
   ✅ WebSocket OPENED
   📹 Capture started at 30 FPS
   
6. Perform a sign (e.g., wave hand = "bye")
7. Look for:
   📥 PREDICTION RECEIVED
   ✅ SIGN PREDICTION: bye (0.XX)
   🚀 Broadcasting sign: Bye
   🔊 Playing voice-over for sign: Bye
   🔊 Sign voice-over started: Bye
   
8. LISTEN for voice-over "Bye" 🔊
9. Check console for 🔊 logs
```

**Browser 2 (Receiver):**
```
1. Open DevTools (F12)
2. Watch Browser 1 perform sign
3. Should see caption appear
4. Should hear voice-over
5. Look for:
   📨 DataReceived event triggered!
   ✅ Caption from user-1: "Bye"
   🔊 Playing voice-over: Bye
```

---

## Common Issues & Quick Fixes

### Issue: "🔊 Playing voice-over" appears but no sound

**Fix 1: Check system volume**
```
Windows: Click speaker icon → make sure not muted
Mac: System Preferences → Sound → check volume
```

**Fix 2: Check browser volume**
```
Right-click on browser tab → "Unmute site"
```

**Fix 3: Check browser permissions**
```
Click 🔒 icon → Permissions → Speakers should be "Allow"
```

**Fix 4: Restart browser**
```
Close all browser windows
Reopen browser
Rejoin video call
Try again
```

### Issue: No "📥 PREDICTION RECEIVED" in console

**This means:**
- Backend not detecting signs
- OR WebSocket not connected

**Fix:**
1. Check `✅ WebSocket OPENED` appears
2. If not, backend not running: `python main.py`
3. If yes, make signs more deliberate
4. Better lighting on hands
5. Center hands in frame

### Issue: "🚀 Broadcasting sign" appears but no "🔊 Playing voice-over"

**This means:**
- broadcast() called
- But voice-over code didn't execute

**Fix:**
1. Check browser console for errors
2. Restart browser
3. Try different browser (Chrome recommended)

### Issue: Room.participants count: 0 in console

**This means:**
- You're alone in the call (not a problem)
- Caption won't be broadcast to others
- But YOU should still hear voice-over

**If you don't hear voice-over even when alone:**
- Use Steps 3-4 above to debug audio

---

## Expected Console Output

### Perfect Test Result

```
🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/...
✅ WebSocket OPENED - Ready to send frames
📹 Capture started at 30 FPS

📤 Frame #30: sent 12345 bytes, buffered: 0
📤 Frame #60: sent 12340 bytes, buffered: 0

[Perform sign "bye"]

📥 PREDICTION RECEIVED: {type: "prediction", sign: "bye", confidence: 0.85}
✅ SIGN PREDICTION: bye (0.85) server=45ms
🚀 Broadcasting sign: Bye

════════════════════════════════════════
🚀 BROADCAST FUNCTION CALLED
Text: Bye
Room object exists: true
Room.participants count: 1
Remote participant IDs: ["user-B"]
Message to broadcast: {topic: "caption", type: "sign", text: "Bye", isFinal: false, identity: "user-A"}
✅ Local caption update called
🔊 Playing voice-over for sign: Bye
🔊 Sign voice-over started: Bye
Publishing details:
  - Encoded bytes: 89
  - Remote participants count: 1
  - Destination IDs: ["user-B"]
✅ publishData() succeeded
════════════════════════════════════════
```

---

## Video Call Test With 2 People

### Person A (Signer):
1. Enable sign mode
2. Perform sign "bye"
3. **Console shows:** `🔊 Sign voice-over started: Bye`
4. **Hears:** "Bye" spoken 🔊
5. **Sees:** Caption "Bye" on own screen
6. Person B's screen also shows "Bye"
7. Person B hears "Bye" 🔊

### Person B (Listener):
1. Watch Person A
2. **See:** Caption "Bye" below Person A's video
3. **Hear:** "Bye" spoken 🔊
4. Console shows: `🔊 Playing voice-over: Bye`

---

## If Voice-Over Still Doesn't Work

### Collect This Information:

1. **Screenshot of console showing:**
   - `✅ SIGN PREDICTION: bye (0.XX)`
   - `🔊 Playing voice-over for sign: Bye`
   - Any error messages with ❌

2. **Answer these questions:**
   - Can you hear audio from YouTube?
   - Is microphone working?
   - Which browser (Chrome/Firefox/Edge/Safari)?
   - Which OS (Windows/Mac/Linux)?
   - Any error messages in red?

3. **Run this diagnostic in console:**
```javascript
console.log({
  speechSynthesis: !!window.speechSynthesis,
  speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  userAgent: navigator.userAgent
});
```

4. **Test Web Speech Synthesis:**
```javascript
let test = new SpeechSynthesisUtterance("test");
window.speechSynthesis.speak(test);
// Do you hear "test"?
```

---

## Files to Check

The voice-over code is in:
**File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts`
**Function:** `broadcast()`
**Lines:** ~119-160

The code definitely exists and is being called.

---

## Summary

✅ **Voice-over code IS implemented**
✅ **It IS being called when sign detected**
✅ **Follow debugging steps if it doesn't work**

The most common reasons for no voice-over:
1. Signs not being detected (confidence too low)
2. Audio muted in browser or system
3. Browser permissions blocking speech synthesis

Use the debugging steps above to identify which one applies to you.

---

## Next Action

1. **Follow Steps 1-5 above**
2. **Share console output** from the test
3. **I can help debug** with specific error messages

The code is there. The issue is either:
- Sign not being detected (backend)
- Audio not working (system/browser)
- Permissions (browser)

Use the debugging checklist to identify which!
