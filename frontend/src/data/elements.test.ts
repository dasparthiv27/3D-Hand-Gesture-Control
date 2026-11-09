import{describe,expect,it}from'vitest';import{configurationFor}from'./elements';
describe('electron configuration display',()=>{it('reflects ion electron counts',()=>{expect(configurationFor(10)).toBe('1s² 2s² 2p⁶');expect(configurationFor(0)).toBe('No electrons')})});
