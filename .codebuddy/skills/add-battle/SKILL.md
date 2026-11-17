---
name: add-battle
description: 向「华夏战纪」历史战役 3D 沙盘项目添加一场新的战役剧本。当用户要求添加战役、新增一场战争/战役、录入某场之战（如"添加一场官渡之战""加一场赤壁"）、制作战役沙盘内容时，应使用此 skill。涵盖剧本数据文件创建、目录登记、数据校验与构建验证的完整流程。
---

# 添加战役（BattleScript）

## 目的

在不改动引擎代码的前提下，通过纯数据文件为项目新增一场可播放的历史战役沙盘。

## 何时使用

用户要求新增/录入/制作一场战役时触发，典型话术："添加一场 XX 之战""再加一个战役""把 YY 战争做成沙盘"。

## 前置知识

先读取 `references/schema.md`，其中包含 `BattleScript` 全部字段的定义、坐标系约定、地形参数语义与完整示例骨架。**不要修改 `src/engine/` 目录下的任何文件**——引擎与数据完全解耦，新增战役只写数据。

## 工作流程

### 1. 收集战役信息

从用户消息与史实中整理：战役名、朝代/年份、双方势力（名称与代表色）、兵力构成、关键阶段（按时间）、主要交战点、地理特征（河流、山脉、城防）。用户提供的信息不全时，基于公认史实合理拟定，并在最终交付说明中标注哪些内容为示意性推定。

### 2. 确定战役 id

- kebab-case 英文，如 `guiling`、`chi bi` 应为 `chibi`
- 检查 `src/data/battles/` 下不存在同名文件

### 3. 创建剧本文件

新建 `src/data/battles/<id>.ts`，导出 `export const script: BattleScript`（从 `../../engine/types` 导入类型）。字段写法参照 `references/schema.md`，可参考现有剧本 `src/data/battles/changping.ts`。

### 4. 登记目录

在 `src/data/catalog.ts` 的 `catalog` 数组中追加一条 `BattleMeta`（id、name、era、summary，与剧本保持一致）。

### 5. 自检数据规则

逐条核对以下规则（与 `src/engine/validate.ts` 一致，违反会在开发模式告警）：

- `schemaVersion` 等于 `SCHEMA_VERSION`（当前为 1）
- 每个 `units[].faction` 必须是 `factions` 中已定义的 key
- 每个 unit 的 `waypoints` 时间 `t` 严格递增，且最后一点的 `t <= duration`
- `appearAfter` 在 0 ~ duration 范围内
- `events`、`clashes`、`camera` 的 `t` 非降序且不超过 `duration`
- `camera` 至少 1 个关键帧，首帧 `t: 0`，末帧 `t` 等于 `duration`（保证收尾运镜完整）
- 所有坐标落在地形范围内（`terrain.size` 的一半以内，默认 ±130）

### 6. 构建验证

运行 `npm run build`（含 tsc 严格类型检查）。失败则修复后重跑。

### 7. 交付说明

向用户汇报：新建/修改的文件清单、访问路径 `#/battle/<id>`（`npm run dev` 后在浏览器打开）、以及标注为示意性推定的内容。

## 常见陷阱

- 势力颜色避免过暗（#xxx 深色在暗色地形上不醒目），双方颜色需有足够对比度
- `duration` 单位是"日"，回放时 1x 速度每秒推进 4 日；百日级战役 duration 控制在 120~240 之间观感较好
- 地形 `seed: 0` 为引擎默认地形；换任意整数 seed 生成全新地形。调完地形后需同步检查各 unit 落点不在深水里
- `river` 走向为 `z = x * slope + offset`，用于让行军线与营地避开河谷时可先算好再写坐标
