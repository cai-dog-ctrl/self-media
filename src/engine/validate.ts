import { SCHEMA_VERSION, type BattleScript } from "./types";

/**
 * 剧本校验：返回问题列表（空数组 = 通过）。
 * 目前在开发模式下随加载执行并 console.warn，战役数量上来后可挂到 CI 全量跑。
 */
export function validateScript(script: BattleScript): string[] {
  const issues: string[] = [];

  if (script.schemaVersion !== SCHEMA_VERSION) {
    issues.push(`schemaVersion=${script.schemaVersion} 与引擎当前版本 ${SCHEMA_VERSION} 不一致`);
  }
  if (script.duration <= 0) {
    issues.push("duration 必须为正数");
  }

  const checkTimeline = (arr: Array<{ t: number }>, label: string) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].t < arr[i - 1].t) {
        issues.push(`${label} 的 t 必须非降序`);
        break;
      }
    }
    for (const e of arr) {
      if (e.t > script.duration) {
        issues.push(`${label} 存在超出 duration 的时刻 t=${e.t}`);
        break;
      }
    }
  };

  for (const u of script.units) {
    if (!script.factions[u.faction]) {
      issues.push(`单位 ${u.id} 引用了未定义的势力 "${u.faction}"`);
    }
    if (u.waypoints.length === 0) {
      issues.push(`单位 ${u.id} 没有任何 waypoints`);
      continue;
    }
    for (let i = 1; i < u.waypoints.length; i++) {
      if (u.waypoints[i].t <= u.waypoints[i - 1].t) {
        issues.push(`单位 ${u.id} 的 waypoints 时间必须严格递增`);
        break;
      }
    }
    if (u.appearAfter !== undefined && (u.appearAfter < 0 || u.appearAfter > script.duration)) {
      issues.push(`单位 ${u.id} 的 appearAfter=${u.appearAfter} 超出时间轴`);
    }
    if (u.waypoints[u.waypoints.length - 1].t > script.duration) {
      issues.push(`单位 ${u.id} 的 waypoints 超出 duration`);
    }
  }

  checkTimeline(script.events, "events");
  checkTimeline(script.clashes, "clashes");
  checkTimeline(script.camera, "camera");

  if (script.camera.length === 0) {
    issues.push("camera 关键帧不能为空");
  }

  return issues;
}
