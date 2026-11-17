/** 战役剧本 schema 版本：引擎升级时用于识别与迁移旧剧本 */
export const SCHEMA_VERSION = 1;

/** 河谷（示意河流）走向：谷心线满足 z = x * slope + offset */
export interface RiverSpec {
  slope: number;
  offset: number;
  /** 谷宽（高斯衰减半径） */
  width: number;
  /** 下切深度 */
  depth: number;
}

/** 主战场平坦区：以 (x, z) 为中心的椭圆区域 */
export interface FlatSpot {
  x: number;
  z: number;
  rx: number;
  rz: number;
  /** 0 ~ 1，越大越平 */
  strength: number;
}

/** 每场战役独立的地形配置，驱动程序化地形生成 */
export interface TerrainConfig {
  /** 沙盘边长（世界坐标单位） */
  size: number;
  /** 噪声种子，0 表示使用引擎默认地形 */
  seed: number;
  /** 主起伏幅度 */
  relief: number;
  river?: RiverSpec;
  flatSpots?: FlatSpot[];
}

/** 战场地标（当前支持石长城类墙体） */
export interface Landmark {
  id: string;
  type: "wall";
  label: string;
  color: string;
  /** 墙体所在经度方向位置 */
  x: number;
  zFrom: number;
  zTo: number;
}

export interface FactionInfo {
  name: string;
  color: string;
}

export interface Waypoint {
  t: number;
  x: number;
  z: number;
}

export interface Unit {
  id: string;
  /** 必须是 factions 中已定义的 key */
  faction: string;
  label: string;
  /** 相对兵力规模 0 ~ 1，影响标记大小 */
  size: number;
  waypoints: Waypoint[];
  /** 该时间点之后才出现 */
  appearAfter?: number;
}

export interface PhaseEvent {
  t: number;
  date: string;
  title: string;
  detail: string;
}

export interface ClashEvent {
  t: number;
  x: number;
  z: number;
  label: string;
}

export interface CameraKeyframe {
  t: number;
  pos: [number, number, number];
  target: [number, number, number];
}

/* ---------- 真实地图要素（可选，schema v1 追加） ---------- */

export interface MapPolyline {
  id: string;
  label?: string;
  /** 平面坐标点列 [x, z] */
  points: Array<[number, number]>;
}

export interface MapRiver extends MapPolyline {
  width: number;
}

export interface MapRailway extends MapPolyline {}

export interface MapLake {
  id: string;
  label?: string;
  /** 平面坐标多边形 [x, z]，按序首尾相连 */
  polygon: Array<[number, number]>;
}

export interface MapCity {
  id: string;
  label: string;
  x: number;
  z: number;
  /** 0.3（小镇）~ 1（重镇），影响建成区与标签大小 */
  scale: number;
}

export interface BattleMap {
  rivers: MapRiver[];
  lakes: MapLake[];
  railways: MapRailway[];
  cities: MapCity[];
}

/** 一场战役的完整剧本。数据文件放 data/battles/*.ts，由注册表按需加载 */
export interface BattleScript {
  schemaVersion: number;
  id: string;
  name: string;
  era: string;
  summary: string;
  /** 时间轴总长（单位：日） */
  duration: number;
  factions: Record<string, FactionInfo>;
  terrain: TerrainConfig;
  landmarks: Landmark[];
  /** 真实地图要素（河流/湖泊/铁路/城镇），提供时叠加渲染 */
  map?: BattleMap;
  units: Unit[];
  events: PhaseEvent[];
  clashes: ClashEvent[];
  camera: CameraKeyframe[];
}

/* ---------- Geo 剧本：真实地理 + MapLibre 沙盘推演视图 ---------- */

export interface GeoWaypoint {
  t: number;
  lon: number;
  lat: number;
}

export interface GeoUnit {
  id: string;
  faction: string;
  label: string;
  /** 相对兵力规模 0 ~ 1，影响标记大小 */
  size: number;
  waypoints: GeoWaypoint[];
  /** 该时间点之后才出现 */
  appearAfter?: number;
  /** 单位简报：详情卡片中的介绍文字 */
  brief?: string;
  /** 行动计划：按时间排序的关键行动 */
  actions?: string[];
}

export interface GeoClashEvent {
  t: number;
  lon: number;
  lat: number;
  label: string;
}

/** 地图运镜关键帧：插值 center/zoom/bearing/pitch */
export interface GeoCameraKeyframe {
  t: number;
  center: [number, number];
  zoom: number;
  /** 朝向角（度，正北为 0） */
  bearing: number;
  /** 俯仰角（度，0 为正俯视，45 为斜视角） */
  pitch: number;
}

export interface GeoView {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

/** 战役阶段（底部 PHASE 标签） */
export interface GeoBattlePhase {
  label: string;
  /** 阶段起始时刻 */
  t: number;
}

/** 真实地理战役剧本：单位/交战点/运镜全部使用经纬度，由 MapLibre 视图渲染 */
export interface GeoBattleScript {
  schemaVersion: number;
  id: string;
  name: string;
  era: string;
  summary: string;
  duration: number;
  factions: Record<string, FactionInfo>;
  /** 初始全局视野 */
  view: GeoView;
  /** 战役起始日期（YYYY-MM-DD），用于顶栏战役时钟 */
  startDate?: string;
  /** 1x 速度下每秒推进的「日」数，默认 4；节奏慢的战役建议 1~2 */
  pace?: number;
  /** 战役阶段（底部 PHASE 标签，点击可跳转） */
  phases?: GeoBattlePhase[];
  units: GeoUnit[];
  events: PhaseEvent[];
  clashes: GeoClashEvent[];
  camera: GeoCameraKeyframe[];
}

/** 地形高度函数：地形网格、军队落点、行军线共用，保证贴地一致 */
export type TerrainHeightFn = (x: number, z: number) => number;
