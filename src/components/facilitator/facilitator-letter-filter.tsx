"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const scrollFlagKey = "soulevents:facilitator-letter-scroll";
const resultsAnchor = "facilitator-results";

type FacilitatorLetterFilterProps = {
  current: Record<string, string>;
  letters: string[];
};

function withParam(current: Record<string, string>, key: string, value: string) {
  const params = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(current)) {
    if (paramValue && paramKey !== key) params.set(paramKey, paramValue);
  }
  if (value) params.set(key, value);
  const query = params.toString();
  return (query ? "/facilitators?" + query : "/facilitators") + "#" + resultsAnchor;
}

function markIntentionalScroll() {
  window.sessionStorage.setItem(scrollFlagKey, "true");
}

export function FacilitatorLetterResultsScroll() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const shouldScroll =
      window.location.hash === "#" + resultsAnchor || window.sessionStorage.getItem(scrollFlagKey) === "true";

    if (!shouldScroll) return;

    window.sessionStorage.removeItem(scrollFlagKey);

    const target = document.getElementById(resultsAnchor);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [searchParams]);

  return null;
}

export function FacilitatorLetterFilter({ current, letters }: FacilitatorLetterFilterProps) {
  return (
    <nav className="mt-8 flex flex-wrap gap-2" aria-label="Alfabetisk navigation">
      <Link
        className="rounded-full border border-olive/10 bg-white px-3 py-1.5 text-sm font-semibold text-olive"
        href={withParam(current, "letter", "")}
        onClick={markIntentionalScroll}
      >
        Alle
      </Link>
      {letters.map((letter) => (
        <Link
          className={
            current.letter === letter
              ? "rounded-full bg-olive px-3 py-1.5 text-sm font-semibold text-white"
              : "rounded-full border border-olive/10 bg-white px-3 py-1.5 text-sm font-semibold text-olive"
          }
          href={withParam(current, "letter", letter)}
          key={letter}
          onClick={markIntentionalScroll}
        >
          {letter}
        </Link>
      ))}
    </nav>
  );
}
