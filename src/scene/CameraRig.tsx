import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { BattleScript } from "../types";
import { usePlayback } from "../store";

/**
 * 双模式相机：
 * - 剧情模式：按脚本关键帧插值运镜（平滑阻尼跟随）
 * - 自由模式：OrbitControls 手动观察
 */
export default function CameraRig({ script }: { script: BattleScript }) {
  const freeCamera = usePlayback((s) => s.freeCamera);
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<any>(null);

  const curPos = useRef(new THREE.Vector3(-120, 95, 120));
  const curTarget = useRef(new THREE.Vector3(0, 0, 0));
  const initialized = useRef(false);

  useFrame((_, dt) => {
    if (freeCamera) return;
    const { time } = usePlayback.getState();
    const kfs = script.camera;
    let i = 0;
    while (i < kfs.length - 1 && kfs[i + 1].t <= time) i++;
    const a = kfs[i];
    const b = kfs[Math.min(i + 1, kfs.length - 1)];
    let p = 1;
    if (b.t > a.t) p = THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1);
    p = p * p * (3 - 2 * p);

    const pos = new THREE.Vector3(...a.pos).lerp(new THREE.Vector3(...b.pos), p);
    const target = new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), p);

    if (!initialized.current) {
      curPos.current.copy(pos);
      curTarget.current.copy(target);
      initialized.current = true;
    }
    const k = 1 - Math.exp(-dt * 2.5);
    curPos.current.lerp(pos, k);
    curTarget.current.lerp(target, k);
    camera.position.copy(curPos.current);
    camera.lookAt(curTarget.current);
  });

  useEffect(() => {
    if (freeCamera && controlsRef.current) {
      controlsRef.current.target.copy(curTarget.current);
      controlsRef.current.update();
    }
  }, [freeCamera]);

  if (freeCamera) {
    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={20}
        maxDistance={400}
      />
    );
  }
  return null;
}
