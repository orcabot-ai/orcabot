import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";

// Original geometry, independent of the supplied brand mark or any image asset.
const BODY =
  "M-320 5 C-250-12-220-67-130-83 C10-116 175-120 278-79 C340-54 350-8 320 20 C258 83 99 102-43 73 C-170 47-230 13-320 14Z";
const FLUKES =
  "M-300 8 C-348-3-347-65-449-105 C-450-54-407-3-355 15 C-400 38-417 75-411 112 C-331 83-329 28-300 16Z";
const FIN = "M91 47 C56 91-32 148-113 171 C-112 130-51 64 5 48Z";
const DORSAL = "M-155-74 C-141-88-138-109-121-119 C-114-98-95-89-66-91Z";

export function OrcaScene() {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const node = canvas.current;
    const surface = art.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx || !surface) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      width = 0,
      height = 0,
      clock = 0,
      elapsed = 0;
    let visible = true;
    const pointer = { x: -1000, y: -1000 };
    const body = new Path2D(BODY);
    const flukes = new Path2D(FLUKES);
    const fin = new Path2D(FIN);
    const dorsal = new Path2D(DORSAL);
    const points = Array.from({ length: 110 }, (_, i) => ({
      u: ((i * 73) % 113) / 113,
      v: ((i * 31) % 109) / 109,
      phase: i * 2.39996,
    }));
    const stroke = (
      path: Path2D,
      fill: string | CanvasGradient,
      line: string,
    ) => {
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.strokeStyle = line;
      ctx.lineWidth = 0.8;
      ctx.stroke(path);
    };
    const draw = () => {
      if (!width || !height) return;
      const time = elapsed / 1000;
      ctx.clearRect(0, 0, width, height);
      const unit = Math.min(width / 980, height / 760);
      // The same complete composition fits a square phone and a wide desktop.
      ctx.save();
      ctx.translate(width * 0.53, height * 0.56);
      ctx.scale(unit, unit);
      // Open currents frame the subject without simulating application activity.
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        for (let j = 0; j <= 100; j++) {
          const x = -650 + j * 13;
          const y =
            150 + i * 16 + Math.sin(x / 250 + i * 0.11 + time * 0.12) * 42;
          if (!j) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(118,198,255,${0.075 - i * 0.005})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.translate(0, Math.sin(time * 0.28) * 7);
      ctx.rotate(-0.12 + Math.sin(time * 0.18) * 0.012);
      const fill = ctx.createLinearGradient(0, -120, 30, 150);
      fill.addColorStop(0, "#346caf");
      fill.addColorStop(0.5, "#173d74");
      fill.addColorStop(1, "#0d2855");
      stroke(flukes, fill, "#96d7ff99");
      stroke(dorsal, fill, "#96d7ff99");
      stroke(body, fill, "#b3e8ffbb");
      // A curved lattice is clipped to the original whale contour. Its density
      // is fixed: resizing increases resolution, never the simulation workload.
      ctx.save();
      ctx.clip(body);
      for (let i = 0; i < 31; i++) {
        const x = -330 + i * 23;
        ctx.beginPath();
        ctx.moveTo(x - 35, -140);
        ctx.bezierCurveTo(x + 90, -68, x + 95, 50, x - 20, 120);
        ctx.strokeStyle = `rgba(157,221,255,${0.13 + Math.sin(i * 0.3) * 0.04})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const y = -110 + i * 13;
        ctx.beginPath();
        ctx.moveTo(-355, y * 0.15);
        ctx.bezierCurveTo(-140, y - 28, 180, y - 30, 350, y * 0.5);
        ctx.strokeStyle = "#b2e7ff33";
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let i = 0; i < 330; i++) {
        const x = ((i * 137) % 701) - 350;
        const y = ((i * 71) % 219) - 110;
        ctx.fillStyle = `rgba(195,237,255,${0.16 + (Math.sin(i + time * 0.35) + 1) * 0.14})`;
        ctx.fillRect(x, y, i % 7 === 0 ? 1.7 : 0.9, 0.9);
      }
      ctx.restore();
      stroke(fin, fill, "#a3dcff99");
      // Fin filaments and a quiet eye keep the form legible at mobile scale.
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(10 + i * 13, 56);
        ctx.quadraticCurveTo(-30 + i * 8, 112, -103 + i * 8, 162 - i * 7);
        ctx.strokeStyle = "#a8dfff44";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(206, 25);
      ctx.quadraticCurveTo(277, 30, 323, -1);
      ctx.strokeStyle = "#b9e8ff88";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = "#d4f3ff";
      ctx.beginPath();
      ctx.arc(250, -26, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      for (const p of points) {
        const u = (p.u + time * 0.007) % 1;
        let x = u * width;
        let y =
          (0.25 + p.v * 0.6) * height +
          Math.sin(u * 7 + p.phase + time * 0.16) * 16;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 85) {
          x += (dx / distance) * (85 - distance) * 0.12;
          y += (dy / distance) * (85 - distance) * 0.12;
        }
        const alpha = 0.12 + (Math.sin(p.phase + time * 0.4) + 1) * 0.18;
        ctx.fillStyle = `rgba(184,229,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.v > 0.7 ? 1.3 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const tick = (time: number) => {
      if (time - clock >= 33) {
        // Resume from the last simulated moment, without a hidden-tab jump.
        elapsed += Math.min(time - clock, 50);
        clock = time;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (!paused && !motion.matches && !document.hidden && visible) {
        clock = performance.now();
        frame = requestAnimationFrame(tick);
      } else draw();
    };
    const resize = () => {
      const rect = node.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
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
    const contentState = (event: Event) => {
      visible = !(event as ContentVisibilityAutoStateChangeEvent).skipped;
      sync();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    // Feature-detect the event too: some browsers support the CSS alone.
    const intersection =
      "oncontentvisibilityautostatechange" in surface
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting;
              sync();
            },
            { rootMargin: "120px" },
          );
    intersection?.observe(surface);
    surface.addEventListener("contentvisibilityautostatechange", contentState);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    resize();
    setReady(true);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection?.disconnect();
      surface.removeEventListener(
        "contentvisibilityautostatechange",
        contentState,
      );
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [paused]);
  return (
    <div className="orca-scene">
      <div
        ref={art}
        className="orca-art"
        aria-hidden="true"
        data-renderer="procedural"
      >
        <svg
          className="whale-fallback"
          viewBox="0 0 1000 760"
          data-ready={ready}
        >
          <g transform="translate(530 426) rotate(-7)">
            <g fill="#214b80" stroke="#a3dcff" strokeWidth="1">
              {[FLUKES, DORSAL, BODY, FIN].map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <circle cx="250" cy="-26" r="2" fill="#d4f3ff" />
          </g>
        </svg>
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
