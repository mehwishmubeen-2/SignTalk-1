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
              gone for END_GAP_SECONDS -> resample that WHOLE sign to 32 frames
              -> model

Because the whole sign is resampled, results do not depend on the exact
frame rate or on a few dropped frames.
"""

import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
import torch

logger = logging.getLogger("pytorch")


def _env_float(name: str, default: float) -> float:
    """Read a number from an environment variable (lets you tune without editing code)."""
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


# ---- Segmenting parameters (TIME based) -----------------------------------
# These use the frame timestamps sent by the browser, so they do not depend on
# how many frames per second the server manages to process.
MIN_SIGN_SECONDS = _env_float("MIN_SIGN_SECONDS", 0.3)  # shorter = flicker, ignored
MAX_SIGN_SECONDS = _env_float("MAX_SIGN_SECONDS", 5.0)  # force a prediction after this long
END_GAP_SECONDS = _env_float("END_GAP_SECONDS", 0.6)  # no hand for this long ends the sign
MIN_SIGN_FRAMES = int(_env_float("MIN_SIGN_FRAMES", 4))  # frames needed to resample

# MediaPipe hand detection sensitivity (lower = finds hands more easily, but
# also more false hands). Defaults match MediaPipe's own defaults.
HOLISTIC_MIN_DETECTION = _env_float("HOLISTIC_MIN_DETECTION", 0.5)
HOLISTIC_MIN_TRACKING = _env_float("HOLISTIC_MIN_TRACKING", 0.5)
# ---------------------------------------------------------------------------

# ---- Optional: save every finished sign for building training data ---------
# Set the environment variable SAVE_SEGMENTS_DIR (for example "live_segments")
# and each sign is saved as <predicted>_<confidence>_<time>.npy, shape
# (frames, 225), in exactly the format the model receives live. Leave it unset
# in production.
SAVE_SEGMENTS_DIR = os.getenv("SAVE_SEGMENTS_DIR", "")
# ---------------------------------------------------------------------------

# ---- Reject "hand visible but not signing" segments ------------------------
# Landmarks are shoulder-normalised: y = 0 is the shoulder line and +1 is about
# one shoulder-width below it, so a hand resting on a desk has a large y.
# Tune these from the "zone=... motion=..." numbers printed in the log.
FILTER_NON_SIGNS = os.getenv("FILTER_NON_SIGNS", "1") != "0"  # set to 0 to switch the filter off
SIGNING_ZONE_MAX_Y = _env_float("SIGNING_ZONE_MAX_Y", 1.8)  # wrist lower than this = "resting"
MIN_ZONE_FRACTION = _env_float("MIN_ZONE_FRACTION", 0.4)  # share of frames with a hand in the zone
MIN_MOTION = _env_float("MIN_MOTION", 0.15)  # wrist travel needed, in shoulder widths
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
        # keep PyTorch from fighting MediaPipe for every CPU core
        torch.set_num_threads(int(os.getenv("TORCH_THREADS", "2")))

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

    def predict_sequence(self, frames: np.ndarray, times: Optional[np.ndarray] = None) -> Dict:
        """
        frames: (T, 225) features of ONE whole sign, any T >= 2.
        times:  (T,) capture time of each frame in seconds (optional).

        The sign is resampled to `sequence_length` frames that are evenly spaced
        in TIME. Evenly spaced in time is what the 30 FPS training clips look
        like, and it stays correct even when the server skipped frames or got
        them at uneven intervals. Without times it falls back to even spacing
        by frame index.
        """
        from common import prep

        start = time.time()
        T = len(frames)
        if times is not None and len(times) == T and T >= 2:
            # make the time axis strictly increasing (np.interp needs that)
            xp = np.maximum.accumulate(np.asarray(times, dtype=np.float64))
            xp = xp + np.arange(T) * 1e-6
            src = np.linspace(xp[0], xp[-1], self.sequence_length)
        else:
            xp = np.arange(T, dtype=np.float64)
            src = np.linspace(0, T - 1, self.sequence_length)
        X = np.stack(
            [np.interp(src, xp, frames[:, j]) for j in range(frames.shape[1])],
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
        self.holistic = mp.solutions.holistic.Holistic(
            model_complexity=1,
            min_detection_confidence=HOLISTIC_MIN_DETECTION,
            min_tracking_confidence=HOLISTIC_MIN_TRACKING,
        )
        self.hand_detected = False
        self._segment: List[np.ndarray] = []  # frames of the sign in progress
        self._gap: List[np.ndarray] = []  # hand-less frames since last hand frame
        self._seg_ts: List[float] = []  # capture time of each frame in _segment
        self._gap_ts: List[float] = []  # capture time of each frame in _gap
        self._start_ts = 0.0  # time of the first hand frame of the current sign
        self._last_hand_ts = 0.0  # time of the most recent hand frame

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
    def process_frame(self, frame: np.ndarray, ts: Optional[float] = None) -> Optional[Dict]:
        """
        Feed one frame. `ts` is the capture time in seconds (from the browser).
        Returns a prediction dict when a whole sign has just finished,
        otherwise None.
        """
        now = ts if ts is not None else time.monotonic()
        features, hand = self.extract_landmarks(frame)
        self.hand_detected = hand

        if hand:
            if not self._segment:
                self._start_ts = now
            if self._gap:
                # short hand dropout in the middle of a sign: keep those frames
                self._segment.extend(self._gap)
                self._seg_ts.extend(self._gap_ts)
                self._gap, self._gap_ts = [], []
            self._segment.append(features)
            self._seg_ts.append(now)
            self._last_hand_ts = now
            if now - self._start_ts >= MAX_SIGN_SECONDS:
                return self._finish()
        elif self._segment:
            self._gap.append(features)
            self._gap_ts.append(now)
            if now - self._last_hand_ts > END_GAP_SECONDS:
                return self._finish()

        return None

    @staticmethod
    def _segment_stats(segment: List[np.ndarray]) -> Tuple[float, float]:
        """
        Returns (zone_fraction, motion):
          zone_fraction - share of frames with a hand inside the signing zone
          motion        - how far a wrist travelled, in shoulder widths
        Feature layout: pose 0-98, left hand 99-161, right hand 162-224;
        a wrist is landmark 0 of its hand (x, y, z).
        """
        X = np.asarray(segment)
        hands = (
            (slice(99, 162), slice(99, 102)),  # left hand, left wrist
            (slice(162, 225), slice(162, 165)),  # right hand, right wrist
        )
        tracks: List[List[Tuple[float, float]]] = [[], []]
        zone_frames = 0

        for f in X:
            pose_ok = bool(np.any(f[:99]))
            in_zone = False
            for i, (hand_slice, wrist) in enumerate(hands):
                if not np.any(f[hand_slice]):
                    continue  # this hand is not visible in this frame
                if not pose_ok:
                    in_zone = True  # cannot judge height without the pose
                    continue
                x, y = float(f[wrist][0]), float(f[wrist][1])
                tracks[i].append((x, y))
                if y < SIGNING_ZONE_MAX_Y:
                    in_zone = True
            zone_frames += int(in_zone)

        motion = 0.0
        for pts in tracks:
            if len(pts) >= 2:
                motion = max(motion, float(np.max(np.ptp(np.asarray(pts), axis=0))))
        return zone_frames / max(len(X), 1), motion

    @staticmethod
    def _discarded(n: int, reason: str) -> Dict:
        return {
            "sign": "no_sign",
            "confidence": 1.0,
            "processing_time_ms": 0.0,
            "num_frames": n,
            "discarded": True,
            "reason": reason,
        }

    def _finish(self) -> Dict:
        segment = self._segment
        times = self._seg_ts
        duration = max(self._last_hand_ts - self._start_ts, 0.0)
        self.reset()  # trailing hand-less frames are dropped
        n = len(segment)

        if duration < MIN_SIGN_SECONDS or n < MIN_SIGN_FRAMES:
            logger.info(f"Ignored short segment ({n} frames, {duration:.2f}s)")
            return self._discarded(n, f"too_short ({n} frames, {duration:.2f}s)")

        zone_fraction, motion = self._segment_stats(segment)
        if FILTER_NON_SIGNS and (zone_fraction < MIN_ZONE_FRACTION or motion < MIN_MOTION):
            logger.info(
                f"Ignored non-sign segment ({n} frames, {duration:.2f}s, "
                f"zone={zone_fraction:.2f}, motion={motion:.2f})"
            )
            return self._discarded(
                n, f"not_signing (zone={zone_fraction:.2f}, motion={motion:.2f})"
            )

        result = self.ensemble.predict_sequence(np.asarray(segment), np.asarray(times))

        if SAVE_SEGMENTS_DIR:
            try:
                os.makedirs(SAVE_SEGMENTS_DIR, exist_ok=True)
                name = f"{result['sign']}_{result['confidence']:.2f}_{int(time.time() * 1000)}.npy"
                np.save(os.path.join(SAVE_SEGMENTS_DIR, name), np.asarray(segment))
            except Exception as e:
                logger.warning(f"Could not save segment: {e}")

        logger.info(
            f"Sign finished: {result['sign']} ({result['confidence']:.2%}) "
            f"from {n} frames over {duration:.2f}s, zone={zone_fraction:.2f}, "
            f"motion={motion:.2f} | top3={result['top3']}"
        )
        return result

    def reset(self):
        self._segment, self._gap = [], []
        self._seg_ts, self._gap_ts = [], []
        self._start_ts = 0.0
        self._last_hand_ts = 0.0

    def close(self):
        if self.holistic:
            self.holistic.close()
            self.holistic = None