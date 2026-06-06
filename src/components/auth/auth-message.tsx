type AuthMessageProps = {
  message?: string;
  variant?: "notice" | "success";
};

export function AuthMessage({ message, variant = "notice" }: AuthMessageProps) {
  if (!message) {
    return null;
  }

  const className =
    variant === "success"
      ? "rounded-md border border-sage-700/25 bg-sage-50 px-4 py-3 text-sm text-midnight"
      : "rounded-md border border-terracotta/25 bg-terracotta/10 px-4 py-3 text-sm text-midnight";

  return (
    <div className={className}>{message}</div>
  );
}
