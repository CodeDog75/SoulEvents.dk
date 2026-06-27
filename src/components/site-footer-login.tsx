import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooterLogin() {
  return (
    <footer className="border-t border-olive/10 bg-white">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <BrandLogo className="h-28 w-28" />
          <p className="mt-3 max-w-md text-sm leading-6 text-ink/62">
            SoulEvents.dk - Find spirituelle events nær dig.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-olive">
            <Link className="transition hover:text-rose" href="/about">
              Om SoulEvents
            </Link>
            <Link className="transition hover:text-rose" href="/auth/signup">
              Opret gratis arrangørprofil
            </Link>
            <Link className="transition hover:text-rose" href="/contact">
              Kontakt
            </Link>
            <Link className="transition hover:text-rose" href="/legal/privatlivspolitik">
              Privatlivspolitik
            </Link>
          </div>
        </div>

        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white transition hover:bg-sage-500"
          href="/auth/login"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Log ind
        </Link>
      </div>
    </footer>
  );
}
