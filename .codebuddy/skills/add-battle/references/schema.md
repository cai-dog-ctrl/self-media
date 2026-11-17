# BattleScript Schema 参考

一场战役 = 一个纯数据文件，由引擎按需加载渲染。类型定义源文件：`src/engine/types.ts`（以源文件为准）。

**剧本有两种形态**：

| 形态 | 导出字段 | 渲染视图 | 适用 |
|------|---------|---------|------|
| 3D 沙盘 | `export const script: BattleScript` | three.js diorama | 古代战役、示意地理、无精确坐标 |
| Geo 剧本 | `export const geoScript: GeoBattleScript` | MapLibre 真实底图（45° 沙盘推演） | 有真实经纬度的近现代战役 |

现代战役（有可靠经纬度与真实地理）优先选 **Geo 剧本**：水系、铁路、道路、城镇全部由底图提供，无需自绘。

## GeoBattleScript 结构

```ts
export const geoScript: GeoBattleScript = {
  schemaVersion: 1,
  id: "huaihai",
  name: "淮海战役",
  era: "…",
  summary: "…",
  duration: 66,                    // 单位：日
  startDate: "1948-11-06",         // 可选：战役起始日，驱动顶栏战役时钟
  pace: 1.5,                       // 可选：1x 时每秒推进的「日」数（默认 4，慢节奏战役建议 1~2）
  factions: { pla: { name: "…", color: "#c0392b" }, kmt: { … } },
  view: { center: [117.1, 33.85], zoom: 7.3, bearing: 0, pitch: 45 },  // 初始全局视野
  phases: [                        // 可选：底部 PHASE 阶段标签（点击跳转）
    { label: "PHASE I · 围歼黄百韬", t: 0 },
    { label: "PHASE II · 围歼黄维", t: 17 },
  ],
  units: [
    {
      id: "pla_assault",
      faction: "pla",
      label: "华野突击集团（1·4·6·8·9纵）",
      size: 1,                      // 0~1，影响标记观感与「兵力规模」文案
      appearAfter: 24,              // 可选，伏兵/后到部队
      brief: "单位简报：详情卡介绍文字（1~3 句）",          // 可选
      actions: ["11.6 自鲁南南下", "11.11—11.22 碾庄攻坚"], // 可选：行动计划列表
      waypoints: [                  // t 严格递增；lon/lat 为真实经纬度
        { t: 0, lon: 117.6, lat: 34.85 },
        { t: 12, lon: 117.86, lat: 34.35 },
      ],
    },
  ],
  events: [ … ],                    // 同 PhaseEvent，同时驱动语音播报与作战日志
  clashes: [{ t: 19, lon: 116.85, lat: 33.56, label: "双堆集合围" }],
  camera: [                         // 地图运镜：center/zoom/bearing/pitch 插值
    { t: 0, center: [117.3, 34.1], zoom: 7.6, bearing: 0, pitch: 45 },
    { t: 12, center: [117.87, 34.32], zoom: 10, bearing: 15, pitch: 55 },
  ],
};
```

**态势 HUD 的数据联动**（自动，无需额外配置）：

- 顶栏战役时钟：由 `startDate` + 当前时间推算（日的整数部分为日期，小数部分为时刻）
- 作战日志：已发生的事件按 D+N 倒序滚动
- 军队进出：各单位按 `appearAfter` 显示「已参战 / 第 N 日入场」
- 单位详情卡：点击地图标记或左侧列表显示 `brief`、`actions`、当前位置与机动状态
- 语音播报：默认开启（Web Speech API 中文语音），播报 `events` 时自动暂停推演、播完恢复；无语音环境按字数估算超时兜底

- 坐标直接写经纬度（小数点后 2~3 位即可），**不要**再做本地投影换算
- `pitch` 建议 40~55（斜视角沙盘观感），`bearing` 可微调增强运镜动感
- 单位渲染为 DOM 标记（图钉 + 中文标签），行军线只画「已走过的路径」，交战点为扩散环
- 首帧 camera 建议 `t: 0` 且覆盖整个战场（全局视角开场），末帧 `t = duration`
- 底图配置在 `src/pages/MapBattleView.tsx` 顶部 `BASEMAPS`（默认 GeoQ 灰度中文瓦片，免 key；备选 CARTO 暗色）

## BattleScript（3D 沙盘形态）顶层结构

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

## map: BattleMap（可选，真实地图要素）

提供 `map` 字段时，引擎会在地形上叠加渲染河流、湖泊、铁路与城镇，形成地理上真实的战场底图：

```ts
map: {
  rivers: [   // 贴地蓝色条带，按 points 折线生成
    { id: "huai_river", label: "淮河", width: 4, points: [[-46, 76], [-29, 66]] },
  ],
  lakes: [    // 平面多边形水面
    { id: "hongze_lake", label: "洪泽湖", polygon: [[64, 10], [84, 14], [96, 28], [87, 46]] },
  ],
  railways: [ // 路基 + 铁轨双层条带
    { id: "jinpu_railway", label: "津浦铁路", points: [[-6, -73], [-11, -35]] },
  ],
  cities: [   // 地基 + 小型建成区 + 标签
    { id: "xuzhou", label: "徐州", x: -13, z: -36, scale: 1 },
  ],
}
```

- `rivers[].width`：淮河干流 4 左右，运河 2.5，一般河流 1~1.6
- `cities[].scale`：0.3（小镇）~ 1（重镇），影响建成区大小
- 河湖蓝为青色系（#3fa0ad），与势力蓝色有区分

**推荐写法——经纬度投影辅助函数**：直接在剧本文件顶部定义换算函数，数据里全部写经纬度，可读、可校对：

```ts
const X = (lon: number) => (lon - 117.4) * 58;
const Z = (lat: number) => (33.75 - lat) * 69.6;
const P = (lon: number, lat: number): [number, number] => [X(lon), Z(lat)];
const W = (t: number, lon: number, lat: number): Waypoint => ({ t, x: X(lon), z: Z(lat) });
```

参考实现：`src/data/battles/huaihai.ts`。投影中心与比例按战役区域自行选取，保证所有坐标落在 `±terrain.size/2` 内。

**地形配合**：真实地图战役建议把 `terrain.flatSpots` 覆盖整个战场（如 `{ x: 0, z: 0, rx: 160, rz: 130, strength: 0.96 }`）得到微起伏平原，让河湖城镇成为主要地理信息。

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
