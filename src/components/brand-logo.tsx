import Image from "next/image";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

function publicMediaUrl(imagePath?: string | null) {
  if (!env.supabaseUrl || !imagePath) {
    return null;
  }

  return env.supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + imagePath.split("/").map(encodeURIComponent).join("/");
}

async function getLogoSrc() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("value").eq("key", "brand_logo_path").maybeSingle();
    return publicMediaUrl(data?.value) ?? "/brand/soulevents-logo.png";
  } catch {
    return "/brand/soulevents-logo.png";
  }
}

export async function BrandLogo({ className = "h-20 w-20", priority = false }: BrandLogoProps) {
  const src = await getLogoSrc();

  return (
    <Image
      alt="SoulEvents.dk"
      className={"object-contain " + className}
      height={900}
      priority={priority}
      src={src}
      unoptimized={src.startsWith("http")}
      width={900}
    />
  );
}
