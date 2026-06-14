type AuthMessageProps = {
  message?: string;
  variant?: "notice" | "success" | "error";
};

function inferVariant(message: string, variant: AuthMessageProps["variant"]) {
  const normalized = message.toLowerCase();
  const looksLikeError =
    normalized.includes("kunne ikke") ||
    normalized.includes("fejl") ||
    normalized.includes("mislykkedes") ||
    normalized.includes("ugyldig") ||
    normalized.includes("mangler") ||
    normalized.includes("skal udfyldes") ||
    normalized.includes("skal være") ||
    normalized.includes("vælg mindst") ||
    normalized.includes("for stor") ||
    normalized.includes("ikke uploades") ||
    normalized.includes("ikke gemmes") ||
    normalized.includes("ikke sendes");

  if (looksLikeError) {
    return "error";
  }

  const looksLikeSuccess =
    normalized.includes("gemt") ||
    normalized.includes("oprettet") ||
    normalized.includes("sendt") ||
    normalized.includes("registreret") ||
    normalized.includes("link kopieret") ||
    normalized.includes("tak.");

  if (looksLikeSuccess) {
    return "success";
  }

  return variant ?? "notice";
}

export function AuthMessage({ message, variant = "notice" }: AuthMessageProps) {
  if (!message) {
    return null;
  }

  const effectiveVariant = inferVariant(message, variant);
  const className =
    effectiveVariant === "success"
      ? "rounded-md border border-sage-700/25 bg-sage-50 px-4 py-3 text-sm font-medium text-midnight"
      : effectiveVariant === "error"
        ? "rounded-md border border-red-300 bg-red-100 px-4 py-3 text-sm font-semibold text-red-900 shadow-soft"
        : "rounded-md border border-midnight/10 bg-midnight/[0.04] px-4 py-3 text-sm text-midnight";

  return <div className={className}>{message}</div>;
}
