# Architecture

## Data flow

1. The React page renders the atom with React Three Fiber. `useFrame` handles orbital motion and applies camera deltas from refs; it does not trigger React renders per frame.
2. Hand control is off by default. When enabled, `useGestures` opens a configurable local WebSocket (`VITE_GESTURE_WS_URL`, default `ws://127.0.0.1:8765`). It validates JSON and reconnects after disconnects.
3. The Python service starts camera capture only after a client connects. It mirrors frames, invokes MediaPipe Tasks Hand Landmarker with a maximum of two hands, and passes landmarks to the existing `GestureClassifier`.
4. The classifier prioritizes two open palms as `zoom`; for one hand it reports `fist`, `open_palm`, `pinch`, or `neutral`. Fist rotation deltas start only after a consecutive fist sample, and the cursor coordinate is populated only for a single open palm. Camera capture and classification remain independent of the browser animation loop.
5. The backend sends one compact JSON snapshot at up to 20 Hz. The frontend uses one mutually exclusive dispatcher: `zoom` applies two-hand separation deltas through OrbitControls' public `dollyIn` API, `fist` applies relative rotation deltas through spherical camera-position changes, and `open_palm` updates only the non-interactive cursor overlay. Legacy `rotate` and `pinch` messages do not invoke camera or pointer actions. Tracking loss clears pending deltas and cursor state; orbital animation is controlled independently.

The service binds to loopback by default and sends a downscaled 320 × 240 JPEG camera preview only to connected local browser clients; frames are not uploaded to an external service. One producer is shared between connected clients, and the webcam is released when the last client disconnects. The MediaPipe model is stored at `backend/models/hand_landmarker.task`.
The browser console logs WebSocket connection state, changes in received message/gesture type, and applied camera actions; camera-action logs are rate-limited to avoid per-frame noise.

## Wire messages

Gesture sample:

```json
{"type":"gesture","gesture":"fist","hands":1,"cursor":null,"pinch":"idle","tracking":"tracking","rotation":[0.01,-0.02],"zoom":0.0,"timestamp":1792790000000}
```

| Field | Meaning |
|---|---|
| `type` | Always `gesture` for a tracking sample. |
| `gesture` | `neutral`, `fist`, `open_palm`, `zoom`, or a legacy `rotate`/`pinch` value. |
| `hands` | Valid tracked hands, 0–2. |
| `cursor` | Normalized `[x,y]` index fingertip position for one open palm, otherwise `null`. |
| `pinch` | Legacy diagnostic state; it does not produce browser pointer events. |
| `tracking` | `tracking` or `lost`. |
| `rotation` | Bounded normalized relative delta pair for a continuing single-fist gesture. |
| `zoom` | Bounded relative distance delta for two open palms. |
| `timestamp` | Unix epoch milliseconds when serialized. |

Startup/camera/model errors use `{"type":"error","error":"readable diagnostic"}`. The browser closes that failed socket and offers a manual retry.
