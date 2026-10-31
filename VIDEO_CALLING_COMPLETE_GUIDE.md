# Video Calling Integration - Complete File Structure & Logic

## Overview
Complete list of all files involved in video calling functionality, organized by layer with their specific purposes.

---

## 🎯 CORE VIDEO CALLING FILES (With Logic)

### FRONTEND - Core Pages & Components

#### 1. **frontend/src/app/pages/VideoCall.tsx** ⭐ MAIN FILE
**Lines:** ~350+ lines  
**Purpose:** Main video call page component  
**Key Logic:**
- LiveKit room initialization with token and server URL
- Participant management (tracks, local/remote participants)
- Caption state management for all participants
- Caption data reception via `RoomEvent.DataReceived`
- Mic/camera/sign/speech mode toggles
- Room leave functionality
- Top bar with room code and participant count
- Video grid layout for all participants

**Key Functions:**
- `fetchToken()` - Get LiveKit token from backend
- `handleLocalCaption()` - Handle incoming captions
- `toggleMic()`, `toggleCamera()`, `leaveCall()` - Control actions
- `VideoCallPage()` - Main component
- `CallRoom()` - Room context component with all logic

**Dependencies:**
- LiveKit components and client
- Supabase auth
- Custom components (CallControls, ParticipantVideoTile)

---

#### 2. **frontend/src/app/pages/VideoCallLanding.tsx** 
**Purpose:** Landing page before joining video call  
**Key Logic:**
- Room code input
- Join room functionality
- User display name input
- Navigation to VideoCall page
- Room validation

---

#### 3. **frontend/src/app/components/ui/CallControls.tsx** ⭐ CONTROLS LOGIC
**Lines:** ~180+ lines  
**Purpose:** Bottom control bar in video calls  
**Key Logic:**
- Mic toggle state and UI
- Camera toggle state and UI
- Sign mode toggle with active state
- Speech mode toggle with active state
- Leave call button
- Button styling (active/inactive states)
- Props management for all control actions

**Key Components:**
- `CallControls()` - Main control bar
- `IconButton()` - Reusable icon button
- `ControlButton()` - Reusable control button with label

**Features:**
- Visual feedback for active modes (color change)
- Hover states and transitions
- Accessibility titles for each button

---

#### 4. **frontend/src/app/components/ui/ParticipantVideoTile.tsx** ⭐ PARTICIPANT DISPLAY
**Lines:** ~250+ lines  
**Purpose:** Individual participant video display  
**Key Logic:**
- Video stream rendering
- Caption display below video
- Participant name badge
- Local vs remote participant detection
- Sign detection mode handling
- Speech mode handling
- Canvas overlay for landmark drawing
- Predicted letter/sign preview
- Mode status badges (Sign ON, Speech ON)
- Avatar placeholder for video fallback

**Key Functions:**
- `useSignDetectionWebSocket()` hook integration
- `useSpeechCaptions()` hook integration
- Video element detection via polling
- Caption type detection (sign vs speech)

**Features:**
- Responsive grid layout
- Gradient backgrounds
- Real-time status display
- Caption styling with emojis (✦ SIGN, 🎤 SPEECH)

---

#### 5. **frontend/src/app/components/ui/CallEndIcon.tsx** (NEW)
**Purpose:** Custom end call button icon  
**Key Logic:**
- SVG icon rendering
- Google Meet style phone handset
- Scalable icon component
- White fill on red background

---

### FRONTEND - Hooks (Capture & Broadcast Logic)

#### 6. **frontend/src/app/hooks/useSignDetectionWebSocket.ts** ⭐ SIGN LOGIC
**Lines:** ~280+ lines  
**Purpose:** Real-time sign language detection via WebSocket  
**Key Logic:**
- WebSocket connection to PyTorch backend
- Video frame capture from local camera
- Frame encoding to JPEG base64
- Frame rate management (30 FPS to match training)
- Automatic reconnection on disconnect
- Caption broadcasting to all participants via `publishData()`
- **[CRITICAL FIX]** Explicit `destinationIdentities` parameter
- Confidence threshold checking (0.75)
- Caption hold and auto-clear (3 seconds)
- Error handling and recovery

**Key Constants:**
- `FRAME_RATE = 30` - Training frame rate
- `SEND_WIDTH = 640`, `SEND_HEIGHT = 480` - Model input size
- `JPEG_QUALITY = 0.8` - Frame compression
- `CONFIDENCE_THRESHOLD = 0.75` - Prediction threshold
- `CAPTION_HOLD_MS = 3000` - Caption duration
- `MAX_BUFFERED_BYTES = 512KB` - Backpressure handling

**Key Functions:**
- `useSignDetectionWebSocket()` - Main hook
- `broadcast()` - Send caption to all participants ⭐
- `handleMessage()` - Process predictions from backend
- `captureAndSend()` - Capture video frames

**Features:**
- Automatic frame center-crop to training aspect ratio
- Backpressure handling (drops frames if buffer full)
- Debug logging for troubleshooting
- Automatic fallback to lossy processing

---

#### 7. **frontend/src/app/hooks/useSpeechCaptions.ts** ⭐ SPEECH LOGIC
**Lines:** ~150+ lines  
**Purpose:** Speech-to-text caption generation  
**Key Logic:**
- Web Speech API integration
- Continuous speech recognition
- Interim and final results
- Caption broadcasting to participants
- **[CRITICAL FIX]** Explicit `destinationIdentities` parameter
- Silence detection (5 second timeout)
- Auto-clear on mode disable

**Key Functions:**
- `useSpeechCaptions()` - Main hook
- `clearCaption()` - Clear captions from all participants
- Speech recognition event handlers

**Features:**
- English language support (en-US)
- Automatic restart on speech end
- Visual feedback with caption type

---

#### 8. **frontend/src/app/hooks/useSignCaptions.ts**
**Purpose:** Caption management utilities  
**Key Logic:**
- Caption state management
- Caption type handling (sign vs speech)

---

#### 9. **frontend/src/app/hooks/useSpeechEmotion.ts**
**Purpose:** Emotion detection from speech  
**Key Logic:**
- Emotion analysis from user input
- Emotion type detection

---

### FRONTEND - Types & Data

#### 10. **frontend/src/app/types/video.ts** ⭐ TYPE DEFINITIONS
**Purpose:** TypeScript interfaces for video calling  
**Key Types:**
```typescript
interface CaptionMessage {
  topic: "caption";
  type: "sign" | "speech";
  text: string;
  isFinal: boolean;
  identity: string;  // participant identity
}
```

---

### FRONTEND - Configuration & Routing

#### 11. **frontend/src/app/routes.tsx**
**Purpose:** App routing configuration  
**Key Routes:**
- `/call/:roomId` - Video call page
- `/call-landing` - Call landing page

---

### FRONTEND - Authentication

#### 12. **frontend/src/app/context/AuthContext.tsx**
**Purpose:** User authentication state  
**Key Logic:**
- Supabase authentication
- Session management
- User identity for participant names

---

## 🔧 BACKEND - Video Call Logic

### Backend - Main Router

#### 13. **backend/app/VideoCall/router_pytorch.py** ⭐ MAIN BACKEND
**Lines:** ~200+ lines  
**Purpose:** FastAPI router for video calling and sign detection  
**Key Endpoints:**
- `POST /meetings/create` - Create new room
- `POST /meetings/{room_id}/token` - Get LiveKit token
- `POST /meetings/{room_id}/join` - Join existing room
- `WebSocket /meetings/ws/{room_id}/sign-detect` - Sign detection stream

**Key Logic:**
- LiveKit token generation with VideoGrants
- User authentication validation
- JWT token verification
- WebSocket connection handling
- Frame processing delegation to `PyTorchVideoStreamHandler`
- Error handling and logging

**Key Functions:**
- `get_current_user()` - Extract user from bearer token
- `get_current_user_websocket()` - Extract user from WebSocket token
- `create_meeting()` - Create room
- `get_room_token()` - Generate LiveKit token
- `websocket_sign_detect()` - WebSocket handler ⭐

**Security:**
- Bearer token validation
- Supabase auth integration
- WebSocket token authentication

---

#### 14. **backend/app/VideoCall/router.py**
**Purpose:** Original/alternative video call routes  
**Key Logic:**
- Room creation
- Token generation
- User authentication

---

#### 15. **backend/app/VideoCall/router_enhanced.py**
**Purpose:** Enhanced video call features  
**Key Logic:**
- Extended video call functionality

---

### Backend - Video Processing

#### 16. **backend/app/services/pytorch_video_handler.py** ⭐ VIDEO PROCESSOR
**Lines:** ~200+ lines  
**Purpose:** Handle video streaming and sign recognition  
**Key Logic:**
- WebSocket frame queue management
- Background frame processing
- MediaPipe Holistic pose detection
- PyTorch sign model inference
- Prediction buffering (32 frames)
- Frame rate normalization
- Automatic disconnection on timeout (30s idle)
- Backpressure handling (drop oldest frames if queue full)

**Key Class:**
- `PyTorchVideoStreamHandler` - Manages connections and processing

**Key Functions:**
- `handle_connection()` - Main WebSocket handler
- `reader()` - Async frame reader
- Frame processing pipeline

**Features:**
- Thread-safe processing
- Automatic model loading
- Idle timeout detection
- Graceful disconnection

---

#### 17. **backend/app/services/pytorch_sign_recognizer.py** ⭐ SIGN RECOGNITION
**Lines:** ~250+ lines  
**Purpose:** PyTorch model inference for sign recognition  
**Key Logic:**
- Model ensemble (multiple models for accuracy)
- Holistic landmark detection (pose + hands + face)
- Frame buffering (32 frames per sign)
- Confidence scoring
- Top-3 predictions
- Processing time tracking

**Key Classes:**
- `SignModelEnsemble` - Multiple model voting
- `SignSession` - Per-connection sign buffer and state

**Key Functions:**
- `process_frame()` - Process single frame
- `get_prediction()` - Get ensemble prediction
- `reset()` - Clear buffer

**Features:**
- Automatic framework detection (PyTorch vs ONNX)
- Graceful fallback handling
- Ensemble voting for robustness

---

## 📊 INTEGRATION SUMMARY

### Video Calling Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND - User Interface                                       │
├─────────────────────────────────────────────────────────────────┤
│ VideoCall.tsx (main page)                                       │
│ ├─ CallControls.tsx (bottom bar)                              │
│ │  ├─ onToggleSign → setSignMode                            │
│ │  └─ onLeave → room.disconnect()                           │
│ └─ ParticipantVideoTile.tsx (each participant)                │
│    ├─ useSignDetectionWebSocket (if sign mode enabled)        │
│    ├─ useSpeechCaptions (if speech mode enabled)              │
│    └─ Displays captions from all participants                 │
│                                                                 │
│ Caption Broadcasting: useSignDetectionWebSocket.ts             │
│ ├─ WebSocket connection to backend                            │
│ ├─ Frame capture (30 FPS)                                     │
│ ├─ Send to: ws://localhost:8000/meetings/ws/{room_id}/...    │
│ └─ Receive predictions → broadcast() via publishData()        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ↕ WebSocket & LiveKit Data Channel
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND - Processing                                            │
├─────────────────────────────────────────────────────────────────┤
│ router_pytorch.py                                               │
│ ├─ POST /meetings/create → Generate room_id                    │
│ ├─ POST /meetings/{room_id}/token → Generate LiveKit token    │
│ └─ WS /meetings/ws/{room_id}/sign-detect                      │
│    └─ websocket_sign_detect()                                 │
│       ├─ Authenticate user                                    │
│       ├─ Create PyTorchVideoStreamHandler                     │
│       └─ Call handler.handle_connection()                     │
│                                                                 │
│ pytorch_video_handler.py                                        │
│ ├─ Queue incoming frames                                      │
│ ├─ Process frames in background                               │
│ ├─ Call SignSession.process_frame()                           │
│ └─ Send predictions back to client                            │
│                                                                 │
│ pytorch_sign_recognizer.py                                      │
│ ├─ Detect hand poses via MediaPipe                            │
│ ├─ Extract landmarks                                          │
│ ├─ Buffer 32 frames                                           │
│ ├─ Run through ensemble models                                │
│ └─ Return sign + confidence                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ↕ LiveKit SDK (Video, Audio, Data)
┌─────────────────────────────────────────────────────────────────┐
│ LIVEKIT SERVER                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ├─ Route video/audio between participants                     │
│ ├─ Deliver data messages (captions)                           │
│ └─ Manage participant list                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 KEY FILES FOR COMPLETE INTEGRATION

### If you want to modify video calling, focus on these CORE files:

**Frontend (7 files):**
1. `VideoCall.tsx` - Main page & caption handling
2. `CallControls.tsx` - Control bar & mode toggles
3. `ParticipantVideoTile.tsx` - Participant display
4. `useSignDetectionWebSocket.ts` - Sign capture & broadcast ⭐
5. `useSpeechCaptions.ts` - Speech capture & broadcast ⭐
6. `video.ts` - Types & interfaces
7. `CallEndIcon.tsx` - UI icon

**Backend (3 files):**
1. `router_pytorch.py` - API endpoints & WebSocket ⭐
2. `pytorch_video_handler.py` - Frame processing ⭐
3. `pytorch_sign_recognizer.py` - Model inference ⭐

**Total: 10 files with core logic**

---

## 📝 FILE SIZES & COMPLEXITY

| File | Lines | Complexity | Purpose |
|------|-------|-----------|---------|
| VideoCall.tsx | 350+ | HIGH | Main page |
| useSignDetectionWebSocket.ts | 280+ | HIGH | Sign capture |
| useSpeechCaptions.ts | 150+ | MEDIUM | Speech capture |
| ParticipantVideoTile.tsx | 250+ | HIGH | Display |
| CallControls.tsx | 180+ | MEDIUM | Controls |
| pytorch_video_handler.py | 200+ | HIGH | Processing |
| pytorch_sign_recognizer.py | 250+ | HIGH | ML inference |
| router_pytorch.py | 200+ | MEDIUM | API |

---

## 🎯 CRITICAL MODIFICATIONS MADE

### Captions Broadcasting Fix
**Files Modified:**
1. `useSignDetectionWebSocket.ts` - Added `destinationIdentities`
2. `useSpeechCaptions.ts` - Added `destinationIdentities` (2 locations)
3. `VideoCall.tsx` - Enhanced logging

**What Was Fixed:**
- Captions now broadcast to ALL participants
- Works correctly with 3+ people in call
- Explicit destination routing

---

## 🚀 HOW VIDEO CALLING WORKS (Step by Step)

### 1. User Joins Room
```
User clicks "Join Room" 
→ VideoCallLanding.tsx captures room code
→ Navigates to /call/{roomId}
→ VideoCall.tsx fetches token from /meetings/{roomId}/token
→ LiveKit room connects
```

### 2. User Enables Sign Mode
```
User clicks "Sign" button
→ CallControls.tsx → onToggleSign() → setSignMode(true)
→ ParticipantVideoTile.tsx detects signMode=true
→ useSignDetectionWebSocket hook activates
→ WebSocket connects to ws://localhost:8000/meetings/ws/{roomId}/...
→ Video frames start capturing at 30 FPS
```

### 3. Sign Detection Happens
```
Frame captured → Base64 encoded → Sent to backend
Backend receives → pytorch_video_handler.py processes
→ pytorch_sign_recognizer.py runs inference (32 frame buffer)
→ Returns prediction with confidence score
→ If confidence > 0.75:
   └─ Prediction sent back to frontend
```

### 4. Caption Broadcast
```
Frontend receives prediction
→ useSignDetectionWebSocket calls broadcast()
→ Creates CaptionMessage with identity & text
→ Calls publishData() with destinationIdentities = [all remote participants]
→ LiveKit server routes message to each participant
→ Each participant's VideoCall.tsx receives via RoomEvent.DataReceived
→ Caption displayed in ParticipantVideoTile for 4 seconds
```

### 5. Other Participants See Caption
```
Remote participant A receives caption message
→ handleData() in VideoCall.tsx processes it
→ setCaptions() updates state with sender's identity
→ ParticipantVideoTile for sender A displays caption
→ Auto-clears after 4 seconds or next caption arrives
```

---

## 💾 STORAGE & CACHING

**No persistent storage for captions** - All captions are:
- In-memory state only
- Cleared when caption expires (4 sec)
- Not saved to database
- Not persisted across sessions

---

## 🔐 SECURITY & AUTHENTICATION

**Authentication Layers:**
1. Supabase JWT token (user login)
2. Bearer token in `/meetings/{roomId}/token` request
3. JWT token in WebSocket URL query params
4. LiveKit access token with VideoGrants (room-specific)

---

This is the complete video calling integration! All these files work together to provide real-time video calling with live caption translation. 🎯
