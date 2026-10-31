# backend/app/VideoCall/router_enhanced.py
"""
Enhanced VideoCall router with real-time sign detection.
Includes all original endpoints plus new WebSocket for sign recognition.

Usage:
    Original endpoints work as before
    New endpoints:
    - WS /meetings/ws/{room_id}/detect-signs - Real-time sign detection
    - GET /meetings/{room_id}/signs/history - Get signs detected in room
    - GET /meetings/models/info - Get current model info
    - POST /meetings/models/switch - Switch to different model
"""

import os
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from livekit.api import AccessToken, VideoGrants
from app.db.supabase import supabase
from app.services.video_stream_handler import VideoStreamHandler
from app.services.model_manager import model_manager

# ── Setup logging ─────────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/meetings", tags=["video-call"])

# ── LiveKit credentials from .env ─────────────────────────────────────────────
LIVEKIT_API_KEY    = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL        = os.getenv("LIVEKIT_URL")

# ── Video stream handlers (one per room) ──────────────────────────────────────
video_handlers = {}  # {room_id: VideoStreamHandler}
room_signs = {}      # {room_id: [signs detected in this room]}


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


async def get_current_user_websocket(websocket: WebSocket, token: str):
    """Extract user from WebSocket token."""
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            await websocket.close(code=4001, reason="Invalid token")
            return None
        return user_response.user
    except Exception as e:
        logger.error(f"WebSocket auth failed: {e}")
        await websocket.close(code=4001, reason="Auth failed")
        return None


# ── Response models ───────────────────────────────────────────────────────────
class CreateMeetingResponse(BaseModel):
    room_id: str


class TokenResponse(BaseModel):
    token: str
    url: str


class ModelInfo(BaseModel):
    name: str
    model_type: str
    num_classes: int
    loaded_at: str


class SwitchModelRequest(BaseModel):
    model_name: str
    version: str = "latest"


class SignDetectionHistory(BaseModel):
    room_id: str
    total_signs: int
    signs: list


# ── Original Endpoints (unchanged) ────────────────────────────────────────────

@router.post("/create", response_model=CreateMeetingResponse)
def create_meeting(user=Depends(get_current_user)):
    """Create a new video meeting room."""
    room_id = str(uuid.uuid4())[:8]
    
    # Initialize sign tracking for this room
    if room_id not in room_signs:
        room_signs[room_id] = []
    
    logger.info(f"Created room {room_id} for user {user.id}")
    return CreateMeetingResponse(room_id=room_id)


@router.post("/{room_id}/token", response_model=TokenResponse)
def get_room_token(room_id: str, user=Depends(get_current_user)):
    """Get LiveKit token for joining a room."""
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


@router.post("/{room_id}/join", response_model=TokenResponse)
def join_meeting(room_id: str, user=Depends(get_current_user)):
    """Join an existing meeting room."""
    return get_room_token(room_id, user)


# ── New: Sign Detection WebSocket ─────────────────────────────────────────────

@router.websocket("/ws/{room_id}/detect-signs")
async def websocket_detect_signs(websocket: WebSocket, room_id: str, token: Optional[str] = None):
    """
    WebSocket endpoint for real-time sign detection during video call.
    
    Connect with:
        ws://localhost:8000/meetings/ws/{room_id}/detect-signs?token={jwt_token}
    
    Send frame:
        {"type": "frame", "data": "base64_encoded_frame", "timestamp": 1234567890}
    
    Receive prediction:
        {
            "type": "prediction",
            "detected": true,
            "signs": [
                {
                    "label": "HELLO",
                    "confidence": 0.95,
                    "hand": "Right",
                    "landmarks": [...]
                }
            ],
            "processing_time_ms": 45.2
        }
    """
    # Authenticate user
    if not token:
        await websocket.close(code=4001, reason="No token provided")
        return
    
    user = await get_current_user_websocket(websocket, token)
    if not user:
        return
    
    logger.info(f"User {user.id} connecting to sign detection in room {room_id}")
    
    # Get or create handler for this room
    if room_id not in video_handlers:
        video_handlers[room_id] = VideoStreamHandler()
    
    if room_id not in room_signs:
        room_signs[room_id] = []
    
    handler = video_handlers[room_id]
    
    try:
        await handler.handle_connection(websocket, room_id, str(user.id))
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
    finally:
        # Cleanup if no active connections
        if room_id in video_handlers and not video_handlers[room_id].detector:
            del video_handlers[room_id]


# ── New: Model Management Endpoints ───────────────────────────────────────────

@router.get("/models/list")
def list_available_models():
    """List all available trained models."""
    try:
        models = model_manager.list_available_models()
        current = model_manager.get_current_model()
        
        return {
            'available_models': models,
            'current_model': current,
            'model_count': len(models)
        }
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/info", response_model=ModelInfo)
def get_model_info():
    """Get information about the currently loaded model."""
    try:
        info = model_manager.get_model_info()
        
        if 'error' in info:
            # Try to load a model if none is loaded
            if not model_manager.load_latest_model():
                raise HTTPException(
                    status_code=500,
                    detail="No model available. Please train and add a model."
                )
            info = model_manager.get_model_info()
        
        return info
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/switch")
def switch_model(request: SwitchModelRequest, user=Depends(get_current_user)):
    """
    Switch to a different trained model.
    
    Requires admin privileges (in production, add role check).
    """
    try:
        if model_manager.load_model(request.model_name, request.version):
            info = model_manager.get_model_info()
            logger.info(f"User {user.id} switched to model {request.model_name}")
            
            return {
                'success': True,
                'message': f"Switched to {request.model_name}",
                'model_info': info
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to load model {request.model_name}"
            )
    except Exception as e:
        logger.error(f"Error switching model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/history")
def get_model_history(limit: int = 10):
    """Get model loading history."""
    try:
        history = model_manager.get_model_history(limit)
        return {
            'history': history,
            'total_entries': len(history)
        }
    except Exception as e:
        logger.error(f"Error getting model history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── New: Sign History Endpoints ───────────────────────────────────────────────

@router.get("/{room_id}/signs/history")
def get_room_sign_history(room_id: str, user=Depends(get_current_user)):
    """
    Get all signs detected in a specific room during this session.
    
    Note: This is in-memory only. For persistence, integrate with Supabase.
    """
    if room_id not in room_signs:
        return SignDetectionHistory(
            room_id=room_id,
            total_signs=0,
            signs=[]
        )
    
    signs = room_signs[room_id]
    return SignDetectionHistory(
        room_id=room_id,
        total_signs=len(signs),
        signs=signs[-100:]  # Return last 100 signs
    )


@router.delete("/{room_id}/signs/history")
def clear_room_sign_history(room_id: str, user=Depends(get_current_user)):
    """Clear the sign history for a room."""
    if room_id in room_signs:
        room_signs[room_id] = []
        logger.info(f"Cleared sign history for room {room_id}")
    
    return {'success': True, 'message': 'Sign history cleared'}


# ── Cleanup on shutdown ───────────────────────────────────────────────────────

@router.on_event("shutdown")
def cleanup_on_shutdown():
    """Cleanup resources when server shuts down."""
    for handler in video_handlers.values():
        handler.close()
    
    logger.info("Video call handlers cleaned up")
