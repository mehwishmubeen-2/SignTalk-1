"""
FastAPI router for ASL sign recognition (alphabet MLP).

Features match the training notebook: wrist-relative, palm-length scaled,
63 coordinates + 210 pairwise distances = 273 features.
Needs mlp.json, labels.json (and hand_landmarker.task, downloaded automatically)
in the same folder as this file.
"""

import base64
import json
import os
import threading
import urllib.request
from typing import List, Optional

import cv2
import numpy as np
import mediapipe as mp
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/sign", tags=["sign-recognition"])

MODEL_DIR = os.path.dirname(__file__)

# ─────────────────────────────────────────────────────────────────────────
# Alphabet MLP (numpy forward pass, no sklearn/tensorflow needed)
# ─────────────────────────────────────────────────────────────────────────

with open(os.path.join(MODEL_DIR, "mlp.json"), encoding="utf-8") as f:
    W1, b1, W2, b2, W3, b3 = [np.array(w, dtype=np.float32) for w in json.load(f)["weights"]]

with open(os.path.join(MODEL_DIR, "labels.json"), encoding="utf-8") as f:
    _label_map = json.load(f)["label_map"]
LABELS = [_label_map[str(i)] for i in range(len(_label_map))]

_I, _J = np.triu_indices(21, 1)


def featurize(coords: np.ndarray) -> np.ndarray:
    """coords: raw (21, 3) landmarks -> (1, 273) features. Must match the notebook."""
    c = coords - coords[0]
    c = c / (np.linalg.norm(c[9]) + 1e-6)
    d = np.linalg.norm(c[_I] - c[_J], axis=1)
    return np.concatenate([c.ravel(), d]).astype(np.float32)[None]


def mlp_probs(x: np.ndarray) -> np.ndarray:
    h = np.maximum(0, x @ W1 + b1)
    h = np.maximum(0, h @ W2 + b2)
    z = (h @ W3 + b3)[0]
    e = np.exp(z - z.max())
    return e / e.sum()


def predict_letter(hand) -> tuple[str, float]:
    coords = np.array([[lm.x, lm.y, lm.z] for lm in hand], dtype=np.float32)
    probs = mlp_probs(featurize(coords))
    k = int(probs.argmax())
    return LABELS[k], float(probs[k])


# ─────────────────────────────────────────────────────────────────────────
# HandLandmarker
# ─────────────────────────────────────────────────────────────────────────

HAND_MODEL_PATH = os.path.join(MODEL_DIR, "hand_landmarker.task")
if not os.path.exists(HAND_MODEL_PATH):
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        HAND_MODEL_PATH,
    )

landmarker = mp.tasks.vision.HandLandmarker.create_from_options(
    mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=HAND_MODEL_PATH),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
)
_detect_lock = threading.Lock()   # one landmarker shared by concurrent requests


def decode_image(image_b64: str):
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    arr = np.frombuffer(base64.b64decode(image_b64), dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_hand(image_b64: str):
    """Returns the first hand's landmarks, or None. Raises ValueError if undecodable."""
    img = decode_image(image_b64)
    if img is None:
        raise ValueError("could not decode image")
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    with _detect_lock:
        res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    return res.hand_landmarks[0] if res.hand_landmarks else None


# ─────────────────────────────────────────────────────────────────────────
# API
# ─────────────────────────────────────────────────────────────────────────

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


def empty_response(n: int) -> PredictResponse:
    return PredictResponse(hand_detected=False, label=None, confidence=0.0, landmarks=[], video_frames=n)


def hand_response(hand, n: int) -> PredictResponse:
    label, confidence = predict_letter(hand)
    print(f"Predicted: {label}  |  Confidence: {confidence:.3f}")
    return PredictResponse(
        hand_detected=True,
        label=label,
        confidence=confidence,
        landmarks=[Landmark(x=lm.x, y=lm.y) for lm in hand],
        video_frames=n,
    )


@router.get("/health")
def health():
    return {"status": "ok", "classes": LABELS}


@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    image_list = [payload.image] if payload.image else (payload.images or payload.frames or [])
    if not image_list:
        raise HTTPException(status_code=400, detail="No image or frame sequence supplied")

    # Several frames: classify the most recent frame that contains a hand
    if len(image_list) > 1:
        for b64 in reversed(image_list):
            try:
                hand = detect_hand(b64)
            except ValueError:
                continue
            if hand is not None:
                return hand_response(hand, len(image_list))
        return empty_response(len(image_list))

    # Single frame
    try:
        hand = detect_hand(image_list[0])
    except ValueError:
        raise HTTPException(status_code=400, detail="could not decode image")

    if hand is None:
        return empty_response(1)
    return hand_response(hand, 1)