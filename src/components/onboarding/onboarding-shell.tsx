"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useLayoutEffect, useRef } from "react";

type OnboardingMode = "auth" | "confirmation" | "password" | "profile" | "success" | "welcome";

type VisualPanel = {
  imageAlt?: string;
  imagePriority?: boolean;
  imageSrc?: string;
  kicker?: string;
  logoHref?: string;
  text?: string;
};

type BackLink = {
  href: string;
  label: string;
};

type OnboardingShellProps = {
  backLink?: BackLink;
  backNavigation?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hideBackOnDesktop?: boolean;
  mode?: OnboardingMode;
  scrollKey?: string | number;
  showVisualPanel?: boolean;
  visualPanel?: VisualPanel;
};

const defaultVisualPanel: Required<Pick<VisualPanel, "imageSrc" | "kicker" | "logoHref" | "text">> = {
  imageSrc: "/facilitator/onboarding-nature.png",
  kicker: "SoulEvents.dk",
  logoHref: "/",
  text: "En rolig vej ind til din profil, dine begivenheder og dit fællesskab.",
};

export function OnboardingShell({
  backLink,
  backNavigation,
  children,
  footer,
  hideBackOnDesktop = false,
  mode = "profile",
  scrollKey,
  showVisualPanel = true,
  visualPanel,
}: OnboardingShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const panel = { ...defaultVisualPanel, ...visualPanel };

  useLayoutEffect(() => {
    shellRef.current?.scrollTo({ top: 0, behavior: "auto" });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [scrollKey]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#fbfaf7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#2F2633] sm:px-6 lg:overflow-hidden lg:bg-[#E7DDE7] lg:px-8 lg:py-6 xl:py-8"
      data-onboarding-mode={mode}
      ref={shellRef}
    >
      <section
        className={
          "mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-[620px] content-between gap-8 lg:h-[calc(100dvh-48px)] lg:min-h-0 lg:content-stretch lg:gap-0 lg:overflow-hidden lg:rounded-[34px] lg:bg-[#fbfaf7] lg:shadow-[0_24px_70px_rgba(47,36,55,0.16)] xl:h-[calc(100dvh-64px)] " +
          (showVisualPanel ? "lg:max-w-[1040px] lg:grid-cols-[42%_58%] xl:max-w-[1120px]" : "lg:max-w-[640px]")
        }
      >
        {showVisualPanel ? <OnboardingVisualPanel panel={panel} /> : null}

        <div className="grid min-h-[calc(100svh-3rem)] content-between gap-8 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-5 lg:overflow-hidden lg:px-6 lg:py-6 xl:px-8 xl:py-7">
          <div className="grid gap-8 lg:min-h-0 lg:gap-5 lg:overflow-y-auto lg:pr-1" ref={contentScrollRef}>
            {backNavigation || backLink ? (
              <div className={hideBackOnDesktop ? "min-h-8 lg:hidden" : "min-h-8"}>
                {backNavigation ?? (
                  <Link className="text-sm font-semibold text-ink/55 underline-offset-4 hover:text-sage-700 hover:underline" href={backLink?.href ?? "/"}>
                    {backLink?.label}
                  </Link>
                )}
              </div>
            ) : null}

            <div className="rounded-[30px] bg-white px-5 py-8 shadow-soft transition-all duration-200 sm:px-8 sm:py-10 lg:rounded-none lg:bg-transparent lg:px-4 lg:py-5 lg:shadow-none xl:px-5 xl:py-6">
              {children}
            </div>
          </div>

          {footer ? <div className="pb-2">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}

function OnboardingVisualPanel({ panel }: { panel: Required<Pick<VisualPanel, "imageSrc" | "kicker" | "logoHref" | "text">> & VisualPanel }) {
  return (
    <aside className="relative hidden h-full overflow-hidden bg-sage-700 lg:block" aria-hidden="true">
      <Image
        alt={panel.imageAlt ?? ""}
        className="object-cover"
        fill
        priority={panel.imagePriority ?? true}
        sizes="(min-width: 1024px) 520px, 0px"
        src={panel.imageSrc}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,36,55,0.18),rgba(47,36,55,0.38)),linear-gradient(90deg,rgba(151,161,132,0.16),rgba(231,221,231,0.12))]" />
      <div className="relative flex h-full flex-col justify-between p-10 text-white">
        <Link aria-label="SoulEvents forside" className="inline-flex w-fit" href={panel.logoHref}>
          <Image
            alt="SoulEvents.dk"
            className="h-28 w-28 object-contain brightness-0 invert"
            height={112}
            priority
            src="/brand/soulevents-logo.png"
            width={112}
          />
        </Link>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">{panel.kicker}</p>
          <p className="mt-4 text-3xl font-semibold leading-tight">{panel.text}</p>
        </div>
      </div>
    </aside>
  );
}

export function OnboardingIntro({ eyebrow, text, title }: { eyebrow: string; text: string; title: string }) {
  return (
    <div className="mb-8 grid gap-3 lg:mb-5 lg:gap-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-sage-700 lg:text-xs">{eyebrow}</p>
      <h1 className="text-4xl font-semibold leading-tight text-midnight sm:text-5xl lg:text-3xl xl:text-4xl">{title}</h1>
      <p className="text-base leading-7 text-ink/64 lg:text-sm lg:leading-6">{text}</p>
    </div>
  );
}
