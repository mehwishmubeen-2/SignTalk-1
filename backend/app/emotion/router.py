# backend/app/emotion/router.py
from fastapi import APIRouter
from pydantic import BaseModel
from transformers import pipeline

router = APIRouter(prefix="/emotion", tags=["emotion"])

# ── Load model locally on startup — no internet needed after first download ───
print("[emotion] Loading emotion model locally...")
emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
    device=-1  # CPU
)
print("[emotion] [OK] Emotion model ready")

EMOTION_INFO = {
    "joy":      {"label": "Happy",     "emoji": "😊", "color": "#22c55e"},
    "sadness":  {"label": "Sad",       "emoji": "😢", "color": "#3b82f6"},
    "anger":    {"label": "Angry",     "emoji": "😠", "color": "#ef4444"},
    "neutral":  {"label": "Neutral",   "emoji": "😐", "color": "#94a3b8"},
    "disgust":  {"label": "Disgust",   "emoji": "🤢", "color": "#a855f7"},
    "fear":     {"label": "Fear",      "emoji": "😨", "color": "#f97316"},
    "surprise": {"label": "Surprised", "emoji": "😲", "color": "#eab308"},
}

class TextInput(BaseModel):
    text: str

@router.post("/detect")
def detect_emotion(body: TextInput):
    results = emotion_pipeline(body.text.strip())
    scores  = results[0] if isinstance(results[0], list) else results
    scores  = sorted(scores, key=lambda x: x["score"], reverse=True)
    top     = scores[0]
    code    = top["label"].lower()
    info    = EMOTION_INFO.get(code, EMOTION_INFO["neutral"])

    return {
        "code":  code,
        "label": info["label"],
        "emoji": info["emoji"],
        "color": info["color"],
        "score": round(top["score"] * 100),
    }