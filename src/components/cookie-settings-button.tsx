"use client";

export function CookieSettingsButton() {
  return (
    <button
      className="font-semibold transition hover:text-rose"
      onClick={() => window.dispatchEvent(new Event("soulevents:open-cookie-settings"))}
      type="button"
    >
      Cookieindstillinger
    </button>
  );
}
