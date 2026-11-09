"""Landmark-only gesture classification; coordinates may be normalized image landmarks."""
from dataclasses import dataclass
from math import hypot
from typing import Sequence


@dataclass
class GestureResult:
    gesture: str = "neutral"
    hands: int = 0
    cursor: tuple[float, float] | None = None
    pinch: str = "idle"
    confidence: float = 0.0
    tracking: str = "lost"
    rotation: tuple[float, float] = (0.0, 0.0)
    zoom: float = 0.0


class GestureClassifier:
    def __init__(self, smooth_frames: int = 3, pinch_start: float = 0.34, pinch_release: float = 0.48):
        self.smooth_frames = max(1, smooth_frames)
        self.pinch_start = pinch_start
        self.pinch_release = pinch_release
        self._history: list[str] = []
        self._pinched = False
        self._prev_centers: list[tuple[float, float]] | None = None
        self._last_fist_center: tuple[float, float] | None = None
        self._fist_neutral_frames: int = 0
        self._prev_span: float | None = None
        self._active_gesture = "neutral"

    @staticmethod
    def _dist(a, b):
        return hypot(a[0] - b[0], a[1] - b[1])

    @classmethod
    def _features(cls, landmarks):
        if landmarks is None or len(landmarks) < 21:
            return None
        points = [
            (float(point.x if hasattr(point, "x") else point[0]),
             float(point.y if hasattr(point, "y") else point[1]))
            for point in landmarks[:21]
        ]
        if not all(-0.5 <= x <= 1.5 and -0.5 <= y <= 1.5 for x, y in points):
            return None
        scale = max(cls._dist(points[0], points[index]) for index in (5, 9, 13, 17))
        if scale < 1e-5:
            return None

        # Compare each fingertip with its own PIP joint relative to the wrist (landmark 0).
        # When extended, the fingertip is farther from the wrist than the PIP joint.
        # When curled into a fist or closed palm, the PIP joint is the apex and the tip curls inward.
        extended = [
            cls._dist(points[tip], points[0]) > cls._dist(points[pip], points[0]) * 1.05
            for tip, pip, mcp in ((8, 6, 5), (12, 10, 9), (16, 14, 13), (20, 18, 17))
        ]
        thumb_ratio = cls._dist(points[4], points[5]) / scale
        extended.append(thumb_ratio > 0.72)
        pinch_ratio = cls._dist(points[4], points[8]) / scale
        center = ((points[0][0] + points[9][0]) / 2, (points[0][1] + points[9][1]) / 2)
        return points, extended, pinch_ratio, center

    def _reset_tracking(self):
        was_pinched = self._pinched
        self._pinched = False
        self._history.clear()
        self._prev_centers = None
        self._last_fist_center = None
        self._fist_neutral_frames = 0
        self._prev_span = None
        self._active_gesture = "neutral"
        return was_pinched

    def update(self, hands: Sequence):
        features = [feature for hand in hands if (feature := self._features(hand)) is not None][:2]
        hand_count = len(features)
        if hand_count == 0:
            was_pinched = self._reset_tracking()
            return GestureResult("neutral", 0, None, "released" if was_pinched else "idle", 0, "lost")

        labels = []
        for _, fingers, pinch_ratio, _ in features:
            finger_count = sum(fingers)
            non_thumb_count = sum(fingers[:4])
            # fingers: [index, middle, ring, pinky, thumb]
            # A closed fist or closed palm has its fingers curled inward.
            # Even if thumb is relaxed or one finger is slightly loose, at most 1 non-thumb
            # finger is extended, or middle, ring, and pinky are all curled.
            is_fist = (non_thumb_count <= 1) or (
                not fingers[1] and not fingers[2] and not fingers[3] and non_thumb_count <= 2
            )
            # A pinch is an intentional pinch between thumb and index while other fingers
            # (middle, ring, pinky) are NOT curled into a fist.
            is_pinch = (
                not is_fist
                and pinch_ratio < (self.pinch_release if self._pinched else self.pinch_start)
                and (fingers[1] or fingers[2])
            )
            is_open_palm = non_thumb_count >= 3 and finger_count >= 4

            if is_fist:
                labels.append("fist")
            elif is_pinch:
                labels.append("pinch")
            elif is_open_palm:
                labels.append("open_palm")
            else:
                labels.append("neutral")

        if hand_count == 2 and labels.count("open_palm") == 2:
            label = "zoom"
        elif hand_count == 1:
            label = labels[0]
        else:
            label = "neutral"

        self._history.append(label)
        self._history = self._history[-self.smooth_frames:]
        # Favor the most recent label on ties (lower reversed index = more recent)
        stable = max(self._history, key=lambda item: (self._history.count(item), -self._history[::-1].index(item)))
        stable_count = self._history.count(stable)
        if len(self._history) < min(2, self.smooth_frames) or stable_count < min(2, self.smooth_frames):
            stable = "neutral"
        confidence = stable_count / len(self._history)

        was_pinched = self._pinched
        self._pinched = stable == "pinch"
        pinch_state = (
            ("pressed" if not was_pinched else "dragging")
            if stable == "pinch"
            else ("released" if was_pinched else "idle")
        )

        centers = [feature[3] for feature in features]
        span = self._dist(*centers) if hand_count == 2 else None
        rotation = (0.0, 0.0)
        zoom = 0.0

        if stable == "fist" and hand_count == 1:
            self._fist_neutral_frames = 0
            center = centers[0]
            if self._last_fist_center is None:
                self._last_fist_center = center
            else:
                dx = center[0] - self._last_fist_center[0]
                dy = center[1] - self._last_fist_center[1]
                # Filter out microscopic sensor noise while preserving intentional movement
                if hypot(dx, dy) < 0.002:
                    dx = 0.0
                    dy = 0.0
                else:
                    self._last_fist_center = center
                rotation = (
                    max(-0.12, min(0.12, dx)),
                    max(-0.12, min(0.12, dy)),
                )
        elif stable == "neutral" and hand_count == 1 and self._last_fist_center is not None:
            # Short neutral classifier transition: keep drag reference aligned without camera movement
            self._fist_neutral_frames += 1
            if self._fist_neutral_frames <= 2:
                self._last_fist_center = centers[0]
            else:
                self._last_fist_center = None
                self._fist_neutral_frames = 0
        else:
            self._last_fist_center = None
            self._fist_neutral_frames = 0

        if stable == "zoom" and self._active_gesture == "zoom" and span is not None and self._prev_span:
            zoom = max(-0.1, min(0.1, (span - self._prev_span) / max(self._prev_span, 0.05)))

        cursor = None
        if stable == "open_palm" and hand_count == 1:
            index_tip = features[0][0][8]
            cursor = (min(1.0, max(0.0, index_tip[0])), min(1.0, max(0.0, index_tip[1])))

        self._prev_centers = centers
        self._prev_span = span
        self._active_gesture = stable
        return GestureResult(stable, hand_count, cursor, pinch_state, confidence, "tracking", rotation, zoom)
