import { Suspense, lazy, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { BattleScript, GeoBattleScript } from "../engine/types";
import { validateScript } from "../engine/validate";
import { usePlayback } from "../engine/playback";
import Scene from "../engine/scene/Scene";
import Overlay from "../engine/ui/Overlay";
import { loadBattle, type LoadedBattle } from "../data/registry";
import { navigate } from "../router";

const MapBattleView = lazy(() => import("./MapBattleView"));

function BattleStage({ script }: { script: BattleScript }) {
  const restart = usePlayback((s) => s.restart);
  const setDuration = usePlayback((s) => s.setDuration);
  const setPace = usePlayback((s) => s.setPace);

  useEffect(() => {
    restart();
    setDuration(script.duration);
    setPace(4);
  }, [script, restart, setDuration, setPace]);

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

function Loading({ text }: { text: string }) {
  return <div className="center-msg">{text}</div>;
}

export default function BattleView({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<LoadedBattle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(null);
    setError(null);
    loadBattle(id).then(
      (b) => {
        if (alive) setLoaded(b);
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
  if (!loaded) {
    return <Loading text="载入战报…" />;
  }
  if (loaded.type === "geo") {
    const geo: GeoBattleScript = loaded.script;
    return (
      <Suspense fallback={<Loading text="载入地图引擎…" />}>
        <MapBattleView key={geo.id} script={geo} />
      </Suspense>
    );
  }
  return <BattleStage key={loaded.script.id} script={loaded.script} />;
}
