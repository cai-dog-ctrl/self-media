import type { GeoUnit } from "./types";

/** 求单位在时刻 t 的经纬度（分段线性插值） */
export function geoUnitPositionAt(unit: GeoUnit, time: number): [number, number] {
  const wps = unit.waypoints;
  if (wps.length === 0) return [0, 0];
  if (time <= wps[0].t) return [wps[0].lon, wps[0].lat];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    if (time >= a.t && time <= b.t) {
      const p = (time - a.t) / (b.t - a.t);
      return [a.lon + (b.lon - a.lon) * p, a.lat + (b.lat - a.lat) * p];
    }
  }
  const last = wps[wps.length - 1];
  return [last.lon, last.lat];
}

/** 已经走过的行军路径（含当前插值位置） */
export function traveledPath(unit: GeoUnit, time: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const w of unit.waypoints) {
    if (w.t <= time) pts.push([w.lon, w.lat]);
  }
  const cur = geoUnitPositionAt(unit, time);
  const lastKnown = pts[pts.length - 1];
  if (!lastKnown || cur[0] !== lastKnown[0] || cur[1] !== lastKnown[1]) {
    pts.push(cur);
  }
  return pts;
}

/** 当前机动状态：两点之间且尚未到达终点 = 机动中，否则驻守 */
export function unitMovementStatus(unit: GeoUnit, time: number): "机动中" | "驻守" {
  const wps = unit.waypoints;
  if (wps.length < 2) return "驻守";
  if (time >= wps[wps.length - 1].t) return "驻守";
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    if (time >= a.t && time < b.t) {
      const moved =
        a.lon !== b.lon || a.lat !== b.lat ? true : false;
      return moved ? "机动中" : "驻守";
    }
  }
  return "驻守";
}
