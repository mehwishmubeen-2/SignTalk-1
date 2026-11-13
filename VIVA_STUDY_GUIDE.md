# SignTalk Backend - Viva Study Guide

## 🎓 What You Need to Know for Your Viva

This guide covers everything your examiners might ask about the backend.

---

## 1️⃣ APPLICATION STARTUP (main.py)

### Question: "What happens when you run `python main.py`?"

**Answer (9 Steps):**
1. **Encoding Fix** - Windows UTF-8 encoding (prevents emoji crashes)
2. **Imports** - Load FastAPI, middleware, and all 8 routers
3. **VideoCall Check** - Try to import router_pytorch (optional feature)
4. **FastAPI Init** - Create app instance with metadata
5. **CORS Setup** - Allow localhost:5173/5174/3000/5001 for frontend
6. **Register Routers** - Add all 8 routers with their prefixes (/api/auth, /sign, etc.)
7. **Startup Event** - Register on_startup handler to call init_schema()
8. **Define Root** - GET / returns health message
9. **Start Server** - Uvicorn listens on 0.0.0.0:8000

---

## 2️⃣ CORE ARCHITECTURE

### Question: "How is the backend organized?"

**Answer:**
- **Modular design**: Each feature is its own router (ChatBot, SignRecognition, Emotion, etc.)
- **8 Routers**: auth, chatbot, sign, emotion, grammar, activity, reviews, videoCall
- **Database layer**: Supabase with PostgreSQL
- **ML services**: PyTorch, scikit-learn, HuggingFace transformers
- **API style**: RESTful with JSON, Bearer token auth

### Question: "Why use routers instead of one big file?"

**Answer:**
- Separation of concerns
- Each feature can be developed independently
- Easier testing and debugging
- Can conditionally disable features (e.g., VideoCall)
- Cleaner code structure

---

## 3️⃣ FASTAPI & FRAMEWORKS

### Question: "Why FastAPI instead of Django/Flask?"

**Answer:**
- **Fast** - Built on Starlette (ASGI), very performant
- **Modern** - Python 3.6+ type hints, automatic API docs
- **Async** - WebSocket support for real-time video
- **Easy** - Minimal boilerplate
- **AutoDocs** - Built-in Swagger UI at /docs

### Question: "What does CORS middleware do?"

**Answer:**
- Allows cross-origin requests from frontend (localhost:5173, etc.)
- Without it, browser blocks requests from different ports
- Configures: allowed origins, methods (GET/POST/etc.), headers

---

## 4️⃣ AUTHENTICATION FLOW

### Question: "How does user authentication work?"

**Answer:**
```
1. User enters email/password
2. POST /api/auth/login
3. Backend calls supabase.auth.sign_in_with_password()
4. Supabase returns JWT token + refresh token
5. Frontend stores token in localStorage
6. For future requests: Header: "Authorization: Bearer <token>"
7. Backend validates token: supabase.auth.get_user(token)
8. If valid → user_id extracted
9. If invalid → 401 Unauthorized
```

### Question: "What's the difference between `supabase` and `supabase_admin`?"

**Answer:**
- **supabase** (anon key): Respects Row-Level Security (RLS)
  - User can only see their own data
  - Frontend uses this
- **supabase_admin** (service role): Bypasses RLS
  - Server can insert/query all users' data
  - Only backend should use this
  - More secure than putting service key in frontend

---

## 5️⃣ DATABASE SCHEMA

### Question: "What tables do you have?"

**Answer:**
1. **activity_events** - User actions (signs practiced, videos watched, etc.)
   - Fields: id, user_id, event_type, metadata (JSON), created_at
   - Index on user_id + created_at for fast dashboard queries

2. **favorites** - User favorite signs/words
   - Fields: id, user_id, word, created_at
   - Unique constraint on (user_id, word)

3. **reviews** - User testimonials for home page
   - Fields: id, user_id, name, role, rating (1-5), text, created_at
   - Public read, user can write own

### Question: "How does Row-Level Security work?"

**Answer:**
```sql
-- policy: users can only see own records
CREATE POLICY activity_events_owner ON activity_events
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- policy: reviews are public read
CREATE POLICY reviews_public_read ON reviews
FOR SELECT USING (true);
```
- `auth.uid()` = current user from JWT token
- USING = read permission
- WITH CHECK = write permission

---

## 6️⃣ SIGN RECOGNITION (ML)

### Question: "How does sign recognition work?"

**Answer:**
```
1. Frontend sends base64 image
2. POST /sign/predict
3. Decode image → numpy array (H, W, 3)
4. MediaPipe HandLandmarker detects 21 hand landmarks (x, y, z)
5. Extract features:
   - Get 21 landmarks × 3 coordinates = 63 values
   - Subtract wrist position (coords[0]) → wrist-relative
   - Divide by max value → normalized (-1 to 1)
6. Load Random Forest model
7. predict_proba([63_features]) → probabilities across 11 classes
8. argmax() → best class
9. label_encoder → convert to name (e.g., "hello")
10. Return: {label, confidence, landmarks}
```

### Question: "Why normalize features?"

**Answer:**
- Hand position varies (person can move)
- Hand size varies (different people)
- Rotation varies (different angles)
- Normalization makes features invariant to these variations
- Model becomes more robust and generalizable

### Question: "What are the 11 sign classes?"

**Answer:**
1. hello
2. bye
3. how_are_you
4. i_am_fine
5. i_dont_know
6. i_know
7. nice_to_meet_you
8. no_sign (no hand detected)
9. see_you_later
10. what_is_your_name
11. whats_up

---

## 7️⃣ SIGNNET (DEEP LEARNING MODEL)

### Question: "What is SignNet? How does it work?"

**Answer:**
```python
class SignNet(nn.Module):
    def __init__(self, d_in=D_IN, n_cls=len(classes)):
        self.lstm = nn.LSTM(
            d_in,           # Input: feature vector
            128,            # Hidden size: 128 units
            num_layers=2,   # 2 stacked LSTM layers
            bidirectional=True,  # Read forward AND backward
            dropout=0.3     # Dropout for regularization
        )
        self.head = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(256, n_cls)  # 256 = 128*2 (bidirectional)
        )
```

**Why LSTM?**
- Sign language is sequential (time-dependent)
- Bidirectional LSTM sees past AND future frames
- Good for capturing hand motion patterns

**Input shape:**
- (Batch, Time=32 frames, Features=198)
- 32 frames = normalized video length
- 198 = pose + hand features + velocities

**Output:**
- (Batch, num_classes=11)
- Softmax → probabilities

---

## 8️⃣ EMOTION DETECTION

### Question: "How does emotion detection work?"

**Answer:**
- Model: **j-hartmann/emotion-english-distilroberta-base** (HuggingFace)
- Input: Text string
- Process:
  1. Tokenize text
  2. Pass through DistilRoBERTa encoder
  3. Softmax over 7 emotion classes
  4. Return top emotion + confidence
- **7 emotions**: joy, sadness, anger, neutral, disgust, fear, surprise
- **Returns**: code, label, emoji, color, score (0-100)

### Question: "Why DistilRoBERTa?"

**Answer:**
- **Distilled** = smaller, faster than RoBERTa
- Pre-trained on English text
- Good at emotion classification
- Runs locally on CPU (no API needed)

---

## 9️⃣ GRAMMAR CORRECTION

### Question: "How does grammar correction work?"

**Answer:**
```
Input:  "I HUNGRY WHERE BATHROOM"
Process:
  1. Lowercase: "i hungry where bathroom"
  2. Prefix: "grammar: i hungry where bathroom"
  3. T5 encoder-decoder generates correction
  4. Post-process:
     - Capitalize first letter
     - Add period if missing
Output: "I'm hungry. Where is the bathroom?"
```

### Question: "Why this particular T5 model?"

**Answer:**
- **vennify/t5-base-grammar-correction**
- Makes minimal edits (doesn't hallucinate)
- Other models like pszemraj/grammar-synthesis-small hallucinate badly
- Faithful corrections for short telegraphic input

---

## 🔟 ACTIVITY TRACKING & DASHBOARD

### Question: "How does the dashboard work?"

**Answer:**
```
1. Log events:
   POST /progress/events with event_type + metadata

2. Event types:
   - ai_query: Looked up word in dictionary
   - video_call: Participated in video call (duration tracked)
   - sign_practiced: Learned a new sign
   - voice_to_text: Used voice-to-text feature

3. Dashboard aggregation:
   - Query all events for current user
   - Count unique signs learned (all-time + this week)
   - Count video calls (all-time + this week)
   - Count AI queries (all-time + this week)
   - Sum total time (all-time + this week)
   - Calculate daily minutes (last 7 days)
   - Show recent activity (last 5 events)
   - Calculate feature usage % (pie chart)

4. Return JSON with:
   - stats (4 counters with trends)
   - weekly_activity (7 bars with colors)
   - feature_usage (pie chart data)
   - recent_activity (list of recent events)
```

### Question: "Why track activity?"

**Answer:**
- Motivate users (see progress)
- Identify popular features
- Personalize recommendations
- A/B testing
- Analytics for project analysis

---

## 1️⃣1️⃣ API DESIGN PATTERNS

### Question: "How do you design your APIs?"

**Answer:**
```
1. RESTful principles:
   - Resources have nouns: /reviews, /progress, /sign
   - HTTP methods: GET (read), POST (create), PUT (update), DELETE (delete)
   - Status codes: 200 (OK), 201 (created), 400 (bad request), 401 (auth), 404 (not found)

2. Request validation (Pydantic):
   class AuthRequest(BaseModel):
       email: EmailStr
       password: str
   # Automatic validation + error messages

3. Response models (Pydantic):
   class PredictResponse(BaseModel):
       hand_detected: bool
       label: str | None
       confidence: float
       landmarks: list[Landmark]
   # Automatic JSON serialization + swagger docs

4. Authentication:
   - Bearer token in Authorization header
   - Dependency injection: @Depends(get_current_user)
   - Automatic 401 if missing/invalid

5. Error handling:
   raise HTTPException(status_code=400, detail="message")
   # Returns {detail: "message"}
```

---

## 1️⃣2️⃣ REAL-TIME VIDEO CALLING

### Question: "How does video calling with sign detection work?"

**Answer:**
1. **Room Creation**: POST /meetings/create → get room_id
2. **Token Generation**: POST /meetings/token → get LiveKit token + URL
3. **WebSocket Connection**: Client connects to /meetings/ws with token
4. **Live Processing**:
   - Receive video frames from WebSocket
   - Extract landmarks (MediaPipe Holistic)
   - Feed to SignNet ensemble (5 models)
   - Average predictions
   - Send detected signs back to client (JSON messages)
5. **Low Latency**: WebSocket for real-time communication
6. **Scalability**: LiveKit handles video routing, backend only processes signdetection

---

## 1️⃣3️⃣ DEPLOYMENT & CONFIGURATION

### Question: "What's in the .env file and why?"

**Answer:**
```env
# Database (Required)
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=public_anon_key
SUPABASE_SERVICE_ROLE_KEY=service_role_key
# Why: Authenticate with Supabase, use different keys for different security levels

# Database Connection (Optional)
DATABASE_URL=postgresql://...
# Why: Direct Postgres for schema initialization (PostgREST can't run DDL)

# Video Calling (Optional)
LIVEKIT_API_KEY=key
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=wss://livekit.url
# Why: LiveKit configuration for video meeting rooms
```

### Question: "Why not put secrets in code?"

**Answer:**
- Security: Secrets shouldn't be in version control
- Flexibility: Different secrets for dev/prod
- Compliance: GDPR/SOC2 require this
- Accidents: Easy to accidentally commit secrets

---

## 1️⃣4️⃣ ERROR HANDLING

### Question: "What common errors might occur?"

**Answer:**

| Error | Cause | Solution |
|-------|-------|----------|
| FileNotFoundError: model not found | Model file missing | Check app/SignRecognition/ has .pkl file |
| ValueError: SUPABASE_URL must be set | Missing .env | Add SUPABASE_URL and SUPABASE_KEY |
| HTTPException 401: Invalid token | Expired/bad JWT | Frontend should refresh token |
| HTTPException 403: Not owner | User accessing other's data | RLS policy enforced |
| HTTPException 404: Review not found | ID doesn't exist | Check ID is valid |
| HTTPException 400: No image supplied | Empty request | Send valid base64 image |

---

## 1️⃣5️⃣ PERFORMANCE OPTIMIZATION

### Question: "How do you optimize performance?"

**Answer:**
1. **Model Loading at Startup**
   - Load models once when app starts
   - Reuse for every request
   - Avoid reload overhead

2. **Database Indexes**
   - Index on user_id (fast filtering)
   - Index on created_at (fast sorting)
   - Unique constraints prevent duplicates

3. **Batch Processing**
   - Accept multiple frames for multi-frame prediction
   - Stack features before inference

4. **Async/WebSocket**
   - FastAPI supports async handlers
   - WebSocket for real-time video (vs polling)

5. **Lazy Loading**
   - VideoCall router conditionally imported
   - Only load if available

6. **Dataset Optimization**
   - WLASL dataset: only words with videos
   - Custom entries for missing letters

---

## 1️⃣6️⃣ TESTING YOUR API

### Question: "How do you test the API?"

**Answer:**
```bash
# Health checks
curl http://localhost:8000/
curl http://localhost:8000/sign/health

# Test sign prediction
curl -X POST http://localhost:8000/sign/predict \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/png;base64,..."}'

# Test emotion
curl -X POST http://localhost:8000/emotion/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"I am happy"}'

# Test grammar
curl -X POST http://localhost:8000/grammar/correct \
  -H "Content-Type: application/json" \
  -d '{"text":"I HUNGRY"}'

# Test auth
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Test activity logging
curl -X POST http://localhost:8000/progress/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"sign_practiced","metadata":{"sign":"hello"}}'
```

---

## 🎯 LIKELY VIVA QUESTIONS

1. "Explain main.py startup" → 9 steps
2. "How many routers do you have?" → 8 routers
3. "What's your database schema?" → 3 tables
4. "How does sign recognition work?" → MediaPipe → RF model → class
5. "What ML models do you use?" → SignNet, RF, DistilRoBERTa, T5
6. "How is authentication implemented?" → JWT tokens
7. "What's Row-Level Security?" → Policy-based data isolation
8. "How does real-time video work?" → WebSocket + LiveKit
9. "Why FastAPI?" → Fast, modern, async, built-in docs
10. "How do you handle errors?" → HTTPException with status codes
11. "What's in your .env?" → Supabase keys, LiveKit credentials
12. "How do you optimize?" → Load models once, use indexes, batch processing
13. "Why these ML models?" → Suitable for task, balance speed/accuracy
14. "How does activity tracking work?" → Log events, aggregate for dashboard
15. "Explain router registration" → Include with prefix, auto-docs

---

## 📝 Practice Answers

### "Tell me about your backend architecture"

**Good Answer:**
"The backend is built with FastAPI and uses a modular architecture with 8 routers, each handling a different feature: authentication, sign recognition, emotion detection, grammar correction, activity tracking, reviews, dictionary search, and video calling. The data layer uses Supabase PostgreSQL with 3 tables: activity_events for tracking user actions, favorites for bookmarks, and reviews for testimonials. All tables have Row-Level Security to ensure users only access their own data.

The machine learning components use 4 models: SignNet (PyTorch LSTM for video sequences), Random Forest (for single-frame hand signs), DistilRoBERTa (for emotion classification), and T5 (for grammar correction). These are loaded at startup to avoid latency on each request.

The API is RESTful with JSON requests/responses, uses JWT bearer tokens for authentication, and implements CORS to allow cross-origin requests from the frontend running on different ports."

### "Walk me through what happens when a user uploads an image for sign recognition"

**Good Answer:**
"1. User selects image in frontend
2. Image encoded to base64, sent as POST /sign/predict
3. FastAPI router dispatches to SignRecognition/router.py
4. Request validated with Pydantic PredictRequest model
5. Image decoded from base64 to numpy array
6. MediaPipe HandLandmarker detects 21 hand landmarks
7. If no hand → return hand_detected=false
8. If hand → extract 63 wrist-relative normalized features
9. Load Random Forest model from pickle file
10. Call predict_proba to get confidence for each of 11 classes
11. Find argmax (most likely class)
12. Use label_encoder to convert class index to name
13. Return PredictResponse with label, confidence, landmarks
14. FastAPI serializes to JSON
15. Frontend receives and displays result"

---

## 💪 Final Tips

1. **Know your numbers**: 8 routers, 3 tables, 11 signs, 7 emotions, 5 models
2. **Understand why**: Each design choice has a reason
3. **Draw diagrams**: Visual explanation is powerful
4. **Give examples**: Use real API endpoints to show how things work
5. **Be confident**: You built this, own it!
6. **Ask clarifying questions**: If question is unclear, ask before answering
7. **Go deep**: Be ready to explain implementation details
8. **Admit gaps**: "That's a good question, I'd need to check the code for that"
9. **Relate to theory**: Connect to ML/web dev concepts learned in class
10. **Have code ready**: Be able to show snippets from actual files

**Good luck! You've got this! 🚀**

