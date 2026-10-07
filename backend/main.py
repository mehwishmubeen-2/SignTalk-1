from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.Chatbot import router as chatbot_router
from app.api import auth
from app.SignRecognition.router import router as sign_recognition_router
from app.emotion.router import router as emotion_router
from app.activity.router import router as activity_router
from app.reviews.router import router as reviews_router
from app.grammar.router import router as grammar_router
from app.db.schema import init_schema

# ── Video call router ─────────────────────────────────────────────────────────
# Only import if the VideoCall folder exists in this project
try:
    from app.VideoCall.router import router as video_call_router
    _has_video_call = True
except ModuleNotFoundError:
    _has_video_call = False
    print("[startup] ⚠️  app.VideoCall not found — video call endpoints disabled")
    print("[startup]     Create backend/app/VideoCall/__init__.py and router.py to enable")

app = FastAPI(title="SignTalk API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://localhost:5001",  # Flask sign service
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])
app.include_router(sign_recognition_router)   # prefix="/sign" set inside router
app.include_router(emotion_router)            # prefix="/emotion" set inside router
app.include_router(activity_router)           # prefix="/progress" set inside router
app.include_router(reviews_router)             # prefix="/reviews" set inside router
app.include_router(grammar_router)             # prefix="/grammar" set inside router

if _has_video_call:
    app.include_router(video_call_router)     # prefix="/meetings" set inside router
    print("[startup] ✅ Video call router loaded")


@app.on_event("startup")
def _on_startup():
    init_schema()


@app.get("/")
def root():
    return {"message": "SignTalk API is running"}