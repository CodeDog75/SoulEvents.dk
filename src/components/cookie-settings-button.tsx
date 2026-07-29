"use client";

export function CookieSettingsButton({ className = "font-semibold transition hover:text-rose" }: { className?: string }) {
  return (
    <button
      className={className}
      onClick={() => window.dispatchEvent(new Event("soulevents:open-cookie-settings"))}
      type="button"
    >
      Cookieindstillinger
    </button>
  );
}
