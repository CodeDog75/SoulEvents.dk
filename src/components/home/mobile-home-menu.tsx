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
    <div className="md:hidden">
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
        <div className="fixed inset-0 z-50 bg-[#FAF6EF]/96 px-5 py-5 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <p className="font-serif text-3xl font-semibold text-[#2F2633]">SoulEvents</p>
            <button
              aria-label="Luk menu"
              className="grid size-12 place-items-center rounded-full bg-white text-[#2F2633] shadow-soft transition hover:bg-[#F4ECFA]"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>

          <nav className="mx-auto mt-10 grid max-w-md gap-3">
            {links.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  className="rounded-[24px] bg-white px-5 py-5 text-xl font-semibold text-[#2F2633] shadow-soft transition hover:bg-[#F4ECFA]"
                  href={link.href}
                  key={link.href}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  className="rounded-[24px] bg-white px-5 py-5 text-xl font-semibold text-[#2F2633] shadow-soft transition hover:bg-[#F4ECFA]"
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
      )}
    </div>
  );
}
