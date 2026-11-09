import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import type { Object3D, AnimationClip } from 'three';

export const MAX_MODEL_BYTES = 50 * 1024 * 1024;
export const modelFormats = {
  glb: { label: 'GLB', features: 'Geometry, materials, textures, animations' },
  gltf: { label: 'GLTF', features: 'Geometry, materials, textures, animations; companion files supported' },
} as const;
export type ModelFormat = keyof typeof modelFormats;
export type ImportedModel = { id: string; name: string; format: ModelFormat; scene: Object3D; animations: AnimationClip[] };

export function disposeImportedModel(model: ImportedModel): void {
  const geometries = new Set<object>();
  const materials = new Set<object>();
  const textures = new Set<object>();
  model.scene.traverse((node) => {
    const mesh = node as Object3D & { geometry?: { dispose: () => void }; material?: import('three').Material | import('three').Material[] };
    if (mesh.geometry && !geometries.has(mesh.geometry)) { geometries.add(mesh.geometry); mesh.geometry.dispose(); }
    for (const material of (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [])) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture && !textures.has(value)) {
          textures.add(value); (value as import('three').Texture).dispose();
        }
      }
      material.dispose();
    }
  });
}

export function validateModelFile(file: File): ModelFormat {
  const format = file.name.split('.').pop()?.toLowerCase();
  if (format !== 'glb' && format !== 'gltf') throw new Error('Unsupported format. Import a .glb or .gltf model.');
  if (!file.size) throw new Error('This model file is empty.');
  if (file.size > MAX_MODEL_BYTES) throw new Error('Model exceeds the 50 MB size limit.');
  return format;
}

export async function loadModel(files: FileList | File[]): Promise<ImportedModel> {
  const selected = Array.from(files);
  const file = selected.find((item) => /\.(glb|gltf)$/i.test(item.name));
  if (!file) throw new Error('Select a .glb or .gltf model file.');
  const format = validateModelFile(file);
  if (selected.some((item) => item.size > MAX_MODEL_BYTES)) throw new Error('A selected model or companion file exceeds the 50 MB size limit.');
  const urls = new Map<string, string>();
  for (const asset of selected) urls.set(asset.name, URL.createObjectURL(asset));
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    const decoded = decodeURIComponent(url.split(/[?#]/)[0]);
    const basename = decoded.split('/').pop() ?? decoded;
    return urls.get(basename) ?? url;
  });
  try {
    const buffer = await file.arrayBuffer();
    const loader = new GLTFLoader(manager);
    const result = await new Promise<{ scene: Object3D; animations: AnimationClip[] }>((resolve, reject) => {
      loader.parse(buffer, '', (gltf) => resolve(gltf), reject);
    });
    return { id: crypto.randomUUID(), name: file.name.replace(/\.(glb|gltf)$/i, ''), format, scene: result.scene, animations: result.animations };
  } catch (error) {
    throw new Error(`Could not load ${file.name}: ${error instanceof Error ? error.message : 'invalid model or missing companion asset'}`);
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
