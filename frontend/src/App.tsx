import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { Comparison } from "./pages/Comparison";
import { Dashboard } from "./pages/Dashboard";
import { MatchAnalysis } from "./pages/MatchAnalysis";
import { Methodology } from "./pages/Methodology";
import { Research } from "./pages/Research";
import { ROUTES, useRoute } from "./router";
import { AppStateProvider } from "./state";

const PAGES = {
  dashboard: Dashboard,
  match: MatchAnalysis,
  compare: Comparison,
  research: Research,
  methodology: Methodology,
  about: About,
};

export function App() {
  const route = useRoute();
  const Page = PAGES[route];
  useEffect(() => {
    document.title = `${ROUTES.find((r) => r.path === route)?.label} · Resume–Job Matching`;
    window.scrollTo?.(0, 0);
  }, [route]);
  return (
    <AppStateProvider>
      <Layout route={route}>
        <Page />
      </Layout>
    </AppStateProvider>
  );
}
