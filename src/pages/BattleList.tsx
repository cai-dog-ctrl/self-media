import { catalog } from "../data/catalog";
import { battleIds } from "../data/registry";
import { navigate } from "../router";

export default function BattleList() {
  // 开发期一致性检查：catalog 与 battles/ 目录是否同步
  if (import.meta.env.DEV) {
    const ids = battleIds();
    const missing = ids.filter((id) => !catalog.some((c) => c.id === id));
    const stale = catalog.filter((c) => !ids.includes(c.id)).map((c) => c.id);
    if (missing.length || stale.length) {
      console.warn("[catalog] 与 data/battles/ 不一致：", { 未登记: missing, 已失效: stale });
    }
  }

  return (
    <div className="list-page">
      <header className="list-header">
        <h1>华夏战纪</h1>
        <p>历史战役 3D 沙盘 · 共 {catalog.length} 场</p>
      </header>
      <div className="battle-grid">
        {catalog.map((b) => (
          <button key={b.id} className="battle-card" onClick={() => navigate(`/battle/${b.id}`)}>
            <div className="era">{b.era}</div>
            <div className="name">{b.name}</div>
            <div className="summary">{b.summary}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
