# 🔧 WebSocket Authentication Fix Guide

## 🚨 Problem

When clicking the "Sign Mode" toggle during a video call, you get:
```
QiOiJiMjJhNzQ0Ni05NWVjLTQ2NGMtOWE2MC1mZTNhODBjYjY4YWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ...
403 Forbidden
INFO: connection rejected (403 Forbidden)
INFO: connection closed
Rejecting: Auth failed
```

## 🔍 Root Cause Analysis

### Backend Issue (Router_pytorch.py)
The WebSocket endpoint expects the token in the **URL query parameter**:
```python
# Line: @router.websocket("/ws/{room_id}/sign-detect")
# Connects with: ws://localhost:8000/meetings/ws/{room_id}/sign-detect?token={jwt_token}
```

But the validation function `get_current_user_websocket()` has a critical issue:

```python
async def get_current_user_websocket(websocket: WebSocket, token: str):
    user_response = supabase.auth.get_user(token)  # ← This fails!
    if not user_response.user:
        logger.error(f"WebSocket auth: No user returned from token")
        await websocket.close(code=4001, reason="Invalid token")
        return None
```

**Problem:** The `supabase.auth.get_user(token)` call doesn't properly handle WebSocket connections when the token is invalid or expired.

### Frontend Issue (useSignDetectionWebSocket.ts)
The frontend correctly passes the token:
```typescript
const url = `${WS_BASE}/meetings/ws/${roomId}/sign-detect?token=${encodeURIComponent(authToken)}`;
```

But **`authToken` might be:**
1. ❌ Undefined or null
2. ❌ An expired Supabase JWT
3. ❌ From a different session
4. ❌ Missing from the component props

---

## ✅ Solution

### Step 1: Verify Backend Token Validation

Replace `backend/app/VideoCall/router_pytorch.py` with improved error handling:

```python
async def get_current_user_websocket(websocket: WebSocket, token: str):
    """Extract user from WebSocket token with improved error handling."""
    try:
        if not token or len(token) < 10:
            logger.error(f"WebSocket auth: Token invalid format (length: {len(token) if token else 0})")
            await websocket.close(code=4001, reason="Invalid token format")
            return None
            
        logger.debug(f"Attempting to validate token (length: {len(token)})")
        
        # Attempt to authenticate with Supabase
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            logger.error(f"WebSocket auth: No user returned from token - response: {user_response}")
            await websocket.close(code=4001, reason="Invalid token")
            return None
        
        logger.info(f"✅ WebSocket auth success for user: {user_response.user.id}")
        return user_response.user
        
    except AttributeError as e:
        logger.error(f"WebSocket auth: Supabase response error: {str(e)}")
        await websocket.close(code=4001, reason="Auth service error")
        return None
    except Exception as e:
        logger.error(f"WebSocket auth: Unexpected exception: {type(e).__name__}: {str(e)}")
        logger.error(f"Token was: {token[:50]}..." if token else "Token was: None")
        await websocket.close(code=4001, reason=f"Auth failed: {type(e).__name__}")
        return None
```

### Step 2: Verify Frontend Token Passing

Check that the component is receiving `authToken` properly in `frontend/src/app/components/ui/ParticipantVideoTile.tsx`:

```typescript
import { useSignDetectionWebSocket } from "../../hooks/useSignDetectionWebSocket";

export function ParticipantVideoTile({ ... }) {
  const [signModeEnabled, setSignModeEnabled] = useState(false);
  const room = useRoomContext();
  
  // ✅ CRITICAL: Get the current session token
  const getAuthToken = () => {
    // Method 1: From sessionStorage (if set during login)
    const storedToken = sessionStorage.getItem("supabase_token");
    if (storedToken) {
      console.log("✅ Using token from sessionStorage");
      return storedToken;
    }
    
    // Method 2: From localStorage (if set during login)
    const localToken = localStorage.getItem("supabase_token");
    if (localToken) {
      console.log("✅ Using token from localStorage");
      return localToken;
    }
    
    // Method 3: Try to get from Supabase session
    try {
      const session = JSON.parse(sessionStorage.getItem("sb-session") || "{}");
      if (session.access_token) {
        console.log("✅ Using token from Supabase session");
        return session.access_token;
      }
    } catch (e) {
      console.error("Error parsing session:", e);
    }
    
    console.error("❌ No valid auth token found!");
    return null;
  };

  const authToken = getAuthToken();
  const roomId = room?.name || "";

  useSignDetectionWebSocket(
    videoElRef.current,
    signModeEnabled,
    canvasRef,
    onCaptionUpdate,
    onStatus,
    onLetterPreview,
    roomId,
    authToken  // ← Pass the token here
  );
  
  return (
    <>
      {/* Toggle button */}
      <button onClick={() => {
        if (!authToken) {
          console.error("❌ Cannot enable sign mode: No auth token!");
          alert("Please log in again. Session expired.");
          return;
        }
        setSignModeEnabled(!signModeEnabled);
      }}>
        Sign Mode
      </button>
    </>
  );
}
```

### Step 3: Store Token During Login

In your authentication login page (e.g., `frontend/src/auth/Login.tsx`):

```typescript
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export function LoginPage() {
  const supabase = useSupabaseClient();
  
  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error("Login failed:", error);
      return;
    }
    
    // ✅ IMPORTANT: Store the token
    if (data.session?.access_token) {
      sessionStorage.setItem("supabase_token", data.session.access_token);
      console.log("✅ Token saved to sessionStorage");
    }
    
    // Redirect to video call
    navigate("/video-call");
  };
  
  return (/* login form */);
}
```

### Step 4: Debug Logger

Add this to `frontend/src/app/hooks/useSignDetectionWebSocket.ts` at the top of the `useEffect`:

```typescript
useEffect(() => {
  if (!enabled || !videoEl || !roomId || !authToken) {
    console.warn("⚠️ Sign detection requirements not met:", {
      enabled,
      videoElExists: !!videoEl,
      roomId: roomId ? "✅" : "❌",
      authToken: authToken ? `✅ (${authToken.length} chars)` : "❌ MISSING",
    });
    emitStatus("ready");
    return;
  }

  console.log("✅ All sign detection requirements met, starting...");
  // ... rest of code
}, [enabled, videoEl, roomId, authToken]);
```

---

## 🧪 Testing Checklist

- [ ] **Before**: Clear browser storage
  ```javascript
  sessionStorage.clear();
  localStorage.clear();
  ```

- [ ] **Step 1**: Log in to application
  
- [ ] **Step 2**: Open browser Developer Console (F12)
  
- [ ] **Step 3**: Check Storage → Session Storage
  - Verify `supabase_token` is present
  - Token should start with `eyJ` (JWT format)
  
- [ ] **Step 4**: Join a video call with another participant
  
- [ ] **Step 5**: Click "Sign Mode" toggle
  - ✅ Should see in console:
    ```
    ✅ All sign detection requirements met, starting...
    🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/{roomId}/sign-detect
    ✅ WebSocket OPENED - Ready to send frames
    📹 Capture started at 30 FPS
    ```
  
- [ ] **Step 6**: Perform a sign
  - Should see:
    ```
    📤 Frame #30: sent 25000 bytes, buffered: 0
    📥 PREDICTION RECEIVED: {type: "prediction", sign: "hello", ...}
    🚀 Broadcasting sign: Hello
    ```

---

## 🔍 Troubleshooting

### Issue: "No valid auth token found!"

**Solution:** Ensure token is being stored during login:
```javascript
// In console, type:
sessionStorage.getItem("supabase_token")

// Should return: "eyJ..." (JWT token)
// If null/undefined, log in again
```

### Issue: "connection rejected (403 Forbidden)"

**Solution:** Backend auth is failing. Check:
```bash
# In backend terminal, grep for "WebSocket auth":
# Should see: "✅ WebSocket auth success for user: ..."
# If not, check backend logs for specific error

# Common causes:
# 1. Token is expired (get new one by re-logging in)
# 2. Token is malformed (clear storage, re-login)
# 3. Supabase credentials in .env are wrong
```

### Issue: "Connection closes immediately after opening"

**Solution:** Backend is closing the connection. Enable debug logging:

In `backend/main.py`:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Then check logs for:
```
WebSocket auth: ...
Rejecting: ...
```

---

## 📋 Quick Reference: Complete Flow

```
1. User logs in → Token stored in sessionStorage
2. User opens video call page
3. User clicks "Sign Mode" toggle
4. Frontend sends WebSocket request with ?token=...
5. Backend validates token with Supabase
6. ✅ Connection established
7. Frontend captures frames at 30 FPS
8. Backend processes with SignNet ML model
9. Predictions sent back via WebSocket
10. UI displays sign captions
```

---

## 🆘 Still Not Working?

Create a test script in browser console:

```javascript
// Test 1: Check token
const token = sessionStorage.getItem("supabase_token");
console.log("Token exists:", !!token);
console.log("Token length:", token?.length);
console.log("Token format:", token?.substring(0, 20) + "...");

// Test 2: Check room ID
const roomId = document.querySelector('[data-room-id]')?.textContent;
console.log("Room ID:", roomId);

// Test 3: Try to connect
const wsUrl = `ws://localhost:8000/meetings/ws/${roomId}/sign-detect?token=${encodeURIComponent(token)}`;
console.log("WebSocket URL:", wsUrl);

const testWs = new WebSocket(wsUrl);
testWs.onopen = () => console.log("✅ WebSocket opened!");
testWs.onerror = (e) => console.error("❌ WebSocket error:", e);
testWs.onmessage = (e) => console.log("📩 Message:", e.data);
testWs.onclose = () => console.log("❌ WebSocket closed");

// After 5 seconds
setTimeout(() => testWs.close(), 5000);
```

This will show you exactly where the connection is failing.

---

## 📞 Need More Help?

Check the backend logs:
```bash
# Terminal where backend is running
# Look for lines starting with "WebSocket auth" or "Rejecting"
# These will show the exact validation error
```

Check the frontend logs (F12 Console):
```
🔌 WebSocket connecting to: ...
✅ WebSocket OPENED
❌ WebSocket ERROR / CLOSED
```

Both together will pinpoint the exact issue!
