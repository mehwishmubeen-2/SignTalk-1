# 📚 PyTorch Integration - File Reference

## Files Created For You

### 1. `backend/app/services/pytorch_sign_recognizer.py`
**Purpose**: Real-time sign recognition using PyTorch ensemble

**Key Classes**:
```python
class SignRecognizer:
    # Initialize with 5 model files and classes
    __init__(model_paths, classes_file, device='cuda')
    
    # Add video frames one by one
    add_frame(frame) → bool (True when ready to predict)
    
    # Get prediction from buffered frames
    predict() → {sign, confidence, processing_time_ms}
    
    # Reset buffer for next sequence
    reset_buffer()
```

**How it works**:
1. Takes raw video frames (480×640×3)
2. Extracts MediaPipe landmarks (225 features)
3. Buffers 32 frames
4. When buffer full, runs through ensemble
5. Returns top prediction with confidence

**Key Methods**:
- `extract_landmarks()` - MediaPipe Holistic → 225-dim vector
- `add_frame()` - Accumulates frames in buffer
- `predict()` - Ensemble inference on 32-frame sequence

---

### 2. `backend/app/services/pytorch_video_handler.py`
**Purpose**: WebSocket handler for streaming video frames

**Key Class**:
```python
class PyTorchVideoStreamHandler:
    # Handle incoming WebSocket connections
    handle_connection(websocket, room_id, user_id)
```

**How it works**:
1. Accepts WebSocket connection from frontend
2. Receives base64-encoded JPEG frames
3. Passes frames to SignRecognizer
4. When prediction ready, sends back to frontend
5. Maintains connection until client closes

**Message Format**:

Incoming:
```json
{"type": "frame", "data": "base64_encoded_jpeg_data"}
```

Outgoing:
```json
{
  "type": "prediction",
  "sign": "HELLO",
  "confidence": 0.95,
  "processing_time_ms": 45.2,
  "hand_detected": true,
  "prediction_number": 1
}
```

---

### 3. `backend/app/VideoCall/router_pytorch.py`
**Purpose**: FastAPI routes for video calling + sign detection

**Endpoints**:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/meetings/create` | Create new meeting room |
| POST | `/meetings/{room_id}/token` | Get LiveKit token |
| POST | `/meetings/{room_id}/join` | Join existing room |
| WS | `/meetings/ws/{room_id}/sign-detect` | Real-time sign detection |
| GET | `/meetings/health` | Check service health |

**WebSocket Endpoint Details**:
```
ws://localhost:8000/meetings/ws/{room_id}/sign-detect?token={jwt_token}

- Authenticates user via JWT token
- Receives video frames
- Runs sign recognition
- Returns predictions
```

---

## How They Work Together

```
                       FRONTEND
┌─────────────────────────────────────────┐
│ VideoCallWithSignDetection.tsx          │
│                                          │
│ 1. Capture camera frame every 100ms     │
│ 2. Encode as JPEG + base64              │
│ 3. Send via WebSocket                   │
│                                          │
│ Receive predictions:                     │
│ 4. Display "HELLO - 95% confidence"     │
└────────────────┬────────────────────────┘
                 │ WebSocket
                 │ base64 JPEG frames
                 ▼
        ┌────────────────────────┐
        │ BACKEND - FastAPI      │
        │                        │
        │ router_pytorch.py:     │
        │ - Handles WebSocket    │
        │ - Auth + routing       │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ pytorch_video_handler.py   │
        │                            │
        │ 1. Decode base64 frame     │
        │ 2. Pass to recognizer      │
        │ 3. Get prediction          │
        │ 4. Send back to client     │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌───────────────────────────────────┐
        │ pytorch_sign_recognizer.py        │
        │                                    │
        │ 1. Extract MediaPipe landmarks    │
        │    (225 features per frame)       │
        │                                    │
        │ 2. Buffer 32 frames               │
        │                                    │
        │ 3. When buffer full:              │
        │    - Interpolate to exactly 32    │
        │    - Apply prep() transformation  │
        │    - Feed to 5 models             │
        │    - Average their logits         │
        │    - Get top prediction           │
        │                                    │
        │ 4. Return result with confidence  │
        └───────────────────────────────────┘
                     │
              Ensemble of
              5 PyTorch models:
              best_0.pt
              best_1.pt
              best_2.pt
              best_3.pt
              best_4.pt
```

---

## Data Flow Example

### Frame 1-31 (Accumulating)
```
Frame 1 (time 0ms):
- Receive base64 JPEG
- Decode → numpy array (480×640×3)
- Extract landmarks → (225,)
- Add to buffer → [frame1]
- Status: buffer has 1/32, not ready

Frame 2 (time 100ms):
- Receive base64 JPEG
- Extract landmarks
- Add to buffer → [frame1, frame2]
- Status: buffer has 2/32, not ready

...

Frame 31 (time 3000ms):
- Add to buffer → [frame1, frame2, ..., frame31]
- Status: buffer has 31/32, not ready
```

### Frame 32 (Prediction!)
```
Frame 32 (time 3100ms):
- Add to buffer → [frame1, frame2, ..., frame32]
- Status: buffer FULL ✓
- Ready to predict!

Prediction:
1. Interpolate 32 frames to exactly (32, 225)
2. Apply prep() to add velocity features → (32, 252)
3. Model 1 forward pass → logits (num_classes,)
4. Model 2 forward pass → logits (num_classes,)
5. ... (5 models total)
6. Average logits
7. softmax() → probabilities (0-1)
8. argmax() → class index
9. Decode index to sign name: "HELLO"
10. Get confidence: max(probabilities) = 0.95

Send to client:
{
  "type": "prediction",
  "sign": "HELLO",
  "confidence": 0.95,
  "processing_time_ms": 45.2
}

Reset buffer → []
Ready for next sequence
```

---

## Model Architecture (From `common.py`)

### Input
- **Shape**: (batch_size, 32, 225)
- **225 features per frame**:
  - Pose: 11 keypoints × 3 coords = 33 features (normalized)
  - Left hand: 21 keypoints × 3 coords = 63 features
  - Right hand: 21 keypoints × 3 coords = 63 features
  - Hand shape: Finger positions relative to wrist = 126 features
  - **Total**: 33 + 126 + 126 = 285 features

### Network
```python
class SignNet(nn.Module):
    def __init__(self, d_in=252, n_cls=num_classes):
        self.lstm = nn.LSTM(
            input_size=252,           # After prep()
            hidden_size=128,
            num_layers=2,
            bidirectional=True,       # 128*2 = 256 output
            dropout=0.3
        )
        self.head = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(256, n_cls)     # Output: logits for each sign
        )
```

### Preprocessing (`prep()`)
```python
# Input: (batch, 32, 225)
# 1. Keep relevant columns (pose + hand landmarks)
# 2. Add hand shape features (fingers relative to wrist)
# 3. Add velocity (diff between consecutive frames)
# Output: (batch, 32, 252)
```

### Forward Pass
```python
# (batch, 32, 252) → LSTM → (batch, 32, 256)
# Take mean over time → (batch, 256)
# Pass through head → (batch, num_classes)
# softmax → (batch, num_classes) [probabilities]
```

### Ensemble
```python
# For each of 5 models:
#   output = model(x) → (batch, num_classes)
#   probs[i] = softmax(output)
# 
# ensemble_probs = mean(probs[0], probs[1], ..., probs[4])
# final_pred = argmax(ensemble_probs)
# confidence = max(ensemble_probs)
```

---

## File Dependencies

```
pytorch_sign_recognizer.py
├── common.py (imports SignNet, prep)
├── torch (PyTorch)
├── mediapipe (MediaPipe Holistic)
└── numpy, cv2 (image processing)

pytorch_video_handler.py
├── pytorch_sign_recognizer.py
├── fastapi (WebSocket)
└── logging

router_pytorch.py
├── pytorch_video_handler.py
├── livekit.api (video streaming)
├── fastapi (FastAPI framework)
└── supabase (auth)

VideoCallWithSignDetection.tsx (frontend)
├── livekit/react (video UI)
└── WebSocket API (browser)
```

---

## Configuration Points

### Model Loading
**File**: `pytorch_sign_recognizer.py`
```python
def _load_pytorch_model(self, path: str):
    model = SignNet().to(self.device)  # <-- Device selection
    model.load_state_dict(torch.load(path, map_location=self.device))
```

### Frame Buffering
**File**: `pytorch_sign_recognizer.py`
```python
def add_frame(self, frame):
    if len(self.frame_buffer) > self.sequence_length:  # <-- Buffer size
        self.frame_buffer.pop(0)
    return len(self.frame_buffer) >= self.sequence_length
```

### Frame Rate
**File**: `VideoCallWithSignDetection.tsx`
```typescript
const interval = setInterval(sendFrame, 100);  // <-- Milliseconds
// 50ms = 20 FPS
// 100ms = 10 FPS  (default)
// 200ms = 5 FPS
```

### WebSocket URL
**File**: `VideoCallWithSignDetection.tsx`
```typescript
const wsUrl = `${protocol}//${window.location.host}/meetings/ws/${roomId}/sign-detect?token=${authToken}`;
// Customize host/port as needed
```

---

## Error Handling

### Backend Errors
- Missing model files → "No best_*.pt files found"
- Missing classes.txt → "classes.txt not found"
- Invalid JWT token → WebSocket close code 4001
- Frame decode error → Logged but continues
- Model inference error → Logged, skips frame

### Frontend Errors
- WebSocket connection failed → Retries connection
- Failed frame encoding → Skips frame, continues
- Timeout receiving prediction → Continues sending frames

---

## Monitoring & Debugging

### Enable Logging
```python
# In backend/main.py
import logging
logging.basicConfig(level=logging.DEBUG)

# Will show:
# [WS 1] User xyz connected to room abc
# [WS 1] Processed 32 frames, ready for prediction
# [WS 1] Prediction complete: HELLO (0.95)
# [WS 1] Closed after 150 frames, 5 predictions
```

### Check Frontend Connection
```javascript
// In browser console
wsRef.current?.readyState  // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
```

### Monitor Performance
```python
# Logs include processing_time_ms per prediction
# If > 200ms: Model inference taking too long
# If < 30ms: GPU working well
```

---

See `PYTORCH_QUICKSTART.md` for setup instructions!
