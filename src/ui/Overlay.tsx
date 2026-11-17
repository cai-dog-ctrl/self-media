import type { BattleScript } from "../types";
import { usePlayback } from "../store";

const SPEEDS = [0.5, 1, 2, 4];

export default function Overlay({ script }: { script: BattleScript }) {
  const time = usePlayback((s) => s.time);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const freeCamera = usePlayback((s) => s.freeCamera);
  const togglePlay = usePlayback((s) => s.togglePlay);
  const setSpeed = usePlayback((s) => s.setSpeed);
  const setTime = usePlayback((s) => s.setTime);
  const toggleCamera = usePlayback((s) => s.toggleCamera);
  const restart = usePlayback((s) => s.restart);

  const phase =
    [...script.events].reverse().find((e) => e.t <= time) ?? script.events[0];

  return (
    <>
      <header className="top-bar">
        <h1>{script.name}</h1>
        <div className="subtitle">{script.era} · 历史战役 3D 沙盘</div>
        <div className="disclaimer">示意地形与布势，非精确史实地理复原</div>
      </header>

      <aside className="legend">
        {Object.values(script.factions).map((f) => (
          <div className="item" key={f.name}>
            <span className="dot" style={{ background: f.color }} />
            {f.name}
          </div>
        ))}
        <div className="item">
          <span className="dot" style={{ background: "#9a927f" }} />
          石长城（示意）
        </div>
      </aside>

      <div className="console">
        <div className="phase-caption">
          <span className="date">{phase.date}</span>
          <strong>{phase.title}</strong>
          <span style={{ color: "#9c917a", fontSize: 12 }}>{phase.detail}</span>
        </div>
        <div className="timeline-row">
          <button className="btn" onClick={togglePlay}>
            {playing ? "暂停" : "播放"}
          </button>
          <input
            type="range"
            min={0}
            max={script.duration}
            step={0.1}
            value={time}
            onChange={(e) => setTime(parseFloat(e.target.value))}
          />
          <span className="time-label">第 {Math.round(time)} 日</span>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={restart}>
            重播
          </button>
          <button
            className={"btn" + (freeCamera ? " active" : "")}
            onClick={toggleCamera}
          >
            自由视角
          </button>
          <div className="speed-group">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={"btn" + (speed === s ? " active" : "")}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
