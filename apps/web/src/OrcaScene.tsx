import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";

/** Local decorative artwork; authentication and copy remain real HTML. */
export function OrcaScene() {
  const { t } = useI18n();
  return (
    <div className="orca-scene">
      <img
        className="login-art"
        src="/scenes/ai-atmosphere-1536.webp"
        srcSet="/scenes/ai-atmosphere-768.webp 768w, /scenes/ai-atmosphere-1536.webp 1536w"
        sizes="(max-width: 700px) 100vw, 70vw"
        width="1536"
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
