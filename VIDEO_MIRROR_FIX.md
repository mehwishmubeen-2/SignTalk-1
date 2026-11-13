# 🎥 Fix Mirrored Video Issue

## Problem
Your video feed appears mirrored (like looking in a mirror) instead of normal like Google Meet.

## Solution

The mirroring is likely coming from LiveKit's VideoTrack component, which mirrors local video by default (this is common in video conferencing for user comfort while recording/streaming, but appears normal to others).

### Fix: Update ParticipantVideoTile.tsx

**File:** `frontend/src/app/components/ui/ParticipantVideoTile.tsx`

Add `mirror={false}` to the VideoTrack component:

**Find this:**
```tsx
{trackRef.publication ? (
  <VideoTrack trackRef={trackRef} style={styles.video} />
) : (
  <div style={styles.avatarWrapper}>
    <div style={styles.avatarCircle}>{initials}</div>
  </div>
)}
```

**Replace with:**
```tsx
{trackRef.publication ? (
  <VideoTrack trackRef={trackRef} style={styles.video} mirror={false} />
) : (
  <div style={styles.avatarWrapper}>
    <div style={styles.avatarCircle}>{initials}</div>
  </div>
)}
```

### Alternative: Mirror Only for Local, Not for Remote

If you prefer the mirrored view ONLY for yourself (so you can see yourself as if looking in a mirror) but normal for others:

```tsx
{trackRef.publication ? (
  <VideoTrack 
    trackRef={trackRef} 
    style={styles.video} 
    mirror={!isLocal}  {/* Mirror only if it's NOT the local participant */}
  />
) : (
  <div style={styles.avatarWrapper}>
    <div style={styles.avatarCircle}>{initials}</div>
  </div>
)}
```

---

## Why This Happens

1. **Local video mirrors by default** - This is a UX convention so YOU see yourself as in a mirror while others see you normally
2. **LiveKit applies it automatically** - The `VideoTrack` component from LiveKit has `mirror={true}` as default for local participants
3. **Google Meet does the same** - Google Meet also mirrors local video, but you said you want it like Google Meet - actually Google Meet DOES mirror local video by default too!

---

## Which Option to Choose?

### Option 1: No Mirror at All (Fully Normal)
```tsx
mirror={false}
```
- Everyone sees you normally (not mirrored)
- You also see yourself normally
- **Use if:** You want everyone to see the same thing

### Option 2: Mirror for Local Only (Recommended - Like Google Meet)
```tsx
mirror={!isLocal}
```
- You see yourself mirrored (like looking in a mirror)
- Others see you normally
- **Use if:** You want the comfort of seeing yourself mirrored while everyone else sees you normally (this is actually what Google Meet does!)

---

## Implementation

### Step 1: Open the file
```
frontend/src/app/components/ui/ParticipantVideoTile.tsx
```

### Step 2: Find line ~97
```tsx
<VideoTrack trackRef={trackRef} style={styles.video} />
```

### Step 3: Add mirror prop
```tsx
<VideoTrack 
  trackRef={trackRef} 
  style={styles.video} 
  mirror={!isLocal}  {/* Recommended: mirror only for local */}
/>
```

### Step 4: Save and test
- Refresh browser
- Join video call
- You should see yourself normally (or mirrored, depending on option chosen)
- Others should see you normally

---

## Testing

**Check if working:**
1. Join a video call with another person (or use 2 browser tabs)
2. Look at your own video tile - is it mirrored or normal?
3. Look at the other person's video tile - should be normal
4. Record yourself or have someone confirm: "Do I look mirrored to you?"

---

## Types Verification

If you get TypeScript error "Property 'mirror' does not exist":

This means the LiveKit types might not include the mirror prop. Check your LiveKit version:

```bash
cd frontend
npm list @livekit/components-react

# Should be a recent version (1.4+)
# If older, update:
npm install --save @livekit/components-react@latest
```

Then rebuild:
```bash
npm run dev
```

---

## Still Mirrored?

If video is STILL mirrored after this fix, the mirror might be coming from somewhere else:

### Check 1: Canvas rendering (Sign Detection)
The canvas overlay might have `scaleX(-1)` applied. If so, update:

In `frontend/src/app/hooks/useSignDetectionWebSocket.ts` line ~344:

From:
```typescript
if (MIRROR_FRAMES) {
  ctx.save();
  ctx.translate(SEND_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(...);
  ctx.restore();
}
```

This should only apply if `MIRROR_FRAMES = true`, which it isn't by default. So this shouldn't be the issue.

### Check 2: Global CSS
Search your CSS files for `scaleX(-1)` or `transform: scaleX`:
```bash
cd frontend
grep -r "scaleX" src/
```

If found, remove it.

### Check 3: Inspect Element
1. Open browser DevTools (F12)
2. Right-click on video → Inspect
3. Look for `transform: scaleX(-1)` in styles
4. Check computed styles for any transforms

---

## Expected Result

**Before:**
- Local video appears mirrored/horizontally flipped
- Text appears backwards

**After (Option 1 - No Mirror):**
- Local video appears normal (not mirrored)
- Text appears correct direction

**After (Option 2 - Recommended):**
- You see yourself mirrored (like a mirror)
- Others see you normal direction
- Text appears correct direction to everyone else

---

## Quick Reference

| Setting | You See | Others See | Best For |
|---------|---------|-----------|----------|
| `mirror={true}` | Mirrored | Mirrored | Old default (not recommended) |
| `mirror={false}` | Normal | Normal | Everyone sees same |
| `mirror={!isLocal}` | Mirrored | Normal | **Recommended (like Google Meet)** |

**Recommendation:** Use `mirror={!isLocal}` - it's what Google Meet does and provides the best UX.

---

## Still Need Help?

If video is still mirrored:
1. Check if `mirror` prop is being applied correctly
2. Clear browser cache (Ctrl+Shift+Delete)
3. Do a hard refresh (Ctrl+Shift+R)
4. Restart frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```

Let me know if you need help applying this fix!
