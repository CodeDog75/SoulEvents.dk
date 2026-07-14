import Image from "next/image";
import { getBrandLogoSettingValue, isSvgLogoUrl, resolveBrandLogoUrl, type LogoSettingClient } from "@/lib/brand-logo";
import { createClient } from "@/lib/supabase/server";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

async function getLogoSrc() {
  try {
    const supabase = await createClient();
    const value = await getBrandLogoSettingValue(supabase as unknown as LogoSettingClient);
    return resolveBrandLogoUrl(value);
  } catch {
    return resolveBrandLogoUrl(null);
  }
}

export async function BrandLogo({ className = "h-20 w-20", priority = false }: BrandLogoProps) {
  const src = await getLogoSrc();
  const logoClassName = "object-contain " + className;

  if (isSvgLogoUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="SoulEvents.dk" className={logoClassName} height={900} src={src} width={900} />;
  }

  return (
    <Image
      alt="SoulEvents.dk"
      className={logoClassName}
      height={900}
      priority={priority}
      src={src}
      width={900}
    />
  );
}
