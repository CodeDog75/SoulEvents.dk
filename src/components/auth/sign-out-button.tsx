"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";

function clearBrowserDrafts() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith("soulevents:event-form-draft:")) {
      window.localStorage.removeItem(key);
    }
  }
}

export function SignOutButton() {
  return (
    <form action={signOutAction} onSubmit={clearBrowserDrafts}>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
        type="submit"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Log ud
      </button>
    </form>
  );
}
