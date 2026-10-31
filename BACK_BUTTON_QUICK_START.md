# Quick Reference: Back Button & Minimize Feature

## What's New? 🎉

Two ways to pause your video call and return to other pages while keeping the call running:

1. **Back Button** - Browser back button or Alt+Left arrow
2. **Minimize Button** - New ↓ button in the control bar (next to camera)

## Before vs After

### BEFORE
```
Back button clicked
    ↓
Call immediately disconnects ❌
    ↓
Other participants see you leave 😞
    ↓
You're stuck on home page
```

### AFTER
```
Back button clicked
    ↓
Call continues running in background ✅
    ↓
You navigate to other pages
    ↓
Call still active for other participants 😊
    ↓
Can click browser forward or manually navigate back to /call/roomId to restore full screen
```

## UI Changes

### CallControls Bar (Bottom)
```
[Sign] [Speech]  |  [🔊] [📹] [↓] [🔴]  |  [...]
                           ▲
                    NEW: Minimize button
                    (only visible during call)
```

### Buttons Overview
| Button | Icon | Action |
|--------|------|--------|
| Sign | ✋ | Toggle sign caption mode |
| Speech | 🎤 | Toggle speech caption mode |
| Mute | 🔊/🔇 | Toggle microphone |
| Camera | 📹/📷 | Toggle camera |
| **Minimize** | **↓** | **[NEW] Minimize call** |
| End Call | 🔴 | Disconnect and go home |

## How to Use

### Minimize During a Call
```
Option 1: Click the minimize button (↓)
Option 2: Click browser back button
Option 3: Press Alt + Left arrow (or Backspace on some browsers)

Result: You see the previous page, but call continues! ✅
```

### Return to Full-Screen Call
```
Option 1: Click browser forward button
Option 2: Manually navigate back to /call/roomId

Result: Video call resumes full screen
```

### Actually Disconnect (End Call)
```
Click the red end call button

Result: Call fully disconnected
        Redirected to /home
        Other participants see you left 👋
```

## Console Indicators

Watch these logs in browser DevTools (F12 → Console):

| Log | Meaning |
|-----|---------|
| 📞 Back button pressed | Back button clicked, minimizing |
| 📞 Minimize button clicked | Minimize button clicked |
| 📞 Call disconnected | End call button clicked |
| 📞 Call minimized | Call paused |
| 📞 Call restored | Call resumed |

## Key Facts

✅ **Call Persists** - Audio/video continues streaming to other participants
✅ **No Token Loss** - Your auth token is preserved
✅ **Any Page** - Can browse dashboard, home, or any page
✅ **Quick Return** - One click or back button to restore
✅ **Full Disconnect** - End call button still works as before
✅ **Mobile Friendly** - System back button minimizes on Android/iOS

## What Happens When You...

| Action | Call Status | Location |
|--------|-------------|----------|
| Click minimize (↓) | Running 🟢 | Previous page |
| Click back button | Running 🟢 | Previous page |
| Click forward button | Running 🟢 | Call (full screen) |
| Navigate to /dashboard | Running 🟢 | Dashboard |
| Click end call (🔴) | Disconnected 🔴 | Home page |
| Close browser tab | Disconnected 🔴 | (server cleanup) |
| Network disconnect | Disconnected 🔴 | Error shown |

## Why This Matters

1. **Better UX** - Don't have to choose between call or other pages
2. **Like Google Meet** - Familiar behavior for users
3. **Productivity** - Check dashboard while waiting for someone to join
4. **No Accidental Disconnects** - Back button is safe now

## Troubleshooting

**Q: Back button still disconnects?**
A: Check browser console for errors. Refresh page and try again.

**Q: Minimize button not showing?**
A: Make sure you're on the call page (/call/roomId). Button only shows during active call.

**Q: Call disconnects after 30 seconds?**
A: LiveKit connection timeout. Should restart automatically. Check network.

**Q: What if I navigate to /home manually?**
A: Call continues running! Can navigate back to /call/roomId or use back button to restore.

## Technical Stack

- **Context API** - `ActiveCallContext` manages call state
- **React Router** - `useNavigate()` handles navigation
- **LiveKit** - Call connection persists independently
- **Browser History API** - `popstate` event catches back button

## Files Changed

1. ✅ `frontend/src/app/context/ActiveCallContext.tsx` (NEW)
2. ✅ `frontend/src/app/App.tsx` (wrapped with provider)
3. ✅ `frontend/src/app/pages/VideoCall.tsx` (back button handler)
4. ✅ `frontend/src/app/components/ui/CallControls.tsx` (minimize button)

---

**Need more details?** See [BACK_BUTTON_MINIMIZE_GUIDE.md](./BACK_BUTTON_MINIMIZE_GUIDE.md)
