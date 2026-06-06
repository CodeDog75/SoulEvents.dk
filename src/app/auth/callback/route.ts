import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (error) {
    const message = errorDescription || "E-mailbekræftelsen kunne ikke gennemføres. Prøv linket igen eller send en ny bekræftelsesmail.";
    return NextResponse.redirect(new URL(`/auth/login?message=${encodeURIComponent(message)}`, requestUrl.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(
          `/auth/login?message=${encodeURIComponent(
            "E-mailbekræftelsen kunne ikke gemmes i browseren. Prøv linket igen, eller log ind hvis e-mailen allerede er bekræftet.",
          )}`,
          requestUrl.origin,
        ),
      );
    }
  } else {
    return NextResponse.redirect(
      new URL(
        `/auth/login?message=${encodeURIComponent("Bekræftelseslinket mangler en kode. Åbn det nyeste link fra din indbakke.")}`,
        requestUrl.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
