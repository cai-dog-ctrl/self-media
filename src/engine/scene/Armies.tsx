import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { BattleScript, Unit } from "../types";
import { usePlayback } from "../playback";
import { useTerrainHeight } from "../terrain";

/** 求单位在时刻 t 的平面坐标（分段线性插值） */
export function unitPositionAt(unit: Unit, time: number): [number, number] {
  const wps = unit.waypoints;
  if (wps.length === 0) return [0, 0];
  if (time <= wps[0].t) return [wps[0].x, wps[0].z];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    if (time >= a.t && time <= b.t) {
      const p = (time - a.t) / (b.t - a.t);
      return [a.x + (b.x - a.x) * p, a.z + (b.z - a.z) * p];
    }
  }
  const last = wps[wps.length - 1];
  return [last.x, last.z];
}

function UnitMarker({ unit, color }: { unit: Unit; color: string }) {
  const group = useRef<THREE.Group>(null!);
  const height = useTerrainHeight();

  useFrame(() => {
    const { time } = usePlayback.getState();
    const [x, z] = unitPositionAt(unit, time);
    const y = height(x, z);
    group.current.position.set(x, y, z);
    group.current.visible = unit.appearAfter === undefined || time >= unit.appearAfter;
  });

  const scale = 0.7 + unit.size * 0.6;

  return (
    <group ref={group} scale={scale}>
      {/* 旗杆 */}
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 8, 6]} />
        <meshStandardMaterial color="#4a3f2f" roughness={0.9} />
      </mesh>
      {/* 军旗 */}
      <mesh position={[1.7, 7.2, 0]} castShadow>
        <boxGeometry args={[3, 1.8, 0.12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.7} />
      </mesh>
      {/* 营盘环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <torusGeometry args={[3.2, 0.3, 8, 40]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.6} />
      </mesh>
      <Html center distanceFactor={90} position={[0, 11, 0]} zIndexRange={[10, 0]}>
        <div className="unit-label" style={{ color }}>
          {unit.label}
        </div>
      </Html>
    </group>
  );
}

export default function Armies({ script }: { script: BattleScript }) {
  return (
    <group>
      {script.units.map((u) => (
        <UnitMarker key={u.id} unit={u} color={script.factions[u.faction].color} />
      ))}
    </group>
  );
}
