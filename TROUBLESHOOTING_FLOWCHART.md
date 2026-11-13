# 🔍 WebSocket 403 Error - Troubleshooting Flowchart

## Issue: "connection rejected (403 Forbidden)" when clicking Sign Mode

```
                    START: Click "Sign Mode" toggle
                              ↓
                    ┌─────────────────────┐
                    │ Do you see any      │
                    │ error in browser    │
                    │ console? (F12)      │
                    └────────┬────────────┘
                             ├─→ YES (see error) → Go to: FRONTEND ERRORS below
                             └─→ NO             → Go to: CHECK BACKEND LOGS below
```

---

## CHECK 1: Browser Console Errors

### Error A: "❌ Cannot enable sign mode: No auth token!"

**Cause:** Frontend doesn't have access to authToken

**Fix:**
1. Make sure you're logged in
2. Open DevTools → Application → Session Storage
3. Look for `supabase_token` key
4. If NOT found → Log out and log back in
5. If found → Check if it's a valid JWT (starts with `eyJ`)

**Verify:**
```javascript
// Type in browser console:
sessionStorage.getItem("supabase_token")

// Should show: "eyJ..." (a long string)
// If null/undefined → LOG IN AGAIN
```

### Error B: "⚠️ WebSocket buffered amount exceeded"

**Cause:** Network is too slow, frames buffering up

**Fix:** This is normal, the system will skip frames automatically
- Keep using it, it will adapt
- If persistent, reduce network load (close other apps)
- Or reduce FRAME_RATE in frontend code (currently 30 FPS)

### Error C: "❌ WebSocket ERROR" or "❌ WebSocket CLOSED"

**Cause:** Backend rejected the connection or crashed

**Fix:** Check backend logs (see: CHECK BACKEND LOGS below)

---

## CHECK 2: Backend Logs

### Looking for Success Pattern

```
🔌 WebSocket connection attempt to /ws/{room_id}/sign-detect
🔑 Token received: eyJ...{last10}
🔐 WebSocket auth: Attempting to validate token (length: 800+)
✅ WebSocket auth SUCCESS for user: {user-uuid}
✅ User {user-uuid} authenticated - connecting to sign detection
   Starting frame capture and sign detection...
```

**✅ If you see this → WORKING! Skip to "Test Predictions" below**

---

### Error Pattern 1: "❌ Invalid token format"

```
❌ WebSocket auth FAILED: Invalid token format (length: 15)
```

**Meaning:** Token is too short or malformed

**Causes:**
- User's session expired
- Token wasn't copied correctly
- Supabase issue

**Fix:**
```bash
# In backend terminal, look for:
❌ WebSocket auth FAILED: Invalid token format (length: X)
   # X < 50 means real problem

# Solution:
# 1. Frontend: Log out → Log back in
# 2. Backend: Check SUPABASE_URL and SUPABASE_KEY in .env
# 3. Restart backend with new .env values
```

---

### Error Pattern 2: "❌ No user returned from Supabase"

```
❌ WebSocket auth FAILED: No user returned from Supabase
   Response object: <SupabaseResponse object>
   Response type: <class 'SupabaseResponse'>
```

**Meaning:** Supabase rejected the token

**Causes:**
- Token expired
- User deleted from Supabase
- Supabase credentials in `.env` are wrong

**Fix:**
```bash
# Check .env file:
cd backend
cat .env | grep SUPABASE

# Should show:
# SUPABASE_URL=https://loouvbrqlwrxkbdtiqxs.supabase.co
# SUPABASE_KEY=eyJ...{valid JWT}

# If SUPABASE_KEY looks wrong (too short, or "sb_secret_..."):
# 1. Go to: https://app.supabase.com
# 2. Select your project
# 3. Settings → API
# 4. Copy the "anon" JWT (starts with eyJ)
# 5. Replace SUPABASE_KEY in .env
# 6. Restart backend
```

---

### Error Pattern 3: "❌ Auth service error" or "Supabase response structure error"

```
❌ WebSocket auth FAILED: Auth service error
   Error: 'SupabaseResponse' object has no attribute 'user'
```

**Meaning:** Supabase library returned unexpected response structure

**Causes:**
- Supabase Python library version mismatch
- Breaking change in Supabase API

**Fix:**
```bash
# Reinstall supabase library:
cd backend
pip install --upgrade supabase

# Restart backend:
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### Error Pattern 4: "❌ Auth failed: JSONDecodeError" or "Connection refused"

```
❌ WebSocket auth FAILED: ConnectionError: Connection refused
```

**Meaning:** Backend can't reach Supabase servers

**Causes:**
- Internet connection down
- Firewall blocking Supabase
- Wrong SUPABASE_URL

**Fix:**
```bash
# Test internet connection:
ping 8.8.8.8

# Test Supabase URL:
curl https://loouvbrqlwrxkbdtiqxs.supabase.co

# Should return HTML (Supabase login page)
# If timeout/error → Check firewall or VPN
```

---

## CHECK 3: Token Validation Flow

### Manual Token Test

```bash
# Step 1: Get your token from browser console:
sessionStorage.getItem("supabase_token")
# Copy the long string

# Step 2: Create test script in browser console:
const token = "eyJ...{paste your token here}";
const ws = new WebSocket(`ws://localhost:8000/meetings/ws/test-room/sign-detect?token=${encodeURIComponent(token)}`);

ws.onopen = () => console.log("✅ SUCCESS: WebSocket opened!");
ws.onerror = (e) => console.error("❌ FAILED:", e);
ws.onclose = (e) => console.log("Closed with code:", e.code, "reason:", e.reason);

// Should see "✅ SUCCESS" within 1-2 seconds
```

### Read Backend Response Codes

| Code | Reason | Meaning |
|------|--------|---------|
| 4001 | Invalid token format | Token too short or malformed |
| 4001 | Invalid token | Token rejected by Supabase |
| 4001 | Auth service error | Supabase library error |
| 4001 | No token provided | Frontend didn't send token |
| 101 | (switching protocols) | ✅ SUCCESS - connection accepted |

---

## CHECK 4: Complete Connection Test

### Test Sequence

```javascript
// ============ STEP 1: Verify Prerequisites =============
console.log("1. Checking prerequisites...");

// Check 1: Token exists
const token = sessionStorage.getItem("supabase_token");
if (!token) {
  console.error("❌ FAIL: No token in sessionStorage. Need to log in.");
  throw new Error("Missing token");
}
console.log("✅ PASS: Token found (length: " + token.length + ")");

// Check 2: Token format
if (!token.startsWith("eyJ")) {
  console.error("❌ FAIL: Token doesn't look like JWT (should start with eyJ)");
  throw new Error("Invalid token format");
}
console.log("✅ PASS: Token format looks correct");

// ============ STEP 2: Attempt WebSocket Connection =============
console.log("\n2. Attempting WebSocket connection...");

const roomId = "test-conn-" + Date.now();
const url = `ws://localhost:8000/meetings/ws/${roomId}/sign-detect?token=${encodeURIComponent(token)}`;

console.log("   URL: " + url.substring(0, 80) + "...");

let connectionSuccess = false;
const ws = new WebSocket(url);

ws.onopen = () => {
  connectionSuccess = true;
  console.log("✅ PASS: WebSocket connection established!");
  console.log("   - Connection state: OPEN");
  console.log("   - Ready state: " + ws.readyState + " (1=OPEN)");
  
  // Send a test frame
  setTimeout(() => {
    console.log("\n3. Sending test frame...");
    const testFrame = { type: "frame", data: "test" };
    ws.send(JSON.stringify(testFrame));
    console.log("✅ PASS: Test frame sent");
    
    setTimeout(() => ws.close(), 1000);
  }, 500);
};

ws.onerror = (event) => {
  console.error("❌ FAIL: WebSocket error event", event);
};

ws.onmessage = (event) => {
  console.log("✅ PASS: Received message from backend:", event.data);
};

ws.onclose = (event) => {
  if (connectionSuccess) {
    console.log("\n4. Connection closed gracefully");
    console.log("✅ SUCCESS: Everything is working!");
  } else {
    console.error("\n❌ FAIL: Connection rejected");
    console.error("   Close code: " + event.code);
    console.error("   Reason: " + event.reason);
    console.error("\n   This means:");
    console.error("   - Check backend logs for 'WebSocket auth FAILED'");
    console.error("   - The reason above will tell you why");
  }
};

// Timeout
setTimeout(() => {
  if (ws.readyState === 0) {
    console.error("❌ FAIL: Connection timeout (still in CONNECTING state)");
    console.error("   Check: Is backend running on localhost:8000?");
  }
}, 5000);
```

---

## Detailed Error Reference

### Connection Refused
```
ERROR: WebSocket is closed with status code 1006
          or similar connection error
```
**Causes:**
- Backend not running
- Backend running on wrong port
- Firewall blocking localhost:8000
- Backend crashed

**Fix:**
```bash
# Check backend is running:
ps aux | grep uvicorn

# If not running, start it:
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Check it's listening:
curl http://localhost:8000/docs  # Should show Swagger UI
```

### 403 Forbidden
```
connection rejected (403 Forbidden)
```
**Causes:**
- Token invalid/expired
- Supabase credentials wrong
- User not in database

**Fix:**
- See: "Error Pattern 1-4" above in "CHECK 2: Backend Logs"

### 400 Bad Request
```
Bad request
```
**Causes:**
- Token not in URL query parameter
- URL malformed

**Fix:**
- Check URL format: `ws://localhost:8000/meetings/ws/{roomId}/sign-detect?token={token}`
- Token must be URL-encoded

### Silent Connection Failure
```
(no error shown, but frames not being processed)
```
**Causes:**
- WebSocket connected but video handler failed
- Backend processing error

**Fix:**
```bash
# Check backend logs for:
# "PyTorchVideoStreamHandler" or "Error processing frame"

# Check ML models are present:
ls backend/app/SignRecognition/best_*.pt
# Should list 5 model files

# Check GPU/CUDA:
python -c "import torch; print(torch.cuda.is_available())"
# If False, make sure PyTorch GPU version installed (if CUDA available)
```

---

## Quick Reference Table

| Symptom | Likely Cause | First Check |
|---------|-------------|-------------|
| "Invalid token format" | Token too short | `sessionStorage.getItem("supabase_token").length > 100?` |
| "No user returned" | Token expired | Log out, log back in |
| "Auth service error" | Library version | `pip install --upgrade supabase` |
| "Connection refused" | Backend down | `curl http://localhost:8000` |
| Frames sent, no predictions | ML model error | Check `backend/app/SignRecognition/` files exist |
| WebSocket opens then closes | Backend crash | Check backend terminal for exceptions |
| Works sometimes, fails others | Race condition | Restart backend |

---

## ✅ Success Indicators

### In Browser Console (F12)
```
✅ All sign detection requirements met, starting...
🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/{roomId}/sign-detect
✅ WebSocket OPENED - Ready to send frames
📹 Capture started at 30 FPS
📤 Frame #30: sent 25000 bytes, buffered: 0
📥 PREDICTION RECEIVED: {type: "prediction", sign: "hello", ...}
🚀 Broadcasting sign: Hello
```

### In Backend Terminal
```
🔌 WebSocket connection attempt to /ws/{room_id}/sign-detect
✅ WebSocket auth SUCCESS for user: {user-id}
   Starting frame capture and sign detection...
Processing frame...
Prediction: hello (confidence: 0.95)
```

### Expected Result
- Caption appears on both participants' screens
- Voice-over plays saying the sign name
- No errors in either console

**🎉 You're ready to use sign detection!**
