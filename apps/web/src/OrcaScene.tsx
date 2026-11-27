import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";

/** Local decorative artwork; authentication and copy remain real HTML. */
export function OrcaScene() {
  const { t } = useI18n();
  return (
    <div className="orca-scene">
      <img
        className="login-art"
        src="/scenes/ai-flow-1920.webp"
        srcSet="/scenes/ai-flow-960.webp 960w, /scenes/ai-flow-1920.webp 1920w"
        sizes="100vw"
        width="2752"
        height="1536"
        alt=""
        fetchPriority="high"
        decoding="async"
      />
      <div className="login-shade" aria-hidden="true" />
      <div className="scene-brand">
        <BrandMark small />
        <span>Orcabot</span>
      </div>
      <div className="scene-welcome">
        <p>{t("Your personal AI workspace.")}</p>
        <span>{t("Conversations, tasks, and results. Together.")}</span>
      </div>
    </div>
  );
}
