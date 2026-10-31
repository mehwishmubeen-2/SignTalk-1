# Back Button & Call Minimize Feature Guide

## Overview
When users press the browser's back button or click the minimize button during a video call, the call now continues running in the background while the user is taken to the previous page. This is similar to how Google Meet and other modern video conferencing apps work.

## Features Implemented

### 1. Browser Back Button Handling
- **What it does**: When user clicks the back button or uses keyboard shortcut (Backspace/Alt+Left), the call is minimized instead of immediately disconnecting
- **How it works**: 
  - Listens for `popstate` event (triggered by back button)
  - Stores call info in ActiveCallContext
  - Navigates back without calling `room.disconnect()`
  - Call continues in LiveKit room on the server

### 2. Minimize Button
- **Location**: In the CallControls bar (between camera toggle and end call button)
- **Icon**: Chevron Down (↓) icon
- **Behavior**: Same as back button — minimizes call without disconnecting
- **Label in UI**: "Minimize call"

### 3. End Call Button
- **Still works as before**: Properly disconnects from the room and returns to home
- **Red pill-shaped icon**: CallEndIcon component
- **Behavior**: Triggers `onDisconnected` callback which logs activity and redirects

## Architecture

### New Files
1. **`frontend/src/app/context/ActiveCallContext.tsx`** (59 lines)
   - Context provider to manage active call state
   - Available to entire app via `useActiveCall()` hook
   - Methods: `setActiveCall()`, `minimizeCall()`, `restoreCall()`, `endCall()`

### Modified Files
1. **`frontend/src/app/App.tsx`**
   - Wrapped app with `<ActiveCallProvider>`
   - Call state now persists across navigation

2. **`frontend/src/app/pages/VideoCall.tsx`**
   - Added `useActiveCall()` hook
   - Added `popstate` event listener for back button
   - Added `minimizeCall()` callback
   - Stores token/serverUrl when back button pressed
   - Updated `onDisconnected` to call `endCall()`

3. **`frontend/src/app/components/ui/CallControls.tsx`**
   - Added `ChevronDown` icon import from lucide-react
   - Added `onMinimize` prop (optional)
   - Added minimize button between camera and end call buttons
   - Minimize button only shown when `onMinimize` handler is provided

## User Flow

### Scenario 1: User Clicks Back Button
```
User at: /call/roomId123 (full-screen video call)
          ↓ [Clicks browser back button]
          ↓ [popstate event fires]
          ↓ [Call stored in ActiveCallContext]
          ↓ [navigate(-1) called]
User at: /dashboard or /home (previous page)
Call:    Still running in background ✓
```

### Scenario 2: User Clicks Minimize Button
```
User at: /call/roomId123 (full-screen video call)
          ↓ [Clicks minimize button (↓)]
          ↓ [minimizeCall() handler triggered]
          ↓ [Call stored in ActiveCallContext]
          ↓ [navigate(-1) called]
User at: /dashboard or /home (previous page)
Call:    Still running in background ✓
```

### Scenario 3: User Clicks End Call Button
```
User at: /call/roomId123 (full-screen video call)
          ↓ [Clicks end call button (red)]
          ↓ [leaveCall() handler triggered]
          ↓ [room.disconnect() called]
          ↓ [onDisconnected callback fires]
          ↓ [endCall() clears ActiveCallContext]
          ↓ [navigate("/") to home]
User at: /home
Call:    Fully disconnected ✓
```

## Console Logging

When testing, watch the browser console for these logs:

### Back Button Pressed
```
📞 Back button pressed — minimizing call
```

### Minimize Button Clicked
```
📞 Minimize button clicked — storing call and navigating back
```

### Call Disconnected
```
📞 Call disconnected by server/user
```

### Call Already Minimized
```
📞 Call minimized
```

### Call Restored
```
📞 Call restored
```

## Technical Details

### Why Back Button Works
1. **`window.history.pushState()`** - Creates a new history entry when entering the call page
2. **`window.addEventListener("popstate")`** - Catches the back button event
3. **`navigate(-1)`** - Uses React Router to navigate back without disconnect
4. **LiveKit room stays connected** - The room on the server continues to exist

### Why It Doesn't Disconnect
- **Not calling** `room.disconnect()` when minimizing
- **Not triggered** `onDisconnected` callback until user clicks end call
- **Room connection persists** on LiveKit server until explicitly disconnected

### State Management
- **ActiveCallContext** stores:
  - `roomId` - Room identifier
  - `token` - JWT token for auth (stored for future restoration)
  - `serverUrl` - LiveKit server URL
  - `isMinimized` - Boolean flag indicating minimized state

- **Set when**:
  - Back button pressed
  - Minimize button clicked
  - After these, only cleared when user clicks "End Call"

## Testing Checklist

- [ ] Start a video call at `/call/roomId123`
- [ ] Click browser back button
  - [ ] Call minimizes and user goes back to previous page
  - [ ] Check console for "📞 Back button pressed" log
  - [ ] Audio/video still streaming (you can hear yourself or see on another client)
- [ ] Click minimize button (↓)
  - [ ] Same behavior as back button
  - [ ] Check console for "📞 Minimize button clicked" log
- [ ] With call minimized, navigate to other pages
  - [ ] Call remains active (peers still see you)
  - [ ] Can navigate back to `/call/roomId123` to restore full screen
- [ ] Click end call button (red)
  - [ ] Immediate disconnect
  - [ ] Redirects to `/`
  - [ ] Check console for "📞 Call disconnected by server/user" log
  - [ ] Other participants see you leave

## Edge Cases Handled

1. **No previous page** - Browser default back behavior (may go to browser home)
2. **Room object missing** - Safely checks for `room` before storing state
3. **Multiple back button presses** - Each creates new history entry, works correctly
4. **Navigating between pages while minimized** - Call context persists
5. **Tab closed while minimized** - Browser cleans up LiveKit connection server-side

## Browser Compatibility

- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)  
- ✅ Safari (full support)
- ✅ Mobile browsers (back button = browser back, not Android back)

**Note**: On mobile, system back button (Android) triggers `popstate`, so the feature works consistently.

## Future Enhancements

Potential improvements (not implemented yet):
1. **Minimize to corner** - Show small video window while browsing
2. **Call indicator badge** - Show "1 call active" in navigation header
3. **Quick restore** - Button to jump back to call from other pages
4. **Call audio notification** - Alert when someone starts talking while minimized
5. **Screen share continuation** - Allow sharing while showing other pages

## Troubleshooting

### Back button not working
- Check browser console for errors
- Verify `ActiveCallProvider` is wrapping the app in `App.tsx`
- Ensure `useActiveCall()` is imported in VideoCall.tsx

### Call disconnects when back button pressed
- Verify `room.disconnect()` is NOT called in `handlePopState`
- Check that `onDisconnected` handler only fires on actual disconnect
- LiveKit may have connection timeout - should be 15-30 seconds

### Minimize button not appearing
- Check CallControls props include `onMinimize` handler
- Verify ChevronDown icon is imported from lucide-react
- Button only shows if `onMinimize` prop is truthy

### Context error "must be used within ActiveCallProvider"
- Verify `<ActiveCallProvider>` wraps the entire app in App.tsx
- Before AuthProvider is OK, but must be inside it
- Can't use hook outside Router context

## Code Example: Using in Other Components

```javascript
import { useActiveCall } from '../context/ActiveCallContext';

export function SomeComponent() {
  const { activeCall, restoreCall } = useActiveCall();

  if (activeCall?.isMinimized) {
    return (
      <div>
        Call is minimized in room {activeCall.roomId}
        <button onClick={restoreCall}>Restore Call</button>
      </div>
    );
  }

  return <div>No active call</div>;
}
```

## Commit Hash
- **a4c198c** - Add back button navigation and minimize call feature
