# Caption Broadcasting Fix - Validation Checklist

## Status: ✅ READY FOR TESTING

### Changes Made

#### Frontend Files Modified

1. **`frontend/src/app/hooks/useSignDetectionWebSocket.ts`**
   - ✅ Modified `broadcast()` function to include `destinationIdentities`
   - ✅ Extracts remote participant identities from `room.participants`
   - ✅ Added detailed console logging for debugging
   - ✅ Enabled `DEBUG = true` for visibility during testing

2. **`frontend/src/app/hooks/useSpeechCaptions.ts`**
   - ✅ Modified `clearCaption()` function to include `destinationIdentities`
   - ✅ Modified `recognition.onresult` handler to include `destinationIdentities`
   - ✅ Both sending and clearing captions now reach all participants

3. **`frontend/src/app/pages/VideoCall.tsx`**
   - ✅ Enhanced `DataReceived` event handler with detailed logging
   - ✅ Added logging to `handleLocalCaption` function
   - ✅ Added "📨" emoji prefix to received data logs for visibility

#### Backend Files Fixed

4. **`backend/app/emotion/router.py`**
   - ✅ Fixed Unicode emoji encoding issue (line 16)
   - ✅ Changed from `✅` to `[OK]` for Windows console compatibility

5. **`backend/app/grammar/router.py`**
   - ✅ Fixed Unicode emoji encoding issue (line 26)
   - ✅ Changed from `✅` to `[OK]` for Windows console compatibility

### What This Fixes

**Problem:** Captions were visible to the signing person only, not to other participants with 2+ people in the call.

**Root Cause:** The `publishData()` method was not explicitly specifying destination participants, causing delivery failures in multi-participant scenarios.

**Solution:** Explicitly enumerate all remote participants as destinations using the `destinationIdentities` parameter.

---

## Pre-Testing Setup

### System Requirements
- ✅ Node.js installed (for frontend)
- ✅ Python 3.8+ installed (for backend)
- ✅ LiveKit server running or accessible
- ✅ Supabase auth configured
- ✅ Multiple browser windows/tabs for testing multi-participant scenarios

### Environment Setup

1. **Backend**
   ```bash
   cd backend
   python main.py
   ```
   Expected output should include:
   - `[emotion] [OK] Emotion model ready`
   - `[grammar] [OK] Grammar-correction model ready`
   - `INFO: Uvicorn running on http://0.0.0.0:8000`

2. **Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   Expected output should include:
   - `VITE ready in ...`
   - `Local: http://localhost:5174/` (or similar port)

---

## Test Scenarios

### Test 1: Two-Participant Scenario (Sign Mode)

**Setup:**
1. Open Browser Tab A (Person A)
2. Open Browser Tab B (Person B)
3. Both sign in with different accounts
4. Person A creates or joins a room
5. Person B joins the same room

**Test Steps:**
1. Person A: Enable "Sign" mode (click sign button)
2. Person A: Perform a sign gesture
3. Person B: Look at Person A's video tile
4. **Expected Result:** Person B should see a caption below Person A's video (e.g., "✦ SIGN HELLO")

**Browser Console Verification:**
- Person A's console should show:
  ```
  [useSignDetectionWebSocket] broadcast() called: identity=..., text="Hello", isFinal=false
  [useSignDetectionWebSocket] publishing 150 bytes to 1 remote participants: ...
  [useSignDetectionWebSocket] publishData() succeeded
  ```
- Person B's console should show:
  ```
  📨 Received data message: {topic: "caption", ...}
  📨 Caption from ...: "Hello"
  ```

**Pass Criteria:**
- ✅ Person B sees the caption
- ✅ Console shows `publishData() succeeded` on Person A
- ✅ Console shows received data message on Person B
- ✅ Caption appears within 1 second of sign performance
- ✅ Caption disappears after 4 seconds of no new sign

---

### Test 2: Two-Participant Scenario (Speech Mode)

**Setup:**
1. Open Browser Tab A (Person A)
2. Open Browser Tab B (Person B)
3. Both sign in with different accounts
4. Both join the same room

**Test Steps:**
1. Person A: Enable "Speech" mode (click speech button)
2. Person A: Say "Hello world"
3. Person B: Look at Person A's video tile
4. **Expected Result:** Person B should see a caption (e.g., "🎤 SPEECH Hello world")

**Browser Console Verification:**
- Similar to Test 1, but with `type: "speech"` in the message

**Pass Criteria:**
- ✅ Person B sees the speech caption
- ✅ Caption matches the spoken text (or closely approximates it)
- ✅ No console errors

---

### Test 3: Three-Participant Scenario (Sign Mode)

**Setup:**
1. Open Browser Tab A (Person A)
2. Open Browser Tab B (Person B)
3. Open Browser Tab C (Person C)
4. All sign in with different accounts
5. All join the same room

**Test Steps:**
1. Person A: Enable "Sign" mode
2. Person A: Perform a sign gesture
3. Person B: Check if caption appears on Person A's tile
4. Person C: Check if caption appears on Person A's tile
5. **Expected Result:** Both Person B AND Person C should see the caption

**Browser Console Verification:**
- Person A's console should show:
  ```
  [useSignDetectionWebSocket] publishing 150 bytes to 2 remote participants: ...
  ```
- Both Person B and C should receive the message

**Pass Criteria:**
- ✅ Person B sees the caption
- ✅ Person C sees the caption
- ✅ Both captions appear simultaneously
- ✅ Person A's console shows "2 remote participants"

---

### Test 4: Edge Case - Participant Joins After Signing Starts

**Setup:**
1. Open Browser Tab A (Person A)
2. Open Browser Tab B (Person B)
3. Person A joins room first
4. Person A enables "Sign" mode and waits

**Test Steps:**
1. Person A: Performs a sign gesture
2. Person B: Joins the room
3. Person A: Performs another sign gesture
4. Person B: Check if captions appear on Person A's tile for the SECOND gesture
5. **Expected Result:** Person B should see the second caption

**Pass Criteria:**
- ✅ First gesture: Only Person A sees caption (expected, Person B not yet in room)
- ✅ Second gesture: Both Person A and Person B see caption
- ✅ No errors in console for late joiners

---

### Test 5: Multiple Participants, One at a Time

**Setup:**
1. All three participate in sequence

**Test Steps:**
1. Person A joins, enables sign mode, performs sign
2. Person B joins
3. Person A performs another sign
4. Person C joins
5. Person A performs another sign
6. **Expected Result:** All captions visible to everyone who has joined

**Pass Criteria:**
- ✅ After Person B joins, B sees captions
- ✅ After Person C joins, C sees captions
- ✅ All three see the final sign

---

## Regression Testing

### Test 6: Verify Video/Audio Still Works

**Test Steps:**
1. Verify video stream is visible from all participants
2. Verify audio is transmitted (if mic enabled)
3. Verify participant count updates correctly

**Pass Criteria:**
- ✅ Video streaming unaffected
- ✅ Audio streaming unaffected
- ✅ Participant list accurate

---

### Test 7: Disable Features

**Test Steps:**
1. Turn OFF sign mode while caption visible
2. Verify caption clears immediately
3. Turn OFF speech mode
4. Verify no new captions appear

**Pass Criteria:**
- ✅ Caption clears when mode disabled
- ✅ New captions don't appear when mode disabled

---

## Known Issues & Workarounds

### Issue: "destinationIdentities undefined" in old LiveKit versions
**Workaround:** Ensure `@livekit/components-react` is version ^2.9.21 or later

### Issue: Console shows many DEBUG logs
**Solution:** Set `DEBUG = false` in `useSignDetectionWebSocket.ts` line 48 after testing

### Issue: Backend crashes with emoji
**Status:** ✅ FIXED - Changed all `✅` emojis to `[OK]`

---

## Performance Expectations

- **Broadcasting latency:** < 100ms
- **Caption appearance:** < 1 second after sign detection
- **CPU usage:** No noticeable increase
- **Network bandwidth:** ~150 bytes per caption message

---

## Debug Commands

### Enable Maximum Logging
In browser console, run:
```javascript
// Already enabled in code, but can verify:
localStorage.setItem('DEBUG_SIGNTALK', 'true');
location.reload();
```

### Check Network Traffic
In browser DevTools Network tab, filter for WebSocket messages:
- Look for messages to `sign-detect` endpoint
- Look for caption messages in the room

### Extract Console Logs
```javascript
// Copy all logs to clipboard
copy(performance.memory || 'No memory info')
```

---

## Success Criteria Summary

All of the following must be true for the fix to be considered successful:

1. ✅ Person 1 can sign and Person 2 sees the caption
2. ✅ Person 1 can sign and both Person 2 and Person 3 see the caption
3. ✅ Late joiners see captions from people already signing
4. ✅ Speech captions also broadcast to all participants
5. ✅ No console errors during caption delivery
6. ✅ Captions clear correctly after 4 seconds or when mode is disabled
7. ✅ No regression in video/audio functionality
8. ✅ Backend starts without Unicode errors

---

## Post-Testing Steps

### If Tests Pass
1. Set `DEBUG = false` in `useSignDetectionWebSocket.ts`
2. Remove console logs from production build
3. Commit changes with message: "Fix: Broadcast captions to all participants using explicit destinationIdentities"

### If Tests Fail
1. Check browser console for specific error
2. Verify `room.participants` is populated correctly
3. Check LiveKit server connectivity
4. Verify participant identities are valid

---

## Documentation References

- [LiveKit Data Publishing](https://docs.livekit.io/guides/develop/publish-data/)
- [LiveKit React Components](https://docs.livekit.io/reference/components-react/)
- [LiveKit Client JS API](https://docs.livekit.io/reference/client-sdk-js/)
