# 📖 PyTorch SignNet Video Calling Integration - Documentation Index

## Quick Navigation

### 🚀 **START HERE** - Getting Started (Choose Your Path)

**If you have 5-10 minutes:**
→ Read [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md)
- 4 easy steps to integrate
- Checklist format
- Minimal explanation

**If you have 20-30 minutes:**
→ Read [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md)
- Complete guide with examples
- Configuration options
- Testing procedures

**If you want to understand the code:**
→ Read [`PYTORCH_FILE_REFERENCE.md`](PYTORCH_FILE_REFERENCE.md)
- What each file does
- Data flow examples
- Architecture details

**For an overview:**
→ Read [`PYTORCH_INTEGRATION_SUMMARY.md`](PYTORCH_INTEGRATION_SUMMARY.md)
- Overview of everything
- Quick reference
- Directory structure

---

## 📚 Complete Documentation

### Setup & Integration
- 📄 [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md) - 4-step setup (10 min)
- 📄 [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md) - Complete guide
- 📄 [`PYTORCH_INTEGRATION_SUMMARY.md`](PYTORCH_INTEGRATION_SUMMARY.md) - Overview

### Technical Reference
- 📄 [`PYTORCH_FILE_REFERENCE.md`](PYTORCH_FILE_REFERENCE.md) - File breakdown
- 💻 `backend/app/services/pytorch_sign_recognizer.py` - Core logic
- 💻 `backend/app/services/pytorch_video_handler.py` - WebSocket handler
- 💻 `backend/app/VideoCall/router_pytorch.py` - API routes

### Frontend
- 💻 `frontend/src/components/VideoCallWithSignDetection.tsx` - React component

---

## 🎯 By Task

### "I just want to integrate and see it work"
1. Read: [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md)
2. Copy model files (Step 1)
3. Update main.py (Step 2)
4. Start backend (Step 3)
5. Add React component (Step 4)
6. Test! 🎉

### "I want to understand how it works"
1. Read: [`PYTORCH_FILE_REFERENCE.md`](PYTORCH_FILE_REFERENCE.md)
2. Look at: `pytorch_sign_recognizer.py` - Shows the architecture
3. Look at: `pytorch_video_handler.py` - Shows WebSocket handling
4. Read: [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md) - Full context

### "I need to configure it for my hardware"
1. Read: [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md) - "Configuration" section
2. Adjust: `pytorch_sign_recognizer.py` - Buffer size, device
3. Adjust: `VideoCallWithSignDetection.tsx` - Frame rate
4. Test and benchmark

### "Something's not working"
1. Check: [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md) - "🐛 Common Issues"
2. Read: [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md) - "Troubleshooting"
3. Check: Backend logs for errors
4. Check: Browser console for WebSocket issues

---

## 📊 Files Created For You

### Backend Services
```
backend/app/services/
├── __init__.py
├── pytorch_sign_recognizer.py      # Ensemble inference (uses your 5 models)
└── pytorch_video_handler.py         # WebSocket frame processor
```

### Enhanced API
```
backend/app/VideoCall/
└── router_pytorch.py               # New WebSocket endpoint + original endpoints
```

### Frontend Component
```
frontend/src/components/
└── VideoCallWithSignDetection.tsx   # Drop-in React component
```

### Documentation
```
├── PYTORCH_QUICKSTART.md             # START HERE (4 steps)
├── PYTORCH_INTEGRATION.md            # Full guide
├── PYTORCH_INTEGRATION_SUMMARY.md    # Overview
├── PYTORCH_FILE_REFERENCE.md         # Technical details
└── INDEX.md                          # This file
```

---

## 🔄 Integration Workflow

```
1. Copy your files
   - best_0.pt, best_1.pt, ..., best_4.pt
   - dataset/classes.txt
   - common.py

2. Update backend/main.py
   - Change VideoCall router import

3. Start backend
   - python main.py
   - Should load 5 models

4. Add frontend component
   - Create VideoCallWithSignDetection.tsx
   - Add to video call page

5. Test
   - Create meeting
   - Make signs
   - See predictions!
```

---

## 📡 How It Works (Simple Version)

```
Camera Feed
    ↓
Frontend captures frame every 100ms
    ↓
Encode as JPEG → base64
    ↓
Send via WebSocket to backend
    ↓
Backend: Decode frame
    ↓
Extract MediaPipe landmarks (225 features)
    ↓
Accumulate 32 frames (~3.2 seconds)
    ↓
When ready: Run through 5 models
    ↓
Ensemble average their predictions
    ↓
Return: "HELLO - 95% confidence"
    ↓
Display in browser!
```

---

## ⚡ Key Statistics

| Metric | Value |
|--------|-------|
| Models | 5 (ensemble) |
| Frame buffer | 32 frames |
| Frame rate | 10 FPS (configurable) |
| Prediction interval | ~3.2 seconds |
| Latency | 40-100ms per prediction |
| Features per frame | 225 (pose + hands) |
| Model type | Bidirectional LSTM |
| GPU support | CUDA auto-detected |

---

## 🛠️ Configuration Reference

### Frame Rate (in React component)
```typescript
// Line ~66 in VideoCallWithSignDetection.tsx
const interval = setInterval(sendFrame, 100);  // milliseconds
// 50 = 20 FPS (faster)
// 100 = 10 FPS (default)
// 200 = 5 FPS (slower)
```

### Device Selection (in Python service)
```python
# Line ~18 in pytorch_sign_recognizer.py
self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
# Force CPU: self.device = "cpu"
# Force CUDA: self.device = "cuda"
```

### Buffer Size (in Python service)
```python
# Line ~153 in pytorch_sign_recognizer.py
if len(self.frame_buffer) > self.sequence_length:  # default: 32
```

---

## 🚨 Troubleshooting Quick Links

| Issue | Guide | Section |
|-------|-------|---------|
| Models not loading | PYTORCH_QUICKSTART.md | Common Issues |
| WebSocket fails | PYTORCH_INTEGRATION.md | Troubleshooting |
| No predictions | PYTORCH_INTEGRATION.md | Troubleshooting |
| Poor accuracy | PYTORCH_INTEGRATION.md | Configuration |
| High latency | PYTORCH_QUICKSTART.md | Adjust for Hardware |

---

## 📞 Getting Help

1. **"How do I set this up?"**
   → [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md)

2. **"How does this work?"**
   → [`PYTORCH_FILE_REFERENCE.md`](PYTORCH_FILE_REFERENCE.md)

3. **"I have an error"**
   → [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md) - Common Issues section

4. **"How do I customize it?"**
   → [`PYTORCH_INTEGRATION.md`](PYTORCH_INTEGRATION.md) - Configuration section

5. **"What do these files do?"**
   → [`PYTORCH_FILE_REFERENCE.md`](PYTORCH_FILE_REFERENCE.md)

---

## 🎯 Next Steps

1. **Choose your guide** based on available time (5, 20, or 30 minutes)
2. **Follow the steps** in order
3. **Test with your camera** to see predictions in real-time
4. **Configure** for your specific hardware if needed
5. **Deploy** to production!

---

## 📌 Checklist Before Starting

- [ ] You have 5 trained PyTorch model files (best_0.pt through best_4.pt)
- [ ] You have dataset/classes.txt with your sign names
- [ ] You have common.py from your training directory
- [ ] Backend is set up with LiveKit credentials
- [ ] Frontend has React and livekit-react installed
- [ ] You have 10-30 minutes to follow the integration guide

---

**Ready to integrate?** Start with [`PYTORCH_QUICKSTART.md`](PYTORCH_QUICKSTART.md)! 🚀
