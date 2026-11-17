import { useState } from "react";
import type { GeoBattleScript, GeoUnit, PhaseEvent } from "../engine/types";
import { geoUnitPositionAt, unitMovementStatus } from "../engine/geo";
import { usePlayback } from "../engine/playback";

const MAP_SPEEDS = [0.25, 0.5, 1, 2, 4];

type Weather = "clear" | "overcast" | "rain" | "fog" | "snow";

const WEATHERS: Array<{ key: Weather; label: string }> = [
  { key: "clear", label: "晴" },
  { key: "overcast", label: "阴" },
  { key: "rain", label: "雨" },
  { key: "fog", label: "雾" },
  { key: "snow", label: "雪" },
];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 战役时钟：起始日期 + 当前时刻（日的整数部分为日期，小数部分为时刻） */
function battleClock(startDate: string | undefined, time: number): string {
  if (!startDate) return `第 ${Math.floor(time)} 日`;
  const [y, m, d] = startDate.split("-").map(Number);
  const day = Math.floor(time);
  const dt = new Date(Date.UTC(y, m - 1, d) + day * 86400000);
  const frac = time - day;
  const hh = Math.floor(frac * 24);
  const mm = Math.floor((frac * 24 - hh) * 60);
  return `${dt.getUTCFullYear()}.${pad2(dt.getUTCMonth() + 1)}.${pad2(dt.getUTCDate())} ${pad2(hh)}:${pad2(mm)}`;
}

function strengthLabel(size: number): string {
  if (size >= 0.9) return "重兵集团";
  if (size >= 0.7) return "主力兵团";
  if (size >= 0.5) return "兵团级";
  if (size >= 0.35) return "纵队 / 军团";
  return "军区 / 支队";
}

function countEventsLE(events: PhaseEvent[], time: number): number {
  let n = 0;
  while (n < events.length && events[n].t <= time) n++;
  return n;
}

export interface MapHudProps {
  script: GeoBattleScript;
  voiceOn: boolean;
  onToggleVoice: () => void;
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
}

export default function MapHud({
  script,
  voiceOn,
  onToggleVoice,
  selectedUnitId,
  onSelectUnit,
}: MapHudProps) {
  const time = usePlayback((s) => s.time);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const freeCamera = usePlayback((s) => s.freeCamera);
  const togglePlay = usePlayback((s) => s.togglePlay);
  const setSpeed = usePlayback((s) => s.setSpeed);
  const setTime = usePlayback((s) => s.setTime);
  const toggleCamera = usePlayback((s) => s.toggleCamera);
  const restart = usePlayback((s) => s.restart);
  const [weather, setWeather] = useState<Weather>("clear");

  const eventIndex = countEventsLE(script.events, time);
  const currentEvent = script.events[Math.max(0, eventIndex - 1)];
  const activePhase =
    script.phases
      ? [...script.phases].reverse().find((p) => p.t <= time) ?? script.phases[0]
      : undefined;
  const log = script.events.slice(0, eventIndex).reverse();
  const selected: GeoUnit | undefined = script.units.find(
    (u) => u.id === selectedUnitId
  );

  return (
    <>
      {/* 气象视觉层（纯视觉特效） */}
      <div className={`weather-tint weather-${weather}`} />

      {/* 顶栏：战役名 + 战役时钟 */}
      <div className="map-topbar">
        <div className="tb-left">
          <span className="tb-title">{script.name} · 作战态势推演</span>
          <span className="tb-era">{script.era}</span>
        </div>
        <div className="tb-right">
          {activePhase && <span className="tb-phase">{activePhase.label}</span>}
          <span className="tb-clock">{battleClock(script.startDate, time)}</span>
          <span className="tb-day">
            D+{Math.floor(time)} / {script.duration}
          </span>
        </div>
      </div>

      {/* 左侧面板：阶段简报 / 军队进出 / 战场气象 */}
      <aside className="map-panel map-left">
        <section className="hud-section">
          <h3>◆ 当前阶段简报</h3>
          {currentEvent && (
            <div className="brief-body">
              <div className="brief-date">{currentEvent.date}</div>
              <div className="brief-title">{currentEvent.title}</div>
              <p className="brief-detail">{currentEvent.detail}</p>
            </div>
          )}
        </section>

        <section className="hud-section">
          <h3>◆ 军队进出</h3>
          <div className="pacs-list">
            {script.units.map((u) => {
              const joined = u.appearAfter === undefined || time >= u.appearAfter;
              const color = script.factions[u.faction].color;
              return (
                <div
                  key={u.id}
                  className={"pacs-row" + (u.id === selectedUnitId ? " active" : "")}
                  onClick={() => onSelectUnit(u.id === selectedUnitId ? null : u.id)}
                >
                  <span className="pacs-dot" style={{ background: color }} />
                  <span className="pacs-name">{u.label}</span>
                  <span className={"pacs-status" + (joined ? " in" : "")}>
                    {joined ? "已参战" : `第${u.appearAfter}日入场`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="hud-section">
          <h3>◆ 战场气象</h3>
          <div className="weather-btns">
            {WEATHERS.map((w) => (
              <button
                key={w.key}
                className={"btn" + (weather === w.key ? " active" : "")}
                onClick={() => setWeather(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* 右侧面板：单位详情 / 作战日志 */}
      <aside className="map-panel map-right">
        <section className="hud-section">
          <h3>◆ 单位详情</h3>
          {selected ? (
            <div className="unit-detail">
              <div className="detail-head">
                <span
                  className="detail-faction"
                  style={{ background: script.factions[selected.faction].color }}
                >
                  {script.factions[selected.faction].name}
                </span>
                <button
                  className="detail-close"
                  onClick={() => onSelectUnit(null)}
                  aria-label="关闭详情"
                >
                  ×
                </button>
              </div>
              <h4 className="detail-name">{selected.label}</h4>
              {selected.brief && <p className="detail-brief">{selected.brief}</p>}
              <div className="detail-grid">
                <span>兵力规模</span>
                <span>{strengthLabel(selected.size)}</span>
                <span>当前位置</span>
                <span>
                  {(() => {
                    const [lon, lat] = geoUnitPositionAt(selected, time);
                    return `东经${lon.toFixed(2)}° 北纬${lat.toFixed(2)}°`;
                  })()}
                </span>
                <span>当前状态</span>
                <span>{unitMovementStatus(selected, time)}</span>
              </div>
              {selected.actions && (
                <div className="detail-actions">
                  <div className="detail-actions-title">行动计划</div>
                  <ul>
                    {selected.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="unit-detail empty">
              点击地图上的部队标记
              <br />
              查看该部详情与行动计划
            </div>
          )}
        </section>

        <section className="hud-section grow">
          <h3>◆ 作战日志</h3>
          <div className="combat-log">
            {log.length === 0 && <div className="log-empty">推演开始后此处滚动记录战况</div>}
            {log.map((e) => (
              <div className="log-row" key={e.t}>
                <span className="log-day">D+{Math.floor(e.t)}</span>
                <span className="log-text">
                  <b>{e.title}</b> · {e.detail}
                </span>
              </div>
            ))}
          </div>
        </section>
      </aside>

      {/* 底栏：自动推演 / 阶段 / 倍速 / 语音 / 视角 */}
      <div className="map-bottombar">
        <button className="btn primary" onClick={togglePlay}>
          {playing ? "暂停推演" : "自动推演"}
        </button>
        <button className="btn" onClick={restart}>
          重播
        </button>
        <div className="phase-tabs">
          {script.phases?.map((p, i) => {
            const active =
              p.t <= time &&
              (i === script.phases!.length - 1 || script.phases![i + 1].t > time);
            return (
              <button
                key={p.label}
                className={"phase-tab" + (active ? " active" : "")}
                onClick={() => setTime(p.t)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="speed-group">
          {MAP_SPEEDS.map((s) => (
            <button
              key={s}
              className={"btn" + (speed === s ? " active" : "")}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          className={"btn" + (voiceOn ? " voice-on" : "")}
          onClick={onToggleVoice}
        >
          语音播报 {voiceOn ? "开" : "关"}
        </button>
        <button
          className={"btn" + (freeCamera ? " active" : "")}
          onClick={toggleCamera}
        >
          自由视角
        </button>
      </div>
    </>
  );
}
