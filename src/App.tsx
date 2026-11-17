import { navigate, useHashRoute } from "./router";
import BattleList from "./pages/BattleList";
import BattleView from "./pages/BattleView";

export default function App() {
  const route = useHashRoute();

  switch (route.name) {
    case "list":
      return <BattleList />;
    case "battle":
      return <BattleView id={route.id} />;
    case "notFound":
      return (
        <div className="center-msg">
          <div>页面不存在：#{route.path}</div>
          <button className="btn" onClick={() => navigate("/")}>
            返回列表
          </button>
        </div>
      );
  }
}
