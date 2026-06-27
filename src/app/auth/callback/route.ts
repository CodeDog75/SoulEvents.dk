import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function confirmationRedirect(requestUrl: URL, message: string, confirmation: "expired" | "needed" = "needed") {
  const searchParams = new URLSearchParams({
    confirmation,
    message,
  });

  return NextResponse.redirect(new URL(`/auth/login?${searchParams.toString()}`, requestUrl.origin));
}

function isExpiredOrInvalidLink(errorText: string) {
  const normalized = errorText.toLowerCase();

  return (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp") ||
    normalized.includes("token")
  );
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (error) {
    const errorText = `${error} ${errorDescription ?? ""}`;
    const message = isExpiredOrInvalidLink(errorText)
      ? "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link."
      : "E-mailbekræftelsen kunne ikke gennemføres. Prøv det nyeste link fra din indbakke, eller send en ny bekræftelsesmail.";

    return confirmationRedirect(requestUrl, message, isExpiredOrInvalidLink(errorText) ? "expired" : "needed");
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const message = isExpiredOrInvalidLink(exchangeError.message)
        ? "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link."
        : "E-mailbekræftelsen kunne ikke gemmes i browseren. Prøv det nyeste link fra din indbakke, eller send en ny bekræftelsesmail.";

      return confirmationRedirect(requestUrl, message, isExpiredOrInvalidLink(exchangeError.message) ? "expired" : "needed");
    }
  } else {
    return confirmationRedirect(
      requestUrl,
      "Bekræftelseslinket mangler en kode. Åbn det nyeste link fra din indbakke, eller send en ny bekræftelsesmail herunder.",
    );
  }

  const successUrl = new URL(next, requestUrl.origin);
  successUrl.searchParams.set("message", "E-mailen er bekræftet. Du kan nu logge ind på SoulEvents.");
  return NextResponse.redirect(successUrl);
}
