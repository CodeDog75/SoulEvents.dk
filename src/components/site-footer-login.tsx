import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { CookieSettingsButton } from "@/components/cookie-settings-button";

export function SiteFooterLogin() {
  return (
    <footer className="border-t border-olive/10 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <BrandLogo className="h-20 w-20" />

        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-olive">
          <Link className="transition hover:text-rose" href="/about">
            Om SoulEvents
          </Link>
          <Link className="transition hover:text-rose" href="/bliv-arrangoer">
            Opret arrangørprofil
          </Link>
          <Link className="transition hover:text-rose" href="/contact">
            Kontakt
          </Link>
          <Link className="transition hover:text-rose" href="/legal/privatlivspolitik">
            Privatlivspolitik
          </Link>
          <Link className="transition hover:text-rose" href="/data-deletion">
            Datasletning
          </Link>
          <Link className="transition hover:text-rose" href="/legal/handelsbetingelser">
            Vilkår
          </Link>
          <Link className="transition hover:text-rose" href="/legal/arrangoervilkaar">
            Arrangørvilkår
          </Link>
          <CookieSettingsButton />
          <Link className="transition hover:text-rose" href="/auth/login">
            Log ind
          </Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-2 px-5 pb-6 text-center text-xs font-medium text-ink/50 sm:flex-row sm:px-8">
        <span>SoulEvents er udviklet og designet af</span>
        <a
          aria-label="StartupDesign.dk"
          className="inline-flex items-center opacity-75 transition hover:opacity-55"
          href="https://startupdesign.dk"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Image
            alt="StartupDesign.dk"
            className="h-6 w-auto"
            height={317}
            src="/brand/startupdesign-logo.png"
            width={788}
          />
        </a>
      </div>
      <p className="mx-auto mt-6 max-w-[1200px] px-5 pb-8 text-center text-xs text-ink/50 sm:px-8">
        © 2026 SoulEvents. Alle rettigheder forbeholdes.
      </p>
    </footer>
  );
}
