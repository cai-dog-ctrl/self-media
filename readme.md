# 华夏战纪 · 历史战役 3D 沙盘

基于 React Three Fiber 的历史战役 3D 沙盘播放器。一个引擎 + N 份战役剧本（纯数据），每场战役一个独立 URL。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 生产构建
```

- `#/` — 战役列表
- `#/battle/<id>` — 战役沙盘，如 `#/battle/changping`

## 目录结构

```
src/
├─ engine/                 # 播放引擎（不感知具体战役，勿为单场战役修改）
│  ├─ types.ts             # BattleScript 等 schema 定义
│  ├─ playback.ts          # 播放状态 store
│  ├─ terrain.ts           # 按战役配置参数化的程序化地形
│  ├─ validate.ts          # 剧本数据校验规则（开发模式自动执行）
│  ├─ scene/               # 3D 场景组件
│  └─ ui/Overlay.tsx       # 图例与播放控制台
├─ data/
│  ├─ registry.ts          # 战役注册表（import.meta.glob 按需懒加载）
│  ├─ catalog.ts           # 列表页元数据
│  └─ battles/             # 战役剧本，一场一个文件
├─ pages/                  # 战役列表页 / 战役沙盘页
└─ router.ts               # hash 路由
```

## 如何新增一场战役

只需两步，完全不碰引擎代码：

1. **创建剧本**：新建 `src/data/battles/<id>.ts`（`<id>` 为 kebab-case 英文，如 `guiling`），导出 `export const script: BattleScript`。字段写法参考 `src/data/battles/changping.ts` 或 `.codebuddy/skills/add-battle/references/schema.md`。

2. **登记目录**：在 `src/data/catalog.ts` 的 `catalog` 数组追加一条：

   ```ts
   { id: "guiling", name: "桂陵之战", era: "战国 · …", summary: "一句话简介。" }
   ```

完成后运行 `npm run build` 确认类型检查通过，`npm run dev` 后访问 `#/battle/<id>` 即可播放。

### 剧本编写要点

- `duration` 单位为「日」，1x 速度每秒推进 4 日；建议 120~240
- `units[].faction` 必须是 `factions` 中已定义的 key，势力数量不限
- 每个 unit 的 `waypoints` 时间 `t` 严格递增且不超过 `duration`
- 坐标系：`x` 向东、`z` 向南，范围 `±terrain.size / 2`（默认 ±130），高度由地形自动计算
- `terrain.seed` 换任意整数即得全新地形；`river`/`flatSpots` 控制河谷与主战场平坦区
- 更多细节见 `.codebuddy/skills/add-battle/references/schema.md`

> 也可以直接在 CodeBuddy 会话里说「添加一场 XX 之战」，会触发 `add-battle` skill 自动完成上述流程。

## 数据校验

`src/engine/validate.ts` 在开发模式下对每个剧本自动校验：势力引用、waypoint 时间递增、事件越界等，问题会以 `console.warn` 输出。列表页同时检查 `catalog` 与 `battles/` 目录的一致性。
