import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
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
