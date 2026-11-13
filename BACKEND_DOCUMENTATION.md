
---

## MAIN.PY WORKFLOW - DETAILED EXECUTION FLOW

### Application Startup Sequence

When you run `python main.py`, the following happens step-by-step:

```
1. ENCODING FIX (Lines 3-8)
   └─ Check console encoding (Windows compatibility)
   └─ If not UTF-8, reconfigure stdout/stderr
   └─ Prevents emoji/unicode crashes

2. IMPORTS (Lines 10-16)
   ├─ Import FastAPI and CORS middleware
   ├─ Import all routers
   ├─ Chatbot router (sign dictionary)
   ├─ Auth router (login/signup)
   ├─ SignRecognition router (hand sign detection)
   ├─ Emotion router (text emotion analysis)
   ├─ Activity router (dashboard tracking)
   ├─ Reviews router (testimonials)
   └─ Grammar router (sentence correction)

3. VIDEOCALL ROUTER CHECK (Lines 18-24)
   ├─ Try to import app.VideoCall.router_pytorch
   ├─ If exists: _has_video_call = True
   ├─ If missing: _has_video_call = False
   └─ Allows optional features

4. FASTAPI INITIALIZATION (Lines 26-27)
   ├─ Create FastAPI app instance
   ├─ Set title: SignTalk API
   └─ Set version: 1.0.0

5. CORS MIDDLEWARE (Lines 29-40)
   ├─ Add CORS middleware to app
   ├─ Allow origins: localhost:5173, localhost:5174, 127.0.0.1:5173, etc.
   ├─ Allow all methods (GET, POST, DELETE, etc.)
   └─ Allow all headers (JWT tokens, Content-Type, etc.)

6. ROUTER REGISTRATION (Lines 42-52)
   ├─ Include auth router (/api/auth/*)
   ├─ Include chatbot router (/chatbot/*)
   ├─ Include sign recognition (/sign/*)
   ├─ Include emotion router (/emotion/*)
   ├─ Include activity router (/progress/*)
   ├─ Include reviews router (/reviews/*)
   ├─ Include grammar router (/grammar/*)
   └─ Conditionally include video call (/meetings/*)

7. STARTUP EVENT (Lines 55-58)
   ├─ Register on_event startup handler
   └─ Call init_schema() to initialize database

8. ROOT ENDPOINT (Lines 61-63)
   ├─ Define GET / endpoint
   └─ Returns health check message

9. SERVER START (Lines 66-68)
   ├─ Check if script is main
   └─ Start Uvicorn on 0.0.0.0:8000
```

---

### Request/Response Lifecycle Example

Scenario: User uploads image for sign recognition

```
CLIENT REQUEST
  |
  v
POST /sign/predict with base64 image
  |
  v
FASTAPI ROUTER DISPATCH
  |
  v
app/SignRecognition/router.py - predict() function
  ├─ Decode base64 image
  ├─ Convert BGR to RGB
  ├─ Load MediaPipe HandLandmarker
  ├─ Detect 21 hand landmarks
  ├─ Extract 63 features (wrist-relative normalized)
  ├─ Load Random Forest model
  ├─ predict_proba() to get all class probabilities
  ├─ argmax() to find best class
  ├─ label_encoder to convert to class name
  └─ Return PredictResponse with label + confidence
  |
  v
FASTAPI JSON ENCODER
  |
  v
HTTP RESPONSE 200 OK
  |
  v
CLIENT displays prediction
```

---

## ENVIRONMENT CONFIGURATION

### .env File Requirements

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection (for direct Postgres access)
DATABASE_URL=postgresql://postgres:password@db.url:5432/postgres

# LiveKit Video Calling
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_URL=wss://your-livekit.url
```

---

## ARCHITECTURE DIAGRAM

```
Browser/Mobile App (React Frontend)
        |
        | HTTP JSON Requests
        v
FastAPI Server (main.py)
        |
        +-- /api/auth/*      -> Authentication
        +-- /sign/*          -> Sign Recognition
        +-- /emotion/*       -> Emotion Detection
        +-- /grammar/*       -> Grammar Correction
        +-- /progress/*      -> Activity Tracking
        +-- /reviews/*       -> Testimonials
        +-- /chatbot/*       -> Sign Dictionary
        +-- /meetings/*      -> Video Calling
        |
        +-- Supabase DB (PostgreSQL)
        |   ├─ activity_events
        |   ├─ favorites
        |   ├─ reviews
        |   └─ Row-Level Security policies
        |
        +-- ML Models
            ├─ SignNet (PyTorch LSTM)
            ├─ Random Forest (hand signs)
            ├─ DistilRoBERTa (emotions)
            ├─ T5 (grammar correction)
            └─ WLASL Dataset (sign videos)
```

---

## TESTING ENDPOINTS

Health Checks:
```bash
curl http://localhost:8000/
curl http://localhost:8000/sign/health
curl http://localhost:8000/chatbot/health
curl http://localhost:8000/meetings/health
```

Sign Prediction:
```bash
curl -X POST http://localhost:8000/sign/predict \
  -H "Content-Type: application/json" \
  -d "{\\"image\\": \\"data:image/png;base64,iVBORw0KGgo...\\"}"
```

Emotion Detection:
```bash
curl -X POST http://localhost:8000/emotion/detect \
  -H "Content-Type: application/json" \
  -d "{\\"text\\": \\"I am so happy today!\\"}"
```

Grammar Correction:
```bash
curl -X POST http://localhost:8000/grammar/correct \
  -H "Content-Type: application/json" \
  -d "{\\"text\\": \\"I HUNGRY WHERE BATHROOM\\"}"
```

---

## COMMON ERRORS & SOLUTIONS

| Error | Cause | Solution |
|-------|-------|----------|
| FileNotFoundError: sign model not found | Model file missing | Download to app/SignRecognition/ |
| ValueError: SUPABASE_URL must be set | Missing .env | Add Supabase keys to backend/.env |
| Activity schema init failed | DATABASE_URL missing | Add DATABASE_URL to .env |
| app.VideoCall not found | VideoCall module missing | Create backend/app/VideoCall/__init__.py |
| Emotion model loading failed | Transformers not installed | pip install -r requirements.txt |
| hand_landmarker.task not found | MediaPipe model missing | Will auto-download on first run |

---

## VIVA VOCE PREPARATION CHECKLIST

### Architecture & Design
- How main.py initializes FastAPI app
- Why CORS middleware is needed
- Router registration pattern
- VideoCall router conditional loading
- Database schema (tables, indexes, RLS)
- Row-Level Security implementation

### Feature Modules
- Authentication flow (signup → JWT)
- Sign recognition pipeline (image → landmarks → model → class)
- Emotion detection (text → DistilRoBERTa → 7 emotions)
- Grammar correction (sign output → T5 → fluent sentence)
- Activity tracking (events → dashboard stats)
- Video calling with LiveKit integration

### Machine Learning
- SignNet architecture (Bidirectional LSTM)
- Feature extraction (wrist-relative normalized landmarks)
- Data augmentation (rotation, scaling, noise, time warping)
- Ensemble prediction (5 models averaged)
- MediaPipe for pose/hand detection

### Database & Security
- Supabase authentication (email/password, JWT)
- Two-tier client pattern (anon vs admin)
- RLS policies (user data isolation)
- Database initialization on startup
- Activity and favorites logging

### API Design
- RESTful endpoint design
- Pydantic models for validation
- Bearer token authentication
- Error handling (HTTPException)
- CORS handling

### Deployment
- Python dependencies in requirements.txt
- .env configuration (no secrets in code)
- Uvicorn server configuration
- verify_setup.py usage
- Windows UTF-8 encoding fix

### Performance
- Model loading at startup (not per-request)
- Batch inference for multiple frames
- Database indexing strategy
- WebSocket for real-time video
- WLASL dataset optimization

