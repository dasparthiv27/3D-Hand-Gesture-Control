
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Atom,
  Hand,
  MousePointer2,
  RotateCcw,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Box,
  Sun,
  Upload,
  Trash2,
} from 'lucide-react';

import AtomScene, { type AtomConfig } from './scene/AtomScene';
import ControlPanel from './components/ControlPanel';
import CameraPreview from './components/CameraPreview';
import { useGestures } from './hooks/useGestures';
import type { GestureMessage } from './types/gesture';
import { elements } from './data/elements';
import { dispatchGesture } from './services/gestureMapper';
import { disposeImportedModel, loadModel, type ImportedModel } from './models/importModel';
import './styles/library.css';

const endpoint = () =>
  import.meta.env.VITE_GESTURE_WS_URL || 'ws://127.0.0.1:8765';

export default function App() {
  const [config, setConfig] = useState<AtomConfig>({
    protons: 6,
    neutrons: 6,
    electrons: 6,
  });
  const [playing, setPlaying] = useState(true);
  const [gesturesEnabled, setGesturesEnabled] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.65);
  const [panel, setPanel] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [message, setMessage] = useState<GestureMessage | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [sceneKind, setSceneKind] = useState<'atom' | 'solar' | 'model'>('atom');
  const [models, setModels] = useState<ImportedModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelError, setModelError] = useState('');
  const [modelPlaying, setModelPlaying] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeModel = models.find((item) => item.id === activeModelId) ?? null;

  const importFiles = async (files: FileList | null) => {
    if (!files?.length || loadingModel) return;
    setLoadingModel(true); setModelError('');
    try {
      const imported = await loadModel(files);
      setModels((current) => current.some((item) => item.id === imported.id) ? current : [...current, imported]);
      setActiveModelId(imported.id); setSceneKind('model'); setModelPlaying(true);
      setResetKey((value) => value + 1);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Model import failed.');
    } finally { setLoadingModel(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const rotation = useRef<[number, number]>([0, 0]);
  const zoom = useRef(0);

  const accept = useCallback(
    (m: GestureMessage) => {
      setMessage(m);

      // Tracking loss must release all pending actions.
      if (m.tracking !== 'tracking') {
        rotation.current = [0, 0];
        zoom.current = 0;
        setCursor(null);
        return;
      }

      const action = dispatchGesture(m, sensitivity);

      switch (action.kind) {
        case 'cursor':
          // Open palm controls the pointer only.
          rotation.current = [0, 0];
          zoom.current = 0;
          setCursor(action.position);
          break;

        case 'rotate':
          // Closed fist controls camera rotation only.
          setCursor(null);
          zoom.current = 0;
          rotation.current = [
            rotation.current[0] + action.delta[0],
            rotation.current[1] + action.delta[1],
          ];
          break;

        case 'zoom':
          // Two open palms control zoom only.
          setCursor(null);
          rotation.current = [0, 0];
          zoom.current += action.delta;
          break;

        case 'none':
          rotation.current = [0, 0];
          zoom.current = 0;

          // Do not hide the pointer on a temporary neutral frame.
          // Hide it when another non-neutral gesture takes over.
          if (m.gesture !== 'neutral') {
            setCursor(null);
          }
          break;
      }
    },
    [sensitivity],
  );

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key.toLowerCase() === 'r') {
        setResetKey((v) => v + 1);
      } else if (e.key === 'Escape') {
        setPanel(false);
      }
    };

    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const socket = useGestures(endpoint(), gesturesEnabled, accept);
  const reset = () => setResetKey((v) => v + 1);

  const toggleGestures = () => {
    if (gesturesEnabled) {
      setCursor(null);
      rotation.current = [0, 0];
      zoom.current = 0;
    }
    setGesturesEnabled((v) => !v);
  };

  const gestureName =
    message?.tracking !== 'tracking'
      ? 'Waiting for hands'
      : message.gesture === 'fist'
        ? 'Closed fist · rotate'
        : message.gesture === 'open_palm'
          ? 'Open palm · pointer'
          : message.gesture === 'zoom'
            ? 'Two open palms · zoom'
            : 'Neutral';

  const connected = socket.status === 'connected';
  const identity = elements[config.protons - 1];

  return (
    <main className="app-shell">
      <div className="scene">
        <AtomScene
          config={config}
          playing={sceneKind === 'atom' ? playing : modelPlaying}
          gestureRotation={rotation}
          gestureZoom={zoom}
          resetKey={resetKey}
          sceneKind={sceneKind}
          model={activeModel}
        />

        <div className="scene-vignette" />

        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <Atom size={21} />
            </div>
            <div>
              <b>
                GESTURE<span> / </span>3D
              </b>
              <small>INTERACTIVE 3D HAND CONTROL</small>
            </div>
          </div>

          <div className="top-meta">
            <span className="live-dot" />
            VISUALIZATION LIVE <i />
          </div>

          <button
            className="icon-button panel-toggle"
            onClick={() => setPanel((v) => !v)}
            aria-label="Toggle atom controls"
          >
            <SlidersHorizontal size={18} />
          </button>
        </header>

        <div className="scene-caption">
          <span className="eyebrow">
            {identity
              ? `ELEMENT ${String(config.protons).padStart(3, '0')} · ${identity.name.toUpperCase()}`
              : 'CUSTOM CONFIGURATION'}
          </span>
            <h1>{sceneKind === 'atom' ? 'Atoms, in motion.' : sceneKind === 'solar' ? 'Worlds in orbit.' : activeModel?.name ?? '3D model'}</h1>
          <p className="scene-tagline">Explore. Rotate. Zoom. Control with your hands.</p>
          <p className="scene-description">{sceneKind === 'atom' ? 'Explore the building blocks of matter in three dimensions.' : sceneKind === 'solar' ? 'A simplified animated model of our solar system.' : `${activeModel?.format.toUpperCase() ?? '3D'} · drag or use hand controls to explore`}</p>
        </div>

        <div className="scene-tools">
          <button className="icon-button" onClick={reset} title="Reset camera">
            <RotateCcw size={17} />
          </button>
          <span>{(sceneKind === 'atom' ? playing : modelPlaying) ? 'MOTION ON' : 'MOTION PAUSED'}</span>
        </div>

        <section className="library panel" aria-label="Scene and model library">
          <div className="library-head"><span className="eyebrow">SCENE LIBRARY</span><button className="add-model" onClick={() => fileInput.current?.click()} disabled={loadingModel}><Upload size={14}/>{loadingModel ? 'Loading…' : 'Add 3D Model'}</button></div>
          <input ref={fileInput} className="hidden-input" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(event) => void importFiles(event.target.files)} aria-label="Choose GLB or GLTF model" />
          <div className="scene-list">
            <button className={sceneKind === 'atom' ? 'scene-item active' : 'scene-item'} onClick={() => { setSceneKind('atom'); setResetKey((v) => v + 1); }}><Atom size={16}/><span><b>Atom</b><small>Interactive element model</small></span></button>
            <button className={sceneKind === 'solar' ? 'scene-item active' : 'scene-item'} onClick={() => { setSceneKind('solar'); setResetKey((v) => v + 1); }}><Sun size={16}/><span><b>Solar System</b><small>Animated orbital scene</small></span></button>
            {models.map((item) => <div className={`scene-item ${activeModelId === item.id && sceneKind === 'model' ? 'active' : ''}`} key={item.id}><button onClick={() => { setActiveModelId(item.id); setSceneKind('model'); setModelPlaying(true); setResetKey((v) => v + 1); }}><Box size={16}/><span><b>{item.name}</b><small>{item.format.toUpperCase()} · {item.animations.length ? `${item.animations.length} animations` : 'static model'}</small></span></button><button className="remove-model" title={`Rename ${item.name}`} aria-label={`Rename ${item.name}`} onClick={() => { const name = window.prompt('Model display name', item.name)?.trim(); if (name) setModels((current) => current.map((model) => model.id === item.id ? { ...model, name } : model)); }}>✎</button><button className="remove-model" title={`Remove ${item.name}`} aria-label={`Remove ${item.name}`} onClick={() => { if (window.confirm(`Remove “${item.name}” from this session?`)) { disposeImportedModel(item); setModels((current) => current.filter((model) => model.id !== item.id)); if (activeModelId === item.id) { setActiveModelId(null); setSceneKind('atom'); } } }}><Trash2 size={14}/></button></div>)}
          </div>
          {modelError && <p className="model-error" role="alert">{modelError}</p>}
          {loadingModel && <p className="model-loading" role="status">Parsing model and preparing scene…</p>}
          {sceneKind === 'model' && activeModel?.animations.length ? <button className="animation-toggle" onClick={() => setModelPlaying((value) => !value)}>{modelPlaying ? 'Pause model animation' : 'Play model animation'}</button> : null}
        </section>

        <div className="axis-label label-x">X</div>
        <div className="axis-label label-y">Y</div>
        <div className="axis-label label-z">Z</div>

        <div className="bottom-note">
          EDUCATIONAL MODEL <span>·</span> NOT TO SCALE
        </div>
      </div>

      {panel && (
        <aside className="side-rail">
          <CameraPreview
            message={message}
            enabled={gesturesEnabled}
            connected={connected}
            error={socket.error}
          />

          {sceneKind === 'atom' && <ControlPanel
            config={config}
            setConfig={setConfig}
            playing={playing}
            setPlaying={setPlaying}
            reset={reset}
            resetAtom={() => {
              setConfig({ protons: 6, neutrons: 6, electrons: 6 });
              setPlaying(true);
              reset();
            }}
          />}

          <section className="panel hand-panel">
            <header className="hand-head">
              <div className="hand-icon">
                <Hand size={17} />
              </div>
              <div>
                <div className="eyebrow">OPTIONAL INPUT</div>
                <h3>Hand controls</h3>
              </div>
              <button
                className={`switch ${gesturesEnabled ? 'on' : ''}`}
                onClick={toggleGestures}
                aria-label="Toggle hand controls"
                aria-pressed={gesturesEnabled}
              >
                <span />
              </button>
            </header>

            <div className="connection">
              <span
                className={`connection-dot ${
                  connected
                    ? 'connected'
                    : socket.status === 'error'
                      ? 'error'
                      : ''
                }`}
              />
              <b>
                {connected
                  ? 'Service connected'
                  : gesturesEnabled
                    ? socket.status === 'connecting'
                      ? 'Connecting…'
                      : 'Disconnected'
                    : 'Disabled'}
              </b>
              <span className="connection-icon">
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              </span>
            </div>

            {socket.error && (
              <div className="error-box">
                <span>{socket.error}</span>
                <button onClick={socket.reconnect}>Retry</button>
              </div>
            )}

            <div className="gesture-status">
              <span>DETECTED INPUT</span>
              <b>{gestureName}</b>
              <small>
                {message?.hands ?? 0} hands detected
                {message?.gesture === 'open_palm' && message.cursor
                  ? ` · cursor ${(message.cursor[0] * 100).toFixed(0)}%, ${(message.cursor[1] * 100).toFixed(0)}%`
                  : ''}
              </small>
            </div>

            <label className="sensitivity">
              Sensitivity <strong>{Math.round(sensitivity * 100)}%</strong>
              <input
                type="range"
                min="0.2"
                max="1.4"
                step="0.05"
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
              />
            </label>

            <div className="gesture-guide">
              <div>
                <span className="gesture-glyph">✊</span>
                <span>
                  <b>Closed fist</b>
                  <small>Move your fist to rotate</small>
                </span>
              </div>
              <div>
                <span className="gesture-glyph">✋</span>
                <span>
                  <b>Open palm</b>
                  <small>Move the cursor freely</small>
                </span>
              </div>
              <div>
                <span className="gesture-glyph">↔</span>
                <span>
                  <b>Two open palms</b>
                  <small>Move apart or together to zoom</small>
                </span>
              </div>
            </div>

            <p className="fallback">
              <MousePointer2 size={14} />
              Mouse drag and scroll work anytime. Enable hand controls to use
              the camera.
            </p>
          </section>
        </aside>
      )}

      <div className="footer">
        <span>
          <Activity size={13} /> GESTURE / 3D
        </span>
        <span>
          DRAG TO ROTATE <i /> SCROLL TO ZOOM <i /> TOUCH TO EXPLORE
        </span>
        <span>3D HAND CONTROL</span>
      </div>

      {gesturesEnabled && cursor && (
        <div
          className="gesture-cursor"
          style={{
            position: 'fixed',
            left: `${cursor[0] * 100}vw`,
            top: `${cursor[1] * 100}vh`,
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <span />
        </div>
      )}
    </main>
  );
}
