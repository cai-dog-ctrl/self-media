export type Faction = "qin" | "zhao";

export interface Waypoint {
  t: number;
  x: number;
  z: number;
}

export interface Unit {
  id: string;
  faction: Faction;
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

export interface BattleScript {
  id: string;
  name: string;
  era: string;
  summary: string;
  duration: number;
  factions: Record<Faction, { name: string; color: string }>;
  units: Unit[];
  events: PhaseEvent[];
  clashes: ClashEvent[];
  camera: CameraKeyframe[];
}
