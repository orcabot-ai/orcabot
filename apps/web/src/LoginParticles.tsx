import { useEffect, useRef, type RefObject } from "react";

/** Bounded foreground currents follow the background geometry. */
export function LoginParticles({
  route,
}: {
  route: RefObject<SVGGElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const path = route.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !path || !context) return;
    const tracks = [...path.querySelectorAll("path")].map((curve, index) => {
      const length = curve.getTotalLength();
      return {
        count: index === 0 ? 38 : 12,
        duration: index === 0 ? 64000 : 26000 + index * 7000,
        color: ["#dceaff", "#a5e1e8", "#d9c5ef", "#b8d4ff"][index],
        samples: Array.from({ length: 401 }, (_, step) =>
          curve.getPointAtLength((length * step) / 400),
        ),
      };
    });
    // A quiet connected field sits behind the moving foreground currents.
    const field = Array.from({ length: 24 }, (_, index) => {
      const angle = index * 2.399963;
      const radius = Math.sqrt((index + 0.5) / 24);
      return {
        x: 550 + Math.cos(angle) * radius * 112,
        y: 400 + Math.sin(angle) * radius * 132,
      };
    });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      ratio = 1,
      frame = 0,
      last = 0,
      elapsed = 0;
    let visible = false,
      active = false;
    const clear = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
    const draw = () => {
      clear();
      const scale = Math.max(width / 1000, height / 900);
      if (!scale) return;
      context.setTransform(
        ratio * scale,
        0,
        0,
        ratio * scale,
        (ratio * (width - 1000 * scale)) / 2,
        (ratio * (height - 900 * scale)) / 2,
      );
      context.strokeStyle = "#a9cee9";
      context.lineWidth = 0.65 / scale;
      for (let index = 0; index < field.length; index++) {
        const point = field[index];
        for (let next = index + 1; next < field.length; next++) {
          const other = field[next];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance > 76) continue;
          context.globalAlpha = (1 - distance / 90) * 0.19;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
        context.globalAlpha = 0.2 + 0.1 * Math.sin(elapsed / 5500 + index);
        context.fillStyle = "#d9e9ff";
        context.beginPath();
        context.arc(point.x, point.y, 1.3 / scale, 0, Math.PI * 2);
        context.fill();
      }
      for (const track of tracks)
        for (let index = 0; index < track.count; index++) {
          const progress = (elapsed / track.duration + index / track.count) % 1;
          const position = progress * 400;
          const lower = Math.min(399, Math.floor(position));
          const a = track.samples[lower],
            b = track.samples[lower + 1];
          const mix = position - lower;
          const normal = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
          const drift = Math.sin(index * 2.4 + elapsed / 9000) * 12;
          const x = a.x + (b.x - a.x) * mix + Math.cos(normal) * drift;
          const y = a.y + (b.y - a.y) * mix + Math.sin(normal) * drift;
          const fade = Math.min(1, progress * 12, (1 - progress) * 12);
          context.globalAlpha = fade * (0.38 + (index % 4) * 0.13);
          context.fillStyle = track.color;
          context.shadowColor = track.color;
          context.shadowBlur = 6;
          // Tiny tails make direction legible without drawing bright laser lines.
          context.strokeStyle = track.color;
          context.lineWidth = 1 / scale;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(
            x + (Math.sin(normal) * 5) / scale,
            y - (Math.cos(normal) * 5) / scale,
          );
          context.stroke();
          context.beginPath();
          context.arc(x, y, (0.9 + (index % 3) * 0.45) / scale, 0, Math.PI * 2);
          context.fill();
        }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
    };
    const tick = (now: number) => {
      if (!active) return;
      if (!last || now - last >= 1000 / 30) {
        if (last) elapsed += Math.min(now - last, 100);
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const next = visible && !document.hidden && !reduced.matches;
      canvas.dataset.motion = next
        ? "running"
        : reduced.matches
          ? "reduced"
          : "paused";
      if (next === active) return;
      active = next;
      if (active) {
        last = 0;
        frame = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(frame);
        if (reduced.matches) clear();
      }
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      if (active) draw();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    resize.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [route]);
  return (
    <canvas
      ref={canvasRef}
      className="login-particles"
      aria-hidden="true"
      data-motion="paused"
    />
  );
}
