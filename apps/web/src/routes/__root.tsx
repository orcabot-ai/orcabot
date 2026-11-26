import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { themeBootstrap, ThemeControl } from "../ThemeControl.js";
import { I18nProvider, LanguageControl, useI18n } from "../i18n.js";
import css from "../styles.css?url";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, interactive-widget=resizes-content",
        },
        { title: "Orcabot — Your personal assistant" },
        {
          name: "description",
          content:
            "A personal AI assistant for tasks, conversations and recurring work on your machines.",
        },
        { name: "page-type", content: "software" },
        { name: "site-kind", content: "software" },
      ],
      links: [
        { rel: "stylesheet", href: css },
        { rel: "icon", type: "image/png", href: "/favicon.png" },
      ],
    }),
    component: Root,
    shellComponent: Document,
    notFoundComponent: NotFound,
  },
);
function NotFound() {
  const { t } = useI18n();
  return (
    <div className="gate">
      <div className="gate-preferences">
        <LanguageControl />
        <ThemeControl />
      </div>
      <h1>{t("Page not found")}</h1>
      <a href="/">{t("Open workspace")}</a>
    </div>
  );
}
function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Outlet />
      </I18nProvider>
    </QueryClientProvider>
  );
}
function Document({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-type="software"
      data-radius="soft"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
