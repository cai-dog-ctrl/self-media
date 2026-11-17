import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { BattleScript, Unit } from "../types";
import { terrainHeight } from "./terrainNoise";

/** 将折线路径按地形采样为 3D 点列 */
function samplePath(unit: Unit): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const wps = unit.waypoints;
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    const steps = 16;
    for (let s = 0; s < steps; s++) {
      const p = s / steps;
      const x = a.x + (b.x - a.x) * p;
      const z = a.z + (b.z - a.z) * p;
      pts.push([x, terrainHeight(x, z) + 0.45, z]);
    }
  }
  const last = wps[wps.length - 1];
  if (last) pts.push([last.x, terrainHeight(last.x, last.z) + 0.45, last.z]);
  return pts;
}

export default function MarchLines({ script }: { script: BattleScript }) {
  const lines = useMemo(
    () =>
      script.units.map((u) => ({
        id: u.id,
        points: samplePath(u),
        color: script.factions[u.faction].color,
      })),
    [script]
  );

  return (
    <group>
      {lines.map((l) => (
        <Line
          key={l.id}
          points={l.points}
          color={l.color}
          lineWidth={1.5}
          transparent
          opacity={0.35}
          dashed
          dashScale={2}
        />
      ))}
    </group>
  );
}
