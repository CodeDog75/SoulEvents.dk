import type { CSSProperties } from "react";

type MoonPhaseProps = {
  className?: string;
  illumination: number;
  phase: string;
  size?: number;
};

const waxingPhases = new Set(["waxing crescent", "first quarter", "waxing gibbous", "tiltagende månesegl", "første kvarter", "tiltagende måne"]);
const waningPhases = new Set(["waning gibbous", "last quarter", "waning crescent", "aftagende måne", "sidste kvarter", "aftagende månesegl"]);

function clampIllumination(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

function phaseDirection(phase: string) {
  const normalized = phase.trim().toLowerCase();
  if (waxingPhases.has(normalized)) return "waxing";
  if (waningPhases.has(normalized)) return "waning";
  return "neutral";
}

function moonClipPath(phase: string, illumination: number) {
  const direction = phaseDirection(phase);
  const visible = clampIllumination(illumination);

  if (visible <= 1) {
    return "";
  }

  if (visible >= 99 || direction === "neutral") {
    return "M 50 0 A 50 50 0 1 1 49.99 0 Z";
  }

  const isWaxing = direction === "waxing";
  const sideSweep = isWaxing ? 1 : 0;
  const terminatorSweep = visible < 50 ? sideSweep : 1 - sideSweep;
  const largeArc = visible > 50 ? 1 : 0;
  const rx = Math.max(0.1, Math.abs(50 - visible));

  return "M 50 0 A 50 50 0 0 " + sideSweep + " 50 100 A " + rx.toFixed(2) + " 50 0 " + largeArc + " " + terminatorSweep + " 50 0 Z";
}

export function MoonPhase({ className = "", illumination, phase, size = 176 }: MoonPhaseProps) {
  const safeIllumination = clampIllumination(illumination);
  const altText = "Aktuel månefase: " + (phase || "Månefase") + ", " + safeIllumination + " procent oplyst";
  const clipPath = moonClipPath(phase, safeIllumination);
  const clipId = "moon-phase-" + phase.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + Math.round(safeIllumination);

  return (
    <div
      className={"soulevents-moon-phase relative mx-auto grid size-[var(--moon-size)] place-items-center " + className}
      style={{ "--moon-size": size + "px" } as CSSProperties}
    >
      <div className="soulevents-moon-glow absolute inset-[-18%] rounded-full" aria-hidden="true" />
      <svg className="soulevents-moon-body relative z-10 size-full overflow-visible" role="img" aria-label={altText} viewBox="0 0 100 100">
        {clipPath ? (
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={clipPath} />
            </clipPath>
          </defs>
        ) : null}
        <image height="100" href="/moon/SoulEvent%20Full%20Moon1.png" opacity={safeIllumination <= 1 ? "0.1" : "0.14"} preserveAspectRatio="xMidYMid meet" width="100" />
        {clipPath ? (
          <image clipPath={"url(#" + clipId + ")"} height="100" href="/moon/SoulEvent%20Full%20Moon1.png" preserveAspectRatio="xMidYMid meet" width="100" />
        ) : null}
      </svg>
    </div>
  );
}
