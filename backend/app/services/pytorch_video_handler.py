"""
WebSocket handler for real-time video streaming with PyTorch sign recognition.

Per connection:
  - its own SignSession (own MediaPipe Holistic + own sign buffer)
  - frames are read by a background task into a small queue; if processing
    falls behind, the OLDEST frames are dropped so latency never builds up
  - MediaPipe + model inference run in a worker thread, not on the event loop

Messages sent to the client:
  {"type": "sign_start"}                      hand appeared, a sign is being recorded
  {"type": "prediction", "sign": ..., ...}    one whole sign finished and classified
"""

import asyncio
import base64
import json
import logging
import threading
from pathlib import Path

import cv2
import numpy as np
from fastapi import WebSocket

logger = logging.getLogger(__name__)

MAX_QUEUED_FRAMES = 8
IDLE_TIMEOUT_S = 30.0


class PyTorchVideoStreamHandler:
    """Handle WebSocket connections for real-time sign recognition."""

    def __init__(self, sign_recognizer=None):
        """
        Args:
            sign_recognizer: optional shared SignModelEnsemble. If None it is
            loaded lazily on first use.
        """
        self.ensemble = sign_recognizer
        self.connection_count = 0
        self._load_lock = threading.Lock()

    def _ensure_ensemble(self):
        """Load the shared models once (thread-safe)."""
        with self._load_lock:
            if self.ensemble is not None:
                return

            from app.services.pytorch_sign_recognizer import SignModelEnsemble

            model_dir = Path(__file__).parent.parent / "SignRecognition"
            model_files = sorted(model_dir.glob("best_*.pt"))
            if not model_files:
                raise RuntimeError("No best_*.pt model files found")

            classes_file = model_dir / "classes.txt"
            if not classes_file.exists():
                raise RuntimeError(f"classes.txt not found at {classes_file}")

            self.ensemble = SignModelEnsemble(
                model_paths=[str(m) for m in model_files],
                classes_file=str(classes_file),
            )

    async def handle_connection(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        self.connection_count += 1
        connection_id = self.connection_count
        logger.info(f"[WS {connection_id}] User {user_id} connected to room {room_id}")

        frame_count = prediction_count = error_count = 0
        session = None
        reader_task = None

        try:
            await asyncio.to_thread(self._ensure_ensemble)

            from app.services.pytorch_sign_recognizer import SignSession

            session = SignSession(self.ensemble)  # private buffer + Holistic
            queue: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUED_FRAMES)

            async def reader():
                """Read from the socket as fast as possible; drop oldest if full."""
                try:
                    while True:
                        data = await websocket.receive_text()
                        if queue.full():
                            try:
                                queue.get_nowait()
                            except asyncio.QueueEmpty:
                                pass
                        queue.put_nowait(data)
                except Exception:
                    pass  # client disconnected or receive error
                finally:
                    if queue.full():
                        try:
                            queue.get_nowait()
                        except asyncio.QueueEmpty:
                            pass
                    queue.put_nowait(None)  # wake the consumer

            reader_task = asyncio.create_task(reader())

            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=IDLE_TIMEOUT_S)
                except asyncio.TimeoutError:
                    logger.warning(f"[WS {connection_id}] No frames for {IDLE_TIMEOUT_S}s")
                    break

                if data is None:
                    break  # disconnected

                try:
                    message = json.loads(data)
                except json.JSONDecodeError as e:
                    error_count += 1
                    logger.error(f"[WS {connection_id}] Invalid JSON: {e}")
                    continue

                msg_type = message.get("type")
                if msg_type == "close":
                    logger.info(f"[WS {connection_id}] Client requested close")
                    break
                if msg_type != "frame":
                    continue

                frame_count += 1
                try:
                    frame_bytes = base64.b64decode(message["data"])
                    frame = cv2.imdecode(
                        np.frombuffer(frame_bytes, dtype=np.uint8), cv2.IMREAD_COLOR
                    )
                    if frame is None:
                        error_count += 1
                        continue

                    was_in_sign = session.in_sign
                    event = await asyncio.to_thread(session.process_frame, frame)

                    if not was_in_sign and session.in_sign:
                        await websocket.send_text(json.dumps({"type": "sign_start"}))

                    if event is not None:
                        prediction_count += 1
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "prediction",
                                    "room_id": room_id,
                                    "user_id": user_id,
                                    "frame_number": frame_count,
                                    "prediction_number": prediction_count,
                                    "sign": event["sign"],
                                    "confidence": event["confidence"],
                                    "processing_time_ms": event["processing_time_ms"],
                                    "num_frames": event["num_frames"],
                                    "top3": event.get("top3", []),
                                    # a finished sign always means a hand was present
                                    "hand_detected": True,
                                }
                            )
                        )

                except Exception as e:
                    error_count += 1
                    logger.error(f"[WS {connection_id}] Error processing frame {frame_count}: {e}")
                    if error_count > 20:
                        logger.error(f"[WS {connection_id}] Too many errors, closing")
                        break

        except Exception as e:
            logger.error(f"[WS {connection_id}] Unexpected error: {e}")

        finally:
            if reader_task:
                reader_task.cancel()
            if session:
                session.close()
            try:
                await websocket.close()
            except Exception as close_error:
                logger.warning(f"[WS {connection_id}] Error closing WebSocket: {close_error}")

            logger.info(
                f"[WS {connection_id}] Closed. Frames: {frame_count}, "
                f"Predictions: {prediction_count}, Errors: {error_count}"
            )

    def close(self):
        """Nothing to clean up: sessions close themselves per connection."""
        pass