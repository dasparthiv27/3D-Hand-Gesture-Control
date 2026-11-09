import { describe, expect, it } from 'vitest';
import { MAX_MODEL_BYTES, validateModelFile } from './importModel';

describe('model file validation', () => {
  it('recognizes GLB and GLTF case-insensitively', () => {
    expect(validateModelFile(new File(['x'], 'sample.GLB'))).toBe('glb');
    expect(validateModelFile(new File(['x'], 'sample.gltf'))).toBe('gltf');
  });

  it('rejects unsupported and empty files before parsing', () => {
    expect(() => validateModelFile(new File(['x'], 'scene.obj'))).toThrow('Unsupported format');
    expect(() => validateModelFile(new File([], 'empty.glb'))).toThrow('empty');
  });

  it('rejects files over the configured limit', () => {
    const oversized = { name: 'large.glb', size: MAX_MODEL_BYTES + 1 } as File;
    expect(() => validateModelFile(oversized)).toThrow('50 MB');
  });
});
