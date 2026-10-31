# PyTorch SignNet Video Calling Integration - Implementation Checklist

✅ **Completed Setup Steps**

## Step 1: Files Copied ✅
- [x] `common.py` → `backend/common.py` (with flexible class loading)
- [x] `extract.py` → `backend/extract.py`
- [x] `best_0.pt` → `backend/app/SignRecognition/best_0.pt`
- [x] `best_1.pt` → `backend/app/SignRecognition/best_1.pt`
- [x] `best_2.pt` → `backend/app/SignRecognition/best_2.pt`
- [x] `best_3.pt` → `backend/app/SignRecognition/best_3.pt`
- [x] `best_4.pt` → `backend/app/SignRecognition/best_4.pt`
- [x] `classes.txt` → `backend/app/SignRecognition/classes.txt`

## Step 2: Backend Services ✅
- [x] `backend/app/services/pytorch_sign_recognizer.py` (PyTorch model loading & inference)
- [x] `backend/app/services/pytorch_video_handler.py` (WebSocket frame streaming)
- [x] `backend/app/services/__init__.py` (package init)

## Step 3: FastAPI Router ✅
- [x] `backend/app/VideoCall/router_pytorch.py` (enhanced router with sign detection)
- [x] Updated `backend/main.py` to import `router_pytorch`

## Step 4: Verification Tests ✅
```bash
# All models load successfully
# SignRecognizer initializes correctly
# 11 sign classes detected
```

---

## 📋 Remaining Integration Tasks

### Task 1: Install Dependencies (if needed)
```bash
cd backend
pip install -r requirements.txt
```

Ensure these packages are installed:
- torch >= 1.9.0
- mediapipe >= 0.8.9
- opencv-python (cv2)
- fastapi
- python-multipart
- websockets

### Task 2: Start Backend Server
```bash
cd backend
python main.py
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
[startup] ✅ Video call router loaded
```

To check health of sign detection:
```bash
curl http://localhost:8000/meetings/health
```

Expected response:
```json
{
  "status": "healthy",
  "models_found": 5,
  "classes_file_exists": true,
  "device": "cpu"
}
```

### Task 3: Create React Component (Frontend)
Create `frontend/src/components/VideoCallWithSignDetection.tsx`:

```typescript
import React, { useRef, useEffect, useState } from 'react';
import { Participant } from 'livekit-client';

interface Props {
  token: string;
  url: string;
  roomId: string;
  authToken: string;
}

export const VideoCallWithSignDetection: React.FC<Props> = ({
  token,
  url,
  roomId,
  authToken
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initialize WebSocket for sign detection
    const wsProtocol = url.includes('https') ? 'wss' : 'ws';
    const baseUrl = url.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
    const wsUrl = `${wsProtocol}://${baseUrl}/meetings/ws/${roomId}/sign-detect?token=${authToken}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected for sign detection');
      setConnected(true);
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'prediction') {
        setPrediction(data);
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket closed');
      setConnected(false);
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, authToken, url]);

  useEffect(() => {
    // Capture video frames and send to WebSocket
    const interval = setInterval(() => {
      if (videoRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = (e.target?.result as string).split(',')[1];
              wsRef.current?.send(JSON.stringify({
                type: 'frame',
                data: base64
              }));
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.8);
      }
    }, 100); // Send frame every 100ms (10 FPS)
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="video-call-container">
      <div className="video-area">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="local-video"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      {prediction && (
        <div className="prediction-panel">
          <h3>Sign Detected</h3>
          <p className="sign-name">{prediction.sign}</p>
          <p className="confidence">
            Confidence: {(prediction.confidence * 100).toFixed(1)}%
          </p>
          <p className="details">
            Frame: {prediction.frame_number} | 
            Prediction #{prediction.prediction_number} |
            {prediction.processing_time_ms.toFixed(1)}ms
          </p>
        </div>
      )}
      
      <div className="status-bar">
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Sign Detection Active' : '🔴 Disconnected'}
        </span>
      </div>
    </div>
  );
};
```

### Task 4: Add Component to Video Call Page

Update your video call page to use the new component:

```tsx
import { VideoCallWithSignDetection } from './VideoCallWithSignDetection';

// In your video call page component:
<VideoCallWithSignDetection
  token={liveKitToken}
  url={liveKitUrl}
  roomId={roomId}
  authToken={jwtToken}
/>
```

### Task 5: Add Styles (Optional)

Add CSS styling to display predictions nicely:

```css
.video-call-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-area {
  position: relative;
  width: 100%;
  height: 100%;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.prediction-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
  min-width: 250px;
}

.prediction-panel h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  text-transform: uppercase;
  color: #4CAF50;
}

.sign-name {
  margin: 5px 0;
  font-size: 24px;
  font-weight: bold;
  text-transform: capitalize;
}

.confidence {
  margin: 8px 0;
  font-size: 14px;
  color: #aaa;
}

.details {
  margin: 8px 0;
  font-size: 12px;
  color: #999;
}

.status-bar {
  position: absolute;
  top: 10px;
  right: 10px;
}

.status {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status.connected {
  background: rgba(76, 175, 80, 0.9);
  color: white;
}

.status.disconnected {
  background: rgba(244, 67, 54, 0.9);
  color: white;
}
```

---

## 🚀 Testing the Integration

### Backend Health Check
```bash
curl http://localhost:8000/meetings/health
```

### Create a Meeting
```bash
curl -X POST http://localhost:8000/meetings/create \
  -H "Authorization: Bearer <your_jwt_token>"
```

### WebSocket Test (with wscat)
```bash
# Install wscat: npm install -g wscat
wscat -c "ws://localhost:8000/meetings/ws/<room_id>/sign-detect?token=<jwt_token>"

# Send a frame (simulated):
{"type": "frame", "data": "base64_encoded_jpeg_here"}
```

---

## 📊 System Architecture

```
Frontend (React)
  ↓ WebSocket (binary frames)
  ↓
Backend FastAPI (router_pytorch.py)
  ↓
PyTorch Sign Recognizer (pytorch_sign_recognizer.py)
  ├─ 5 Ensemble Models (best_0.pt - best_4.pt)
  ├─ MediaPipe Holistic Extraction
  ├─ 32-Frame Temporal Buffering
  └─ Ensemble Prediction + Confidence
  ↓
Response (JSON with sign name, confidence, processing time)
  ↓
Frontend Display

```

---

## 🔧 Configuration Options

Edit values in `backend/app/services/pytorch_sign_recognizer.py`:

| Setting | Current | Description |
|---------|---------|-------------|
| `sequence_length` | 32 | Number of frames to buffer before prediction |
| `model_complexity` | 1 | MediaPipe complexity (0=fast, 1=full) |
| `device` | auto | 'cuda' for GPU, 'cpu' for CPU |

---

## ⚠️ Troubleshooting

### Models fail to load
```
❌ FileNotFoundError: No such file or directory
```
**Solution**: Ensure best_0.pt through best_4.pt are in `backend/app/SignRecognition/`

### common.py import fails
```
❌ ModuleNotFoundError: No module named 'common'
```
**Solution**: Ensure `common.py` is in `backend/` root directory

### WebSocket connection refused
```
❌ ConnectionRefusedError
```
**Solution**: Check backend is running (`python main.py`)

### Classes file not found
```
❌ FileNotFoundError: dataset/classes.txt
```
**Solution**: Ensure `classes.txt` is in `backend/app/SignRecognition/` (done automatically)

---

## 📞 Support

For issues or questions, refer to:
- `00_START_HERE.md` - Overview
- `PYTORCH_INTEGRATION.md` - Technical deep dive
- `PYTORCH_FILE_REFERENCE.md` - File-by-file breakdown

---

**Status**: ✅ Backend Implementation Complete - Ready for Frontend Integration
