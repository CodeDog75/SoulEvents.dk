"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/auth/actions";

function clearBrowserDrafts() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith("soulevents:event-form-draft:")) {
      window.localStorage.removeItem(key);
    }
  }
}

function SignOutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-zinc-300 bg-zinc-100 px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-200 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? "Logger ud..." : "Log ud"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction} onSubmit={clearBrowserDrafts}>
      <SignOutSubmitButton />
    </form>
  );
}
