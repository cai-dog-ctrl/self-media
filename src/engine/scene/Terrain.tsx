import { useMemo } from "react";
import * as THREE from "three";
import type { Landmark, TerrainConfig, TerrainHeightFn } from "../types";
import { useTerrainHeight } from "../terrain";

const SEGMENTS = 160;

/** 按高程着色：水下沙 → 岸滩 → 平原 → 丘陵 → 山岩 */
const colorAt = (h: number): THREE.Color => {
  const stops: Array<[number, string]> = [
    [-3.5, "#7a6f52"],
    [-1.0, "#c2b280"],
    [1.2, "#8a9a5b"],
    [4.5, "#5f7d45"],
    [7.5, "#4c6a3c"],
    [10.0, "#7d7869"],
  ];
  if (h <= stops[0][0]) return new THREE.Color(stops[0][1]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [h0, c0] = stops[i];
    const [h1, c1] = stops[i + 1];
    if (h <= h1) {
      const p = (h - h0) / (h1 - h0);
      return new THREE.Color(c0).lerp(new THREE.Color(c1), p);
    }
  }
  return new THREE.Color(stops[stops.length - 1][1]);
};

function TerrainMesh({ size }: { size: number }) {
  const height = useTerrainHeight();

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = height(x, z);
      pos.setY(i, h);
      const c = colorAt(h);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [size, height]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Water({ size }: { size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#1e3a5f"
        transparent
        opacity={0.85}
        roughness={0.15}
        metalness={0.1}
      />
    </mesh>
  );
}

/** 沙盘底座，形成 diorama 观感 */
function Base({ size }: { size: number }) {
  return (
    <mesh position={[0, -8, 0]}>
      <boxGeometry args={[size, 8, size]} />
      <meshStandardMaterial color="#1a2030" roughness={1} />
    </mesh>
  );
}

/** 城墙类地标：沿 z 方向排布的石砌墙体 */
function Wall({ landmark, height }: { landmark: Landmark; height: TerrainHeightFn }) {
  const blocks = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number }> = [];
    for (let z = landmark.zFrom; z <= landmark.zTo; z += 4) {
      const x = landmark.x;
      list.push({ x, y: height(x, z) + 1.3, z });
    }
    return list;
  }, [landmark, height]);

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} castShadow>
          <boxGeometry args={[1.6, 2.8, 4.1]} />
          <meshStandardMaterial color={landmark.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function Terrain({
  config,
  landmarks,
}: {
  config: TerrainConfig;
  landmarks: Landmark[];
}) {
  const height = useTerrainHeight();

  return (
    <group>
      <TerrainMesh size={config.size} />
      <Water size={config.size} />
      <Base size={config.size} />
      {landmarks.map((l) =>
        l.type === "wall" ? <Wall key={l.id} landmark={l} height={height} /> : null
      )}
    </group>
  );
}
