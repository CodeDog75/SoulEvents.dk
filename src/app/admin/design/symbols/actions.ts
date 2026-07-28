"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import {
  designSymbolBucketName,
  designSymbolStoragePrefix,
  isDesignSymbolBackgroundColor,
  normalizeDesignSymbolCategory,
  slugifyDesignSymbolName,
  validateAndOptimizeSvg,
} from "@/lib/design-symbols";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string, edit?: string | null): never {
  const params = new URLSearchParams({ message });
  if (edit) params.set("edit", edit);
  redirect("/admin/design/symbols?" + params.toString());
}

function safeStorageName(input: string) {
  return slugifyDesignSymbolName(input) || "symbol";
}

async function uniqueSymbolSlug(baseSlug: string, existingId?: string | null) {
  const supabase = createAdminClient();
  let candidate = baseSlug || "symbol";
  let suffix = 2;

  while (true) {
    let query = supabase.from("design_symbols").select("id").eq("slug", candidate).limit(1);
    if (existingId) query = query.neq("id", existingId);
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[design-symbols] slug lookup failed", { code: error.code, message: error.message });
      return candidate;
    }

    if (!data) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function uploadSvgPair(input: { file: File; slug: string }) {
  const text = await input.file.text();
  const validation = validateAndOptimizeSvg({ fileName: input.file.name, size: input.file.size, text });

  if (validation.errors.length > 0 || !validation.optimizedSvg) {
    return { error: validation.errors.join(" "), optimizedPath: null, originalPath: null };
  }

  const supabase = createAdminClient();
  const stamp = Date.now() + "-" + crypto.randomUUID().slice(0, 8);
  const safeName = safeStorageName(input.slug);
  const originalPath = `${designSymbolStoragePrefix}/original/${stamp}-${safeName}.svg`;
  const optimizedPath = `${designSymbolStoragePrefix}/optimized/${stamp}-${safeName}.svg`;

  const { error: originalError } = await supabase.storage.from(designSymbolBucketName).upload(originalPath, text, {
    cacheControl: "31536000",
    contentType: "image/svg+xml",
    upsert: false,
  });

  if (originalError) {
    console.error("[design-symbols] original upload failed", { message: originalError.message, path: originalPath });
    return { error: "Originalfilen kunne ikke uploades.", optimizedPath: null, originalPath: null };
  }

  const { error: optimizedError } = await supabase.storage.from(designSymbolBucketName).upload(optimizedPath, validation.optimizedSvg, {
    cacheControl: "31536000",
    contentType: "image/svg+xml",
    upsert: false,
  });

  if (optimizedError) {
    console.error("[design-symbols] optimized upload failed", { message: optimizedError.message, path: optimizedPath });
    await supabase.storage.from(designSymbolBucketName).remove([originalPath]);
    return { error: "Den optimerede SVG kunne ikke uploades.", optimizedPath: null, originalPath: null };
  }

  return { error: null, optimizedPath, originalPath };
}

export async function saveDesignSymbolAction(formData: FormData) {
  await requireRole("admin");
  const supabase = createAdminClient();
  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name").trim();
  const requestedSlug = getOptionalString(formData, "slug") || name;
  const slug = await uniqueSymbolSlug(slugifyDesignSymbolName(requestedSlug), id);
  const category = normalizeDesignSymbolCategory(getOptionalString(formData, "category"));
  const backgroundColorInput = getOptionalString(formData, "background_color") || "#EEF5EA";
  const backgroundColor = isDesignSymbolBackgroundColor(backgroundColorInput) ? backgroundColorInput : "#EEF5EA";
  const isActive = formData.get("is_active") === "on";
  const sortOrder = Number(formData.get("sort_order"));
  const file = formData.get("svg_file");

  if (!name) {
    go("Skriv et navn til symbolet.", id);
  }

  let currentSymbol: { original_svg_path: string | null; sort_order: number; svg_path: string } | null = null;

  if (id) {
    const { data, error } = await supabase
      .from("design_symbols")
      .select("svg_path, original_svg_path, sort_order")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      go("Symbolet kunne ikke findes.");
    }

    currentSymbol = data;
  }

  let originalSvgPath = currentSymbol?.original_svg_path ?? null;
  let optimizedSvgPath = currentSymbol?.svg_path ?? null;

  if (file instanceof File && file.size > 0) {
    const upload = await uploadSvgPair({ file, slug });
    if (upload.error || !upload.optimizedPath || !upload.originalPath) {
      go(upload.error ?? "SVG'en kunne ikke uploades.", id);
    }
    originalSvgPath = upload.originalPath;
    optimizedSvgPath = upload.optimizedPath;
  }

  if (!optimizedSvgPath) {
    go("Upload en SVG-fil til symbolet.", id);
  }

  const payload = {
    background_color: backgroundColor,
    category,
    is_active: isActive,
    name,
    original_svg_path: originalSvgPath,
    slug,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : currentSymbol?.sort_order ?? 0,
    svg_path: optimizedSvgPath,
  };

  const result = id
    ? await supabase.from("design_symbols").update(payload).eq("id", id)
    : await supabase.from("design_symbols").insert(payload);

  if (result.error) {
    console.error("[design-symbols] save failed", { code: result.error.code, message: result.error.message });
    go("Symbolet kunne ikke gemmes.", id);
  }

  revalidatePath("/admin/design/symbols");
  revalidatePath("/facilitator/profile");

  go(id ? "Symbolet er gemt." : "Symbolet er uploadet.");
}

export async function setDesignSymbolStatusAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  const isActive = formData.get("is_active") === "true";
  const supabase = createAdminClient();
  const { error } = await supabase.from("design_symbols").update({ is_active: isActive }).eq("id", id);

  if (error) {
    console.error("[design-symbols] status update failed", { code: error.code, message: error.message, symbolId: id });
    go("Status kunne ikke ændres.");
  }

  revalidatePath("/admin/design/symbols");
  revalidatePath("/facilitator/profile");
  go(isActive ? "Symbolet er aktiveret." : "Symbolet er deaktiveret.");
}

export async function deleteDesignSymbolAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("facilitator_profile_symbols")
    .select("symbol_id", { count: "exact", head: true })
    .eq("symbol_id", id);

  if ((count ?? 0) > 0) {
    go("Symbolet er i brug og kan ikke slettes. Deaktivér det i stedet.");
  }

  const { data: symbol } = await supabase.from("design_symbols").select("svg_path, original_svg_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("design_symbols").delete().eq("id", id);

  if (error) {
    console.error("[design-symbols] delete failed", { code: error.code, message: error.message, symbolId: id });
    go("Symbolet kunne ikke slettes.");
  }

  const paths = [symbol?.svg_path, symbol?.original_svg_path].filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from(designSymbolBucketName).remove(paths);
  }

  revalidatePath("/admin/design/symbols");
  revalidatePath("/facilitator/profile");
  go("Symbolet er slettet.");
}

export async function reorderDesignSymbolAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  const currentOrder = Number(formData.get("sort_order"));
  const direction = formData.get("direction") === "down" ? 1 : -1;
  const nextOrder = Number.isFinite(currentOrder) ? currentOrder + direction : 0;
  const supabase = createAdminClient();
  const { error } = await supabase.from("design_symbols").update({ sort_order: nextOrder }).eq("id", id);

  if (error) {
    console.error("[design-symbols] reorder failed", { code: error.code, message: error.message, symbolId: id });
    go("Rækkefølgen kunne ikke ændres.");
  }

  revalidatePath("/admin/design/symbols");
  go("Rækkefølgen er ændret.");
}
