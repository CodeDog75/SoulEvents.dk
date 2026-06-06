import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "h-20 w-20", priority = false }: BrandLogoProps) {
  return (
    <Image
      alt="SoulEvents.dk"
      className={`object-contain ${className}`}
      height={900}
      priority={priority}
      src="/brand/soulevents-logo.png"
      width={900}
    />
  );
}
