"""Standalone Linux webcam viewer and MediaPipe Hand Landmarker diagnostics."""
from __future__ import annotations
import argparse
import time
from pathlib import Path
cv2 = None
from gesture_classifier import GestureClassifier

MODEL = Path(__file__).parent / "models" / "hand_landmarker.task"
CONNECTIONS = [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),(9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17)]

def require_opencv():
    global cv2
    if cv2 is None:
        try:
            import cv2 as opencv
            cv2 = opencv
        except ImportError as exc:
            raise RuntimeError("OpenCV is not installed in this environment. Activate backend/.venv and run: python -m pip install -r backend/requirements.txt") from exc

def open_camera(index: int):
    require_opencv()
    cap = cv2.VideoCapture(index, cv2.CAP_V4L2)
    if not cap.isOpened():
        cap.release()
        raise RuntimeError(f"Cannot open camera index {index}. Check that /dev/video{index} exists, your user has camera permission, and no other process is using it.")
    return cap

def load_detector():
    if not MODEL.is_file():
        raise RuntimeError(f"MediaPipe model file is missing: {MODEL}\nDownload it explicitly using the command in README.md.")
    try:
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
    except (ImportError, AttributeError) as exc:
        raise RuntimeError("MediaPipe Tasks is unavailable in this Python environment. See README.md for supported Python setup and install instructions.") from exc
    options = vision.HandLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
    )
    return mp, vision.HandLandmarker.create_from_options(options)

def draw_landmarks(frame, landmarks, label):
    height, width = frame.shape[:2]
    pts = [(int(p.x * width), int(p.y * height)) for p in landmarks]
    for a, b in CONNECTIONS:
        cv2.line(frame, pts[a], pts[b], (170, 175, 190), 2)
    for pt in pts:
        cv2.circle(frame, pt, 4, (30, 220, 250), -1)
    cv2.putText(frame, label, pts[0], cv2.FONT_HERSHEY_SIMPLEX, .6, (255,255,255), 2)

def run(mode="gesture", camera=0):
    if mode not in {"camera", "landmarks", "gesture", "cursor"}:
        raise ValueError(f"Unknown mode: {mode}")
    require_opencv()
    mp = detector = None
    if mode != "camera":
        mp, detector = load_detector()
    cap = None
    classifier = GestureClassifier()
    fps = 0.0
    previous = time.monotonic()
    pinch_state = "idle"
    try:
        cap = open_camera(camera)
        while True:
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError("Camera opened but failed to provide a frame. Check the device or reconnect the camera.")
            frame = cv2.flip(frame, 1)
            status = "Camera ready"
            out = None
            if detector:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = detector.detect_for_video(image, int(time.monotonic() * 1000))
                hands = result.hand_landmarks or []
                out = classifier.update(hands)
                for i, landmarks in enumerate(hands):
                    handed = result.handedness[i][0].category_name if result.handedness and i < len(result.handedness) else f"Hand {i+1}"
                    draw_landmarks(frame, landmarks, handed)
                pinch_state = out.pinch
                status = f"Hands: {out.hands} | Gesture: {out.gesture} | Tracking: {out.tracking}"
            now = time.monotonic()
            elapsed = now - previous
            fps = .9 * fps + .1 / elapsed if fps else 1 / elapsed
            previous = now
            if mode == "camera": lines = ["Camera preview", f"FPS: {fps:.1f}", "Q / Esc to quit"]
            elif mode == "landmarks": lines = [status, f"FPS: {fps:.1f}", "Q / Esc to quit"]
            elif mode == "gesture": lines = [status, f"Confidence/stability: {out.confidence:.0%}", f"FPS: {fps:.1f} | Q / Esc to quit"]
            else:
                cursor = out.cursor
                coords = f"{cursor[0]:.3f}, {cursor[1]:.3f}" if cursor else "unavailable"
                lines = [status, f"Cursor (normalized): {coords}", f"Pinch: {pinch_state} | FPS: {fps:.1f} | Q / Esc"]
            cv2.rectangle(frame, (0,0), (frame.shape[1], 100), (10,14,28), -1)
            for i, line in enumerate(lines):
                cv2.putText(frame, line, (14,27+i*30), cv2.FONT_HERSHEY_SIMPLEX, .62, (225,235,245), 2)
            cv2.imshow("3D Hand Gesture Control - Hand Tracking Lab", frame)
            key = cv2.waitKey(1) & 0xff
            if key in (27, ord("q"), ord("Q")):
                break
    finally:
        if cap is not None:
            cap.release()
        if detector:
            detector.close()
        cv2.destroyAllWindows()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["camera","landmarks","gesture","cursor"], default="gesture")
    parser.add_argument("--camera", type=int, default=0, help="Linux camera device index (default: 0)")
    args = parser.parse_args()
    try:
        run(args.mode, args.camera)
    except RuntimeError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc

if __name__ == "__main__":
    main()
