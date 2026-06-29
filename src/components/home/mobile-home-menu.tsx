"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "#find-events", label: "Events" },
  { href: "#map", label: "Kort" },
  { href: "/facilitators", label: "Arrangører" },
  { href: "/inspiration", label: "Inspiration" },
  { href: "#categories", label: "Kategorier" },
  { href: "/auth/login", label: "Login" },
];

export function MobileHomeMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative md:hidden">
      <button
        aria-expanded={isOpen}
        aria-label="Åbn menu"
        className="grid size-12 place-items-center rounded-full bg-white/88 text-[#2F2633] shadow-soft backdrop-blur transition hover:bg-white"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <button
            aria-label="Luk menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <div className="absolute right-0 top-14 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-[24px] border border-white/80 bg-white/96 p-3 shadow-[0_22px_60px_rgba(47,38,51,0.18)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-2 py-1">
              <p className="font-serif text-2xl font-semibold text-[#2F2633]">Menu</p>
              <button
                aria-label="Luk menu"
                className="grid size-10 place-items-center rounded-full bg-[#FAF6EF] text-[#2F2633] transition hover:bg-[#F4ECFA]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-2 grid gap-1">
              {links.map((link) =>
                link.href.startsWith("/") ? (
                  <Link
                    className="rounded-[18px] px-4 py-3.5 text-base font-semibold text-[#2F2633] transition hover:bg-[#FAF6EF]"
                    href={link.href}
                    key={link.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    className="rounded-[18px] px-4 py-3.5 text-base font-semibold text-[#2F2633] transition hover:bg-[#FAF6EF]"
                    href={link.href}
                    key={link.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </a>
                ),
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
