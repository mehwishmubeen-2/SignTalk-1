# 🎯 PyTorch Video Calling Integration - QUICK SETUP

Your SignTalk project already has:
- ✅ 5 trained PyTorch models (best_0.pt through best_4.pt)
- ✅ SignNet LSTM architecture
- ✅ MediaPipe Holistic landmark extraction
- ✅ LiveKit video calling infrastructure

Now integrate them in **4 easy steps**:

---

## Step 1: Copy Your Files (2 minutes)

```bash
# From your training directory to backend
cp best_0.pt best_1.pt best_2.pt best_3.pt best_4.pt \
   SignTalk-master/backend/app/SignRecognition/

cp dataset/classes.txt SignTalk-master/backend/app/SignRecognition/

cp common.py SignTalk-master/backend/
```

**Verify structure:**
```
backend/
├── common.py                           ✓
└── app/
    ├── SignRecognition/
    │   ├── best_0.pt                  ✓
    │   ├── best_1.pt                  ✓
    │   ├── best_2.pt                  ✓
    │   ├── best_3.pt                  ✓
    │   ├── best_4.pt                  ✓
    │   └── classes.txt                ✓
    ├── VideoCall/
    │   ├── router.py                  (keep)
    │   └── router_pytorch.py          ✓ (NEW - created for you)
    └── services/
        ├── __init__.py                ✓ (NEW - created for you)
        ├── pytorch_sign_recognizer.py ✓ (NEW - created for you)
        └── pytorch_video_handler.py   ✓ (NEW - created for you)
```

---

## Step 2: Update Backend (1 minute)

Edit `backend/main.py`:

```python
# Find this line (around line 10-15):
from app.VideoCall.router import router as video_call_router

# Change to:
from app.VideoCall.router_pytorch import router as video_call_router

# Save file
```

---

## Step 3: Test Backend (2 minutes)

```bash
cd backend
python main.py
```

✅ You should see:
```
Loading 100 sign classes from app/SignRecognition/classes.txt
Device: cuda  (or cpu if no GPU)
✅ Loaded: best_0.pt
✅ Loaded: best_1.pt
✅ Loaded: best_2.pt
✅ Loaded: best_3.pt
✅ Loaded: best_4.pt
```

---

## Step 4: Frontend Component (5 minutes)

Create: `frontend/src/components/VideoCallWithSignDetection.tsx`

Copy the component from `PYTORCH_INTEGRATION.md` (in Step 5 section)

Then use it in your video call page:

```tsx
import { VideoCallWithSignDetection } from './components/VideoCallWithSignDetection';

// In your video call page:
<VideoCallWithSignDetection
  token={liveKitToken}
  url={liveKitUrl}
  roomId={roomId}
  authToken={jwtToken}
/>
```

---

## Test It! (3 minutes)

**Terminal 1:**
```bash
cd backend && python main.py
```

**Terminal 2:**
```bash
cd frontend && npm run dev
```

**Browser:**
1. Go to http://localhost:5173/video-call
2. Create meeting
3. Join meeting
4. Make hand signs in front of camera
5. Watch predictions appear! 🎉

---

## 🔌 API Endpoint

```
WebSocket: ws://localhost:8000/meetings/ws/{room_id}/sign-detect?token={jwt_token}

Send every 100ms:
{"type": "frame", "data": "base64_encoded_jpeg"}

Receive every 32 frames (~3 seconds @ 10 FPS):
{
  "type": "prediction",
  "sign": "HELLO",
  "confidence": 0.95,
  "processing_time_ms": 45.2
}
```

---

## 📊 What's Happening

```
Your Camera (30 FPS)
       ↓ (captured every 100ms)
Frontend: Encode to JPEG + base64
       ↓ (sent via WebSocket)
Backend: Decode frame
       ↓ (extract landmarks)
Extract: MediaPipe Holistic → 225 features
       ↓ (add to buffer)
Buffer: Accumulate 32 frames (~3.2 seconds)
       ↓ (when full, predict)
Ensemble: 5 PyTorch models vote
       ↓ (average their predictions)
Output: "HELLO - 95% confidence"
       ↓ (sent back to frontend)
Display: Show result in real-time
```

---

## ⚙️ Adjust for Your Hardware

### Faster Predictions
```typescript
// frontend/src/components/VideoCallWithSignDetection.tsx
// Line ~66: Change 100 to 50
const interval = setInterval(sendFrame, 50);  // 20 FPS instead of 10
```

### Slower (Uses Less CPU)
```typescript
// Change 100 to 200
const interval = setInterval(sendFrame, 200);  // 5 FPS instead of 10
```

### GPU vs CPU
```python
# It auto-detects CUDA. To force CPU:
# In pytorch_sign_recognizer.py, change:
device='cuda' → device='cpu'
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "No best_*.pt files found" | Make sure you copied model files to `backend/app/SignRecognition/` |
| "classes.txt not found" | Copy `dataset/classes.txt` to same location |
| WebSocket connection refused | Check backend is running, verify CORS in main.py |
| No predictions appearing | Check lighting, ensure hand is in frame |
| "cuda out of memory" | Reduce number of concurrent connections or use CPU |

---

## 📁 Files Created For You

✅ `backend/app/services/pytorch_sign_recognizer.py` - Main recognition logic
✅ `backend/app/services/pytorch_video_handler.py` - WebSocket streaming
✅ `backend/app/VideoCall/router_pytorch.py` - Enhanced API endpoints
✅ `PYTORCH_INTEGRATION.md` - Detailed guide

---

## 🎯 Performance Expectations

- **Frame rate**: 10 FPS (configurable)
- **Prediction every**: ~3.2 seconds (32 frames)
- **Latency per frame**: 40-100ms (includes model inference)
- **Accuracy**: Based on your trained models
- **GPU speedup**: 5-10x faster with CUDA

---

## 🚀 You're Ready!

1. ✅ Copy model files (Step 1)
2. ✅ Update main.py (Step 2)
3. ✅ Start backend (Step 3)
4. ✅ Add frontend component (Step 4)
5. ✅ Test in browser!

For detailed configuration and troubleshooting, see **PYTORCH_INTEGRATION.md**

---

**Questions? Check PYTORCH_INTEGRATION.md for the full guide!**
