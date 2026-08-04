"use client";

import { useFormStatus } from "react-dom";

type BecomeOrganizerSubmitButtonProps = {
  idleLabel?: string;
  pendingLabel?: string;
};

export function BecomeOrganizerSubmitButton({
  idleLabel = "Gem ændringer",
  pendingLabel = "Gemmer...",
}: BecomeOrganizerSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-11 items-center justify-center rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
