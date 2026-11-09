
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type GestureCameraControls = Pick<
  OrbitControlsImpl,
  'object' | 'target' | 'update' | 'dollyIn'
>;

export type GestureCameraActions = {
  rotation: [number, number] | null;
  zoom: number | null;
};

export function applyGestureActions(
  controls: GestureCameraControls,
  actions: GestureCameraActions,
): boolean {
  let changed = false;

  // Closed fist: rotate the camera.
  if (actions.rotation !== null) {
    const [horizontal, vertical] = actions.rotation;

    if (
      Number.isFinite(horizontal) &&
      Number.isFinite(vertical) &&
      (horizontal !== 0 || vertical !== 0)
    ) {
      const offset = controls.object.position
        .clone()
        .sub(controls.target);

      const spherical = new THREE.Spherical().setFromVector3(offset);

      // Increased responsiveness for hand movement.
      spherical.theta -= horizontal * 5;
      spherical.phi -= vertical * 4;

      // Clamp polar angle to avoid gimbal lock at the vertical poles
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.05, Math.PI - 0.05);

      spherical.makeSafe();

      controls.object.position
        .copy(controls.target)
        .add(offset.setFromSpherical(spherical));

      changed = true;
    }
  }

  // Two open palms: preserve existing zoom behavior.
  if (
    actions.zoom !== null &&
    Number.isFinite(actions.zoom) &&
    actions.zoom !== 0
  ) {
    controls.dollyIn(
      THREE.MathUtils.clamp(1 - actions.zoom * 1.5, 0.85, 1.15),
    );

    changed = true;
  }

  if (changed) {
    controls.update();
  }

  return changed;
}
