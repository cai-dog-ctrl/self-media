import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import Scene from "./scene/Scene";
import Overlay from "./ui/Overlay";
import { changping } from "./data/changping";
import { usePlayback } from "./store";

export default function App() {
  const setDuration = usePlayback((s) => s.setDuration);

  useEffect(() => {
    setDuration(changping.duration);
  }, [setDuration]);

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [-120, 95, 120], fov: 50, near: 0.5, far: 1500 }}
      >
        <Scene script={changping} />
      </Canvas>
      <Overlay script={changping} />
    </div>
  );
}
