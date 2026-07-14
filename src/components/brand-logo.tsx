import Image from "next/image";
import { getBrandLogoSettingValues, isSvgLogoUrl, resolveBrandLogoUrl, type LogoSettingClient } from "@/lib/brand-logo";
import { createClient } from "@/lib/supabase/server";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

type LogoSources = {
  desktop: string;
  mobile: string;
};

async function getLogoSrc(): Promise<LogoSources> {
  try {
    const supabase = await createClient();
    const { desktop, mobile } = await getBrandLogoSettingValues(supabase as unknown as LogoSettingClient);
    const desktopSrc = resolveBrandLogoUrl(desktop);
    return {
      desktop: desktopSrc,
      mobile: mobile ? resolveBrandLogoUrl(mobile) : desktopSrc,
    };
  } catch {
    const fallbackSrc = resolveBrandLogoUrl(null);
    return { desktop: fallbackSrc, mobile: fallbackSrc };
  }
}

function LogoImage({ className, priority, src, variant }: { className: string; priority: boolean; src: string; variant: "desktop" | "mobile" }) {
  const alt = variant === "desktop" ? "SoulEvents.dk" : "SoulEvents.dk ikon";

  if (isSvgLogoUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} className={className} height={900} src={src} width={900} />;
  }

  return <Image alt={alt} className={className} height={900} priority={priority} src={src} width={900} />;
}

export async function BrandLogo({ className = "h-20 w-20", priority = false }: BrandLogoProps) {
  const src = await getLogoSrc();
  const mobileClassName = "object-contain md:hidden " + className;
  const desktopClassName = "hidden object-contain md:block " + className;

  return (
    <>
      <LogoImage className={mobileClassName} priority={priority} src={src.mobile} variant="mobile" />
      <LogoImage className={desktopClassName} priority={priority} src={src.desktop} variant="desktop" />
    </>
  );
}
