# BattleScript Schema 参考

一场战役 = 一个纯数据文件，由引擎按需加载渲染。类型定义源文件：`src/engine/types.ts`（以源文件为准）。

## 顶层结构

```ts
export const script: BattleScript = {
  schemaVersion: 1,        // 必须等于 engine/types.ts 中的 SCHEMA_VERSION
  id: "changping",         // kebab-case，与文件名一致
  name: "长平之战",         // 列表卡片与沙盘标题
  era: "战国 · 秦昭襄王四十七年",
  summary: "一句话简介，列表卡片展示",   // 建议 30~60 字
  duration: 180,           // 时间轴总长（单位：日）
  factions: { ... },       // 势力表
  terrain: { ... },        // 地形配置
  landmarks: [ ... ],      // 地标（城墙等）
  units: [ ... ],          // 军事单位
  events: [ ... ],         // 阶段事件（字幕）
  clashes: [ ... ],        // 交战特效点
  camera: [ ... ],         // 运镜关键帧
};
```

## 坐标系

- 俯视沙盘：`x` 向东为正，`z` 向南为正（屏幕下方）
- 原点在沙盘中心；可用范围为 `±terrain.size / 2`（默认 ±130）
- `y`（高度）由地形函数自动计算，数据中不出现

## factions: Record<string, FactionInfo>

```ts
factions: {
  qin: { name: "秦军", color: "#c0392b" },
  zhao: { name: "赵军", color: "#3a6ea5" },
}
```

- key 为任意字符串（英文小写惯例），`units[].faction` 引用它
- 势力数量不限（赤壁可三方）
- 颜色建议饱和明亮、彼此对比明显

## terrain: TerrainConfig

```ts
terrain: {
  size: 260,     // 沙盘边长
  seed: 0,       // 0 = 引擎默认地形；其他整数 = 全新地形
  relief: 10,    // 主起伏幅度（越大山越高）
  river: { slope: 0.15, offset: 0, width: 16, depth: 5 },   // 可选，河谷
  flatSpots: [{ x: 20, z: 0, rx: 70, rz: 55, strength: 0.55 }], // 可选，主战场平坦区
}
```

- 河谷谷心线满足 `z = x * slope + offset`；`width` 为高斯衰减半径，`depth` 为下切深度
- `flatSpots` 以 `(x, z)` 为中心的椭圆，`strength` 0~1 越大越平（决战地通常压平）
- 高程着色带固定：约 <-1 水/滩，0~5 平原，>7 山岩

## landmarks: Landmark[]

```ts
landmarks: [
  { id: "zhao_stone_wall", type: "wall", label: "石长城（示意）", color: "#9a927f", x: 32, zFrom: -52, zTo: 52 },
]
```

- `type: "wall"`：沿 `z` 方向排布的石砌墙体，位于固定 `x`，从 `zFrom` 到 `zTo`
- `label` 与 `color` 会出现在沙盘图例中
- `id` 全局唯一

## units: Unit[]

```ts
{
  id: "qin_main",           // 剧本内唯一
  faction: "qin",           // 必须是 factions 已定义的 key
  label: "秦军主力",         // 3D 场景中的军旗标签
  size: 1,                  // 0~1 相对兵力规模，影响标记大小
  appearAfter: 95,          // 可选，该时刻后才出现（伏兵用）
  waypoints: [              // 行军折线，t 严格递增且 <= duration
    { t: 0, x: -85, z: 0 },
    { t: 25, x: -30, z: -5 },
  ],
}
```

- 位置按 waypoints 分段线性插值；单点 waypoint = 驻守不动
- 主力 `size: 1`，偏师 0.3~0.6

## events: PhaseEvent[]

```ts
{ t: 30, date: "前 260 年 · 五月", title: "廉颇坚壁固守", detail: "一两句经过描述。" }
```

字幕区展示"当前所处阶段"（取 `t <= 当前时间` 的最后一条）。`t` 非降序。

## clashes: ClashEvent[]

```ts
{ t: 58, x: -8, z: -2, label: "前哨战" }
```

在 `(x, z)` 处播放 8 个"日"的冲击环+光柱特效。`t` 非降序。

## camera: CameraKeyframe[]

```ts
{ t: 30, pos: [5, 48, 95], target: [30, 0, 0] }
```

- `pos` 相机位置、`target` 注视点，关键帧间平滑插值（带阻尼）
- 建议 5~8 帧：开场全景 → 各阶段中景 → 决战特写
- 首帧 `t: 0`，末帧 `t: duration`

## 完整骨架示例

```ts
import type { BattleScript } from "../../engine/types";

/** XX之战（示意沙盘脚本，非精确史实地理复原） */
export const script: BattleScript = {
  schemaVersion: 1,
  id: "example",
  name: "示例之战",
  era: "朝代 · 年份",
  summary: "一句话简介。",
  duration: 180,
  factions: {
    a: { name: "甲方", color: "#c0392b" },
    b: { name: "乙方", color: "#3a6ea5" },
  },
  terrain: {
    size: 260,
    seed: 1,
    relief: 10,
    river: { slope: 0.1, offset: 10, width: 16, depth: 5 },
    flatSpots: [{ x: 0, z: 0, rx: 70, rz: 55, strength: 0.55 }],
  },
  landmarks: [],
  units: [
    {
      id: "a_main",
      faction: "a",
      label: "甲军主力",
      size: 1,
      waypoints: [
        { t: 0, x: -80, z: 0 },
        { t: 90, x: -20, z: 5 },
        { t: 180, x: 20, z: 8 },
      ],
    },
    {
      id: "b_main",
      faction: "b",
      label: "乙军主力",
      size: 0.9,
      waypoints: [
        { t: 0, x: 70, z: 0 },
        { t: 120, x: 45, z: 0 },
        { t: 180, x: 30, z: 6 },
      ],
    },
  ],
  events: [
    { t: 0, date: "某年 · 某月", title: "两军对峙", detail: "描述。" },
    { t: 120, date: "某年 · 某月", title: "决战", detail: "描述。" },
  ],
  clashes: [{ t: 130, x: 40, z: 3, label: "决战" }],
  camera: [
    { t: 0, pos: [-120, 95, 120], target: [0, 0, 0] },
    { t: 120, pos: [5, 72, 115], target: [30, 0, 5] },
    { t: 180, pos: [70, 38, 55], target: [35, 0, 5] },
  ],
};
```
