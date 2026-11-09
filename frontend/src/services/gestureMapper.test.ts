import{describe,expect,it}from'vitest';
import{dispatchGesture}from'./gestureMapper';
import type{GestureMessage}from'../types/gesture';

const sample=(gesture:GestureMessage['gesture'],rotation:[number,number]=[0,0],zoom=0,cursor:[number,number]|null=[.5,.5],hands=gesture==='zoom'?2:1):GestureMessage=>({type:'gesture',gesture,hands,cursor,pinch:'idle',tracking:'tracking',rotation,zoom,timestamp:1});

describe('mutually exclusive gesture dispatcher',()=>{
 it('returns cursor movement only for one open palm',()=>{
  expect(dispatchGesture(sample('open_palm',[.04,-.02],.1,[.25,.75]),.5)).toEqual({kind:'cursor',position:[.25,.75]});
 });
 it('returns rotation only for a single closed fist and never toggles animation',()=>{
  expect(dispatchGesture(sample('fist',[.04,-.02],0,[.2,.8]),.5)).toEqual({kind:'rotate',delta:[.02,-.01]});
 });
 it('returns zoom only for two open palms',()=>{
  const action=dispatchGesture(sample('zoom',[.04,-.02],.06,[.25,.75]),.7);
  expect(action.kind).toBe('zoom');
  if(action.kind==='zoom')expect(action.delta).toBeCloseTo(.042);
 });
 it('does not route legacy rotate labels to camera actions',()=>{
  expect(dispatchGesture(sample('rotate',[.04,-.02]),1)).toEqual({kind:'none',releaseDrag:false});
 });
 it('releases on tracking loss and clears actions when switching gestures',()=>{
  const fist=dispatchGesture(sample('fist',[.04,-.02]),1);
  const palm=dispatchGesture(sample('open_palm',[.04,-.02],0,[.2,.8]),1);
  const zoom=dispatchGesture(sample('zoom',[.04,-.02],.06,[.2,.8]),1);
  const lost=dispatchGesture({...sample('neutral'),tracking:'lost',cursor:null},1);
  expect(fist.kind).toBe('rotate');
  expect(palm.kind).toBe('cursor');
  expect(zoom.kind).toBe('zoom');
  expect(lost).toEqual({kind:'none',releaseDrag:true});
 });
 it('rejects gestures with an incompatible tracked-hand count',()=>{
  expect(dispatchGesture(sample('fist',[.1,.1],0,[.5,.5],2),1)).toEqual({kind:'none',releaseDrag:false});
  expect(dispatchGesture(sample('open_palm',[0,0],0,[.5,.5],2),1)).toEqual({kind:'none',releaseDrag:false});
  expect(dispatchGesture(sample('zoom',[0,0],.1,[.5,.5],1),1)).toEqual({kind:'none',releaseDrag:false});
 });

 it('preserves drag state on neutral frame while tracking is active', () => {
  expect(dispatchGesture(sample('neutral', [0, 0]), 1)).toEqual({ kind: 'none', releaseDrag: false });
 });

 it('applies sensitivity scaling to rotation and zoom, but not cursor coordinates', () => {
  const rot = dispatchGesture(sample('fist', [0.1, -0.05]), 0.5);
  expect(rot).toEqual({ kind: 'rotate', delta: [0.05, -0.025] });

  const zoom = dispatchGesture(sample('zoom', [0, 0], 0.2), 0.5);
  expect(zoom).toEqual({ kind: 'zoom', delta: 0.1 });

  const cur = dispatchGesture(sample('open_palm', [0, 0], 0, [0.3, 0.7]), 0.5);
  expect(cur).toEqual({ kind: 'cursor', position: [0.3, 0.7] });
 });
});
