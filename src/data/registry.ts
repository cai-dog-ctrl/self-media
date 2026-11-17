import type { BattleScript } from "../engine/types";

/**
 * 战役注册表：基于 Vite glob 实现「进哪场战役才加载哪份剧本」。
 * 新增战役只需在 battles/ 目录添加 <id>.ts（导出名为 script 的 BattleScript）。
 */
const loaders = import.meta.glob<{ script: BattleScript }>("./battles/*.ts");

/** battles/ 目录下现有的全部战役 id */
export function battleIds(): string[] {
  return Object.keys(loaders).map((p) => p.slice("./battles/".length, -".ts".length));
}

export function hasBattle(id: string): boolean {
  return `./battles/${id}.ts` in loaders;
}

/** 按需加载战役剧本；id 不存在时返回被拒绝的 Promise */
export function loadBattle(id: string): Promise<BattleScript> {
  const load = loaders[`./battles/${id}.ts`];
  if (!load) {
    return Promise.reject(new Error(`未找到战役 "${id}"，请检查 data/battles/ 目录`));
  }
  return load().then((m) => m.script);
}
