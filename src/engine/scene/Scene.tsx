import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { BattleScript } from "../types";
import { usePlayback } from "../playback";
import { createTerrainHeight, TerrainHeightProvider } from "../terrain";
import Terrain from "./Terrain";
import Armies from "./Armies";
import MarchLines from "./MarchLines";
import ClashEffects from "./ClashEffects";
import CameraRig from "./CameraRig";

/** 时间驱动器：挂在 Canvas 内部，按帧推进时间轴 */
function TimelineDriver() {
  useFrame((_, dt) => {
    const s = usePlayback.getState();
    if (s.playing) s.advance(dt);
  });
  return null;
}

export default function Scene({ script }: { script: BattleScript }) {
  const heightFn = useMemo(() => createTerrainHeight(script.terrain), [script.terrain]);

  return (
    <TerrainHeightProvider value={heightFn}>
      <color attach="background" args={["#141a26"]} />
      <fog attach="fog" args={["#141a26", 200, 620]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[90, 130, 50]}
        intensity={1.4}
        color="#ffe8c0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
      />

      <Terrain config={script.terrain} landmarks={script.landmarks} />
      <MarchLines script={script} />
      <Armies script={script} />
      <ClashEffects script={script} />

      <CameraRig script={script} />
      <TimelineDriver />
    </TerrainHeightProvider>
  );
}
