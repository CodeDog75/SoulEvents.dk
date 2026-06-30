import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooterLogin() {
  return (
    <footer className="border-t border-olive/10 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <BrandLogo className="h-20 w-20" />

        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-olive">
          <Link className="transition hover:text-rose" href="/about">
            Om SoulEvents
          </Link>
          <Link className="transition hover:text-rose" href="/auth/signup">
            Opret arrangørprofil
          </Link>
          <Link className="transition hover:text-rose" href="/contact">
            Kontakt
          </Link>
          <Link className="transition hover:text-rose" href="/privacy">
            Privatlivspolitik
          </Link>
          <Link className="transition hover:text-rose" href="/terms">
            Vilkår
          </Link>
          <Link className="transition hover:text-rose" href="/auth/login">
            Log ind
          </Link>
        </div>
      </div>
    </footer>
  );
}
