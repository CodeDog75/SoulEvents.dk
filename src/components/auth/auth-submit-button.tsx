"use client";

import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
};

export function AuthSubmitButton({ children, className, pendingLabel }: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button aria-busy={pending} className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
