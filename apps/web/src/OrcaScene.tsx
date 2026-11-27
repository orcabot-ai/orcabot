import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark.js";

// Original curved anatomy, independent of the supplied brand mark.
const BODY =
  "M-285-70 C-225-72-203-119-92-116 C20-114 122-60 211-25 C256-8 298 12 314 35 C322 49 302 63 280 69 C220 94 140 74 55 43 C-55 2-162-68-285-60Z";
const FLUKES =
  "M-285-69 C-327-92-335-131-420-147 C-413-104-377-66-328-56 C-367-33-401 12-398 45 C-330 22-316-31-285-59Z";
const FIN =
  "M150 22 C110 59 47 125-33 143 C-41 131-12 86 22 45 C64 7 111 10 150 22Z";
const DORSAL = "M-164-108 C-144-114-146-139-126-148 C-123-129-110-119-94-116Z";
const COLORS = [
  "#46f5ca",
  "#48dfff",
  "#cefff0",
  "#a88aff",
  "#ef98d4",
  "#ffc49b",
];
type Point = {
  x: number;
  y: number;
  radius: number;
  color: string;
  phase: number;
};

export function OrcaScene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
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
    // Hit-testing authored geometry must not inherit a previous DPR transform.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let seed = 47;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cloud = (
      shape: Path2D,
      box: [number, number, number, number],
      count: number,
    ) => {
      const result: Point[] = [];
      for (let i = 0; i < count; i++) {
        const x = box[0] + random() * box[2],
          y = box[1] + random() * box[3];
        if (!ctx.isPointInPath(shape, x, y)) continue;
        const shade =
          y < -65 ? Math.floor(random() * 3) : 1 + Math.floor(random() * 5);
        result.push({
          x,
          y,
          radius: 0.5 + random() * 1.25,
          color: COLORS[shade],
          phase: random() * Math.PI * 2,
        });
      }
      return result;
    };
    const bodyPoints = cloud(body, [-290, -130, 615, 220], 2400);
    const tailPoints = cloud(flukes, [-425, -150, 145, 200], 620);
    const finPoints = cloud(fin, [-40, 5, 195, 145], 520);
    const dorsalPoints = cloud(dorsal, [-170, -150, 80, 40], 100);
    // The bend travels back from the shoulders. The tail sweeps through a much
    // larger arc than the head; this is swimming, rather than whole-body bobbing.
    const bend = (x: number, time: number) => {
      const tail = Math.max(0, Math.min(1, (200 - x) / 620));
      return Math.sin(time * 1.45 + x * 0.007) * tail * tail * 65;
    };
    const draw = () => {
      if (!width || !height) return;
      const time = elapsed / 1000;
      ctx.clearRect(0, 0, width, height);
      const unit = Math.min(width / 1000, height / 800);
      ctx.save();
      ctx.translate(
        width * 0.54 + Math.sin(time * 0.25) * width * 0.012,
        height * 0.53,
      );
      ctx.scale(unit, unit);
      ctx.rotate(-0.17 + Math.sin(time * 0.38) * 0.025);
      // Long ribbons pass behind the animal and peel away into its wake.
      for (let i = 0; i < 5; i++) {
        const ribbon = (x: number) =>
          130 + i * 19 + Math.sin(x / 220 + time * 0.36 + i * 0.22) * 49;
        const color = COLORS[[0, 1, 3, 4, 5][i]];
        ctx.beginPath();
        for (let j = 0; j <= 90; j++) {
          const x = -700 + j * 15;
          if (!j) ctx.moveTo(x, ribbon(x));
          else ctx.lineTo(x, ribbon(x));
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.13;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        for (let j = 0; j < 10; j++) {
          const x = -700 + ((j * 137 + time * 29 + i * 61) % 1350);
          ctx.globalAlpha = 0.3 + (j % 3) * 0.1;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, ribbon(x), j % 3 === 0 ? 2 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      const paintCloud = (points: Point[], extraBend = 0) => {
        for (const p of points) {
          const y =
            p.y +
            bend(p.x, time) +
            extraBend *
              Math.sin(time * 1.45 - 0.6) *
              Math.max(0, (p.y - 20) / 120);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.35 + (Math.sin(p.phase + time * 0.6) + 1) * 0.25;
          ctx.beginPath();
          ctx.arc(p.x, y, Math.max(0.65 / unit, p.radius), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      // Strip-by-strip deformation keeps anatomy, filaments and points together.
      // The outline is a faint wash, never an opaque ellipsoid or technical grid.
      const wash = (shape: Path2D, color: string, extraBend = 0) => {
        ctx.fillStyle = color;
        for (let x = -440; x < 330; x += 11) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, -220, 11, 440);
          ctx.clip();
          ctx.translate(0, bend(x + 5, time) + extraBend);
          ctx.fill(shape);
          ctx.restore();
        }
      };
      wash(flukes, "#ab86ff1c");
      paintCloud(tailPoints);
      wash(dorsal, "#8af5dd15");
      paintCloud(dorsalPoints);
      wash(body, "#54e9d51b");
      paintCloud(bodyPoints);
      // A few continuous pearl threads follow the curved back and throat;
      // they suggest volume without reinstating a latitude/longitude mesh.
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let j = 0; j <= 70; j++) {
          const u = j / 70,
            x = -280 + u * 590;
          const y =
            -65 -
            Math.sin(u * Math.PI) * (61 - i * 26) +
            u * 109 +
            bend(x, time);
          if (!j) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS[i % 5];
        ctx.globalAlpha = i === 0 ? 0.62 : 0.2;
        ctx.lineWidth = i === 0 ? 1 : 0.6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      paintCloud(finPoints, 26);
      // An eye is enough personality; a rigid mouth line would make a hull again.
      ctx.fillStyle = "#efffff";
      ctx.beginPath();
      ctx.arc(251, 28 + bend(251, time), 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Nearby plankton reacts gently to the pointer, without moving the form.
      for (let i = 0; i < 55; i++) {
        const phase = i * 2.39996;
        let x = ((((i * 73) % 101) / 101 - time * 0.009 + 100) % 1) * width;
        let y =
          (0.2 + ((i * 31) % 109) / 155) * height +
          Math.sin(phase + time * 0.2) * 14;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 85) {
          x += (dx / distance) * (85 - distance) * 0.12;
          y += (dy / distance) * (85 - distance) * 0.12;
        }
        ctx.globalAlpha = 0.2 + (Math.sin(phase + time * 0.4) + 1) * 0.12;
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.beginPath();
        ctx.arc(x, y, i % 9 === 0 ? 1.8 : 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
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
      if (!motion.matches && !document.hidden && visible) {
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
  }, []);
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
          <g transform="translate(540 403) rotate(-10)">
            <g fill="#9bf4dd22" stroke="#a1ece6" strokeWidth="1">
              {[FLUKES, DORSAL, BODY, FIN].map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <circle cx="251" cy="28" r="2" fill="#d4f3ff" />
          </g>
        </svg>
        <canvas ref={canvas} />
      </div>
      <div className="scene-brand">
        <BrandMark small />
        <span>Orcabot</span>
      </div>
    </div>
  );
}
