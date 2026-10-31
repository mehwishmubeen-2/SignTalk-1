"""
Enhanced VideoCall router with real-time sign detection using PyTorch SignNet.
Integrates LiveKit video calling with ensemble sign language recognition.
"""

import os
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from livekit.api import AccessToken, VideoGrants
from app.db.supabase import supabase
from app.services.pytorch_video_handler import PyTorchVideoStreamHandler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meetings", tags=["video-call"])

# LiveKit credentials
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL")

# Video handlers
video_handlers = {}


class CreateMeetingResponse(BaseModel):
    room_id: str


class TokenResponse(BaseModel):
    token: str
    url: str


def get_current_user(authorization: Optional[str] = Header(None)):
    """Authenticate user from bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
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


async def get_current_user_websocket(websocket: WebSocket, token: str):
    """Extract user from WebSocket token."""
    try:
        logger.debug(f"Attempting to validate token (length: {len(token)})")
        
        # Attempt to authenticate with Supabase
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            logger.error(f"WebSocket auth: No user returned from token")
            await websocket.close(code=4001, reason="Invalid token")
            return None
        logger.info(f"WebSocket auth success for user: {user_response.user.id}")
        return user_response.user
    except Exception as e:
        logger.error(f"WebSocket auth exception: {type(e).__name__}: {str(e)}")
        await websocket.close(code=4001, reason="Auth failed")
        return None


# ── Original Endpoints ────────────────────────────────────────────────────────

@router.post("/create", response_model=CreateMeetingResponse)
def create_meeting(user=Depends(get_current_user)):
    """Create a new video meeting room."""
    room_id = str(uuid.uuid4())[:8]
    logger.info(f"Created room {room_id} for user {user.id}")
    return CreateMeetingResponse(room_id=room_id)


@router.post("/{room_id}/token", response_model=TokenResponse)
def get_room_token(room_id: str, user=Depends(get_current_user)):
    """Get LiveKit token for joining a room."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
        raise HTTPException(
            status_code=500,
            detail="LiveKit not configured"
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


@router.post("/{room_id}/join", response_model=TokenResponse)
def join_meeting(room_id: str, user=Depends(get_current_user)):
    """Join an existing meeting room."""
    return get_room_token(room_id, user)


# ── New: PyTorch Sign Detection WebSocket ──────────────────────────────────────

@router.websocket("/ws/{room_id}/sign-detect")
async def websocket_sign_detect(websocket: WebSocket, room_id: str, token: Optional[str] = None):
    """
    WebSocket endpoint for real-time sign detection using PyTorch SignNet.
    
    Connect with:
        ws://localhost:8000/meetings/ws/{room_id}/sign-detect?token={jwt_token}
    
    Send frame (base64 JPEG):
        {"type": "frame", "data": "base64_encoded_jpeg"}
    
    Receive prediction (every 32 frames):
        {
            "type": "prediction",
            "sign": "HELLO",
            "confidence": 0.95,
            "processing_time_ms": 45.2,
            "hand_detected": true,
            "prediction_number": 1
        }
    """
    logger.info(f"WebSocket connection attempt to /ws/{room_id}/sign-detect")
    logger.info(f"Token received: {token[:20] if token else 'None'}...")
    
    if not token:
        logger.warning(f"Rejecting: No token provided")
        await websocket.close(code=4001, reason="No token provided")
        return
    
    user = await get_current_user_websocket(websocket, token)
    if not user:
        logger.warning(f"Rejecting: Auth failed")
        return
    
    logger.info(f"✅ User {user.id} authenticated, connecting to sign detection in room {room_id}")
    
    # Get or create handler for this room
    if room_id not in video_handlers:
        video_handlers[room_id] = PyTorchVideoStreamHandler()
    
    handler = video_handlers[room_id]
    
    try:
        await handler.handle_connection(websocket, room_id, str(user.id))
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")


# ── Health Check ───────────────────────────────────────────────────────────────

@router.get("/health")
def health_check():
    """Check if sign detection is available."""
    try:
        from app.services.pytorch_sign_recognizer import SignRecognizer
        from pathlib import Path
        
        model_dir = Path(__file__).parent.parent / "SignRecognition"
        model_files = sorted(model_dir.glob("best_*.pt"))
        classes_file = model_dir / "classes.txt"
        
        return {
            'status': 'healthy',
            'models_found': len(model_files),
            'classes_file_exists': classes_file.exists(),
            'device': 'cuda' if __import__('torch').cuda.is_available() else 'cpu'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }


# ── Cleanup ────────────────────────────────────────────────────────────────────

def cleanup_handlers():
    """Cleanup on shutdown."""
    for handler in video_handlers.values():
        handler.close()
    logger.info("Sign detection handlers cleaned up")
