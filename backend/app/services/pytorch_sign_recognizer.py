"""
Real-time sign language recognition for the PyTorch SignNet ensemble.

Two classes:

- SignModelEnsemble: the 5 models + class names. Loaded ONCE and shared by all
  connections (read-only after loading).
- SignSession: one per WebSocket connection. Owns its own MediaPipe Holistic
  instance and its own frame buffer, so people in the same call never mix.

How prediction works (mirrors training):
  training  = trim clip to the stretch where hands are visible
              -> resample evenly to 32 frames -> model
  live      = collect frames from the first hand frame until the hand has been
              gone for END_GAP_FRAMES -> resample that WHOLE sign to 32 frames
              -> model

Because the whole sign is resampled, results do not depend on the exact
frame rate or on a few dropped frames.
"""

import logging
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
import torch

logger = logging.getLogger("pytorch")

# ---- Segmenting parameters (tune on real calls) ---------------------------
MIN_SIGN_FRAMES = 12  # shorter hand-visible segments are treated as flicker
MAX_SIGN_FRAMES = 150  # force a prediction after ~5 s at 30 FPS
END_GAP_FRAMES = 10  # frames without a hand that end a sign (~0.33 s at 30 FPS)
# ---------------------------------------------------------------------------


class SignModelEnsemble:
    """Ensemble of PyTorch SignNet models. Shared across connections."""

    def __init__(
        self,
        model_paths: List[str],
        classes_file: str,
        device: Optional[str] = None,
        sequence_length: int = 32,
    ):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.sequence_length = sequence_length

        text = Path(classes_file).read_text()
        self.classes = [c.strip() for c in text.splitlines() if c.strip()]
        self.num_classes = len(self.classes)
        logger.info(f"Loaded {self.num_classes} classes, device={self.device}")

        self.models = []
        for path in model_paths:
            try:
                self.models.append(self._load_pytorch_model(path))
                logger.info(f"Loaded model: {Path(path).name}")
            except Exception as e:
                logger.error(f"Failed to load {path}: {e}")

        if not self.models:
            raise RuntimeError(f"No models loaded from {model_paths}")

        self._lock = threading.Lock()

    def _load_pytorch_model(self, path: str):
        from common import SignNet  # must match the training architecture

        model = SignNet().to(self.device)
        state_dict = torch.load(path, map_location=self.device)
        model.load_state_dict(state_dict)
        model.eval()
        return model

    def predict_sequence(self, frames: np.ndarray) -> Dict:
        """
        frames: (T, 225) features of ONE whole sign, any T >= 2.
        Resamples to `sequence_length` frames, then averages softmax outputs.
        """
        from common import prep

        start = time.time()
        T = len(frames)
        src = np.linspace(0, T - 1, self.sequence_length)
        idx = np.arange(T)
        X = np.stack(
            [np.interp(src, idx, frames[:, j]) for j in range(frames.shape[1])],
            axis=1,
        )
        X_tensor = torch.tensor(X[np.newaxis, :, :], dtype=torch.float32).to(self.device)

        with self._lock, torch.no_grad():
            X_prep = prep(X_tensor)
            all_probs = [
                torch.softmax(model(X_prep), dim=-1)[0].cpu().numpy()
                for model in self.models
            ]

        probs = np.mean(all_probs, axis=0)
        pred = int(np.argmax(probs))
        order = np.argsort(probs)[::-1][:3]

        return {
            "sign": self.classes[pred],
            "confidence": float(probs[pred]),
            "top3": [(self.classes[i], round(float(probs[i]), 3)) for i in order],
            "processing_time_ms": (time.time() - start) * 1000,
            "num_frames": T,
        }


class SignSession:
    """Per-connection state: own Holistic instance + own sign buffer."""

    def __init__(self, ensemble: SignModelEnsemble):
        self.ensemble = ensemble
        self.holistic = mp.solutions.holistic.Holistic(model_complexity=1)
        self.hand_detected = False
        self._segment: List[np.ndarray] = []  # frames of the sign in progress
        self._gap: List[np.ndarray] = []  # hand-less frames since last hand frame

    @property
    def in_sign(self) -> bool:
        return len(self._segment) > 0

    # ---- landmark extraction (unchanged logic: keep identical to training) --
    def extract_landmarks(self, frame: np.ndarray) -> Tuple[np.ndarray, bool]:
        """Returns (225-dim features, hand_detected)."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.holistic.process(rgb_frame)

        pose = self._landmarks_to_array(results.pose_landmarks, 33)
        left_hand = self._landmarks_to_array(results.left_hand_landmarks, 21)
        right_hand = self._landmarks_to_array(results.right_hand_landmarks, 21)

        if results.pose_landmarks:
            shoulder_left = pose[11]
            shoulder_right = pose[12]
            center = (shoulder_left + shoulder_right) / 2
            scale = np.linalg.norm(shoulder_left - shoulder_right) + 1e-6

            pose = (pose - center) / scale
            if results.left_hand_landmarks:
                left_hand = (left_hand - center) / scale
            if results.right_hand_landmarks:
                right_hand = (right_hand - center) / scale

        features = np.concatenate([pose.ravel(), left_hand.ravel(), right_hand.ravel()])
        hand_detected = (
            results.left_hand_landmarks is not None
            or results.right_hand_landmarks is not None
        )
        return features, hand_detected

    @staticmethod
    def _landmarks_to_array(landmarks, num_points: int) -> np.ndarray:
        if landmarks:
            return np.array([[p.x, p.y, p.z] for p in landmarks.landmark])
        return np.zeros((num_points, 3))

    # ---- sign segmentation -------------------------------------------------
    def process_frame(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Feed one frame. Returns a prediction dict when a whole sign has just
        finished, otherwise None.
        """
        features, hand = self.extract_landmarks(frame)
        self.hand_detected = hand

        if hand:
            if self._gap:
                # short hand dropout in the middle of a sign: keep those frames
                self._segment.extend(self._gap)
                self._gap = []
            self._segment.append(features)
            if len(self._segment) >= MAX_SIGN_FRAMES:
                return self._finish()
        elif self._segment:
            self._gap.append(features)
            if len(self._gap) > END_GAP_FRAMES:
                return self._finish()

        return None

    def _finish(self) -> Dict:
        segment = self._segment
        self._segment, self._gap = [], []  # trailing hand-less frames are dropped
        n = len(segment)

        if n < MIN_SIGN_FRAMES:
            logger.info(f"Ignored short segment ({n} frames)")
            return {
                "sign": "no_sign",
                "confidence": 1.0,
                "processing_time_ms": 0.0,
                "num_frames": n,
                "discarded": True,
            }

        result = self.ensemble.predict_sequence(np.asarray(segment))
        logger.info(
            f"Sign finished: {result['sign']} ({result['confidence']:.2%}) "
            f"from {n} frames | top3={result['top3']}"
        )
        return result

    def reset(self):
        self._segment, self._gap = [], []

    def close(self):
        if self.holistic:
            self.holistic.close()
            self.holistic = None