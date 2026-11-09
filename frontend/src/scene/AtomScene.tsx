import { memo, useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { applyGestureActions } from './gestureCamera';
import SolarSystem from './SolarSystem';
import type { ImportedModel } from '../models/importModel';

export type AtomConfig = {
  protons: number;
  neutrons: number;
  electrons: number;
};

type Props = {
  config: AtomConfig;
  playing: boolean;
  gestureRotation: MutableRefObject<[number, number]>;
  gestureZoom: MutableRefObject<number>;
  resetKey: number;
  sceneKind: 'atom' | 'solar' | 'model';
  model: ImportedModel | null;
};

function Particle({
  position,
  color,
  radius,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.26}
      />
    </mesh>
  );
}

function Electron({
  radius,
  angle,
  speed,
  color,
  playing,
}: {
  radius: number;
  angle: number;
  speed: number;
  color: string;
  playing: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useRef(angle);

  useFrame((_, dt) => {
    if (ref.current && playing) {
      phase.current += dt * speed;
      const a = phase.current;
      ref.current.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
  });

  return (
    <mesh ref={ref} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
      <sphereGeometry args={[0.065, 14, 14]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Orbit({
  index,
  count,
  playing,
}: {
  index: number;
  count: number;
  playing: boolean;
}) {
  const orbit = useRef<THREE.Group>(null);
  const radius = 2.15 + (index % 3) * 0.25;

  useFrame((_, dt) => {
    if (orbit.current && playing) {
      orbit.current.rotation.z += dt * (index % 2 ? 0.12 : -0.11);
    }
  });

  return (
    <group rotation={[index * 0.77, index * 0.43, index * 0.2]}>
      <group ref={orbit}>
        <mesh>
          <torusGeometry args={[radius, 0.006, 6, 128]} />
          <meshBasicMaterial
            color={index % 2 ? '#bc9eff' : '#67eaff'}
            transparent
            opacity={0.34}
          />
        </mesh>
        {Array.from({ length: count }, (_, n) => (
          <Electron
            key={n}
            radius={radius}
            angle={n * 2.399 + index * 0.4}
            speed={0.48 + index * 0.09}
            color={index % 2 ? '#d8c9ff' : '#a5f4ff'}
            playing={playing}
          />
        ))}
      </group>
    </group>
  );
}

function Nucleus({ config }: { config: AtomConfig }) {
  const parts = useMemo(() => {
    const count = config.protons + config.neutrons;
    const capacities = [1, 12, 20, 27];
    const radii = [0, 0.58, 0.9, 1.2];
    const result: { position: [number, number, number]; proton: boolean }[] = [];
    let index = 0;

    for (let shell = 0; shell < capacities.length && index < count; shell++) {
      const take = Math.min(capacities[shell], count - index);
      for (let j = 0; j < take; j++) {
        if (shell === 0) {
          result.push({ position: [0, 0, 0], proton: index < config.protons });
        } else {
          const z = 1 - 2 * ((j + 0.5) / capacities[shell]);
          const ring = Math.sqrt(1 - z * z);
          const angle = j * 2.399 + shell * 0.71;
          const radius = radii[shell];
          result.push({
            position: [
              radius * ring * Math.cos(angle),
              radius * ring * Math.sin(angle),
              radius * z,
            ],
            proton: index < config.protons,
          });
        }
        index++;
      }
    }
    return result;
  }, [config.protons, config.neutrons]);

  return (
    <group rotation={[0.43, 0.31, 0.2]}>
      {parts.map((p, i) => (
        <Particle
          key={i}
          position={p.position}
          radius={0.2}
          color={p.proton ? '#ff745d' : '#7188ff'}
        />
      ))}
    </group>
  );
}

function Content({
  config,
  playing,
  gestureRotation,
  gestureZoom,
  resetKey,
  sceneKind,
  model,
}: {
  config: AtomConfig;
  playing: boolean;
  gestureRotation: Props['gestureRotation'];
  gestureZoom: Props['gestureZoom'];
  resetKey: number;
  sceneKind: Props['sceneKind'];
  model: ImportedModel | null;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const reset = useRef(resetKey);
  const lastGestureLog = useRef(0);

  useFrame(() => {
    if (controls.current) {
      const rotation = gestureRotation.current;
      const zoom = gestureZoom.current;

      if (rotation[0] || rotation[1] || zoom) {
        const actions = {
          rotation: (rotation[0] || rotation[1]) ? (rotation as [number, number]) : null,
          zoom: zoom || null,
        };
        const changed = applyGestureActions(controls.current, actions);
        gestureRotation.current = [0, 0];
        gestureZoom.current = 0;

        if (changed && Date.now() - lastGestureLog.current >= 1000) {
          console.debug(
            '[gesture-scene] Applied camera action',
            rotation[0] || rotation[1] ? 'rotation' : 'zoom',
          );
          lastGestureLog.current = Date.now();
        }
      }

      if (reset.current !== resetKey) {
        controls.current.reset();
        reset.current = resetKey;
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#070b16']} />
      <fog attach="fog" args={['#070b16', 9, 23]} />
      <ambientLight intensity={0.8} />
      <pointLight position={[4, 3, 5]} color="#8aaaff" intensity={22} />
      <pointLight position={[-4, -2, -3]} color="#a65cff" intensity={14} />
      <Stars radius={80} depth={45} count={1300} factor={2} saturation={0.55} fade speed={0.25} />
      <pointLight color="#ff8566" intensity={1.3} distance={3.5} />
      {sceneKind === 'atom' && <>
        <Nucleus config={config} />
        {[2, 8, 18, 8].map((capacity, i) => {
          const before = [0, 2, 10, 28][i];
          const count = Math.max(0, Math.min(capacity, config.electrons - before));
          return count > 0 ? <Orbit key={i} index={i} count={count} playing={playing} /> : null;
        })}
      </>}
      {sceneKind === 'solar' && <SolarSystem />}
      {sceneKind === 'model' && model && <ImportedObject model={model} playing={playing} />}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minDistance={4}
        maxDistance={12}
        enablePan
      />
    </>
  );
}

function ImportedObject({ model, playing }: { model: ImportedModel; playing: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z, 0.0001);
    return { center, scale: 3.2 / max };
  }, [model]);
  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(model.scene);
    model.animations.forEach((clip) => mixer.current?.clipAction(clip).play());
    return () => { mixer.current?.stopAllAction(); mixer.current?.uncacheRoot(model.scene); mixer.current = null; };
  }, [model]);
  useEffect(() => {
    if (mixer.current) mixer.current.timeScale = playing ? 1 : 0;
  }, [playing]);
  useFrame((_, dt) => { if (playing) mixer.current?.update(dt); });
  return <group ref={ref} position={bounds.center.clone().multiplyScalar(-bounds.scale)} scale={bounds.scale}>
    <primitive object={model.scene} />
  </group>;
}

const AtomScene = memo(function AtomScene(props: Props) {
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 7.5], fov: 42 }} gl={{ antialias: true }}>
      <Content {...props} />
    </Canvas>
  );
});

export default AtomScene;
