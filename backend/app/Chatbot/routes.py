"""
app/chatbot/routes.py
Sign-language search endpoints as a FastAPI APIRouter.

Registered in main.py with:
    from app.chatbot import router as chatbot_router
    app.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])

Endpoints:
    GET  /chatbot/health
    GET  /chatbot/search?q=<text>&fuzzy=true
    GET  /chatbot/suggest?q=<prefix>&limit=10
    GET  /chatbot/word/{word}
    GET  /chatbot/video/{video_id}
    GET  /chatbot/vocab/count
"""

import os
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from .dataset_loader import build_unified_index
from .search import search_sentence, get_suggestions

# ── Router ─────────────────────────────────────────────────────────────────────
router = APIRouter()

# ── Load index once at import time ─────────────────────────────────────────────
# (FastAPI imports modules once; this runs when the app starts)
print("[chatbot] Building unified sign index...")
UNIFIED_INDEX: dict = build_unified_index()
print(f"[chatbot] Index built: {len(UNIFIED_INDEX)} words.")

# Scan videos folder
# __file__ = backend/app/chatbot/routes.py → 3 levels up = backend/
_BACKEND_DIR   = Path(__file__).parent.parent.parent
_VIDEOS_DIR    = _BACKEND_DIR / "videos" / "videos"
AVAILABLE_IDS: set = set()

if _VIDEOS_DIR.is_dir():
    for f in _VIDEOS_DIR.iterdir():
        if f.suffix.lower() == ".mp4":
            AVAILABLE_IDS.add(f.stem)

print(f"[chatbot] {len(AVAILABLE_IDS)} video files found on disk.")

# Keep only words that have at least one playable video
for _word in list(UNIFIED_INDEX.keys()):
    _playable = [v for v in UNIFIED_INDEX[_word] if v.get("id") in AVAILABLE_IDS]
    if _playable:
        UNIFIED_INDEX[_word] = _playable
    else:
        del UNIFIED_INDEX[_word]

# Manually-added letters/words not present in the WLASL dataset (e.g. fingerspelling
# clips dropped straight into videos/videos/<id>.mp4). Add more "word": "video_id" pairs here.
CUSTOM_ENTRIES = {
    "c": "c",
    "i": "i",
    "x": "x",
    "y": "y",
    "z": "z",
}
for _word, _video_id in CUSTOM_ENTRIES.items():
    if _video_id in AVAILABLE_IDS:
        UNIFIED_INDEX.setdefault(_word, []).insert(0, {"id": _video_id, "source": "custom"})

print(f"[chatbot] {len(UNIFIED_INDEX)} words have at least one playable video.\n")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "unified_vocab_size": len(UNIFIED_INDEX)}


@router.get("/search")
def search(
    q:     str  = Query(..., description="Word or sentence to search"),
    fuzzy: bool = Query(True, description="Enable fuzzy matching"),
):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = search_sentence(query, UNIFIED_INDEX, fuzzy=fuzzy)

    serialised = [{
        "input_word":   r["input_word"],
        "matched_word": r["matched_word"],
        "match_type":   r["match_type"],
        "video":        r["video"],
        "video_count":  len(r["all_videos"]),
    } for r in results]

    return {
        "query":         query,
        "results":       serialised,
        "total_matched": sum(1 for r in results if r["match_type"] != "none"),
    }


@router.get("/suggest")
def suggest(
    q:     str = Query(..., description="Prefix to autocomplete"),
    limit: int = Query(10),
):
    prefix = q.strip()
    if not prefix:
        return {"suggestions": []}
    return {"prefix": prefix, "suggestions": get_suggestions(prefix, UNIFIED_INDEX, limit)}


@router.get("/word/{word}")
def word_detail(word: str):
    word   = word.lower().strip()
    videos = UNIFIED_INDEX.get(word)
    if not videos:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
    return {"word": word, "videos": videos, "best": videos[0]}


@router.get("/vocab/count")
def vocab_count():
    return {"word_count": len(UNIFIED_INDEX)}


@router.get("/video/{video_id}")
def serve_video(video_id: str):
    if not re.match(r"^[a-zA-Z0-9_-]+$", video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    video_path = _VIDEOS_DIR / f"{video_id}.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},  # enables video seeking in browser
    )