# Back Button & Minimized Call Preview - UPDATED GUIDE

## ✅ What's Been Fixed

Previously, the back button was closing the website. **NOW IT WORKS CORRECTLY:**

1. **Back button** → Takes you to `/video-call` (video call landing page)
2. **Minimize button** → Also takes you to `/video-call`
3. **Call continues running** in background
4. **Minimized preview** shows in bottom-right corner with:
   - Room code display
   - "Return to Call" button
   - Maximize/Restore icon
   - Close button

## How It Works Now 🎉

### Step 1: Start a Call
```
User at /video-call (landing page)
    ↓ [Click "New meeting" or "Join meeting"]
    ↓ [Navigate to /call/roomId123]
User is now in full-screen video call ✅
```

### Step 2: Click Back Button or Minimize
```
User at /call/roomId123 (full-screen call)
    ↓ [Click browser back button OR click minimize button ↓]
    ↓ [Back button listener triggers popstate event]
    ↓ [Call stored in ActiveCallContext as "minimized"]
    ↓ [Navigate to /video-call]
User now at /video-call (landing page) ✅
Call continues running in background 🎯
```

### Step 3: See Minimized Preview
```
On /video-call landing page, in bottom-right corner:

┌────────────────────────────┐
│ Call in progress...        │
│                            │
│  (gradient background)     │
├────────────────────────────┤
│ Room: abc-defg-hij  [↗] [x]│
├────────────────────────────┤
│  ← Return to Call          │
└────────────────────────────┘
```

### Step 4: Restore Full Call
```
Option A: Click "Return to Call" button
    ↓ [Navigates to /call/roomId123]
    ↓ [Full-screen call restored]

Option B: Click maximize icon (↗)
    ↓ [Same as option A]

Option C: Click browser forward button
    ↓ [Same as option A]
```

### Step 5: Close Minimized Preview
```
Click X button in minimized preview
    ↓ [Calls endCall() in context]
    ↓ [Disconnects from room]
    ↓ [Preview disappears]
    ↓ [Can start/join new meeting]
```

## UI Components

### MinimizedCallPreview Component
```typescript
// Location: frontend/src/app/components/ui/MinimizedCallPreview.tsx
// Shows only when:
// - activeCall exists in context
// - activeCall.isMinimized === true

// Displays in fixed position: bottom-right corner
// Size: 280px wide × ~200px tall

// Features:
// - Room code display
// - Gradient background with blur effect
// - Restore button
// - Maximize icon
// - Close icon
```

### VideoCallLanding Integration
```typescript
// In VideoCallLanding.tsx return statement:
<MinimizedCallPreview />

// This shows minimized preview if a call is active
// Otherwise renders nothing (conditional in component)
```

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    /video-call                          │
│            (Video Call Landing Page)                    │
│                                                          │
│  [New meeting]              [Join meeting]              │
│                                                          │
│                    Minimized Preview                     │
│                    (if call active)                      │
│                         ↑                                │
└─────────────────────────┼──────────────────────────────┘
                          │ click "Return to Call"
                          │ OR forward button
                          │ OR maximize icon
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    /call/roomId123                       │
│              (Full-Screen Video Call)                   │
│                                                          │
│  [Video Grid] - Shows all participants                  │
│  [Captions]   - Sign & Speech captions                  │
│                                                          │
│  [S] [Sp] [🔊] [📹] [↓] [🔴]                            │
│   ↑                      ↑  ↑                            │
│   │                      │  └─ End Call (disconnect)    │
│   │                      └──── Minimize (go to landing) │
│   └────────────────────────── Sign/Speech toggles       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## File Changes

### New Files Created
1. ✅ `frontend/src/app/components/ui/MinimizedCallPreview.tsx`
   - Minimized call preview component
   - Shows when call is active and minimized
   - Handles restore and close actions

### Modified Files
1. ✅ `frontend/src/app/pages/VideoCall.tsx`
   - Back button handler updated to navigate to `/video-call`
   - Minimize button updated to navigate to `/video-call`
   - Call context properly stored and cleared

2. ✅ `frontend/src/app/pages/VideoCallLanding.tsx`
   - Imported MinimizedCallPreview component
   - Added to return statement

3. ✅ `frontend/src/app/context/ActiveCallContext.tsx`
   - Already created in previous commit
   - Manages call state across navigation

4. ✅ `frontend/src/app/App.tsx`
   - Already wrapped with ActiveCallProvider

## Testing Checklist

### Test 1: Back Button Navigation
- [ ] Start a meeting at `/call/roomId`
- [ ] Click browser back button
- [ ] Verify you're at `/video-call`
- [ ] Verify minimized preview appears in bottom-right
- [ ] Verify console shows: "📞 Back button pressed"

### Test 2: Minimize Button
- [ ] Start a meeting
- [ ] Click minimize button (↓) in control bar
- [ ] Verify you're at `/video-call`
- [ ] Verify minimized preview appears
- [ ] Verify console shows: "📞 Minimize button clicked"

### Test 3: Restore from Preview
- [ ] With minimized preview visible, click "Return to Call"
- [ ] Verify full-screen call restored
- [ ] Verify audio/video still working
- [ ] Verify other participants still see you

### Test 4: Restore from Forward Button
- [ ] From minimized state, click browser forward button
- [ ] Verify full-screen call restored
- [ ] Same as Test 3

### Test 5: Close Minimized Preview
- [ ] With minimized preview visible, click X button
- [ ] Verify preview disappears
- [ ] Verify call disconnected (check console)
- [ ] Verify you can create/join new meeting

### Test 6: Multiple Participants
- [ ] Join with 2+ participants
- [ ] Person A minimizes call
- [ ] Person B still sees Person A in grid (call active)
- [ ] Person A can create/join different meeting while call continues
- [ ] Person A clicks "Return to Call"
- [ ] Person A back in call with Person B still there

### Test 7: Network Behavior
- [ ] Start call, minimize, go to landing page
- [ ] Keep minimized preview visible for 30+ seconds
- [ ] Verify audio still working (unmute and speak)
- [ ] Other participants hear you (call not disconnected)

## Console Logging Reference

```
📞 Back button pressed — minimizing call and going to video-call page
📞 Minimize button clicked — storing call and going to video-call page
📞 Restoring call from minimized state
📞 Closing minimized call preview
📞 Call disconnected by server/user
```

## Styling & Design

### MinimizedCallPreview Appearance
- **Position**: Fixed bottom-right corner (20px offset)
- **Size**: 280px width × variable height
- **Background**: Teal gradient with blur effect
- **Border**: 2px solid teal (#14b8a6)
- **Shadow**: Depth shadow for floating effect
- **Icons**: Lucide React (Maximize2, X)

### Color Scheme
- Primary: Teal gradient (#0f766e, #134e4a)
- Text: Dark slate on white background
- Buttons: Teal background with hover effect
- Border: Light teal with opacity

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Minimize call | Click minimize button (↓) |
| Minimize call | Browser back button |
| Restore call | Browser forward button |
| Restore call | Click "Return to Call" in preview |
| Restore call | Click maximize icon in preview |
| End call | Click red end call button |

## Architecture Notes

1. **No direct video streaming** - MinimizedCallPreview doesn't show actual video
   - Just a visual indicator that call is active
   - Actual video continues on LiveKit server
   - Can be enhanced later with actual video preview if needed

2. **State Management** - Uses React Context API
   - Persists across page navigation
   - Only cleared on actual disconnect
   - Available to entire app via `useActiveCall()` hook

3. **Navigation** - Uses React Router
   - `/video-call` is always the landing page
   - `/call/roomId` is always full-screen call
   - No deep linking to previous page (prevents confusion)

4. **LiveKit Connection** - Stays alive
   - Room object persists independently
   - Server-side session continues
   - Automatic reconnection if network drops

## Commit History

- **a4c198c** - Add back button navigation and minimize call feature
- **efa8694** - Fix: Back button now goes to video-call landing page with minimized preview

## Next Steps (Optional Enhancements)

1. **Actual Video Preview** - Show real video in minimized preview
2. **Call Notifications** - Alert when someone joins/leaves while minimized
3. **Audio Indicator** - Show if there's active speech/detection while minimized
4. **Quick Actions** - Mute/unmute from minimized preview
5. **Minimize to Sidebar** - Option to collapse but keep visible during navigation

---

**Status**: ✅ FIXED - Back button now goes to landing page with minimized preview showing
