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
  units: Unit[];
  events: PhaseEvent[];
  clashes: ClashEvent[];
  camera: CameraKeyframe[];
}

/** 地形高度函数：地形网格、军队落点、行军线共用，保证贴地一致 */
export type TerrainHeightFn = (x: number, z: number) => number;
