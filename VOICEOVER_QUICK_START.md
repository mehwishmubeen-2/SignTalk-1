# Voice-Over Feature - Quick Start Guide

## What's New?

When remote participants receive captions from sign language detection, the caption text is now **read aloud** using text-to-speech!

## How It Works

```
Sender: Performs sign "HELLO"
  ↓
Receiver: Sees caption "HELLO" AND hears "HELLO" spoken aloud
  ↓
After 4 seconds: Caption disappears, voice-over stops
```

## Test It (2 minutes)

### Setup
1. Pull latest code: `git pull`
2. Restart backend: `python main.py`
3. Restart frontend: `npm run dev`
4. Open 2 browsers, both join same video call

### Test Steps
1. **Person A:** Enable sign mode
2. **Person A:** Perform clear sign (e.g., wave hand, point) = "HELLO"
3. **Person B:**
   - 🔊 Should **HEAR**: "HELLO" spoken aloud
   - 📺 Should **SEE**: "HELLO" caption below Person A's video
   - ⏰ After 4 seconds: Caption and audio stop
4. **Console (Person B):** Should see logs with 🔊 emoji

### ✅ Expected Result
- Caption appears
- Voice reads caption aloud
- 4 seconds later, both disappear

## Console Logs

Look for these logs with 🔊 emoji:

```
🔊 Playing voice-over: HELLO
🔊 Voice-over started
(4 seconds)
🔊 Voice-over cancelled
```

## Features

✅ **Automatic** - No settings needed, works out of box
✅ **Accessible** - Helps users with visual impairments
✅ **Private** - All processing happens locally (no data sent)
✅ **Works everywhere** - Chrome, Firefox, Edge, Safari
✅ **Sign & Speech** - Works with both caption types
✅ **Multi-user** - Works with 2, 3, or more participants

## Configuration

### Adjust Speed
Edit `frontend/src/app/pages/VideoCall.tsx`, line where:
```javascript
utterance.rate = 1.0;  // Change this number
```
- `0.5` = Half speed (slower)
- `1.0` = Normal (default)
- `1.5` = 1.5x speed (faster)

### Adjust Pitch
```javascript
utterance.pitch = 1.0;  // Change this number
```
- Lower numbers = lower voice
- Higher numbers = higher voice

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No voice heard | Check system volume, browser volume |
| Wrong language | Edit `utterance.lang = "en-US"` in VideoCall.tsx |
| Voice too fast/slow | Adjust `utterance.rate` |
| Voice stops mid-speech | That's normal if new caption arrives |
| Error in console | Check browser supports Speech Synthesis API |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full |
| Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari | ✅ Full |
| Opera | ✅ Full |
| Mobile | ✅ Full |

## What Happens in Different Scenarios

### Scenario 1: One Sign
1. Person A signs "HELLO"
2. Person B hears: "HELLO" ✅
3. Person B sees: "HELLO" caption ✅
4. After 4s: Voice stops, caption disappears ✅

### Scenario 2: Rapid Signs
1. Person A signs "A", "B", "C" rapidly
2. Person B hears: "A" (then interrupted) → "B" (then interrupted) → "C"
3. Each caption triggers new voice-over
4. Previous voice-over is cancelled (this is normal)

### Scenario 3: Three People
1. Person A signs "HELLO"
2. Person B hears: "HELLO" ✅
3. Person C hears: "HELLO" ✅
4. Both B and C see same caption ✅
5. May hear 2 voices overlapping (both browsers playing) ✅

### Scenario 4: Speech Caption
1. Person A speaks: "Good morning"
2. Person B hears: "Good morning" ✅
3. Caption appears ✅
4. Auto-clears after 5s of silence ✅

## For Developers

### Code Location
- **Main implementation:** `frontend/src/app/pages/VideoCall.tsx`
- **Function:** `playVoiceOver(text)` 
- **Lines:** Around line 133-160

### How It Works
```javascript
// When caption received:
playVoiceOver(msg.text);  // ← Plays voice-over

// When caption cleared:
window.speechSynthesis?.cancel();  // ← Stops voice-over

// When auto-clearing:
window.speechSynthesis?.cancel();  // ← Stops voice-over
```

### Logging
All voice-over events logged with 🔊 prefix:
```
console.log("🔊 Playing voice-over:", text);
console.log("🔊 Voice-over started");
console.log("🔊 Voice-over completed");
console.log("🔊 Voice-over cancelled");
console.error("🔊 Voice-over error:", error);
```

## Complete Documentation

For detailed information, see: **VOICEOVER_FEATURE_GUIDE.md**

Includes:
- Technical implementation details
- Customization options
- Comprehensive testing procedures
- Troubleshooting guide
- Browser compatibility matrix
- Performance impact analysis
- Privacy & security notes
- Edge cases and how to handle them

## Summary

| Aspect | Details |
|--------|---------|
| **What** | Voice-over reads caption text aloud |
| **When** | When caption appears on receiver's screen |
| **Where** | In receiver's browser (local) |
| **How** | Web Speech Synthesis API (built-in) |
| **Duration** | Same as caption (auto-clears after 4s) |
| **Privacy** | Completely private (no data sent) |
| **Cost** | Free (built-in browser feature) |
| **Setup** | None required (works automatically) |

## Next Steps

1. ✅ Pull latest code
2. ✅ Restart backend & frontend
3. ✅ Test sign detection with voice-over
4. ✅ Check console logs (🔊 prefix)
5. ✅ Enjoy captions with audio feedback!

---

**Git Commit:** 21ba817
**Feature Status:** ✅ COMPLETE & READY TO USE
