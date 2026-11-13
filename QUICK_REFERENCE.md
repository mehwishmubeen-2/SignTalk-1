# SignTalk Backend - Quick Reference Guide

## 🚀 Quick Start

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment (.env file)
# Add: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, LIVEKIT credentials

# 4. Verify setup
python verify_setup.py

# 5. Start server
python main.py
# Server runs on http://localhost:8000
```

---

## 📂 File Organization

| File | Purpose | Lines |
|------|---------|-------|
| **main.py** | FastAPI initialization | 77 |
| **common.py** | SignNet model & preprocessing | ~100 |
| **extract.py** | Video feature extraction | ~50 |
| **verify_setup.py** | Dependency checking | ~100 |
| **requirements.txt** | Python packages | 18 |

---

## 🔌 API Endpoints (30+)

### Authentication
```
POST   /api/auth/signup                 - Register user
POST   /api/auth/login                  - Login (returns JWT)
POST   /api/auth/logout                 - Logout
POST   /api/auth/reset-password         - Password reset
DELETE /api/auth/delete-account         - Delete account
```

### Sign Recognition
```
GET    /sign/health                     - Health check + classes
POST   /sign/predict                    - Predict sign from image
```

### Emotion Detection
```
POST   /emotion/detect                  - Classify emotion from text
```

### Grammar Correction
```
POST   /grammar/correct                 - Fix sign-to-text grammar
```

### Activity & Dashboard
```
POST   /progress/events                 - Log activity
GET    /progress/dashboard              - Dashboard stats
GET    /progress/favorites              - List favorites
POST   /progress/favorites              - Add favorite
DELETE /progress/favorites/{word}       - Remove favorite
```

### Reviews
```
GET    /reviews/public                  - Public reviews
GET    /reviews/mine                    - My reviews
POST   /reviews                         - Create review
PUT    /reviews/{id}                    - Update review
DELETE /reviews/{id}                    - Delete review
```

### Sign Dictionary
```
GET    /chatbot/health                  - Health check
GET    /chatbot/search?q=<text>         - Search signs
GET    /chatbot/suggest?q=<prefix>      - Autocomplete
GET    /chatbot/word/{word}             - Get sign details
GET    /chatbot/video/{id}              - Stream video
GET    /chatbot/vocab/count             - Vocabulary size
```

### Video Calling
```
POST   /meetings/create                 - Create meeting room
POST   /meetings/token                  - Get access token
GET    /meetings/health                 - Health check
WS     /meetings/ws                     - WebSocket stream
```

---

## 🗄️ Database Schema

### activity_events
```sql
id (BIGSERIAL), user_id (UUID), event_type (TEXT),
metadata (JSONB), created_at (TIMESTAMPTZ)
-- Types: ai_query, video_call, sign_practiced, voice_to_text
```

### favorites
```sql
id (BIGSERIAL), user_id (UUID), word (TEXT),
created_at (TIMESTAMPTZ)
-- UNIQUE(user_id, word)
```

### reviews
```sql
id (BIGSERIAL), user_id (UUID), name (TEXT),
role (TEXT), rating (SMALLINT 1-5), text (TEXT),
created_at, updated_at (TIMESTAMPTZ)
```

---

## 🤖 ML Components

| Component | Type | Purpose |
|-----------|------|---------|
| **SignNet** | PyTorch LSTM | Video sequence classification |
| **Random Forest** | Scikit-learn | Single-frame hand sign detection |
| **DistilRoBERTa** | HuggingFace | Emotion classification (7 classes) |
| **T5** | HuggingFace | Grammar correction |

---

## 🔐 Authentication Pattern

```python
# Client sends JWT in header
Authorization: Bearer <token>

# Server extracts token
def get_current_user(authorization: str = Header()):
    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)
    return user.id
```

---

## 📊 Data Flow Examples

### Image Recognition Flow
```
Browser/App
    ↓ (POST /sign/predict with base64)
FastAPI
    ↓
Sign Recognition Router
    ├─ Decode image
    ├─ Detect hand landmarks (MediaPipe)
    ├─ Extract features
    ├─ Load Random Forest model
    └─ Predict class
    ↓
Return PredictResponse (label, confidence, landmarks)
    ↓
Browser displays result
```

### Activity Logging Flow
```
User practices a sign
    ↓
Frontend: POST /progress/events
    {
      event_type: "sign_practiced",
      metadata: {sign: "hello"}
    }
    ↓
Activity Router
    ├─ Extract user from JWT
    ├─ Insert into activity_events table
    └─ Return {ok: true}
    ↓
Dashboard query aggregates stats
    ├─ Count unique signs
    ├─ Count events per type
    ├─ Calculate last 7 days
    └─ Return dashboard data
```

---

## ⚙️ Environment Variables

```env
# Required
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=anon_public_key
SUPABASE_SERVICE_ROLE_KEY=service_role_key

# Optional but recommended
DATABASE_URL=postgresql://user:pass@host:5432/db
LIVEKIT_API_KEY=key
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=wss://livekit.example.com
```

---

## 🧪 Testing Commands

```bash
# Health check
curl http://localhost:8000/

# Sign health
curl http://localhost:8000/sign/health

# Predict sign (with real base64 image)
curl -X POST http://localhost:8000/sign/predict \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/png;base64,..."}'

# Detect emotion
curl -X POST http://localhost:8000/emotion/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"I am happy"}'

# Fix grammar
curl -X POST http://localhost:8000/grammar/correct \
  -H "Content-Type: application/json" \
  -d '{"text":"I HUNGRY"}'

# Search sign
curl "http://localhost:8000/chatbot/search?q=hello"

# Autocomplete
curl "http://localhost:8000/chatbot/suggest?q=hel"
```

---

## 🐛 Common Issues

| Issue | Fix |
|-------|-----|
| Model not found | Check app/SignRecognition/ has model files |
| SUPABASE_KEY error | Add to backend/.env |
| Database init failed | Add DATABASE_URL to .env |
| CORS blocked | Ensure client origin in app/main.py |
| VideoCall disabled | Create app/VideoCall/__init__.py |
| Model slow | Check GPU available (torch.cuda.is_available()) |

---

## 📋 Viva Voce Topics

- [ ] main.py startup sequence (9 steps)
- [ ] Router registration and CORS
- [ ] Database schema and RLS
- [ ] Authentication JWT flow
- [ ] SignNet architecture (LSTM)
- [ ] Feature extraction pipeline
- [ ] Sign prediction flow
- [ ] Emotion detection model
- [ ] Grammar correction (T5)
- [ ] Activity tracking & aggregation
- [ ] Reviews CRUD operations
- [ ] Sign dictionary search
- [ ] Video calling with LiveKit
- [ ] Error handling patterns
- [ ] Performance optimization

---

## 📞 File-by-File Checklist

- [ ] **main.py** - Can explain all 9 startup stages
- [ ] **common.py** - Know SignNet architecture, prep(), augment()
- [ ] **extract.py** - Understand video_to_seq() normalization
- [ ] **verify_setup.py** - Know what it checks (5 areas)
- [ ] **auth.py** - Explain signup/login/delete-account
- [ ] **supabase.py** - Know difference between clients (anon vs admin)
- [ ] **schema.py** - Know 3 tables and RLS policies
- [ ] **SignRecognition/router.py** - Explain model loading & prediction
- [ ] **emotion/router.py** - Know DistilRoBERTa model
- [ ] **grammar/router.py** - Explain T5 correction process
- [ ] **activity/router.py** - Know dashboard aggregation logic
- [ ] **reviews/router.py** - Explain CRUD + display_name()
- [ ] **Chatbot/routes.py** - Know WLASL dataset + search logic
- [ ] **VideoCall/router_pytorch.py** - Explain room creation + tokens

---

## 🎯 One-Liner Explanations

- **main.py**: "Initializes FastAPI, registers 8 routers, sets CORS, starts Uvicorn on port 8000"
- **common.py**: "Defines SignNet LSTM (256 hidden units, bidirectional) for sequence classification"
- **extract.py**: "Converts videos to 32-frame sequences with MediaPipe landmarks, normalized to shoulder"
- **auth.py**: "Handles signup/login/logout using Supabase JWT tokens"
- **schema.py**: "Creates activity_events, favorites, reviews tables with RLS policies"
- **SignRecognition**: "Random Forest on 63 wrist-relative hand features, 11 ASL signs"
- **emotion**: "DistilRoBERTa classification into 7 emotions (joy, sadness, anger, etc.)"
- **grammar**: "T5 seq2seq model converts telegraphic sign output to fluent English"
- **activity**: "Logs events, calculates dashboard stats (signs, calls, time, queries)"
- **reviews**: "CRUD for user testimonials, public list + private user reviews"
- **Chatbot**: "Full-text search on WLASL dataset, fuzzy matching, autocomplete"
- **VideoCall**: "LiveKit rooms with WebSocket stream + real-time SignNet inference"

---

## 💡 Study Tips

1. **Start with main.py** - It's the entry point, connects everything
2. **Understand the flow** - Request comes in → router handles → database/model → response
3. **Learn the models** - SignNet, Random Forest, DistilRoBERTa, T5
4. **Know the database** - 3 tables, RLS policies, indexes
5. **Practice explaining** - Can you describe each file in 1 minute?
6. **Draw diagrams** - Architecture, data flow, request lifecycle
7. **Test endpoints** - Use curl to test each endpoint
8. **Read error messages** - Understand what each common error means
9. **Know .env requirements** - What each variable does
10. **Explain design choices** - Why FastAPI? Why Supabase? Why ensemble models?

