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

function circleOverlapFraction(distance: number) {
  const radius = 50;
  const clampedDistance = Math.min(radius * 2, Math.max(0, distance));

  if (clampedDistance <= 0) return 1;
  if (clampedDistance >= radius * 2) return 0;

  const area =
    2 * radius * radius * Math.acos(clampedDistance / (2 * radius)) -
    (clampedDistance / 2) * Math.sqrt(Math.max(0, 4 * radius * radius - clampedDistance * clampedDistance));

  return area / (Math.PI * radius * radius);
}

function overlapDistanceForFraction(fraction: number) {
  const target = Math.min(1, Math.max(0, fraction));
  let low = 0;
  let high = 100;

  for (let index = 0; index < 32; index += 1) {
    const mid = (low + high) / 2;
    if (circleOverlapFraction(mid) < target) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

function moonShadowMask(direction: MoonDirection, percentage: number) {
  const shadow = clampIllumination(percentage);

  if (shadow <= 0.5) {
    return null;
  }

  if (shadow >= 99.5) {
    return {
      fullShadow: true,
      lightCenterX: 50,
    };
  }

  const illuminatedFraction = 1 - shadow / 100;
  const shadowSide = direction === "waxing" ? "left" : "right";
  const overlapDistance = overlapDistanceForFraction(illuminatedFraction);
  const lightCenterX = 50 + (shadowSide === "left" ? overlapDistance : -overlapDistance);

  return {
    fullShadow: false,
    lightCenterX,
  };
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
  const shadowMask = moonShadowMask(shadowDirection, shadowPercentage);
  const shadowMaskId = clipId + "-shadow";
  const moonTextureFilter = "brightness(1.12) contrast(1.16) saturate(0.58)";
  const shadowFillOpacity = safeIllumination <= 1 ? 0.9 : 0.82;
  const hasShadowArea = Boolean(shadowMask);

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
        className="soulevents-moon-body relative z-10 size-full overflow-hidden rounded-full"
        role="img"
        aria-label={altText}
        viewBox="0 0 100 100"
      >
        <defs>
          {shadowMask ? (
            <mask id={shadowMaskId} maskUnits="userSpaceOnUse">
              <rect fill="black" height="100" width="100" x="0" y="0" />
              <path d={moonDiscPath()} fill="white" />
              {shadowMask.fullShadow ? null : (
                <circle cx={shadowMask.lightCenterX} cy="50" fill="black" r="50" />
              )}
            </mask>
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
          <g mask={"url(#" + shadowMaskId + ")"}>
            <circle
              cx="50"
              cy="50"
              fill="#252927"
              opacity={shadowFillOpacity}
              r="50"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
