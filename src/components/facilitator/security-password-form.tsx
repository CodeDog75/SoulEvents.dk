"use client";

import { ChevronDown, Eye, EyeOff, LockKeyhole, Save } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { changeFacilitatorPasswordAction, type ChangePasswordFormState } from "@/app/facilitator/profile/actions";

type SecurityPasswordFormProps = {
  oauthProvider?: "facebook" | "google" | string | null;
  passwordLoginAvailable: boolean;
};

const initialState: ChangePasswordFormState = { status: "idle" };

function providerText(provider?: "facebook" | "google" | string | null) {
  if (provider === "facebook") {
    return "Du logger ind med Facebook. Din adgangskode administreres hos Facebook og kan ikke ændres på SoulEvents.";
  }

  if (provider === "google") {
    return "Du logger ind med Google. Din adgangskode administreres hos Google og kan ikke ændres på SoulEvents.";
  }

  return "Du logger ind med en ekstern loginmetode. Din adgangskode administreres uden for SoulEvents og kan ikke ændres her.";
}

function PasswordField({
  autoComplete,
  error,
  label,
  name,
}: {
  autoComplete: "current-password" | "new-password";
  error?: string;
  label: string;
  name: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = `${name}-error`;

  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      {label}
      <span className="relative">
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={
            "h-11 w-full rounded-md border bg-white px-3 pr-11 text-base outline-none transition focus:border-sage-700 " +
            (error ? "border-red-500 bg-red-50" : "border-midnight/15")
          }
          minLength={autoComplete === "new-password" ? 10 : undefined}
          name={name}
          required
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-label={isVisible ? `Skjul ${label.toLowerCase()}` : `Vis ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink/55 transition hover:bg-sage-50 hover:text-sage-700"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          {isVisible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </span>
      {error ? (
        <span className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SecurityPasswordForm({ oauthProvider, passwordLoginAvailable }: SecurityPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(changeFacilitatorPasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }

    if (state.status !== "idle") {
      statusRef.current?.focus();
    }
  }, [state]);

  return (
    <details className="group rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage-700">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-sage-50 text-sage-700">
            <LockKeyhole className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-midnight">Sikkerhed</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">Skift adgangskode for din SoulEvents-konto.</p>
          </div>
        </div>
        <ChevronDown className="size-5 text-ink/45 transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      {!passwordLoginAvailable ? (
        <div className="mt-5 rounded-md border border-sage-700/15 bg-sage-50 p-4 text-sm leading-6 text-ink/72">
          {providerText(oauthProvider)}
        </div>
      ) : (
        <form action={formAction} className="mt-5 grid gap-4" ref={formRef}>
          {state.message ? (
            <p
              className={
                "rounded-md border px-4 py-3 text-sm font-semibold leading-6 outline-none " +
                (state.status === "success"
                  ? "border-sage-700/20 bg-sage-50 text-sage-700"
                  : "border-red-500/25 bg-red-50 text-red-700")
              }
              ref={statusRef}
              tabIndex={-1}
            >
              {state.message}
            </p>
          ) : (
            <p className="sr-only" ref={statusRef} tabIndex={-1} />
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <PasswordField
              autoComplete="current-password"
              error={state.fieldErrors?.currentPassword}
              label="Nuværende adgangskode"
              name="current_password"
            />
            <PasswordField
              autoComplete="new-password"
              error={state.fieldErrors?.newPassword}
              label="Ny adgangskode"
              name="new_password"
            />
            <PasswordField
              autoComplete="new-password"
              error={state.fieldErrors?.confirmPassword}
              label="Gentag ny adgangskode"
              name="confirm_password"
            />
          </div>

          <div className="flex justify-center sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-70"
              disabled={isPending}
              type="submit"
            >
              <Save className="size-4" aria-hidden="true" />
              {isPending ? "Ændrer adgangskode..." : "Skift adgangskode"}
            </button>
          </div>
        </form>
      )}
    </details>
  );
}
