import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const planets = [
  { name: 'Mercury', radius: 0.12, orbit: 1.2, size: 0.1, color: '#aaa49a', speed: 1.6 },
  { name: 'Venus', radius: 1.7, orbit: 1.8, size: 0.17, color: '#e4b477', speed: 1.1 },
  { name: 'Earth', radius: 2.4, orbit: 2.4, size: 0.18, color: '#4d9bff', speed: 0.8 },
  { name: 'Mars', radius: 3.1, orbit: 3.1, size: 0.14, color: '#e56e50', speed: 0.62 },
  { name: 'Jupiter', radius: 4.1, orbit: 4.1, size: 0.38, color: '#d6ad83', speed: 0.36 },
];

function Planet({ data }: { data: typeof planets[number] }) {
  const ref = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame((_, dt) => {
    phase.current += dt * data.speed * 0.2;
    ref.current?.position.set(Math.cos(phase.current) * data.radius, 0, Math.sin(phase.current) * data.radius);
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>
    <mesh><sphereGeometry args={[data.size, 24, 24]} /><meshStandardMaterial color={data.color} roughness={0.8} /></mesh>
    {data.name === 'Earth' && <mesh><sphereGeometry args={[data.size + 0.005, 16, 16]} /><meshBasicMaterial color="#5edcff" wireframe transparent opacity={0.22} /></mesh>}
  </group>;
}

export default function SolarSystem() {
  return <group>
    <pointLight color="#ffd28d" intensity={40} distance={16} />
    <mesh><sphereGeometry args={[0.42, 32, 32]} /><meshBasicMaterial color="#ffca71" /></mesh>
    {planets.map((p) => <group key={p.name}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[p.orbit, 0.006, 6, 128]} /><meshBasicMaterial color="#8ea8d5" transparent opacity={0.35} /></mesh>
      <Planet data={p} />
    </group>)}
  </group>;
}
