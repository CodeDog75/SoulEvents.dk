import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function safeRedirectUrl(value: string | null) {
  if (!value) return new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");

  if (value.startsWith("/")) {
    return new URL(value, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url;
  } catch {
    return new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
  }

  return new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: ad } = await supabase
    .from("ads")
    .select("target_url")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!ad?.target_url) {
    return NextResponse.redirect(safeRedirectUrl("/"));
  }

  await supabase.rpc("increment_ad_clicks", { ad_id: id });

  return NextResponse.redirect(safeRedirectUrl(ad.target_url));
}
