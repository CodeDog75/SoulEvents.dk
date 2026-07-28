import type { CSSProperties } from "react";

type MoonPhaseProps = {
  className?: string;
  illumination: number;
  phase: string;
  size?: number;
};
type MoonDirection = "neutral" | "waning" | "waxing";

const waxingPhases = new Set([
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "tiltagende månesegl",
  "første kvarter",
  "tiltagende måne",
]);
const waningPhases = new Set([
  "waning gibbous",
  "last quarter",
  "waning crescent",
  "aftagende måne",
  "sidste kvarter",
  "aftagende månesegl",
]);

function clampIllumination(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

function phaseDirection(phase: string): MoonDirection {
  const normalized = phase.trim().toLowerCase();
  if (waxingPhases.has(normalized)) return "waxing";
  if (waningPhases.has(normalized)) return "waning";
  return "neutral";
}

function moonDiscPath() {
  return "M 50 0 A 50 50 0 1 1 49.99 0 Z";
}

function circleSegmentAreaFraction(x: number) {
  const radius = 50;
  const offset = x - radius;
  const clampedOffset = Math.min(radius, Math.max(-radius, offset));
  const area =
    clampedOffset * Math.sqrt(Math.max(0, radius * radius - clampedOffset * clampedOffset)) +
    radius * radius * Math.asin(clampedOffset / radius) +
    (Math.PI * radius * radius) / 2;

  return area / (Math.PI * radius * radius);
}

function xForCircleSegmentFraction(fraction: number) {
  let low = 0;
  let high = 100;

  for (let index = 0; index < 32; index += 1) {
    const mid = (low + high) / 2;
    if (circleSegmentAreaFraction(mid) < fraction) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function moonShadowPath(direction: MoonDirection, percentage: number) {
  const shadow = clampIllumination(percentage);

  if (shadow <= 0.5) {
    return "";
  }

  if (shadow >= 99.5) {
    return moonDiscPath();
  }

  const shadowFraction = shadow / 100;
  const shadowSide = direction === "waxing" ? "left" : "right";
  const x =
    shadowSide === "left"
      ? xForCircleSegmentFraction(shadowFraction)
      : xForCircleSegmentFraction(1 - shadowFraction);
  const radius = 50;
  const yOffset = Math.sqrt(Math.max(0, radius * radius - (x - radius) * (x - radius)));
  const yTop = radius - yOffset;
  const yBottom = radius + yOffset;
  const formattedX = x.toFixed(2);
  const formattedTop = yTop.toFixed(2);
  const formattedBottom = yBottom.toFixed(2);

  if (shadowSide === "left") {
    return `M ${formattedX} ${formattedTop} A 50 50 0 0 0 ${formattedX} ${formattedBottom} L ${formattedX} ${formattedTop} Z`;
  }

  return `M ${formattedX} ${formattedTop} L ${formattedX} ${formattedBottom} A 50 50 0 0 0 ${formattedX} ${formattedTop} Z`;
}

export function MoonPhase({
  className = "",
  illumination,
  phase,
  size = 176,
}: MoonPhaseProps) {
  const safeIllumination = clampIllumination(illumination);
  const direction = phaseDirection(phase);
  const shadowPercentage = 100 - safeIllumination;
  const shadowDirection: MoonDirection =
    direction === "waning" ? "waxing" : "waning";
  const altText =
    "Aktuel månefase: " +
    (phase || "Månefase") +
    ", " +
    safeIllumination +
    " procent oplyst";
  const clipId =
    "moon-phase-" +
    phase.replace(/[^a-z0-9]+/gi, "-").toLowerCase() +
    "-" +
    Math.round(safeIllumination);
  const shadowPath = moonShadowPath(shadowDirection, shadowPercentage);
  const shadowClipId = clipId + "-shadow";
  const moonTextureFilter = "brightness(1.12) contrast(1.16) saturate(0.58)";
  const shadowFillOpacity = safeIllumination <= 1 ? 0.9 : 0.82;
  const hasShadowArea = Boolean(shadowPath);

  return (
    <div
      className={
        "soulevents-moon-phase relative mx-auto grid size-[var(--moon-size)] place-items-center " +
        className
      }
      style={{ "--moon-size": size + "px" } as CSSProperties}
    >
      <div
        className="soulevents-moon-glow absolute inset-[-18%] rounded-full"
        aria-hidden="true"
      />
      <svg
        className="soulevents-moon-body relative z-10 size-full overflow-visible"
        role="img"
        aria-label={altText}
        viewBox="0 0 100 100"
      >
        <defs>
          {hasShadowArea ? (
            <clipPath id={shadowClipId} clipPathUnits="userSpaceOnUse">
              <path d={shadowPath} />
            </clipPath>
          ) : null}
        </defs>

        <g>
          <circle cx="50" cy="50" fill="#E9E6DF" r="50" />
          <image
            height="100"
            href="/moon/SoulEvent%20Full%20Moon1.png"
            opacity="0.82"
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: moonTextureFilter }}
            width="100"
          />
        </g>

        {hasShadowArea ? (
          <g clipPath={"url(#" + shadowClipId + ")"}>
            <circle
              cx="50"
              cy="50"
              fill="#2F3130"
              opacity={shadowFillOpacity}
              r="50"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
