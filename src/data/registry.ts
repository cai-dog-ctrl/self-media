import type { BattleScript, GeoBattleScript } from "../engine/types";

/**
 * 战役注册表：基于 Vite glob 实现「进哪场战役才加载哪份剧本」。
 * 剧本有两种形态，由导出字段区分：
 * - `export const script`（BattleScript）→ 3D 沙盘视图
 * - `export const geoScript`（GeoBattleScript）→ MapLibre 真实地图视图
 */
type BattleModule = { script: BattleScript } | { geoScript: GeoBattleScript };

const loaders = import.meta.glob<BattleModule>("./battles/*.ts");

export type LoadedBattle =
  | { type: "sandbox"; script: BattleScript }
  | { type: "geo"; script: GeoBattleScript };

/** battles/ 目录下现有的全部战役 id */
export function battleIds(): string[] {
  return Object.keys(loaders).map((p) => p.slice("./battles/".length, -".ts".length));
}

export function hasBattle(id: string): boolean {
  return `./battles/${id}.ts` in loaders;
}

/** 按需加载战役剧本；id 不存在时返回被拒绝的 Promise */
export function loadBattle(id: string): Promise<LoadedBattle> {
  const load = loaders[`./battles/${id}.ts`];
  if (!load) {
    return Promise.reject(new Error(`未找到战役 "${id}"，请检查 data/battles/ 目录`));
  }
  return load().then((m) =>
    "geoScript" in m ? { type: "geo", script: m.geoScript } : { type: "sandbox", script: m.script }
  );
}
