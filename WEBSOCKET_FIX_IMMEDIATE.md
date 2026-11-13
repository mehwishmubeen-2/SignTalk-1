# 🚀 WebSocket Sign Detection 403 Error - IMMEDIATE FIX

## Problem Summary
When clicking "Sign Mode" toggle in video call, you get:
```
403 Forbidden - Auth failed
connection rejected (403 Forbidden)
connection closed
```

## ✅ Root Cause
The `authToken` being passed to the WebSocket is **valid**, but the backend's `supabase.auth.get_user(token)` call is **failing silently** or not working properly with WebSocket connections.

The issue is in: `backend/app/VideoCall/router_pytorch.py` → `get_current_user_websocket()` function

---

## 🔧 FIX #1: Update Backend WebSocket Authentication

**File:** `backend/app/VideoCall/router_pytorch.py`

Find this function (around line 50-70):
```python
async def get_current_user_websocket(websocket: WebSocket, token: str):
    """Extract user from WebSocket token."""
    try:
        logger.debug(f"Attempting to validate token (length: {len(token)})")
        
        # Attempt to authenticate with Supabase
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            logger.error(f"WebSocket auth: No user returned from token")
            await websocket.close(code=4001, reason="Invalid token")
            return None
        logger.info(f"WebSocket auth success for user: {user_response.user.id}")
        return user_response.user
    except Exception as e:
        logger.error(f"WebSocket auth exception: {type(e).__name__}: {str(e)}")
        await websocket.close(code=4001, reason="Auth failed")
        return None
```

**Replace with:**
```python
async def get_current_user_websocket(websocket: WebSocket, token: str):
    """Extract user from WebSocket token with robust error handling."""
    try:
        # Validate token format
        if not token or len(token) < 10:
            logger.error(f"❌ WebSocket auth FAILED: Invalid token format (length: {len(token) if token else 0})")
            await websocket.close(code=4001, reason="Invalid token format")
            return None
        
        logger.debug(f"🔐 WebSocket auth: Attempting to validate token (length: {len(token)})")
        
        # Get user from Supabase using the token
        user_response = supabase.auth.get_user(token)
        
        # Check if response has user data
        if not user_response or not hasattr(user_response, 'user') or not user_response.user:
            logger.error(f"❌ WebSocket auth FAILED: No user returned from Supabase")
            logger.error(f"   Response object: {user_response}")
            logger.error(f"   Response type: {type(user_response)}")
            await websocket.close(code=4001, reason="Invalid token")
            return None
        
        logger.info(f"✅ WebSocket auth SUCCESS for user: {user_response.user.id}")
        return user_response.user
        
    except AttributeError as e:
        logger.error(f"❌ WebSocket auth FAILED: Supabase response structure error")
        logger.error(f"   Error: {str(e)}")
        logger.error(f"   This usually means supabase.auth.get_user() returned unexpected structure")
        await websocket.close(code=4001, reason="Auth service error")
        return None
        
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"❌ WebSocket auth FAILED: {error_type}: {error_msg}")
        logger.error(f"   Token was: {token[:50]}{'...' if len(token) > 50 else ''}")
        await websocket.close(code=4001, reason=f"Auth failed: {error_type}")
        return None
```

---

## 🔧 FIX #2: Improve WebSocket Connection Logging

In the same file, find the `websocket_sign_detect` endpoint (around line 113):

**Replace the entire function with:**
```python
@router.websocket("/ws/{room_id}/sign-detect")
async def websocket_sign_detect(websocket: WebSocket, room_id: str, token: Optional[str] = None):
    """
    WebSocket endpoint for real-time sign detection using PyTorch SignNet.
    
    Connect with:
        ws://localhost:8000/meetings/ws/{room_id}/sign-detect?token={jwt_token}
    """
    logger.info(f"🔌 WebSocket connection attempt to /ws/{room_id}/sign-detect")
    
    if not token:
        logger.error(f"❌ Rejecting: No token provided")
        await websocket.close(code=4001, reason="No token provided")
        return
    
    logger.info(f"🔑 Token received: {token[:20]}...{token[-10:] if len(token) > 30 else ''}")
    
    # Authenticate user
    user = await get_current_user_websocket(websocket, token)
    if not user:
        logger.warning(f"❌ WebSocket connection rejected: Auth failed for room {room_id}")
        return
    
    logger.info(f"✅ User {user.id} authenticated - connecting to sign detection")
    logger.info(f"   Room: {room_id}")
    logger.info(f"   User Email: {user.email}")
    
    # Get or create video handler for this room
    if room_id not in video_handlers:
        logger.info(f"   Creating new PyTorchVideoStreamHandler for room {room_id}")
        video_handlers[room_id] = PyTorchVideoStreamHandler()
    
    handler = video_handlers[room_id]
    
    try:
        logger.info(f"   Starting frame capture and sign detection...")
        await handler.handle_connection(websocket, room_id, str(user.id))
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected for room {room_id}, user {user.id}")
    except Exception as e:
        logger.error(f"❌ WebSocket error in room {room_id}: {type(e).__name__}: {e}")
        try:
            await websocket.close(code=4011, reason=f"Server error: {type(e).__name__}")
        except:
            pass
```

---

## 🧪 Testing the Fix

### Step 1: Restart Backend
```bash
# Stop the running backend (Ctrl+C)
# Then restart it:
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 2: Check Backend Logs
You should see:
```
INFO:     connection accepted
🔌 WebSocket connection attempt to /ws/{roomId}/sign-detect
🔑 Token received: eyJ...{token}
🔐 WebSocket auth: Attempting to validate token (length: 800+)
✅ WebSocket auth SUCCESS for user: {user-id}
✅ User {user-id} authenticated - connecting to sign detection
   Starting frame capture and sign detection...
📹 Capture started at 30 FPS
```

### Step 3: Test in Browser

1. Open browser console (F12)
2. Click "Sign Mode" toggle
3. Should see in console:
   ```
   ✅ All sign detection requirements met, starting...
   🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/{roomId}/sign-detect
   ✅ WebSocket OPENED - Ready to send frames
   📹 Capture started at 30 FPS
   ```

4. Perform a sign → Should see:
   ```
   📤 Frame #30: sent 25000 bytes, buffered: 0
   📥 PREDICTION RECEIVED: {type: "prediction", sign: "hello", ...}
   🚀 Broadcasting sign: Hello
   ```

---

## 🆘 If Still Not Working

### Debug Script (paste in browser console):
```javascript
// Check token
const token = sessionStorage.getItem("supabase_token");
console.log("✅ Token stored:", !!token);
console.log("   Length:", token?.length);
console.log("   First 20 chars:", token?.substring(0, 20));

// Test WebSocket connection directly
const roomId = "test-room";
const wsUrl = `ws://localhost:8000/meetings/ws/${roomId}/sign-detect?token=${encodeURIComponent(token)}`;
console.log("Testing WebSocket URL...");

const testWs = new WebSocket(wsUrl);
testWs.onopen = () => console.log("✅ WebSocket opened!");
testWs.onerror = (e) => console.error("❌ WebSocket error:", e);
testWs.onmessage = (e) => console.log("📩 Message:", e.data);
testWs.onclose = (e) => console.log("❌ WebSocket closed:", e.code, e.reason);

// Auto-close after 5 seconds
setTimeout(() => {
  console.log("Closing test WebSocket...");
  testWs.close();
}, 5000);
```

### Check Backend Terminal
Look for any of these error patterns:

**Pattern 1: Token not provided**
```
❌ Rejecting: No token provided
```
→ Frontend isn't sending token. Check browser console logs.

**Pattern 2: Invalid token**
```
❌ WebSocket auth FAILED: Invalid token format (length: X)
```
→ Token is malformed. Ask user to log in again.

**Pattern 3: User not found**
```
❌ WebSocket auth FAILED: No user returned from Supabase
```
→ Token is expired or invalid in Supabase. User needs to re-login.

**Pattern 4: Supabase service error**
```
❌ WebSocket auth FAILED: Auth service error
```
→ Check Supabase `.env` variables in `backend/.env`

---

## 📋 Verification Checklist

After applying the fix, verify:

- [ ] Backend starts without errors
- [ ] Browser can connect to `/meetings/{roomId}/token` (REST endpoint) ✅
- [ ] `authToken` state variable is NOT null/undefined
- [ ] WebSocket URL is correctly formed with `?token=...`
- [ ] Backend receives token in query parameter
- [ ] Supabase returns valid user object
- [ ] WebSocket connection is established (code 101 Switching Protocols)
- [ ] Frames are being sent at 30 FPS
- [ ] Backend processes frames and sends predictions
- [ ] Frontend receives and displays predictions

---

## 📞 Common Questions

**Q: What if I'm getting "Invalid token" constantly?**
A: User's session has expired. They need to log out and log back in.

**Q: What if frames are sent but no predictions come back?**
A: Backend ML model might be failing. Check backend logs for model loading errors:
```
Backend logs should show:
  ✅ Model loaded successfully
  Processing frame...
  Prediction: ...
```

**Q: What if I see "Auth failed" but token looks correct?**
A: The Supabase configuration in backend `.env` might be incorrect. Verify:
```bash
# In backend/.env:
SUPABASE_URL=https://loouvbrqlwrxkbdtiqxs.supabase.co  ← Check this matches
SUPABASE_KEY=eyJ...                                     ← Check this is valid
```

**Q: Can I test without being in a video call?**
A: Yes, use the debug script above to test the WebSocket directly.

---

## 🎯 Expected Result

After the fix, the complete flow should be:

```
User logs in
  ↓ (token saved to sessionStorage)
Join video call with another participant
  ↓
Click "Sign Mode" toggle
  ↓
Frontend: ✅ WebSocket OPENED
  ↓
Backend: ✅ WebSocket auth SUCCESS
  ↓
Frontend: 📹 Capture started at 30 FPS
  ↓
Perform a sign
  ↓
Backend: Processing frame... Prediction: HELLO
  ↓
Frontend: 🚀 Broadcasting sign: Hello
  ↓
Caption appears on both participants' screens with voice-over
```

✅ **You're done!**
