# 3D Hand Gesture Control

**GESTURE / 3D** — Interactive 3D Hand Control

Explore. Rotate. Zoom. Control with your hands.

An interactive 3D viewer with mouse, touch, and optional webcam-based hand controls. Explore the built-in atom and solar-system scenes, or import your own GLB/GLTF models. Hand tracking runs locally in a Python service and communicates with the React app over a loopback WebSocket.

## Features

- Interactive 3D scenes rendered with Three.js and React Three Fiber.
- Built-in atom visualization with element presets and adjustable proton, neutron, and electron counts.
- Animated solar-system scene and support for importing GLB/GLTF models, including animations and companion assets.
- Mouse drag, scroll, and touch controls for rotating and zooming; camera panning is also available.
- Optional MediaPipe hand tracking with a live camera preview, 21-point hand landmarks, gesture recognition, and pinch-state diagnostics.
- Gesture-based camera rotation and zoom, an enable/disable toggle, and adjustable sensitivity.
- Local-only Python WebSocket service; camera capture starts only while a browser client is connected.
- Responsive dark interface with cyan and electric-blue accents.

## Screenshots

Screenshots are not included yet. Add captures from the running app here when available.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| 3D rendering | Three.js, React Three Fiber, Drei |
| Hand tracking | Python, OpenCV, MediaPipe Tasks Hand Landmarker |
| Communication | WebSockets |
| Tests | Vitest, Testing Library, pytest |

## Architecture

```text
React UI ── React Three Fiber / Three.js
   │
   └── WebSocket (ws://127.0.0.1:8765)
             │
             └── Python service ── OpenCV camera ── MediaPipe
                                        │
                                        └── Gesture classifier
```

Hand controls are off by default. When enabled, the browser connects to the local Python service. The service opens the camera, detects up to two hands, classifies gestures, and sends validated gesture state, landmarks, and a small camera preview to the browser. The service binds to loopback by default; it does not upload camera frames to an external service. See [docs/architecture.md](docs/architecture.md) for message details and data flow.

## Project structure

```text
.
├── backend/
│   ├── models/hand_landmarker.task  # MediaPipe Hand Landmarker model
│   ├── tests/                       # Backend tests and camera diagnostics
│   ├── gesture_classifier.py
│   ├── hand_tracker.py
│   ├── message_protocol.py
│   └── websocket_server.py
├── docs/
│   └── architecture.md
├── frontend/
│   ├── src/
│   │   ├── components/              # Camera preview and control panels
│   │   ├── hooks/                   # WebSocket gesture hook
│   │   ├── models/                  # External model import
│   │   ├── scene/                   # 3D scenes and gesture camera controls
│   │   ├── services/                # Gesture mapping
│   │   └── styles/
│   ├── index.html
│   └── package.json
└── README.md
```

## Requirements

- Node.js 22.12 or newer (or Node.js 20.19 or newer) and npm.
- Python 3 with `venv` support and pip.
- A webcam for live hand tracking; the 3D viewer works without one.
- On Ubuntu, OpenCV may require system libraries such as `libgl1` and `libglib2.0-0`.

The MediaPipe model is included at `backend/models/hand_landmarker.task`. If it is missing, download the official compatible model to that path:

```bash
mkdir -p backend/models
curl -fL 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' -o backend/models/hand_landmarker.task
```

## Installation and startup

From the project root, create and populate the Python environment:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

In a second terminal, start the frontend with the requested command:

```bash
cd frontend && npm install && npm run dev
```

To start the backend, run these commands from the project root in another terminal:

```bash
source backend/.venv/bin/activate
python3 backend/websocket_server.py --camera 0
```

Open the Vite URL shown in the frontend terminal (normally <http://localhost:5173>). The WebSocket endpoint defaults to `ws://127.0.0.1:8765`. To use another endpoint, set `VITE_GESTURE_WS_URL` in `frontend/.env.local` and restart Vite; do not commit local `.env` files.

## GitHub Pages deployment

The GitHub Actions workflow builds and deploys the frontend to GitHub Pages whenever changes are pushed to `main`. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. The site is available at <https://dasparthiv27.github.io/3D-Hand-Gesture-Control/> after the deployment workflow completes.

GitHub Pages hosts only the static frontend. Hand tracking requires the separate Python WebSocket service to be running and reachable by the browser.

## Controls

### Mouse and touch

- Drag to rotate the scene.
- Scroll or pinch with touch to zoom.
- Use right-drag or a two-finger motion to pan.
- Press **Space** to pause or resume animation, **R** to reset the view, and **Escape** to close the controls panel.

### Hand gestures

1. Start the Python service and allow camera access on your device.
2. Select **Hand controls** in the app to connect and start camera tracking.
3. Hold one hand in view and make the gesture you want:
   - **Closed fist:** move your fist to rotate the scene.
   - **Open palm:** move the on-screen cursor; it does not click or interact with page controls.
   - **Two open palms:** move your hands apart or together to zoom.
   - **Pinch:** detected and displayed as a diagnostic state; it does not trigger browser clicks.
4. Adjust **Sensitivity** in the hand-control panel to tune rotation and zoom.
5. Turn hand controls off to disconnect and release the camera. Mouse and touch remain available.

## Tests

Run frontend tests and a production build:

```bash
cd frontend
npm test
npm run build
```

Run backend tests from the project root with the virtual environment activated:

```bash
python -m pytest backend/tests -v
python -m py_compile backend/*.py backend/tests/*.py
```

The automated tests do not require a webcam. Standalone camera, landmark, gesture, and cursor diagnostics are available in `backend/tests/`; they require a camera, and the landmark-based diagnostics also require the model.

## Troubleshooting

- **Cannot reach the gesture service:** Confirm the backend is running and the URL is `ws://127.0.0.1:8765`. Use **Retry** in the app after restarting the service.
- **Camera cannot be opened:** Check that the selected `--camera` index is correct, the device is connected, camera permissions are granted, and another application is not using it.
- **No hands detected or tracking is unstable:** Improve lighting, keep your hand fully in frame, and move steadily. Tracking loss clears pending camera movement.
- **Model file missing:** Check for `backend/models/hand_landmarker.task` and use the download command above if needed.
- **Import fails:** Select `.glb` or `.gltf` files. For GLTF models, select the JSON file together with any referenced companion assets. Each selected file is limited to 50 MB.
- **Camera preview is blank:** The preview is sent only while the local service is connected and tracking is active. Restart the backend and reconnect hand controls.
