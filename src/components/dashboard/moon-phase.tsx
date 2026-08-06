import type { CSSProperties } from "react";

type MoonPhaseProps = {
  className?: string;
  illumination: number;
  phase: string;
  size?: number;
};
type MoonDirection = "neutral" | "waning" | "waxing";
type MoonVisualPhase =
  | "full"
  | "first-quarter"
  | "last-quarter"
  | "new"
  | "waning-crescent"
  | "waning-gibbous"
  | "waxing-crescent"
  | "waxing-gibbous";

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

const visualPhaseAliases: Record<string, MoonVisualPhase> = {
  "aftagende måne": "waning-gibbous",
  "aftagende månesegl": "waning-crescent",
  "first quarter": "first-quarter",
  "fuldmåne": "full",
  "full moon": "full",
  "første kvarter": "first-quarter",
  "last quarter": "last-quarter",
  "new moon": "new",
  "nymåne": "new",
  "sidste kvarter": "last-quarter",
  "tiltagende måne": "waxing-gibbous",
  "tiltagende månesegl": "waxing-crescent",
  "waning crescent": "waning-crescent",
  "waning gibbous": "waning-gibbous",
  "waxing crescent": "waxing-crescent",
  "waxing gibbous": "waxing-gibbous",
};

const shadowPathsByPhase: Record<MoonVisualPhase, string | null> = {
  full: null,
  "first-quarter": "M 50 0 A 50 50 0 0 0 50 100 C 48 76 52 24 50 0 Z",
  "last-quarter": "M 50 0 A 50 50 0 0 1 50 100 C 52 76 48 24 50 0 Z",
  new: moonDiscPath(),
  "waning-crescent": "M 50 0 A 50 50 0 0 1 50 100 C 17 82 20 60 17 42 C 15 24 24 10 50 0 Z",
  "waning-gibbous": "M 50 0 A 50 50 0 0 1 50 100 C 78 83 75 61 80 39 C 83 22 75 9 50 0 Z",
  "waxing-crescent": "M 50 0 A 50 50 0 0 0 50 100 C 83 82 80 60 83 42 C 85 24 76 10 50 0 Z",
  "waxing-gibbous": "M 50 0 A 50 50 0 0 0 50 100 C 22 83 25 61 20 39 C 17 22 25 9 50 0 Z",
};

function visualPhaseFor(phase: string, illumination: number): MoonVisualPhase {
  const normalized = phase.trim().toLowerCase();
  const directPhase = visualPhaseAliases[normalized];
  if (directPhase) return directPhase;

  if (illumination <= 6) return "new";
  if (illumination >= 94) return "full";

  const direction = phaseDirection(phase);
  if (direction === "waxing") {
    if (illumination < 37.5) return "waxing-crescent";
    if (illumination <= 62.5) return "first-quarter";
    return "waxing-gibbous";
  }

  if (direction === "waning") {
    if (illumination < 37.5) return "waning-crescent";
    if (illumination <= 62.5) return "last-quarter";
    return "waning-gibbous";
  }

  return illumination < 50 ? "new" : "full";
}

export function MoonPhase({
  className = "",
  illumination,
  phase,
  size = 176,
}: MoonPhaseProps) {
  const safeIllumination = clampIllumination(illumination);
  const visualPhase = visualPhaseFor(phase, safeIllumination);
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
  const moonClipId = clipId + "-clip";
  const terminatorFilterId = clipId + "-terminator-softness";
  const shadowPath = shadowPathsByPhase[visualPhase];
  const moonTextureFilter = "brightness(1.12) contrast(1.16) saturate(0.58)";
  const shadowFillOpacity = safeIllumination <= 1 ? 0.9 : 0.82;
  const hasTerminator = Boolean(shadowPath && visualPhase !== "new");

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
          <clipPath id={moonClipId}>
            <path d={moonDiscPath()} />
          </clipPath>
          {hasTerminator ? (
            <filter id={terminatorFilterId} x="-8%" y="-8%" width="116%" height="116%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.15" />
            </filter>
          ) : null}
        </defs>

        <g clipPath={"url(#" + moonClipId + ")"}>
          <circle cx="50" cy="50" fill="#E9E6DF" r="50" />
          <image
            height="100"
            href="/moon/SoulEvent%20Full%20Moon1.png"
            opacity="0.82"
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: moonTextureFilter }}
            width="100"
          />

          {shadowPath ? (
            <path
              d={shadowPath}
              fill="#252927"
              filter={hasTerminator ? "url(#" + terminatorFilterId + ")" : undefined}
              opacity={shadowFillOpacity}
            />
          ) : null}
        </g>
      </svg>
    </div>
  );
}
