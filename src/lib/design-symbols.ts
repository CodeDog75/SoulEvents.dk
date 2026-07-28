export const designSymbolBucketName = "media";
export const designSymbolStoragePrefix = "design-symbols";
export const maxDesignSymbolBytes = 120 * 1024;
export const maxProfileSymbols = 2;

export const designSymbolBackgroundColors = [
  { label: "Salvie", value: "#EEF5EA" },
  { label: "Sand", value: "#F8F2E8" },
  { label: "Lavendel", value: "#F2EDF7" },
  { label: "Støvet rosa", value: "#F8EDE7" },
  { label: "Himmelblå", value: "#EAF5F7" },
  { label: "Creme", value: "#FFF8EC" },
  { label: "Måneskær", value: "#EEF1F7" },
  { label: "Lys rose", value: "#F6EEF4" },
] as const;

export type DesignSymbol = {
  backgroundColor: string;
  category: string;
  id: string;
  isActive: boolean;
  name: string;
  optimizedSvgPath: string;
  slug: string;
  sortOrder: number;
};

export type DesignSymbolRow = {
  background_color: string;
  category: string;
  id: string;
  is_active: boolean;
  name: string;
  sort_order: number;
  slug: string;
  svg_path: string;
};

export function mapDesignSymbolRow(row: DesignSymbolRow): DesignSymbol {
  return {
    backgroundColor: row.background_color,
    category: row.category,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    optimizedSvgPath: row.svg_path,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

export function slugifyDesignSymbolName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function isDesignSymbolBackgroundColor(value: string) {
  return designSymbolBackgroundColors.some((color) => color.value.toLowerCase() === value.toLowerCase());
}

export function normalizeDesignSymbolCategory(value: string | null | undefined) {
  return (value?.trim() || "Generelt").slice(0, 80);
}

export function validateAndOptimizeSvg(input: { fileName: string; size: number; text: string }) {
  const errors: string[] = [];
  const trimmed = input.text.trim();
  const lower = trimmed.toLowerCase();

  if (!input.fileName.toLowerCase().endsWith(".svg")) {
    errors.push("Filen skal være en SVG-fil.");
  }

  if (input.size <= 0 || input.size > maxDesignSymbolBytes) {
    errors.push("SVG-filen må højst være 120 KB.");
  }

  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>$/i.test(trimmed)) {
    errors.push("Filen skal indeholde én gyldig SVG.");
  }

  if ((trimmed.match(/<svg[\s>]/gi) ?? []).length !== 1) {
    errors.push("SVG'en må kun indeholde ét symbol.");
  }

  if (!/\sviewBox\s*=\s*["'][^"']+["']/i.test(trimmed)) {
    errors.push("SVG'en skal have en viewBox, gerne 0 0 48 48.");
  }

  if (/<text[\s>]/i.test(trimmed) || /<tspan[\s>]/i.test(trimmed)) {
    errors.push("SVG'en må ikke indeholde tekst.");
  }

  if (/<image[\s>]/i.test(trimmed) || /<foreignObject[\s>]/i.test(trimmed)) {
    errors.push("SVG'en må ikke indeholde rasterbilleder eller indlejret HTML.");
  }

  if (/<script[\s>]/i.test(trimmed) || /\son[a-z]+\s*=/i.test(trimmed)) {
    errors.push("SVG'en må ikke indeholde scripts eller event-handlers.");
  }

  if (/filter\s*=|<filter[\s>]|box-shadow|drop-shadow/i.test(trimmed)) {
    errors.push("SVG'en må ikke indeholde skygger eller filtereffekter.");
  }

  if (/<rect[\s>][^>]*(width\s*=\s*["']?100%|height\s*=\s*["']?100%|fill\s*=\s*["'](?!none|transparent)[^"']+["'])/i.test(trimmed)) {
    errors.push("SVG'en ser ud til at have en indbygget baggrund. Brug transparent baggrund.");
  }

  if (/fill\s*=\s*["']#|fill\s*=\s*["']rgb|fill\s*=\s*["']hsl/i.test(trimmed)) {
    errors.push("SVG'en må ikke have farvet fyld. Brug fill=\"none\" og stroke=\"currentColor\".");
  }

  if (errors.length > 0) {
    return { errors, optimizedSvg: null };
  }

  let optimizedSvg = trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<desc[\s\S]*?<\/desc>/gi, "")
    .replace(/\s(id|data-name|class)=["'][^"']*["']/gi, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();

  optimizedSvg = optimizedSvg.replace(/<svg\s/i, '<svg color="currentColor" ');

  if (!/\sstroke\s*=/i.test(optimizedSvg)) {
    optimizedSvg = optimizedSvg.replace(/<svg\s/i, '<svg stroke="currentColor" ');
  }

  return { errors: [], optimizedSvg };
}
