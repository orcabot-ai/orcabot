import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { useI18n } from "./i18n.js";
import { routeTree } from "./routeTree.gen.js";
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, retry: false },
      mutations: { retry: false },
    },
  });
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: Pending,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function Pending() {
  const { t } = useI18n();
  return (
    <div className="gate">
      <p className="muted">{t("Opening your workspace…")}</p>
    </div>
  );
}
