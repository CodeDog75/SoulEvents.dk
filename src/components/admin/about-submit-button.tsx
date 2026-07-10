"use client";

import { useFormStatus } from "react-dom";

export function AboutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-11 items-center justify-center rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Gemmer..." : "Gem ændringer"}
    </button>
  );
}
