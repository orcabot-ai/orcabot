import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";

export function OrcaScene() {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      width = 0,
      height = 0,
      clock = 0;
    const pointer = { x: -1000, y: -1000 };
    // A small ambient current accompanies the raster; it never redraws the whale.
    const points = Array.from({ length: 48 }, (_, i) => ({
      x: ((i * 37) % 101) / 100,
      y: 0.58 + Math.sin(i * 1.7) * 0.13,
      phase: i * 2.37,
    }));
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        const cycle = Math.sin(time / 2400 + p.phase);
        let x = p.x * width + Math.cos(p.phase + time / 6000) * 8;
        let y = p.y * height + Math.sin(p.phase + time / 6000) * 5;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 70) {
          x += (dx / distance) * (70 - distance) * 0.08;
          y += (dy / distance) * (70 - distance) * 0.08;
        }
        ctx.globalAlpha = 0.14 + (cycle + 1) * 0.15;
        ctx.fillStyle = "#d2f8ff";
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const tick = (time: number) => {
      if (time - clock >= 33) {
        clock = time;
        draw(time);
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (!paused && !motion.matches && !document.hidden)
        frame = requestAnimationFrame(tick);
      else draw(clock);
    };
    const resize = () => {
      const rect = node.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(clock);
    };
    const move = (event: PointerEvent) => {
      const r = node.getBoundingClientRect();
      pointer.x = event.clientX - r.left;
      pointer.y = event.clientY - r.top;
    };
    const leave = () => {
      pointer.x = -1000;
      pointer.y = -1000;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    resize();
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [paused]);
  return (
    <div className="orca-scene">
      <div className="orca-art" aria-hidden="true">
        <picture>
          <source
            type="image/webp"
            srcSet="/scenes/whale-ocean-960.webp 960w, /scenes/whale-ocean-1600.webp 1600w"
            sizes="(max-width: 800px) calc(100vw - 24px), 70vw"
          />
          <img
            className="whale-landscape"
            src="/scenes/whale-ocean-1600.jpg"
            width={1600}
            height={1600}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <canvas ref={canvas} />
      </div>
      <div className="scene-brand">
        <BrandMark small />
        <span>Orcabot</span>
      </div>
      <button
        type="button"
        className="scene-motion"
        aria-label={t(paused ? "Play animation" : "Pause animation")}
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
  );
}
