# backend/app/VideoCall/router.py
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from livekit.api import AccessToken, VideoGrants
from app.db.supabase import supabase

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/meetings", tags=["video-call"])

# ── LiveKit credentials from .env ─────────────────────────────────────────────
LIVEKIT_API_KEY    = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL        = os.getenv("LIVEKIT_URL")


# ── Auth dependency — matches your existing auth.py pattern ──────────────────
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user_response.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Response models ───────────────────────────────────────────────────────────
class CreateMeetingResponse(BaseModel):
    room_id: str

class TokenResponse(BaseModel):
    token: str
    url: str


# ── POST /meetings/create ─────────────────────────────────────────────────────
@router.post("/create", response_model=CreateMeetingResponse)
def create_meeting(user=Depends(get_current_user)):
    room_id = str(uuid.uuid4())[:8]
    return CreateMeetingResponse(room_id=room_id)


# ── POST /meetings/{room_id}/token ────────────────────────────────────────────
@router.post("/{room_id}/token", response_model=TokenResponse)
def get_room_token(room_id: str, user=Depends(get_current_user)):
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
        raise HTTPException(
            status_code=500,
            detail="LiveKit not configured. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL to .env"
        )
    try:
        token = (
            AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(str(user.id))
            .with_name(user.email or str(user.id))
            .with_grants(VideoGrants(
                room_join=True,
                room=room_id,
                can_publish=True,
                can_subscribe=True,
            ))
        )
        return TokenResponse(token=token.to_jwt(), url=LIVEKIT_URL)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")


# ── POST /meetings/{room_id}/join ─────────────────────────────────────────────
@router.post("/{room_id}/join", response_model=TokenResponse)
def join_meeting(room_id: str, user=Depends(get_current_user)):
    return get_room_token(room_id, user)