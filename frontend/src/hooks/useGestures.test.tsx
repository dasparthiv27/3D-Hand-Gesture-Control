// @vitest-environment jsdom
import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useGestures} from './useGestures';

class FakeSocket {
  static all:FakeSocket[]=[];
  onopen:((event:Event)=>void)|null=null;
  onmessage:((event:MessageEvent)=>void)|null=null;
  onerror:((event:Event)=>void)|null=null;
  onclose:((event:CloseEvent)=>void)|null=null;
  constructor(readonly url:string){FakeSocket.all.push(this)}
  close(){this.onclose?.(new CloseEvent('close'))}
  fail(){this.onerror?.(new Event('error'));this.onclose?.(new CloseEvent('close'))}
}

afterEach(()=>{FakeSocket.all=[];vi.unstubAllGlobals();vi.restoreAllMocks()});
describe('gesture service connection',()=>{
  it('shows a useful disconnected state and permits retry',async()=>{
    vi.stubGlobal('WebSocket',FakeSocket);
    const {result}=renderHook(()=>useGestures('ws://127.0.0.1:8765',true,()=>{}));
    await waitFor(()=>expect(FakeSocket.all).toHaveLength(1));
    act(()=>FakeSocket.all[0].fail());
    await waitFor(()=>expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/Cannot reach/);
    act(()=>result.current.reconnect());
    await waitFor(()=>expect(FakeSocket.all).toHaveLength(2));
    expect(result.current.status).toBe('connecting');
  });
  it('parses and forwards backend gesture messages',async()=>{
    vi.stubGlobal('WebSocket',FakeSocket);
    vi.spyOn(console,'info').mockImplementation(()=>{});
    vi.spyOn(console,'debug').mockImplementation(()=>{});
    const onMessage=vi.fn();
    renderHook(()=>useGestures('ws://127.0.0.1:8765',true,onMessage));
    await waitFor(()=>expect(FakeSocket.all).toHaveLength(1));
    act(()=>FakeSocket.all[0].onmessage?.(new MessageEvent('message',{data:JSON.stringify({type:'gesture',gesture:'rotate',hands:1,cursor:[.5,.5],pinch:'idle',tracking:'tracking',rotation:[.04,-.02],zoom:0,timestamp:1})})));
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({type:'gesture',gesture:'rotate',rotation:[.04,-.02]}));
  });
});
