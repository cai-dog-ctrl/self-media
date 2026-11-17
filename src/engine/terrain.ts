import { createContext, useContext } from "react";
import type { TerrainConfig, TerrainHeightFn } from "./types";

/**
 * 程序化地形高度场（确定性伪随机）。
 * 由每场战役的 TerrainConfig 生成；地形网格与军队落点共用同一函数，保证贴地一致。
 */

const hash = (x: number, z: number, seed: number): number => {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const valueNoise = (x: number, z: number, seed: number): number => {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash(xi, zi, seed);
  const b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed);
  const d = hash(xi + 1, zi + 1, seed);
  const u = smooth(xf);
  const v = smooth(zf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
};

/** 按战役配置创建高度函数。seed = 0 时与引擎默认地形完全一致 */
export function createTerrainHeight(cfg: TerrainConfig): TerrainHeightFn {
  const { seed, relief, river, flatSpots } = cfg;
  return (x: number, z: number): number => {
    let h = valueNoise(x * 0.018, z * 0.018, seed) * relief;
    h += valueNoise(x * 0.045 + 7.3, z * 0.045 + 2.1, seed) * relief * 0.4;
    h += valueNoise(x * 0.11 + 13.7, z * 0.11 + 9.2, seed) * relief * 0.12;
    h -= relief * 0.6;
    if (river) {
      h -= Math.exp(-Math.pow((z - (x * river.slope + river.offset)) / river.width, 2)) * river.depth;
    }
    for (const f of flatSpots ?? []) {
      const flat = Math.exp(-(Math.pow((x - f.x) / f.rx, 2) + Math.pow((z - f.z) / f.rz, 2)));
      h *= 1 - f.strength * flat;
    }
    return h;
  };
}

const TerrainHeightContext = createContext<TerrainHeightFn | null>(null);

export const TerrainHeightProvider = TerrainHeightContext.Provider;

export function useTerrainHeight(): TerrainHeightFn {
  const fn = useContext(TerrainHeightContext);
  if (!fn) {
    throw new Error("useTerrainHeight 必须在 TerrainHeightProvider 内使用");
  }
  return fn;
}
