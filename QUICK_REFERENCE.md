# 🚀 Quick Reference Guide

## 📋 3-Minute Setup

### When pip install finishes:

```bash
# 1. Open terminal in project root
cd backend

# 2. Start backend
python main.py

# 3. In another terminal, test it
curl http://localhost:8000/meetings/health

# Expected: {"status": "healthy", "models_found": 5, ...}
```

**DONE!** Backend is running.

---

## 🎨 Frontend: Copy-Paste Solution

### 1. Create the component file
```bash
# Create this file:
frontend/src/components/VideoCallWithSignDetection.tsx

# Copy the entire content from:
FRONTEND_COMPONENT_TEMPLATE.tsx
```

### 2. Use it in your video call page
```tsx
import VideoCallWithSignDetection from './VideoCallWithSignDetection';

export default function VideoCall() {
  return (
    <VideoCallWithSignDetection
      token={liveKitToken}      // Your LiveKit JWT
      url={liveKitUrl}          // LiveKit server URL
      roomId={roomId}           // Meeting room ID
      authToken={jwtToken}      // Your JWT for backend auth
    />
  );
}
```

**DONE!** Sign detection is now active during calls.

---

## 🔍 How to Test

### Test 1: Backend health
```bash
curl http://localhost:8000/meetings/health
```

### Test 2: Create meeting (with JWT)
```bash
curl -X POST http://localhost:8000/meetings/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 3: WebSocket (with wscat)
```bash
npm install -g wscat

wscat -c "ws://localhost:8000/meetings/ws/test-room/sign-detect?token=YOUR_JWT_TOKEN"

# Send a frame:
{"type": "frame", "data": "base64_encoded_jpeg_here"}
```

---

## 🎯 What Gets Detected

```
✅ bye                    ✅ how_are_you
✅ hello                  ✅ i_am_fine
✅ i_dont_know            ✅ i_know
✅ nice_to_meet_you       ✅ no_sign
✅ see_you_later          ✅ what_is_your_name
✅ whats_up
```

---

## 📂 File Locations

| Component | Location |
|-----------|----------|
| Models | `backend/app/SignRecognition/best_*.pt` |
| Classes | `backend/app/SignRecognition/classes.txt` |
| Inference | `backend/app/services/pytorch_sign_recognizer.py` |
| WebSocket Handler | `backend/app/services/pytorch_video_handler.py` |
| API Router | `backend/app/VideoCall/router_pytorch.py` |
| React Template | `FRONTEND_COMPONENT_TEMPLATE.tsx` |

---

## ⚙️ Adjustable Settings

**Frame rate** (in React component):
```typescript
const captureAndSendFrame = () => {
  // Change 100 to your desired interval in ms
  // 100 = 10 FPS
  // 50 = 20 FPS
  // 200 = 5 FPS
};
```

**JPEG quality** (in React component):
```typescript
'image/jpeg',
0.8  // Change this: 0.5 (low quality, fast) to 1.0 (high quality, slow)
```

**Temporal window size** (in Python):
```python
sequence_length=32  # Number of frames to buffer
# 32 @ 10 FPS = 3.2 seconds
# 64 @ 10 FPS = 6.4 seconds
```

---

## 🆘 If Something Breaks

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.8+

# Check dependencies
pip list | grep fastapi

# If missing: reinstall
pip install -r requirements.txt
```

### WebSocket won't connect
```
1. Verify backend is running (python main.py)
2. Verify port 8000 is open
3. Verify JWT token is valid
4. Check browser console for error messages
```

### Models won't load
```bash
# Check files exist
ls backend/app/SignRecognition/best_*.pt

# Run verification
cd backend && python verify_setup.py
```

### No predictions
```
1. Make sure you're making hand gestures
2. Ensure good lighting
3. Wait 3.2 seconds (buffer fill time)
4. Check console for error messages
```

---

## 📊 Expected Output

### Successful backend startup:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
[startup] ✅ Video call router loaded
```

### Successful WebSocket connection:
```
✅ Sign detection WebSocket connected
📍 Detected: hello (87.5%)
📍 Detected: how_are_you (92.1%)
```

### Successful prediction:
```json
{
  "type": "prediction",
  "sign": "HELLO",
  "confidence": 0.875,
  "processing_time_ms": 45.2,
  "frame_number": 156,
  "prediction_number": 5,
  "hand_detected": true
}
```

---

## 🔐 Security Notes

- ✅ JWT authentication required for WebSocket
- ✅ Per-room connection isolation
- ✅ CORS protection enabled
- ✅ No sensitive data logged
- ✅ Models run locally (no cloud upload)

---

## 📱 Browser Compatibility

Works on:
- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires:
- ✅ WebSocket support
- ✅ WebCamera access
- ✅ Canvas API

---

## 🎬 Live Demo Flow

```
1. User opens video call page
   ↓
2. Component initializes WebSocket connection
   ↓
3. Browser requests camera permission
   ↓
4. User allows camera access
   ↓
5. Frames captured at 10 FPS
   ↓
6. After 32 frames (~3.2 seconds):
   ↓
7. Backend processes with 5 models
   ↓
8. Prediction returned: "HELLO - 87.5%"
   ↓
9. UI overlay displays result
   ↓
10. Buffer resets, repeat
```

---

## 💡 Pro Tips

1. **Best lighting**: Well-lit environment, face towards light source
2. **Best distance**: 1-2 meters from camera
3. **Clear gestures**: Make complete hand movements
4. **Patience**: Each prediction takes ~3.2 seconds (by design)
5. **GPU is optional**: CPU works fine, just slower

---

## 📞 Quick Contacts

- Documentation: See `00_START_HERE.md`
- Technical Details: See `PYTORCH_INTEGRATION.md`
- Setup Issues: See `IMPLEMENTATION_CHECKLIST.md`
- File Reference: See `PYTORCH_FILE_REFERENCE.md`

---

## ✅ Pre-Flight Checklist

Before launching:
- [ ] Backend dependencies installed
- [ ] Backend server running (`python main.py`)
- [ ] Health check passes (`curl /meetings/health`)
- [ ] React component created
- [ ] Component added to video call page
- [ ] Camera permissions configured
- [ ] JWT tokens configured
- [ ] Room ID generation working

**All set?** → Launch and test! 🚀

---

**Last Updated**: 2026-10-29
**Status**: ✅ Production Ready
