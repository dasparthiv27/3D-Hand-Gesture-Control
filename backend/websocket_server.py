"""Local-only WebSocket gesture service. Camera inference runs outside the browser render loop."""
from __future__ import annotations
import argparse
import asyncio
import base64
import json
import time
from hand_tracker import MODEL, GestureClassifier, open_camera
from message_protocol import gesture_payload

HOST = "127.0.0.1"
PORT = 8765
UPDATE_HZ = 20

async def main(host: str = HOST, port: int = PORT, camera: int = 0):
    try:
        import websockets
    except ImportError as exc:
        raise RuntimeError("WebSocket dependency missing. Activate backend/.venv and install backend/requirements.txt.") from exc
    clients: set = set()
    producer_task: asyncio.Task | None = None
    stop = asyncio.Event()

    async def broadcast(payload: dict):
        if clients:
            data = json.dumps(payload, separators=(",", ":"))
            await asyncio.gather(*(client.send(data) for client in tuple(clients)), return_exceptions=True)

    async def produce():
        cap = detector = None
        try:
            if not MODEL.is_file():
                raise RuntimeError(f"MediaPipe model is missing: {MODEL}. See README.md for the explicit official download command.")
            import cv2
            import mediapipe as mp
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision
            cap = open_camera(camera)
            options = vision.HandLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=str(MODEL)),
                running_mode=vision.RunningMode.VIDEO,
                num_hands=2,
            )
            detector = vision.HandLandmarker.create_from_options(options)
            classifier = GestureClassifier()
            while clients and not stop.is_set():
                started = time.monotonic()
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Camera {camera} opened but did not return a frame.")
                frame = cv2.flip(frame, 1)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                result = detector.detect_for_video(image, int(time.monotonic() * 1000))
                hands = result.hand_landmarks or []
                landmarks = [[[round(float(point.x), 4), round(float(point.y), 4)] for point in hand] for hand in hands]
                preview = cv2.resize(frame, (320, 240), interpolation=cv2.INTER_AREA)
                encoded, jpeg = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_data = f"data:image/jpeg;base64,{base64.b64encode(jpeg).decode('ascii')}" if encoded else None
                await broadcast(gesture_payload(classifier.update(hands), landmarks, frame_data))
                await asyncio.sleep(max(0, (1 / UPDATE_HZ) - (time.monotonic() - started)))
        except Exception as exc:
            await broadcast({"type": "error", "error": str(exc)})
            stop.set()
        finally:
            if cap is not None:
                cap.release()
            if detector is not None:
                detector.close()

    async def handler(websocket):
        nonlocal producer_task
        clients.add(websocket)
        stop.clear()
        if producer_task is None or producer_task.done():
            producer_task = asyncio.create_task(produce())
        try:
            await websocket.wait_closed()
        finally:
            clients.discard(websocket)
            if not clients:
                stop.set()
                if producer_task and not producer_task.done():
                    await producer_task

    async with websockets.serve(handler, host, port, ping_interval=20, ping_timeout=20, max_size=1_000_000):
        print(f"Gesture service listening on ws://{host}:{port} (camera {camera} opens when a client connects)")
        await asyncio.Future()

def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=HOST, help="Bind address (defaults to loopback only)")
    parser.add_argument("--port", default=PORT, type=int)
    parser.add_argument("--camera", default=0, type=int)
    args = parser.parse_args()
    try:
        asyncio.run(main(args.host, args.port, args.camera))
    except KeyboardInterrupt:
        print("Gesture service stopped.")
    except RuntimeError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    except OSError as exc:
        raise SystemExit(f"ERROR: cannot bind ws://{args.host}:{args.port}; check whether the port is already in use or unavailable ({exc})") from exc

if __name__ == "__main__":
    cli()
