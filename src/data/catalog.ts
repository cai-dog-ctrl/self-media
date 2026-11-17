/**
 * 战役目录：列表页展示用的轻量元数据，不加载 3D 代码。
 * 新增战役时在 battles/ 下加剧本文件，并在此登记一条。
 * 开发模式下列表页会自动检查本目录与 battles/ 目录的一致性。
 */
export interface BattleMeta {
  id: string;
  name: string;
  era: string;
  summary: string;
}

export const catalog: BattleMeta[] = [
  {
    id: "changping",
    name: "长平之战",
    era: "战国 · 秦昭襄王四十七年",
    summary: "秦赵两国倾国之力对决于上党长平，白起围歼赵军主力，战国格局自此倾斜。",
  },
  {
    id: "huaihai",
    name: "淮海战役",
    era: "解放战争 · 1948年11月 — 1949年1月",
    summary:
      "六十万对八十万的战略决战：解放军在徐蚌之间的广袤平原上分割合围国民党军重兵集团，长江以北自此底定。",
  },
];
