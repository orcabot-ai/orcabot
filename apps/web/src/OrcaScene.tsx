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
    const image = new Image();
    let frame = 0,
      width = 0,
      height = 0,
      clock = 0;
    let points: {
      x: number;
      y: number;
      color: string;
      phase: number;
      edge: boolean;
    }[] = [];
    const pointer = { x: -1000, y: -1000 };
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const size = Math.min(width, height) / 1.3;
      const left = (width - size) / 2,
        top = (height - size) / 2;
      for (const p of points) {
        const cycle = Math.sin(time / 2400 + p.phase);
        const drift = p.edge ? 5 + cycle * 4 : 1;
        let x = left + p.x * size + Math.cos(p.phase + time / 6000) * drift;
        let y = top + p.y * size + Math.sin(p.phase + time / 6000) * drift;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 90) {
          x += (dx / distance) * (90 - distance) * 0.12;
          y += (dy / distance) * (90 - distance) * 0.12;
        }
        ctx.globalAlpha = p.edge ? 0.55 + cycle * 0.2 : 0.12 + cycle * 0.08;
        ctx.fillStyle = p.edge ? p.color : "rgb(43 141 224)";
        ctx.beginPath();
        ctx.arc(x, y, p.edge ? 1.1 : 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (p.edge)
          for (let i = 1; i <= 3; i++) {
            const angle = p.phase + i * 2.4 + time / 12000;
            const spread = (8 + i * 4) * (1 + cycle * 0.25);
            ctx.globalAlpha = (0.35 + cycle * 0.12) / i;
            ctx.beginPath();
            ctx.arc(
              x + Math.cos(angle) * spread,
              y + Math.sin(angle) * spread,
              1.1,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
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
      if (!paused && !motion.matches && !document.hidden && points.length)
        frame = requestAnimationFrame(tick);
      else draw(clock);
    };
    const load = () => {
      image.src =
        document.documentElement.dataset.theme === "dark"
          ? "/brand/orca-dark.png"
          : "/brand/orca-light.png";
    };
    image.onload = () => {
      const sample = document.createElement("canvas");
      sample.width = 192;
      sample.height = 192;
      const source = sample.getContext("2d");
      if (!source) return;
      source.drawImage(image, 0, 0, 192, 192);
      const pixels = source.getImageData(0, 0, 192, 192).data;
      const alpha = (x: number, y: number) =>
        pixels[(y * 192 + x) * 4 + 3] ?? 0;
      points = [];
      for (let y = 3; y < 189; y += 3)
        for (let x = 3; x < 189; x += 3) {
          const i = (y * 192 + x) * 4;
          if (pixels[i + 3] < 100) continue;
          const edge =
            alpha(x - 3, y) < 80 ||
            alpha(x + 3, y) < 80 ||
            alpha(x, y - 3) < 80 ||
            alpha(x, y + 3) < 80;
          points.push({
            x: x / 192,
            y: y / 192,
            color: `rgb(${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]})`,
            phase: (x * 13 + y * 7) % 37,
            edge,
          });
        }
      sync();
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
    const theme = new MutationObserver(load);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    load();
    resize();
    return () => {
      cancelAnimationFrame(frame);
      image.onload = null;
      observer.disconnect();
      theme.disconnect();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [paused]);
  return (
    <div className="orca-scene">
      <div className="orca-art" aria-hidden="true">
        <BrandMark />
        <canvas ref={canvas} />
      </div>
      <button
        type="button"
        className="scene-motion"
        aria-label={t(paused ? "Play animation" : "Pause animation")}
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}
