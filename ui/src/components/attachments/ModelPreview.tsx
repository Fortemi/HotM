/**
 * ModelPreview Component
 * Three.js-powered 3D model viewer for attachment previews.
 * Supports GLTF/GLB, STL, OBJ, FBX, and PLY formats.
 *
 * This component should be lazy-loaded to avoid bundling Three.js
 * for users who don't have 3D attachments.
 */

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Gltf } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import * as THREE from 'three';


type ModelFormat = 'gltf' | 'stl' | 'obj' | 'fbx' | 'ply' | 'unknown';

function detectFormat(filename: string, contentType: string): ModelFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf' || contentType === 'model/gltf-binary' || contentType === 'model/gltf+json') {
    return 'gltf';
  }
  if (ext === 'stl' || contentType === 'model/stl') return 'stl';
  if (ext === 'obj' || contentType === 'model/obj') return 'obj';
  if (ext === 'fbx') return 'fbx';
  if (ext === 'ply') return 'ply';
  return 'unknown';
}

function StlModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8899aa', roughness: 0.4, metalness: 0.3 }), []);
  return <mesh geometry={geometry} material={material} />;
}

function ObjModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} />;
}

function FbxModel({ url }: { url: string }) {
  const fbx = useLoader(FBXLoader, url);
  return <primitive object={fbx} scale={0.01} />;
}

function PlyModel({ url }: { url: string }) {
  const geometry = useLoader(PLYLoader, url);
  geometry.computeVertexNormals();
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8899aa', roughness: 0.4, metalness: 0.3, vertexColors: geometry.hasAttribute('color') }), [geometry]);
  return <mesh geometry={geometry} material={material} />;
}

function ModelContent({ url, format }: { url: string; format: ModelFormat }) {
  switch (format) {
    case 'gltf':
      return <Gltf src={url} />;
    case 'stl':
      return <StlModel url={url} />;
    case 'obj':
      return <ObjModel url={url} />;
    case 'fbx':
      return <FbxModel url={url} />;
    case 'ply':
      return <PlyModel url={url} />;
    default:
      return null;
  }
}

interface ModelPreviewProps {
  url: string;
  filename: string;
  contentType: string;
  className?: string;
}

export function ModelPreview({ url, filename, contentType, className }: ModelPreviewProps) {
  const format = detectFormat(filename, contentType);

  if (format === 'unknown') {
    return (
      <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg text-muted-foreground text-sm">
        Unsupported 3D format
      </div>
    );
  }

  return (
    <div className={className ?? 'h-[400px] w-full rounded-lg overflow-hidden border bg-background'} data-testid="model-preview">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage adjustCamera intensity={0.5} environment="city">
            <ModelContent url={url} format={format} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={1} />
      </Canvas>
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        Drag to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}
