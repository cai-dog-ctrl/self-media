import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { BattleScript } from "../engine/types";
import { validateScript } from "../engine/validate";
import { usePlayback } from "../engine/playback";
import Scene from "../engine/scene/Scene";
import Overlay from "../engine/ui/Overlay";
import { loadBattle } from "../data/registry";
import { navigate } from "../router";

function BattleStage({ script }: { script: BattleScript }) {
  const restart = usePlayback((s) => s.restart);
  const setDuration = usePlayback((s) => s.setDuration);

  useEffect(() => {
    restart();
    setDuration(script.duration);
  }, [script, restart, setDuration]);

  if (import.meta.env.DEV) {
    const issues = validateScript(script);
    if (issues.length) {
      console.warn(`[剧本校验] ${script.id} 存在 ${issues.length} 个问题：`, issues);
    }
  }

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [-120, 95, 120], fov: 50, near: 0.5, far: 1500 }}
      >
        <Scene script={script} />
      </Canvas>
      <Overlay script={script} />
    </div>
  );
}

export default function BattleView({ id }: { id: string }) {
  const [script, setScript] = useState<BattleScript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setScript(null);
    setError(null);
    loadBattle(id).then(
      (s) => {
        if (alive) setScript(s);
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    );
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="center-msg">
        <div>剧本加载失败：{error}</div>
        <button className="btn" onClick={() => navigate("/")}>
          返回列表
        </button>
      </div>
    );
  }
  if (!script) {
    return <div className="center-msg">载入战报…</div>;
  }
  return <BattleStage key={script.id} script={script} />;
}
