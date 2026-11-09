"""Compact JSON schema shared by the local Python service and the browser."""
from __future__ import annotations
import json
import time
import math
from gesture_classifier import GestureResult

GESTURES = {"neutral", "rotate", "zoom", "pinch", "fist", "open_palm"}
PINCH_STATES = {"idle", "pressed", "dragging", "released"}

def gesture_payload(result: GestureResult, landmarks: list[list[list[float]]] | None = None, frame: str | None = None) -> dict:
    payload = {
        "type": "gesture", "gesture": result.gesture, "hands": result.hands,
        "cursor": list(result.cursor) if result.cursor is not None else None,
        "pinch": result.pinch, "tracking": result.tracking,
        "rotation": list(result.rotation), "zoom": result.zoom,
        "timestamp": round(time.time() * 1000),
        "landmarks": landmarks or [],
        "frame": frame,
    }
    validate_payload(payload)
    return payload

def validate_payload(payload: dict) -> dict:
    if not isinstance(payload, dict) or payload.get("type") != "gesture":
        raise ValueError("expected gesture message")
    if payload.get("gesture") not in GESTURES:
        raise ValueError("invalid gesture name")
    if type(payload.get("hands")) is not int or not 0 <= payload["hands"] <= 2:
        raise ValueError("hands must be an integer from 0 to 2")
    cursor = payload.get("cursor")
    if cursor is not None and (not isinstance(cursor, list) or len(cursor) != 2 or any(not isinstance(v, (int,float)) or not 0 <= v <= 1 for v in cursor)):
        raise ValueError("cursor must be null or normalized [x, y]")
    if payload.get("pinch") not in PINCH_STATES:
        raise ValueError("invalid pinch state")
    if payload.get("tracking") not in {"tracking", "lost"}:
        raise ValueError("invalid tracking status")
    rotation = payload.get("rotation")
    if not isinstance(rotation, list) or len(rotation) != 2 or any(not isinstance(v, (int,float)) or not math.isfinite(v) for v in rotation):
        raise ValueError("rotation must contain two finite deltas")
    if not isinstance(payload.get("zoom"), (int,float)) or not math.isfinite(payload["zoom"]):
        raise ValueError("zoom must be finite and numeric")
    landmarks = payload.get("landmarks", [])
    if not isinstance(landmarks, list) or len(landmarks) > 2:
        raise ValueError("landmarks must contain at most two hands")
    for hand in landmarks:
        if not isinstance(hand, list) or len(hand) != 21 or any(
            not isinstance(point, list) or len(point) != 2 or
            any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in point)
            for point in hand
        ):
            raise ValueError("each hand must contain 21 normalized [x, y] landmarks")
    frame = payload.get("frame")
    if frame is not None and not isinstance(frame, str):
        raise ValueError("frame must be a data URL string or null")
    return payload

def encode_message(payload: dict) -> str:
    return json.dumps(validate_payload(payload), separators=(",", ":"))
