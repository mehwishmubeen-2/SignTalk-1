"""
app/activity/router.py
Tracks real user activity (signs practiced, video calls, AI dictionary
queries, voice-to-text sessions) and per-user favorite signs, backing the
Dashboard page with real data instead of static mock values.

Endpoints:
    POST   /activity/events            — log one activity event
    GET    /activity/dashboard         — aggregated stats for the Dashboard page
    GET    /activity/favorites         — list the current user's favorite words
    POST   /activity/favorites         — add a favorite word
    DELETE /activity/favorites/{word}  — remove a favorite word
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Callable, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.db.supabase import supabase, supabase_admin

router = APIRouter(prefix="/progress", tags=["progress"])


# ── Auth dependency (same pattern as app/VideoCall/router.py) ────────────────
def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user_response.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Event logging ─────────────────────────────────────────────────────────────
FEATURE_LABELS = {
    "ai_query": "AI Dictionary",
    "video_call": "Video Calls",
    "sign_practiced": "Sign to Text",
    "voice_to_text": "Voice to Text",
}


class LogEventRequest(BaseModel):
    event_type: str
    metadata: dict = {}


@router.post("/events")
def log_event(body: LogEventRequest, user_id: str = Depends(get_current_user_id)):
    if body.event_type not in FEATURE_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown event_type '{body.event_type}'")
    supabase_admin.table("activity_events").insert({
        "user_id": user_id,
        "event_type": body.event_type,
        "metadata": body.metadata,
    }).execute()
    return {"ok": True}


# ── Dashboard aggregation ──────────────────────────────────────────────────────
def _fmt_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "Practice session"
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    return f"{seconds // 60} minutes"


ACTIVITY_DESCRIPTIONS: dict[str, tuple[str, Callable[[dict], str]]] = {
    "ai_query": ("Used AI Dictionary", lambda m: m.get("query", "")),
    "video_call": ("Video call session", lambda m: _fmt_duration(m.get("duration_seconds"))),
    "sign_practiced": ("Learned sign", lambda m: m.get("sign", "")),
    "voice_to_text": ("Voice to text", lambda m: _fmt_duration(m.get("duration_seconds"))),
}

_DAY_COLORS = ["#0f766e", "#14b8a6", "#f97316", "#f59e0b", "#10b981", "#e11d48", "#84cc16"]


def _parse_ts(ts: str) -> dt.datetime:
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _time_ago(ts: str) -> str:
    try:
        created = _parse_ts(ts)
    except ValueError:
        return ts
    seconds = (dt.datetime.now(dt.timezone.utc) - created).total_seconds()
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        return f"{int(seconds // 60)} minutes ago"
    if seconds < 86400:
        return f"{int(seconds // 3600)} hours ago"
    days = int(seconds // 86400)
    return f"{days} day{'s' if days != 1 else ''} ago"


@router.get("/dashboard")
def get_dashboard(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase_admin.table("activity_events")
        .select("event_type, metadata, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    events = resp.data or []

    now = dt.datetime.now(dt.timezone.utc)
    week_ago = now - dt.timedelta(days=7)

    signs_set: set[str] = set()
    signs_set_week: set[str] = set()
    video_calls = video_calls_week = 0
    ai_queries = ai_queries_week = 0
    total_seconds = total_seconds_week = 0.0
    feature_counts: dict[str, int] = defaultdict(int)

    day_minutes: dict[dt.date, float] = {}
    day_order: list[dt.date] = []
    for i in range(6, -1, -1):
        d = (now - dt.timedelta(days=i)).date()
        day_order.append(d)
        day_minutes[d] = 0.0

    for ev in events:
        et = ev["event_type"]
        meta = ev.get("metadata") or {}
        try:
            created = _parse_ts(ev["created_at"])
        except (KeyError, ValueError):
            continue
        is_recent = created >= week_ago
        feature_counts[et] += 1
        day = created.date()

        if et == "sign_practiced":
            sign = meta.get("sign")
            if sign:
                signs_set.add(sign)
                if is_recent:
                    signs_set_week.add(sign)
        elif et == "video_call":
            video_calls += 1
            dur = float(meta.get("duration_seconds") or 0)
            total_seconds += dur
            if is_recent:
                video_calls_week += 1
                total_seconds_week += dur
            if day in day_minutes:
                day_minutes[day] += dur / 60
        elif et == "ai_query":
            ai_queries += 1
            if is_recent:
                ai_queries_week += 1
        elif et == "voice_to_text":
            dur = float(meta.get("duration_seconds") or 0)
            total_seconds += dur
            if is_recent:
                total_seconds_week += dur
            if day in day_minutes:
                day_minutes[day] += dur / 60

    total_feature_events = sum(feature_counts.values()) or 1
    feature_usage = [
        {"name": label, "usage": round((feature_counts.get(key, 0) / total_feature_events) * 100)}
        for key, label in FEATURE_LABELS.items()
    ]

    weekly_activity = [
        {
            "id": d.strftime("%a").lower(),
            "day": d.strftime("%a"),
            "minutes": round(day_minutes[d]),
            "color": _DAY_COLORS[i % len(_DAY_COLORS)],
        }
        for i, d in enumerate(day_order)
    ]

    stats = {
        "signs_learned": {"value": len(signs_set), "trend": f"+{len(signs_set_week)} this week"},
        "video_calls": {"value": video_calls, "trend": f"+{video_calls_week} this week"},
        "ai_queries": {"value": ai_queries, "trend": f"+{ai_queries_week} this week"},
        "total_time_hours": {
            "value": round(total_seconds / 3600, 1),
            "trend": f"+{round(total_seconds_week / 3600, 1)}h this week",
        },
    }

    recent_activity = []
    for ev in events[:5]:
        et = ev["event_type"]
        meta = ev.get("metadata") or {}
        action, item_fn = ACTIVITY_DESCRIPTIONS.get(et, (et, lambda _m: ""))
        recent_activity.append({
            "type": et,
            "action": action,
            "item": item_fn(meta),
            "time": _time_ago(ev["created_at"]),
        })

    return {
        "stats": stats,
        "weekly_activity": weekly_activity,
        "feature_usage": feature_usage,
        "recent_activity": recent_activity,
    }


# ── Favorites ──────────────────────────────────────────────────────────────────
class FavoriteRequest(BaseModel):
    word: str


@router.get("/favorites")
def list_favorites(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase_admin.table("favorites")
        .select("word")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"favorites": [row["word"] for row in (resp.data or [])]}


@router.post("/favorites")
def add_favorite(body: FavoriteRequest, user_id: str = Depends(get_current_user_id)):
    word = body.word.strip().lower()
    if not word:
        raise HTTPException(status_code=400, detail="word is required")
    supabase_admin.table("favorites").upsert(
        {"user_id": user_id, "word": word}, on_conflict="user_id,word"
    ).execute()
    return {"ok": True}


@router.delete("/favorites/{word}")
def remove_favorite(word: str, user_id: str = Depends(get_current_user_id)):
    supabase_admin.table("favorites").delete().eq("user_id", user_id).eq("word", word.strip().lower()).execute()
    return {"ok": True}
