import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { BattleScript, ClashEvent } from "../types";
import { usePlayback } from "../playback";
import { useTerrainHeight } from "../terrain";

/** 交战特效：扩散冲击环 + 渐隐光柱，持续 8 个"日" */
function ClashFlash({ clash, color }: { clash: ClashEvent; color: string }) {
  const group = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
  const height = useTerrainHeight();

  useFrame(() => {
    const { time } = usePlayback.getState();
    const p = (time - clash.t) / 8;
    const active = p >= 0 && p <= 1;
    group.current.visible = active;
    if (!active) return;
    const radius = 3 + p * 16;
    ring.current.scale.setScalar(radius / 4);
    ringMat.current.opacity = (1 - p) * 0.85;
    beamMat.current.opacity = (1 - p) * 0.4;
  });

  const y = height(clash.x, clash.z);

  return (
    <group ref={group} position={[clash.x, y, clash.z]} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
        <ringGeometry args={[3.4, 4, 48]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={beam} position={[0, 9, 0]}>
        <cylinderGeometry args={[1.6, 2.6, 18, 12, 1, true]} />
        <meshBasicMaterial ref={beamMat} color={color} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function ClashEffects({ script }: { script: BattleScript }) {
  return (
    <group>
      {script.clashes.map((c, i) => (
        <ClashFlash key={i} clash={c} color="#e8b04b" />
      ))}
    </group>
  );
}
