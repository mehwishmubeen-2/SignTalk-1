# ⚡ Quick Fix Checklist - 403 WebSocket Error

## ✅ Step-by-Step Fix

### Step 1: Apply Backend Code Fix (DONE ✅)
- [x] Updated `backend/app/VideoCall/router_pytorch.py`
  - [x] Enhanced `get_current_user_websocket()` function
  - [x] Improved `websocket_sign_detect()` endpoint
  - Changes include better logging and error handling

**Time:** Already applied

---

### Step 2: Restart Backend (DO THIS NOW)

**In your backend terminal:**

```bash
# Stop the running backend (Ctrl+C)

# Make sure you're in the backend directory:
cd C:\Users\DELL\Downloads\SignTalk\SignTalk-master\backend

# Restart:
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Time:** 1-2 minutes

---

### Step 3: Verify Frontend Token (DO THIS NOW)

**In browser console (F12):**

```javascript
// Type this:
sessionStorage.getItem("supabase_token")

// Should return a long string starting with "eyJ"
// If null or undefined → LOG OUT AND LOG BACK IN
```

**Time:** 30 seconds

---

### Step 4: Test Sign Detection

**Steps:**
1. Open the app in browser
2. Make sure you're logged in
3. Join a video call with another participant (or use 2 browser tabs)
4. Open browser console (F12) → Console tab
5. Toggle "Sign Mode" button

**Expected in console:**
```
✅ All sign detection requirements met, starting...
🔌 WebSocket connecting to: ws://localhost:8000/meetings/ws/{roomId}/sign-detect
✅ WebSocket OPENED - Ready to send frames
📹 Capture started at 30 FPS
```

**Time:** 1-2 minutes

---

### Step 5: Check Backend Logs

**In backend terminal, you should see:**
```
🔌 WebSocket connection attempt to /ws/{room_id}/sign-detect
🔑 Token received: eyJ...{last10}
🔐 WebSocket auth: Attempting to validate token (length: 843)
✅ WebSocket auth SUCCESS for user: {user-id}
✅ User {user-id} authenticated - connecting to sign detection
   Starting frame capture and sign detection...
```

**If you see any `❌` error lines, see TROUBLESHOOTING section below**

**Time:** 1 minute

---

### Step 6: Perform a Sign and Verify

**Steps:**
1. Make a sign (e.g., "HELLO" pose)
2. Look for caption on screen
3. Listen for voice-over

**Expected:**
- Caption appears: "Hello"
- Voice says: "Hello"
- No errors in console

**Time:** 30 seconds

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Backend restarted successfully
- [ ] No error messages in backend terminal
- [ ] Frontend shows "✅ WebSocket OPENED"
- [ ] Backend shows "✅ WebSocket auth SUCCESS"
- [ ] Frames are being sent (check: "Frame #..." messages)
- [ ] Predictions received (check: "PREDICTION RECEIVED" messages)
- [ ] Sign captions appear on screen
- [ ] Voice-over plays

---

## ❌ Quick Troubleshooting

### Issue: "connection rejected (403 Forbidden)"

**Quick fix:**
```bash
# Terminal:
cd backend
pip install --upgrade supabase

# Then restart:
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### Issue: No token in sessionStorage

**Quick fix:**
1. Log out (click logout button)
2. Wait 2 seconds
3. Log back in
4. Try Sign Mode again

---

### Issue: Backend shows "No user returned"

**Quick fix:**

Check `.env` file:
```bash
cd backend
cat .env | grep SUPABASE_KEY
```

Should show: `SUPABASE_KEY=eyJ...`

If it says `sb_secret_...` or something else → WRONG KEY

**Get correct key:**
1. Go to: https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy "anon" JWT (starts with `eyJ`)
5. Replace in `.env`
6. Restart backend

---

### Issue: "Connection refused"

**Quick fix:**
```bash
# Backend not running?
# Check:
curl http://localhost:8000

# If that fails, start backend:
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📱 Mobile/Different Network?

If testing from phone or different machine:

**Change this line in frontend:**
```javascript
// File: frontend/src/app/hooks/useSignDetectionWebSocket.ts
// Line: const WS_BASE = "ws://localhost:8000";

// Replace with:
const WS_BASE = "ws://YOUR_COMPUTER_IP:8000";
// Example: "ws://192.168.1.100:8000"
```

Get your IP:
```bash
# Mac/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig
# Look for IPv4 Address (e.g., 192.168.x.x)
```

---

## 🆘 Still Not Working?

1. **Check file was modified:**
   ```bash
   # Should show recent changes:
   ls -la backend/app/VideoCall/router_pytorch.py
   ```

2. **Verify backend is using updated code:**
   - Backend console should show: `🔐 WebSocket auth: Attempting to validate...`
   - If not, backend loaded old code
   - Solution: Stop backend → Delete `backend/__pycache__` → Restart

3. **Check all error messages:**
   - Read TROUBLESHOOTING_FLOWCHART.md for detailed error patterns

4. **Test in isolation:**
   - Paste test script from TROUBLESHOOTING_FLOWCHART.md
   - It will pinpoint the exact failure

---

## 📋 Summary

| Step | Status | Time |
|------|--------|------|
| Apply backend fix | ✅ Done | - |
| Restart backend | ⏳ Next | 2 min |
| Verify token | ⏳ Next | 30 sec |
| Test sign detection | ⏳ Next | 2 min |
| Check logs | ⏳ Next | 1 min |
| Verify functionality | ⏳ Next | 30 sec |
| **Total** | | **~6 min** |

---

## 🎯 Expected Final State

```
✅ Log in → ✅ Join video call → ✅ Toggle Sign Mode 
  → ✅ See "WebSocket OPENED" → ✅ Perform sign 
  → ✅ Caption appears → ✅ Voice-over plays → ✅ DONE!
```

**All features working?** ✨ **You're done!**

---

## 📞 Need Help?

**For detailed troubleshooting:**
- See: `TROUBLESHOOTING_FLOWCHART.md`

**For understanding the fix:**
- See: `WEBSOCKET_FIX_IMMEDIATE.md`

**For backend architecture:**
- See: `BACKEND_DOCUMENTATION.md`

---

Last Updated: 2024 | Fix Applied: backend/app/VideoCall/router_pytorch.py
