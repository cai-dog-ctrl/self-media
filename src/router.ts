import { useEffect, useState } from "react";

export type Route =
  | { name: "list" }
  | { name: "battle"; id: string }
  | { name: "notFound"; path: string };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  const m = path.match(/^\/battle\/([\w-]+)\/?$/);
  if (m) return { name: "battle", id: m[1] };
  if (path === "/") return { name: "list" };
  return { name: "notFound", path };
}

/** 极简 hash 路由：#/ → 战役列表，#/battle/<id> → 战役沙盘 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  window.location.hash = to;
}
