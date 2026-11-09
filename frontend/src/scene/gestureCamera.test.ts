import * as THREE from 'three';
import {describe,expect,it,vi} from 'vitest';
import {dispatchGesture,type GestureAction} from '../services/gestureMapper';
import type {GestureMessage} from '../types/gesture';
import {applyGestureActions,type GestureCameraActions,type GestureCameraControls} from './gestureCamera';

const sample=(gesture:GestureMessage['gesture'],rotation:[number,number]=[0,0],zoom=0):GestureMessage=>({type:'gesture',gesture,hands:gesture==='zoom'?2:1,cursor:[.5,.5],pinch:'idle',tracking:'tracking',rotation,zoom,timestamp:1});
const cameraActions=(action:GestureAction):GestureCameraActions=>({rotation:action.kind==='rotate'?action.delta:null,zoom:action.kind==='zoom'?action.delta:null});

describe('gesture camera actions',()=>{
 it('applies closed-fist rotation to the controlled camera',()=>{
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(0,0,7.5);
  const controls={object:camera,target:new THREE.Vector3(),update:vi.fn(()=>true),dollyIn:vi.fn()} satisfies GestureCameraControls;
  const initialPosition=camera.position.clone();
  const action=dispatchGesture(sample('fist',[.04,-.02]),.65);
  expect(action.kind).toBe('rotate');
  expect(applyGestureActions(controls,cameraActions(action))).toBe(true);
  expect(camera.position.equals(initialPosition)).toBe(false);
  expect(controls.update).toHaveBeenCalledOnce();
 });

 it('open-palm cursor movement cannot change atom/camera state',()=>{
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(0,0,7.5);
  const controls={object:camera,target:new THREE.Vector3(),update:vi.fn(()=>true),dollyIn:vi.fn()} satisfies GestureCameraControls;
  const initialPosition=camera.position.clone();
  const action=dispatchGesture(sample('open_palm',[.04,-.02]),.65);
  expect(action).toEqual({kind:'cursor',position:[.5,.5]});
  expect(applyGestureActions(controls,cameraActions(action))).toBe(false);
  expect(camera.position.equals(initialPosition)).toBe(true);
  expect(controls.dollyIn).not.toHaveBeenCalled();
 });

 it('uses OrbitControls zoom only for two-palm deltas',()=>{
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(0,0,7.5);
  const controls={object:camera,target:new THREE.Vector3(),update:vi.fn(()=>true),dollyIn:vi.fn()} satisfies GestureCameraControls;
  const action=dispatchGesture(sample('zoom',[0,0],.06),.7);
  expect(action.kind).toBe('zoom');
  expect(applyGestureActions(controls,cameraActions(action))).toBe(true);
  expect(controls.dollyIn).toHaveBeenCalledWith(expect.closeTo(1-.042*1.5));
  expect(controls.update).toHaveBeenCalledOnce();
 });

 it('stationary fist [0, 0] does not rotate camera', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 7.5);
  const controls = { object: camera, target: new THREE.Vector3(), update: vi.fn(() => true), dollyIn: vi.fn() } satisfies GestureCameraControls;
  const initialPosition = camera.position.clone();
  const action = dispatchGesture(sample('fist', [0, 0]), 0.65);
  expect(applyGestureActions(controls, cameraActions(action))).toBe(false);
  expect(camera.position.equals(initialPosition)).toBe(true);
  expect(controls.update).not.toHaveBeenCalled();
 });

 it('clamps polar angle to prevent vertical flipping at poles', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 7.5);
  const controls = { object: camera, target: new THREE.Vector3(), update: vi.fn(() => true), dollyIn: vi.fn() } satisfies GestureCameraControls;
  // Extreme vertical movement
  const extremeAction: GestureCameraActions = { rotation: [0, 100], zoom: null };
  expect(applyGestureActions(controls, extremeAction)).toBe(true);
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  expect(spherical.phi).toBeGreaterThanOrEqual(0.05);
  expect(spherical.phi).toBeLessThanOrEqual(Math.PI - 0.05);
 });

 it('successive frames produce continuous camera movement without resetting to origin', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 7.5);
  const controls = { object: camera, target: new THREE.Vector3(), update: vi.fn(() => true), dollyIn: vi.fn() } satisfies GestureCameraControls;
  const step1: GestureCameraActions = { rotation: [0.03, 0], zoom: null };
  applyGestureActions(controls, step1);
  const pos1 = camera.position.clone();
  const step2: GestureCameraActions = { rotation: [0.03, 0], zoom: null };
  applyGestureActions(controls, step2);
  const pos2 = camera.position.clone();
  expect(pos1.equals(camera.position)).toBe(false);
  expect(pos2.equals(pos1)).toBe(false);
 });
});
