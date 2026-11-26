import type { ReactNode } from "react";
import { OrcaScene } from "./OrcaScene.js";
import { LanguageControl, useI18n } from "./i18n.js";
import { ThemeControl } from "./ThemeControl.js";

export function Landing({
  children,
  keyRequired,
}: {
  children: ReactNode;
  keyRequired: boolean;
}) {
  const { t } = useI18n();
  return (
    <main className="landing">
      <a className="skip-link" href="#orcabot-entry">
        {t("Skip to content")}
      </a>
      <section className="landing-shell" aria-label={t("Welcome to Orcabot")}>
        <OrcaScene />
        <div className="landing-entry">
          <div className="landing-preferences">
            <LanguageControl />
            <ThemeControl />
          </div>
          <div id="orcabot-entry" className="landing-form">
            <h1>{t("Welcome to Orcabot")}</h1>
            <p className="landing-intro">
              {t("Your personal AI assistant for the work ahead.")}
            </p>
            {children}
            <p className="landing-note">
              {t(
                keyRequired
                  ? "Your key opens your workspace and its connected machines."
                  : "Pick up where you left off, or hand Orca something new.",
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
