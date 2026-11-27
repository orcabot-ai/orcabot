import { useEffect, useRef } from "react";
import { BrandMark } from "./BrandMark.js";

export function OrcaScene() {
  const art = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = art.current;
    if (!surface) return;
    let visible = false;
    const sync = () => {
      surface.dataset.playing = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(surface);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <div className="orca-scene">
      <div
        ref={art}
        className="orca-art"
        aria-hidden="true"
        data-playing="false"
      >
        <picture className="ocean-image">
          <source
            type="image/webp"
            srcSet="/scenes/soft-ocean-768.webp 768w, /scenes/soft-ocean-1254.webp 1254w"
            sizes="(max-width: 800px) calc(100vw - 24px), calc(70vw - 34px)"
          />
          <img
            src="/scenes/soft-ocean-1254.jpg"
            width="1254"
            height="1254"
            alt=""
            fetchPriority="high"
            draggable="false"
          />
        </picture>
        <div className="ocean-light ocean-light-near" />
        <div className="ocean-light ocean-light-far" />
      </div>
      <div className="scene-brand">
        <BrandMark small />
        <span>Orcabot</span>
      </div>
    </div>
  );
}
