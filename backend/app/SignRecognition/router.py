"""
FastAPI router for ASL sign recognition.
Matches random-forest-1.ipynb exactly:
  - Tasks API HandLandmarker (not legacy mp.solutions.hands)
  - 63 features: x, y, z per landmark, wrist-relative + max-abs-scale normalized
  - model.p / asl_rf_model.pkl contains {'model': clf, 'label_encoder': le}
"""

import base64
import os
import pickle
import urllib.request
from typing import List, Optional

import cv2
import joblib
import numpy as np
import mediapipe as mp
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/sign", tags=["sign-recognition"])

# ─────────────────────────────────────────────────────────────────────────
# Load model + label encoder
# ─────────────────────────────────────────────────────────────────────────

APP_DIR = os.path.dirname(os.path.dirname(__file__))
VIDEO_CALL_DIR = os.path.join(APP_DIR, "VideoCall")
MODEL_DIR = os.path.dirname(__file__)
MODEL_CANDIDATES = [
    os.path.join(VIDEO_CALL_DIR, "asl_word_model.pkl"),
    os.path.join(VIDEO_CALL_DIR, "asl_word_model .pkl"),
    os.path.join(MODEL_DIR, "asl_rf_model.pkl"),
    os.path.join(MODEL_DIR, "asl_rf_model .pkl"),
]
MODEL_PKL_PATH = next((p for p in MODEL_CANDIDATES if os.path.exists(p)), MODEL_CANDIDATES[0])

if not os.path.exists(MODEL_PKL_PATH):
    raise FileNotFoundError(
        f"Could not find sign model file. Looked for: {MODEL_CANDIDATES}"
    )

try:
    with open(MODEL_PKL_PATH, "rb") as f:
        _data = pickle.load(f)
except Exception:
    _data = joblib.load(MODEL_PKL_PATH)

if isinstance(_data, dict):
    model = _data.get("model")
    label_encoder = _data.get("label_encoder")
else:
    model = _data
    label_encoder = None

if model is None:
    raise ValueError(f"Unknown model format in {MODEL_PKL_PATH}")

# ─────────────────────────────────────────────────────────────────────────
# HandLandmarker setup — same model + thresholds as training
# ─────────────────────────────────────────────────────────────────────────

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

HAND_MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
if not os.path.exists(HAND_MODEL_PATH):
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        HAND_MODEL_PATH,
    )

_options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=HAND_MODEL_PATH),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)
landmarker = HandLandmarker.create_from_options(_options)


class PredictRequest(BaseModel):
    image: Optional[str] = None
    images: Optional[List[str]] = None
    frames: Optional[List[str]] = None


class Landmark(BaseModel):
    x: float
    y: float


class PredictResponse(BaseModel):
    hand_detected: bool
    label: str | None
    confidence: float
    landmarks: list[Landmark]
    video_frames: int = 0


def decode_image(image_b64: str):
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    img_bytes = base64.b64decode(image_b64)
    img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(img_arr, cv2.IMREAD_COLOR)


def extract_landmarks(hand_landmarks):
    """Wrist-relative normalized 3D hand landmark feature vector."""
    coords = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32)
    coords -= coords[0]
    scale = np.max(np.abs(coords)) + 1e-6
    coords /= scale
    return coords.flatten().astype(np.float32)


def extract_sequence_features(frame_b64s: list[str]):
    """Build a sequence feature vector from several frames. This is for video/word recognition."""
    frame_rows = []
    for frame_b64 in frame_b64s:
        img = decode_image(frame_b64)
        if img is None:
            continue
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        result = landmarker.detect(mp_image)
        if not result.hand_landmarks:
            frame_rows.append(np.zeros(63, dtype=np.float32))
            continue
        hand = result.hand_landmarks[0]
        frame_rows.append(extract_landmarks(hand))

    if not frame_rows:
        return None

    return np.hstack(frame_rows) if len(frame_rows) == 1 else np.concatenate(frame_rows)


@router.get("/health")
def health():
    if label_encoder is not None and hasattr(label_encoder, "classes_"):
        classes = list(label_encoder.classes_)
    elif hasattr(model, "classes_"):
        classes = list(model.classes_)
    else:
        classes = []
    return {"status": "ok", "classes": classes, "model_path": MODEL_PKL_PATH}


@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    image_list = payload.images or payload.frames or []
    if payload.image:
        image_list = [payload.image]

    if not image_list:
        raise HTTPException(status_code=400, detail="No image or frame sequence supplied")

    if len(image_list) > 1:
        feature_vector = extract_sequence_features(image_list)
        if feature_vector is None:
            return PredictResponse(hand_detected=False, label=None, confidence=0.0, landmarks=[], video_frames=0)

        X = np.array([feature_vector])
        last_hand = None
        for frame_b64 in image_list:
            img = decode_image(frame_b64)
            if img is None:
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
            result = landmarker.detect(mp_image)
            if result.hand_landmarks:
                last_hand = result.hand_landmarks[0]

        landmarks_out = [Landmark(x=lm.x, y=lm.y) for lm in last_hand] if last_hand is not None else []

        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)[0]
            idx = int(np.argmax(probs))
            label = str(label_encoder.inverse_transform([idx])[0]) if label_encoder is not None else str(model.classes_[idx])
            confidence = float(probs[idx])
        else:
            pred = model.predict(X)[0]
            label = str(pred)
            confidence = 1.0

        return PredictResponse(hand_detected=bool(landmarks_out), label=label, confidence=confidence, landmarks=landmarks_out, video_frames=len(image_list))

    img = decode_image(image_list[0])
    if img is None:
        raise HTTPException(status_code=400, detail="could not decode image")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    result = landmarker.detect(mp_image)

    if not result.hand_landmarks:
        return PredictResponse(hand_detected=False, label=None, confidence=0.0, landmarks=[], video_frames=1)

    hand = result.hand_landmarks[0]
    features = extract_landmarks(hand)
    landmarks_out = [Landmark(x=lm.x, y=lm.y) for lm in hand]

    X = np.array([features])
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
        idx = int(np.argmax(probs))
        if label_encoder is not None:
            label = str(label_encoder.inverse_transform([idx])[0])
        else:
            label = str(model.classes_[idx])
        confidence = float(probs[idx])
    else:
        pred = model.predict(X)[0]
        label = str(pred)
        confidence = 1.0

    print(f"Predicted: {label}  |  Confidence: {confidence:.3f}")
    return PredictResponse(hand_detected=True, label=label, confidence=confidence, landmarks=landmarks_out, video_frames=1)