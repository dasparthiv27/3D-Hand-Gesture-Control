import {describe,expect,it} from 'vitest';
import {parseMessage} from './gesture';
describe('gesture WebSocket protocol',()=>{
 it('accepts a normalized gesture sample',()=>{const msg=parseMessage(JSON.stringify({type:'gesture',gesture:'zoom',hands:2,cursor:[.5,.25],pinch:'idle',tracking:'tracking',rotation:[0,0],zoom:.04,timestamp:1}));expect(msg?.type).toBe('gesture');if(msg?.type==='gesture')expect(msg.hands).toBe(2)});
 it('accepts backend errors for the retry state',()=>expect(parseMessage(JSON.stringify({type:'error',error:'camera busy'}))).toEqual({type:'error',error:'camera busy'}));
 it('rejects malformed or out-of-range messages',()=>{expect(parseMessage('{')).toBeNull();expect(parseMessage(JSON.stringify({type:'gesture',gesture:'rotate',hands:1,cursor:[2,.5],pinch:'idle',tracking:'tracking',rotation:[0,0],zoom:0}))).toBeNull()});
});
