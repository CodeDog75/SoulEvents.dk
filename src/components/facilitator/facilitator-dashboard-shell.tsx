"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  CreditCard,
  HelpCircle,
  Home,
  Inbox,
  X,
  Mail,
  Menu,
  MoonStar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SoulEventsIdTag } from "@/components/facilitator/soulevents-id-tag";

type FacilitatorDashboardShellProps = {
  children: React.ReactNode;
  facilitatorIdentity?: FacilitatorIdentity | null;
  pendingBookingsCount: number;
  unreadMessagesCount: number;
  yearRhythmMenuStatus?: string | null;
};

type FacilitatorIdentity = {
  city?: string | null;
  hostReferenceId?: string | null;
  imageUrl?: string | null;
  name: string;
};

type NavigationItem = {
  badge?: number;
  href: string;
  icon: React.ElementType;
  isPrimary?: boolean;
  label: string;
  secondaryLabel?: string | null;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/facilitator") return pathname === href;
  if (href === "/facilitator/settings") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function Badge({ value }: { value?: number }) {
  if (!value || value <= 0) return null;

  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[#B56F8A] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function FacilitatorIdentityCard({
  className = "mt-4",
  identity,
  imageVariant = "compact",
}: {
  className?: string;
  identity?: FacilitatorIdentity | null;
  imageVariant?: "compact" | "desktop";
}) {
  if (!identity) return null;

  const imageClassName =
    imageVariant === "desktop"
      ? "size-[68px] rounded-[18px]"
      : "size-12 rounded-full";
  const fallbackIconClassName = imageVariant === "desktop" ? "size-7" : "size-5";

  return (
    <Link
      className={
        "flex items-center gap-3 rounded-[20px] border border-[#E5DDEA] bg-white/72 p-3 shadow-soft transition hover:border-[#D8CBE4] hover:bg-white " +
        className
      }
      href="/facilitator/profile"
    >
      <span className={"grid shrink-0 place-items-center overflow-hidden bg-[#F1EAF5] text-[#7A5D91] " + imageClassName}>
        {identity.imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={identity.imageUrl} />
        ) : (
          <UserRound className={fallbackIconClassName} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#2F2437]">{identity.name}</span>
        {identity.city ? <span className="block truncate text-xs font-semibold text-[#6E6475]">{identity.city}</span> : null}
        <SoulEventsIdTag className="mt-1 px-2 py-0.5 text-[10px]" hostReferenceId={identity.hostReferenceId} />
      </span>
    </Link>
  );
}

function NavLink({ item, onNavigate, pathname }: { item: NavigationItem; onNavigate?: () => void; pathname: string }) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);
  const className = item.isPrimary
    ? "flex min-h-11 items-center gap-3 rounded-[16px] border px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#E5DDEA] " +
      (active
        ? "border-[#BFA9CF] bg-[#F7F1FA] text-[#5F4777]"
        : "border-[#D8CBE4] bg-white/35 text-[#6E5285] hover:border-[#C8B8D7] hover:bg-[#F7F1FA]/70")
    : "flex min-h-11 items-center gap-3 rounded-[16px] px-3 text-sm font-semibold transition " +
      (active ? "bg-[#F1EAF5] text-[#6E5285]" : "text-[#6E6475] hover:bg-white hover:text-[#2F2437]");

  return (
    <Link
      className={className}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {item.secondaryLabel ? (
          <span className={"mt-0.5 block truncate text-[11px] font-semibold leading-4 " + (active ? "text-[#8E76A2]" : "text-[#9A8FA0]")}>
            {item.secondaryLabel}
          </span>
        ) : null}
      </span>
      <Badge value={item.badge} />
    </Link>
  );
}

export function FacilitatorDashboardShell({
  children,
  facilitatorIdentity,
  pendingBookingsCount,
  unreadMessagesCount,
  yearRhythmMenuStatus,
}: FacilitatorDashboardShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuScrollRef = useRef<HTMLDivElement>(null);
  const primaryItems: NavigationItem[] = [
    { href: "/facilitator", icon: Home, label: "Startside" },
    { href: "/facilitator/events", icon: CalendarPlus, label: "Opret nyt event", isPrimary: true },
    { badge: pendingBookingsCount, href: "/facilitator/bookings", icon: Inbox, label: "Tilmeldinger" },
    { badge: unreadMessagesCount, href: "/facilitator/messages", icon: Mail, label: "Beskedcenter" },
    { href: "/facilitator/year-rhythm", icon: MoonStar, label: "Årets rytme", secondaryLabel: yearRhythmMenuStatus },
  ];
  const secondaryItems: NavigationItem[] = [
    { href: "/facilitator/profile", icon: UserRound, label: "Profilindstillinger" },
    { href: "/facilitator/settings", icon: ShieldCheck, label: "Generelle indstillinger" },
    { href: "/facilitator/settings/payment", icon: CreditCard, label: "Betalingsindstillinger" },
    { href: "/facilitator/help", icon: HelpCircle, label: "Hjælp og support" },
  ];
  const mobileItems: NavigationItem[] = [
    { href: "/facilitator", icon: Home, label: "Start" },
    { href: "/facilitator/events", icon: CalendarPlus, isPrimary: true, label: "Opret event" },
    { badge: pendingBookingsCount, href: "/facilitator/bookings", icon: Inbox, label: "Tilmeldinger" },
    { badge: unreadMessagesCount, href: "/facilitator/messages", icon: Mail, label: "Beskeder" },
  ];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      mobileMenuScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      closeMenuButtonRef.current?.focus();
    });
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousActiveElement?.focus();
    };
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#2F2437]">
      <aside className="fixed left-0 top-0 z-30 hidden h-[100dvh] w-72 flex-col overflow-hidden border-r border-[#E5DDEA] bg-[#FBFAF7]/95 px-4 pb-6 pt-5 shadow-[12px_0_36px_rgba(47,36,55,0.04)] backdrop-blur lg:flex">
        <div className="shrink-0">
          <Link className="flex items-center gap-3 rounded-[20px] px-2 py-2" href="/facilitator">
            <Image
              alt="SoulEvents.dk"
              className="h-12 w-12 shrink-0 object-contain"
              height={96}
              priority
              src="/brand/soulevents-logo.png"
              width={96}
            />
            <span>
              <span className="block text-sm font-bold uppercase tracking-[0.16em] text-[#7A5D91]">SoulEvents</span>
              <span className="block text-sm font-semibold text-[#6E6475]">Arrangørdashboard</span>
            </span>
          </Link>
          <FacilitatorIdentityCard identity={facilitatorIdentity} imageVariant="desktop" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-7 pr-1">
          <nav className="grid gap-1">
            {primaryItems.map((item) => (
              <NavLink item={item} key={item.label} pathname={pathname} />
            ))}
          </nav>

          <div className="mt-6 border-t border-[#E5DDEA] pt-5">
            <p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#A08BB4]">Indstillinger</p>
            <nav className="mt-2 grid gap-1">
              {secondaryItems.map((item) => (
                <NavLink item={item} key={item.label} pathname={pathname} />
              ))}
            </nav>
          </div>
        </div>

        <div className="grid shrink-0 gap-3 border-t border-[#E5DDEA] pb-[env(safe-area-inset-bottom)] pt-5">
          <SignOutButton />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#E5DDEA] bg-white/92 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <Link className="flex items-center gap-2 font-semibold text-[#2F2437]" href="/facilitator">
              <Image alt="SoulEvents.dk" className="h-9 w-9 object-contain" height={72} priority src="/brand/soulevents-logo.png" width={72} />
              <span>Arrangørdashboard</span>
            </Link>
          </div>
        </header>

        <div className="pb-24 lg:pb-0">{children}</div>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-[#2F2437]/28 backdrop-blur-[2px] lg:hidden" onClick={() => setIsMenuOpen(false)}>
          <dialog
            aria-label="Arrangørmenu"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] top-3 z-50 m-0 grid w-auto grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-[#E5DDEA] bg-white shadow-[0_18px_45px_rgba(47,36,55,0.18)]"
            onClick={(event) => event.stopPropagation()}
            open
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5DDEA] p-3">
              <span className="flex items-center gap-2 font-semibold text-[#2F2437]">
                <Image alt="SoulEvents.dk" className="h-8 w-8 object-contain" height={64} priority src="/brand/soulevents-logo.png" width={64} />
                Menu
              </span>
              <button
                aria-label="Luk menu"
                className="grid size-10 place-items-center rounded-full border border-[#D8CBE4] bg-white text-[#7A5D91] transition hover:bg-[#F1EAF5]"
                onClick={() => setIsMenuOpen(false)}
                ref={closeMenuButtonRef}
                type="button"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div
              className="min-h-0 overflow-y-auto overscroll-contain p-3"
              ref={mobileMenuScrollRef}
            >
              <FacilitatorIdentityCard className="mb-2 mt-0" identity={facilitatorIdentity} />
              <nav className="grid gap-1">
                {[...primaryItems, ...secondaryItems].map((item) => (
                  <NavLink item={item} key={item.label} onNavigate={() => setIsMenuOpen(false)} pathname={pathname} />
                ))}
              </nav>
            </div>
            <div className="grid shrink-0 gap-2 border-t border-[#E5DDEA] bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <Link
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-[#D8CBE4] bg-white px-3 text-sm font-semibold text-[#6E5285] transition hover:border-[#C8B8D7] hover:bg-[#F7F1FA]/70 focus:outline-none focus:ring-4 focus:ring-[#E5DDEA]"
                href="/"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="size-4" aria-hidden="true" />
                Tilbage til SoulEvents
              </Link>
              <SignOutButton />
            </div>
          </dialog>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E5DDEA] bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_35px_rgba(47,36,55,0.08)] backdrop-blur lg:hidden">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          const itemClassName = item.isPrimary
            ? "relative grid min-h-14 place-items-center gap-1 rounded-[16px] border px-1 text-[11px] font-semibold transition " +
              (active
                ? "border-[#BFA9CF] bg-[#F7F1FA] text-[#5F4777]"
                : "border-[#D8CBE4] bg-transparent text-[#6E5285] hover:bg-[#F7F1FA]/70")
            : "relative grid min-h-14 place-items-center gap-1 rounded-[16px] text-[11px] font-semibold " + (active ? "text-[#7A5D91]" : "text-[#6E6475]");
          return (
            <Link
              className={itemClassName}
              href={item.href}
              key={item.label}
            >
              <span className="relative">
                <Icon className="size-5" aria-hidden="true" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-[#B56F8A] px-1 text-[10px] font-bold leading-4 text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Luk arrangørmenu" : "Åbn arrangørmenu"}
          className="grid min-h-14 place-items-center gap-1 rounded-[16px] text-[11px] font-semibold text-[#6E6475]"
          onClick={() => setIsMenuOpen((open) => !open)}
          type="button"
        >
          {isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          Menu
        </button>
      </nav>
    </div>
  );
}
