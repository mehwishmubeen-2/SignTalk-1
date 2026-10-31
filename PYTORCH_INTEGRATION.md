# 🎥 PyTorch SignNet + Video Calling Integration Guide

## 📋 Your Setup

You have:
- ✅ **5 PyTorch models**: `best_0.pt`, `best_1.pt`, `best_2.pt`, `best_3.pt`, `best_4.pt` (ensemble)
- ✅ **SignNet LSTM architecture**: Bidirectional LSTM with hand shape features
- ✅ **MediaPipe Holistic extraction**: Full body + both hands (225 features)
- ✅ **Training pipeline**: train.py, common.py, extract.py
- ✅ **LiveKit video calling**: Already integrated in backend

## 🚀 Integration Steps

### Step 1: Prepare Model Files

Copy your trained models to the correct location:

```bash
# Copy all 5 model files to backend
cp best_0.pt backend/app/SignRecognition/
cp best_1.pt backend/app/SignRecognition/
cp best_2.pt backend/app/SignRecognition/
cp best_3.pt backend/app/SignRecognition/
cp best_4.pt backend/app/SignRecognition/

# Copy classes.txt to backend
cp dataset/classes.txt backend/app/SignRecognition/

# Copy common.py to backend for model loading
cp common.py backend/
```

### Step 2: Update Backend main.py

Replace the video call router import:

```python
# In backend/main.py, change this line:
# from app.VideoCall.router import router as video_call_router

# To this:
from app.VideoCall.router_pytorch import router as video_call_router
```

### Step 3: Update Requirements

Your requirements.txt should have:
```
torch>=1.9.0
torchvision>=0.10.0
mediapipe>=0.8.0
fastapi>=0.95.0
websockets
numpy
opencv-python
```

Install if missing:
```bash
cd backend
pip install -r requirements.txt
```

### Step 4: Test Backend

```bash
cd backend
python main.py
```

Check the logs:
- ✅ Models should load from SignRecognition/
- ✅ Should show "Device: cuda" or "Device: cpu"
- ✅ Should list "5 models loaded"

### Step 5: Create Frontend Component

File: `frontend/src/components/VideoCallWithSignDetection.tsx`

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/react';

interface Prediction {
  sign: string;
  confidence: number;
  processing_time_ms: number;
  hand_detected: boolean;
  prediction_number: number;
}

export const VideoCallWithSignDetection: React.FC<{
  token: string;
  url: string;
  roomId: string;
  authToken: string;
}> = ({ token, url, roomId, authToken }) => {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/meetings/ws/${roomId}/sign-detect?token=${authToken}`;
    
    console.log('[SignDetection] Connecting to:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('[SignDetection] Connected');
      setIsConnected(true);
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'prediction') {
        setPrediction({
          sign: data.sign,
          confidence: data.confidence,
          processing_time_ms: data.processing_time_ms,
          hand_detected: data.hand_detected,
          prediction_number: data.prediction_number
        });
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('[SignDetection] WebSocket error:', error);
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'close' }));
        wsRef.current.close();
      }
    };
  }, [roomId, authToken]);

  // Capture and send frames
  const sendFrame = () => {
    if (!isConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    
    canvasRef.current.toBlob((blob) => {
      if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          wsRef.current?.send(JSON.stringify({
            type: 'frame',
            data: base64.split(',')[1]
          }));
        };
        reader.readAsDataURL(blob);
      }
    }, 'image/jpeg', 0.85);
  };

  // Send frames every 100ms (10 FPS)
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(sendFrame, 100);
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="w-full space-y-4">
      {/* Video Conference */}
      <div className="bg-black rounded-lg overflow-hidden">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={url}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>

      {/* Hidden elements for frame capture */}
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />

      {/* Predictions Display */}
      {prediction && (
        <div className="bg-blue-900 text-white rounded-lg p-4">
          <h3 className="text-lg font-bold mb-2">🤟 Sign Detected</h3>
          <div className="text-2xl font-bold text-blue-200 mb-2">{prediction.sign}</div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-blue-300">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-blue-800 rounded h-3">
                  <div
                    className="bg-green-500 h-3 rounded transition-all"
                    style={{ width: `${prediction.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono">{(prediction.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-400">
                {prediction.processing_time_ms.toFixed(1)}ms
              </div>
              <div className="text-xs text-blue-400">
                Hand: {prediction.hand_detected ? '✓' : '✗'}
              </div>
              <div className="text-xs text-blue-400">
                #{prediction.prediction_number}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="text-xs text-gray-500">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
};
```

Usage in your video call page:

```tsx
<VideoCallWithSignDetection
  token={liveKitToken}
  url={liveKitUrl}
  roomId={roomId}
  authToken={jwtToken}
/>
```

## 📊 How It Works

```
┌─────────────────────┐
│ User's Camera Frame │ (30 FPS or more)
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│ Frontend: Capture & Send     │ Every 100ms: encode frame as JPEG, base64
│ via WebSocket                │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Backend: Receive Frame       │ Decode base64 frame
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ PyTorchVideoStreamHandler.process()  │
│                                      │
│ 1. Decode JPEG to numpy array       │
│ 2. Extract MediaPipe landmarks      │ (225 features)
│    - Pose (33 pts × 3)             │ (99 dims)
│    - Left hand (21 pts × 3)        │ (63 dims)
│    - Right hand (21 pts × 3)       │ (63 dims)
│ 3. Add to frame buffer              │ Accumulate 32 frames
│                                      │
│ When buffer full (32 frames):       │
│ 4. Interpolate to exactly 32 frames │
│ 5. Apply prep() transformation      │
│ 6. Pass through ensemble models     │
│    - Model 1 (best_0.pt) → logits  │
│    - Model 2 (best_1.pt) → logits  │
│    - ... (5 models total)           │
│ 7. Average probabilities            │
│ 8. Get top prediction & confidence  │
│ 9. Reset buffer for next sequence   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Send Prediction via WebSocket│
│                              │
│ {                            │
│   "type": "prediction",      │
│   "sign": "HELLO",           │
│   "confidence": 0.95,        │
│   "processing_time_ms": 45   │
│ }                            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Frontend: Display Result     │
│ "HELLO - 95% confidence"     │
└──────────────────────────────┘
```

## ⚙️ Configuration

### Adjust Sensitivity

In `backend/app/services/pytorch_sign_recognizer.py`:

```python
# Line ~130: Only predict if buffer has enough frames
# Lower = earlier predictions, Higher = more temporal context
# if len(self.frame_buffer) >= self.sequence_length:  # default: 32
```

### Frame Rate

In `frontend/src/components/VideoCallWithSignDetection.tsx`:

```typescript
// Line ~66: Adjust frame send interval
const interval = setInterval(sendFrame, 100);  // 100ms = 10 FPS
// Try: 50ms = 20 FPS (more CPU) or 200ms = 5 FPS (less CPU)
```

### Model Ensemble

All 5 models contribute equally to predictions. To change:

```python
# In pytorch_sign_recognizer.py, line ~190:
ensemble_probs = np.mean(all_probs, axis=0)  # Average votes
# Could change to weighted average, median, majority vote, etc.
```

## 🧪 Testing

### Test 1: Backend Only

```bash
cd backend
python -c "
from app.services.pytorch_sign_recognizer import SignRecognizer
import cv2
import numpy as np

r = SignRecognizer(
    model_paths=['app/SignRecognition/best_0.pt', 'app/SignRecognition/best_1.pt'],
    classes_file='app/SignRecognition/classes.txt'
)

# Dummy frame
frame = np.zeros((480, 640, 3), dtype=np.uint8)

# Add 32 frames
for i in range(32):
    ready = r.add_frame(frame)
    if ready:
        pred = r.predict()
        print('Prediction:', pred)
        break
"
```

### Test 2: Full Stack

1. Start backend:
   ```bash
   cd backend && python main.py
   ```

2. Start frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Open http://localhost:5173/video-call
4. Make signs in front of camera
5. Watch predictions appear every ~3 seconds (32 frames @ 10 FPS)

## 📊 Performance

| Metric | Value |
|--------|-------|
| Frame rate | 10 FPS (configurable) |
| Buffer size | 32 frames |
| Time per sequence | ~3.2 seconds |
| Prediction latency | 40-100ms (depends on GPU) |
| Model inference | 5 models × ~15ms = ~75ms |
| Total per prediction | 100-200ms |

## 🔍 Troubleshooting

| Issue | Fix |
|-------|-----|
| "No best_*.pt files found" | Copy model files to `backend/app/SignRecognition/` |
| "classes.txt not found" | Copy `dataset/classes.txt` to `backend/app/SignRecognition/` |
| WebSocket won't connect | Check CORS in `main.py`, verify token is valid |
| No predictions appearing | Check hand is in frame, try lower confidence threshold |
| Very slow predictions | Use CPU model or reduce sequence_length |
| CUDA out of memory | Reduce batch size or use CPU (model loads to GPU by default) |

## 📁 Files Created

```
backend/
├── app/
│   ├── services/
│   │   ├── __init__.py                    [NEW]
│   │   ├── pytorch_sign_recognizer.py     [NEW] Main recognition logic
│   │   └── pytorch_video_handler.py       [NEW] WebSocket handler
│   ├── VideoCall/
│   │   ├── router.py                      (keep as backup)
│   │   └── router_pytorch.py              [NEW] Enhanced router
│   └── SignRecognition/
│       ├── best_0.pt                      (copy your models)
│       ├── best_1.pt
│       ├── best_2.pt
│       ├── best_3.pt
│       ├── best_4.pt
│       └── classes.txt                    (copy from dataset/)
├── common.py                              (copy from training dir)
└── main.py                                (update import)

frontend/
└── src/
    └── components/
        └── VideoCallWithSignDetection.tsx [NEW]
```

## 🚀 Production Checklist

- [ ] All 5 model files copied to `backend/app/SignRecognition/`
- [ ] `classes.txt` copied to `backend/app/SignRecognition/`
- [ ] `common.py` copied to `backend/`
- [ ] `router.py` updated to import from `router_pytorch.py`
- [ ] Frontend component added to video call page
- [ ] Test with live camera
- [ ] Verify predictions appear every ~3 seconds
- [ ] Confidence scores reasonable (>50%)
- [ ] No WebSocket disconnections
- [ ] Latency < 200ms per prediction

## 💡 Pro Tips

1. **Ensemble works best**: All 5 models contribute to final prediction
2. **Temporal consistency**: 32-frame buffer captures full sign
3. **Real-time performance**: Adjust frame rate and buffer size for your hardware
4. **GPU acceleration**: CUDA enables 5-10x faster predictions
5. **Monitor confidence**: Low confidence (<50%) usually indicates poor visibility

---

**Ready to test?** Start at Step 1 above!
