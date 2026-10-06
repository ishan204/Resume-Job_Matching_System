// Minimal hash router: six pages do not need a routing library.
import { useEffect, useState } from "react";

export const ROUTES = [
  { path: "dashboard", label: "Dashboard" },
  { path: "match", label: "Match Analysis" },
  { path: "compare", label: "Model Comparison" },
  { path: "research", label: "Research" },
  { path: "methodology", label: "Dataset & Methodology" },
  { path: "about", label: "About / Limitations" },
] as const;

export type RoutePath = (typeof ROUTES)[number]["path"];

const current = (): RoutePath => {
  const p = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES.find((r) => r.path === p)?.path ?? "dashboard") as RoutePath;
};

export function useRoute(): RoutePath {
  const [route, setRoute] = useState<RoutePath>(current);
  useEffect(() => {
    const on = () => setRoute(current());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(path: RoutePath) {
  window.location.hash = `/${path}`;
}
