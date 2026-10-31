# Technical Details: Caption Broadcasting Fix

## Issue Analysis

### LiveKit Data Publishing API
The LiveKit client library provides a `publishData()` method on participants with this signature:

```typescript
publishData(data: Uint8Array, options?: DataPublishOptions): Promise<void>
```

Where `DataPublishOptions` includes:
```typescript
{
  reliable?: boolean;
  topic?: string;
  destinationIdentities?: string[]; // CRITICAL: List of participant identities to receive the message
}
```

### The Bug
The original code did NOT specify `destinationIdentities`, relying on the implied "broadcast to all" behavior:

**Before (Broken):**
```typescript
// In useSignDetectionWebSocket.ts - broadcast() function
r.localParticipant?.publishData(
  new TextEncoder().encode(JSON.stringify(msg)),
  { reliable: true, topic: "caption" }  // ❌ No destinationIdentities
);
```

**Why it fails with 3+ participants:**
- When `destinationIdentities` is undefined/empty, LiveKit may interpret this as "send only to known subscribers"
- With late joiners, the participant list might not be fully synchronized at the moment of publish
- The data packet may be routed through the LiveKit server's mesh, and without explicit destinations, some peers don't receive it

### The Fix
Explicitly enumerate all remote participants as destinations:

**After (Fixed):**
```typescript
// In useSignDetectionWebSocket.ts - broadcast() function
const remoteParticipants = room.participants || [];
const destinationIds = remoteParticipants.map(p => p.identity);

r.localParticipant?.publishData(
  new TextEncoder().encode(JSON.stringify(msg)),
  {
    reliable: true,
    topic: "caption",
    destinationIdentities: destinationIds.length > 0 ? destinationIds : undefined  // ✅ Explicit destinations
  }
);
```

## Code Changes Detail

### 1. useSignDetectionWebSocket.ts

**Change Location:** Lines 88-118 (broadcast function)

**What Changed:**
- Extract all remote participants from `room.participants`
- Map their identities to create a destination list
- Pass this list in the `DataPublishOptions`
- Add detailed console logging to track the broadcast

**Impact:**
- Ensures every sign detection reaches all remote participants
- Provides visibility into what's being sent and to whom

### 2. useSpeechCaptions.ts

**Change Locations:** 
- Lines 16-35 (clearCaption function)
- Lines 70-95 (recognition.onresult handler)

**What Changed:**
- Same pattern as useSignDetectionWebSocket
- Both sending captions AND clearing them now explicitly specify destinations
- Ensures speech captions work correctly with multiple participants

**Impact:**
- Speech-to-text captions now broadcast reliably
- Clearing captions is also guaranteed to reach all participants

### 3. VideoCall.tsx

**Change Location:** Lines 130-175 (handleData effect hook)

**What Changed:**
- Added console.log statements to track incoming caption messages
- Logs include the message content and sender identity
- Helps diagnose reception issues

**Also Updated:**
- handleLocalCaption now logs when local captions are set/cleared

**Impact:**
- Easier debugging of caption delivery
- Can verify messages are being received on remote participants

### 4. Error Fixes (Windows Console)

**backend/app/emotion/router.py** line 16:
```python
# Before: print("[emotion] ✅ Emotion model ready")
# After:  print("[emotion] [OK] Emotion model ready")
```

**backend/app/grammar/router.py** line 26:
```python
# Before: print("[grammar] ✅ Grammar-correction model ready")
# After:  print("[grammar] [OK] Grammar-correction model ready")
```

Reason: Windows console (cp1252 encoding) cannot render the ✅ emoji, causing UnicodeEncodeError.

## Testing Checklist

- [ ] Start backend: `python main.py` (should print "[OK]" messages)
- [ ] Start frontend: `npm run dev` in frontend directory
- [ ] Open browser console (F12)
- [ ] Have Person A join room
- [ ] Have Person B join same room
- [ ] Person A enables "Sign" mode and performs sign
- [ ] Verify Person B sees captions (check browser console for "📨 Caption from..." logs)
- [ ] Have Person C join
- [ ] Person A signs again
- [ ] Verify Persons B and C both see captions
- [ ] Repeat with speech mode enabled

## Performance Impact

✅ **Minimal**
- Only adds a single `map()` call over the remote participants array
- No network overhead (same data packet, just with explicit destinations)
- Actually more efficient: LiveKit server doesn't need to query who should receive

## Logging Output Examples

### When Person A Signs (Local Console in Person A's Browser)
```
[useSignDetectionWebSocket] broadcast() called: identity=8d2b0f5a-1234-5678-9abc-def012345678, text="Hello", isFinal=false
[useSignDetectionWebSocket] publishing 150 bytes to 2 remote participants: 9e3c1f6b-abcd-ef01-2345-6789abcdef01, 7f4d2e7c-bcde-f012-3456-789abcdef012
[useSignDetectionWebSocket] publishData() succeeded
```

### When Person B Receives (Remote Console in Person B's Browser)
```
📨 Received data message: {topic: "caption", type: "sign", text: "Hello", isFinal: false, identity: "8d2b0f5a-1234-5678-9abc-def012345678"}
📨 Caption from 8d2b0f5a-1234-5678-9abc-def012345678: "Hello"
[VideoCall] setting caption for 8d2b0f5a-1234-5678-9abc-def012345678: "Hello"
```

## Future Improvements

1. **Reduce Logging**: Set `DEBUG = false` in production
2. **Add Metrics**: Track caption delivery success rate
3. **Implement Retry**: If delivery to one participant fails, retry with fallback behavior
4. **User Feedback**: Show UI indicator if participant is offline/unreachable
