import { useId, useRef } from "react";
import { FileCheck2, Layers3, MessageSquare } from "lucide-react";
import { LoginParticles } from "./LoginParticles.js";
import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";

/** Decorative geometry for the login surface; it carries no application state. */
export function OrcaScene() {
  const { t } = useI18n();
  const route = useRef<SVGGElement>(null);
  const id = useId().replaceAll(":", "");
  return (
    <div className="orca-scene">
      <svg
        className="login-art"
        viewBox="0 0 1000 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-field`} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#102b60" />
            <stop offset=".52" stopColor="#244578" />
            <stop offset="1" stopColor="#7587b7" />
          </linearGradient>
          <linearGradient id={`${id}-ribbon`} x1=".1" y1="1" x2=".85" y2="0">
            <stop stopColor="#274b8a" />
            <stop offset=".35" stopColor="#547eb6" />
            <stop offset=".7" stopColor="#96b3d8" />
            <stop offset="1" stopColor="#b7b1ce" />
          </linearGradient>
          <linearGradient id={`${id}-inside`} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#102a62" />
            <stop offset=".6" stopColor="#3b6096" />
            <stop offset="1" stopColor="#829fc4" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#9ebde2" stopOpacity="0" />
            <stop offset=".65" stopColor="#e5edfa" stopOpacity=".7" />
            <stop offset="1" stopColor="#f5e4dd" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <path fill={`url(#${id}-field)`} d="M0 0h1000v900H0z" />
        <path
          fill={`url(#${id}-ribbon)`}
          d="M1080-90C716-64 364 103 298 303c-63 191 198 316 372 201 135-89 132-222 7-240-125-18-246 99-223 215 25 129 204 239 340 246l240 15v230H600c-276-65-455-241-464-454C124 221 513-7 1080-90Z"
        />
        <path
          fill={`url(#${id}-inside)`}
          d="M1080-90C716-64 364 103 298 303c-63 191 198 316 372 201-175 194-421 67-396-117C307 147 662 20 1080-90Z"
        />
        <path
          fill={`url(#${id}-inside)`}
          d="M677 264c125 18 128 151-7 240-82 55-187 57-266 17 82 37 200 6 253-60 67-84 54-150 20-197Z"
        />
        <path
          fill="none"
          stroke={`url(#${id}-edge)`}
          strokeWidth="2"
          d="M1080-90C716-64 364 103 298 303c-63 191 198 316 372 201 135-89 132-222 7-240-125-18-246 99-223 215 25 129 204 239 340 246"
        />
        <g ref={route} className="login-flow-lines" fill="none" strokeWidth="1">
          <path
            stroke="#a6cbff"
            opacity=".2"
            d="M1080-90C716-64 364 103 298 303c-63 191 198 316 372 201 135-89 132-222 7-240-125-18-246 99-223 215 25 129 204 239 340 246"
          />
          <path
            stroke="#9fdfeb"
            opacity=".3"
            d="M-60 170C70 100 130 280 215 310S430 405 550 400"
          />
          <path
            stroke="#d6bce5"
            opacity=".3"
            d="M550 400C700 470 760 410 795 650S1040 800 1100 680"
          />
          <path
            stroke="#c4d9f7"
            opacity=".25"
            d="M760 130C770 220 690 300 550 400"
          />
        </g>
        <g
          className="login-context-marks"
          fill="none"
          stroke="#dce9ff"
          strokeWidth="1"
        >
          <circle cx="215" cy="310" r="28" opacity=".12" />
          <circle cx="215" cy="310" r="37" opacity=".06" />
          <MessageSquare
            x="204"
            y="299"
            width="22"
            height="22"
            strokeWidth="1.2"
            opacity=".65"
          />
          <circle cx="760" cy="130" r="28" opacity=".12" />
          <Layers3
            x="749"
            y="119"
            width="22"
            height="22"
            strokeWidth="1.2"
            opacity=".65"
          />
          <circle cx="795" cy="650" r="28" opacity=".12" />
          <circle cx="795" cy="650" r="37" opacity=".06" />
          <FileCheck2
            x="784"
            y="639"
            width="22"
            height="22"
            strokeWidth="1.2"
            opacity=".65"
          />
        </g>
      </svg>
      <div className="login-shade" aria-hidden="true" />
      <LoginParticles route={route} />
      <div className="scene-brand">
        <BrandMark small />
        <span>Orcabot</span>
      </div>
      <div className="scene-welcome">
        <p>{t("A space for your ideas.")}</p>
        <span>{t("And a little help along the way.")}</span>
      </div>
    </div>
  );
}
