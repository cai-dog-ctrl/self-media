import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type {
  BattleMap,
  MapCity,
  MapLake,
  MapRailway,
  MapRiver,
  TerrainHeightFn,
} from "../types";
import { useTerrainHeight } from "../terrain";

/** 地图要素配色（Overlay 图例与本组件共用） */
export const MAP_COLORS = {
  river: "#3fa0ad",
  lake: "#3587a3",
  railwayBase: "#6b6252",
  railwayRail: "#d6cfbe",
  city: "#d6c9a8",
} as const;

/**
 * 将平面折线扩展为贴地条带几何体（河流/铁路共用）。
 * 每段生成左右两排顶点，法线统一朝上，材质双面避免绕向问题。
 */
function buildRibbon(
  points: Array<[number, number]>,
  width: number,
  height: TerrainHeightFn,
  yOffset: number
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;
  const n = points.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // 垂直于走向的方向
    const px = -dz;
    const pz = dx;
    const [x, z] = points[i];
    const y = height(x, z) + yOffset;
    positions.push(x - (px * width) / 2, y, z - (pz * width) / 2);
    positions.push(x + (px * width) / 2, y, z + (pz * width) / 2);
    normals.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function midpoint(points: Array<[number, number]>): [number, number] {
  const m = points[Math.floor(points.length / 2)];
  return [m[0], m[1]];
}

function MapLabel({ x, z, y, text }: { x: number; z: number; y: number; text: string }) {
  return (
    <Html center distanceFactor={140} position={[x, y, z]} zIndexRange={[9, 0]}>
      <div className="map-label">{text}</div>
    </Html>
  );
}

function River({ river, height }: { river: MapRiver; height: TerrainHeightFn }) {
  const geometry = useMemo(
    () => buildRibbon(river.points, river.width, height, 0.22),
    [river, height]
  );
  const labelPos = useMemo(() => {
    const [x, z] = midpoint(river.points);
    return { x, z, y: height(x, z) + 2 };
  }, [river, height]);
  if (!geometry) return null;
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={MAP_COLORS.river}
          roughness={0.35}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {river.label && <MapLabel {...labelPos} text={river.label} />}
    </>
  );
}

function Lake({ lake, height }: { lake: MapLake; height: TerrainHeightFn }) {
  const geometry = useMemo(() => {
    if (lake.polygon.length < 3) return null;
    const shape = new THREE.Shape(lake.polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [lake]);

  const y = useMemo(() => {
    let max = -Infinity;
    for (const [x, z] of lake.polygon) max = Math.max(max, height(x, z));
    return max + 0.1;
  }, [lake, height]);

  const labelPos = useMemo(() => {
    const [x, z] = midpoint(lake.polygon);
    return { x, z, y: y + 2 };
  }, [lake, y]);

  if (!geometry) return null;
  return (
    <>
      <mesh geometry={geometry} position={[0, y, 0]}>
        <meshStandardMaterial
          color={MAP_COLORS.lake}
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {lake.label && <MapLabel {...labelPos} text={lake.label} />}
    </>
  );
}

function Railway({ railway, height }: { railway: MapRailway; height: TerrainHeightFn }) {
  const base = useMemo(
    () => buildRibbon(railway.points, 2.4, height, 0.16),
    [railway, height]
  );
  const rail = useMemo(
    () => buildRibbon(railway.points, 0.5, height, 0.26),
    [railway, height]
  );
  const labelPos = useMemo(() => {
    const [x, z] = midpoint(railway.points);
    return { x, z, y: height(x, z) + 2.5 };
  }, [railway, height]);
  if (!base || !rail) return null;
  return (
    <>
      {/* 路基 */}
      <mesh geometry={base}>
        <meshStandardMaterial
          color={MAP_COLORS.railwayBase}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 铁轨 */}
      <mesh geometry={rail}>
        <meshStandardMaterial
          color={MAP_COLORS.railwayRail}
          roughness={0.6}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {railway.label && <MapLabel {...labelPos} text={railway.label} />}
    </>
  );
}

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** 城镇：地基圆盘 + 确定性随机的小型建成区 + 标签 */
function City({ city, height }: { city: MapCity; height: TerrainHeightFn }) {
  const groundY = useMemo(() => height(city.x, city.z), [city, height]);

  const buildings = useMemo(() => {
    const seed = hashStr(city.id);
    const count = Math.max(1, Math.round(city.scale * 4));
    const list: Array<{ x: number; z: number; h: number; w: number }> = [];
    for (let i = 0; i < count; i++) {
      const ang = (((seed + i * 137) % 360) * Math.PI) / 180;
      const dist = 0.6 + (((seed + i * 61) % 100) / 100) * 2.4 * city.scale;
      list.push({
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        h: 0.8 + (((seed + i * 53) % 100) / 100) * 5 * city.scale,
        w: 0.7 + (((seed + i * 29) % 100) / 100) * 1.2 * city.scale,
      });
    }
    return list;
  }, [city]);

  return (
    <group position={[city.x, groundY, city.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <circleGeometry args={[1.6 + 2.4 * city.scale, 24]} />
        <meshStandardMaterial color="#1f2430" roughness={1} />
      </mesh>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial color="#464e63" roughness={0.85} />
        </mesh>
      ))}
      <Html center distanceFactor={120} position={[0, 2 + 3 * city.scale, 0]} zIndexRange={[9, 0]}>
        <div className="city-label">{city.label}</div>
      </Html>
    </group>
  );
}

/** 真实地图要素图层：河流 / 湖泊 / 铁路 / 城镇 */
export default function MapLayer({ features }: { features: BattleMap }) {
  const height = useTerrainHeight();
  return (
    <group>
      {features.rivers.map((r) => (
        <River key={r.id} river={r} height={height} />
      ))}
      {features.lakes.map((l) => (
        <Lake key={l.id} lake={l} height={height} />
      ))}
      {features.railways.map((r) => (
        <Railway key={r.id} railway={r} height={height} />
      ))}
      {features.cities.map((c) => (
        <City key={c.id} city={c} height={height} />
      ))}
    </group>
  );
}
