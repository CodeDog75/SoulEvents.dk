"use client";

import { ChevronDown, Eye, EyeOff, LockKeyhole, Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  changeFacilitatorPasswordAction,
  type ChangePasswordFormState,
} from "@/app/facilitator/profile/actions";

const initialState: ChangePasswordFormState = { status: "idle" };

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

export function SecurityPasswordForm() {
  const [changeState, changeFormAction, isChangePending] = useActionState(changeFacilitatorPasswordAction, initialState);
  const changeFormRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (changeState.status === "success") {
      changeFormRef.current?.reset();
    }
  }, [changeState.status]);

  useEffect(() => {
    if (changeState.status !== "idle") {
      statusRef.current?.focus();
    }
  }, [changeState.status]);

  return (
    <details className="group rounded-md border border-midnight/10 bg-[#FAF8F4] p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage-700">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-sage-50 text-sage-700">
            <LockKeyhole className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-midnight">Adgangskode</h3>
            <p className="mt-1 text-sm leading-6 text-ink/64">
              Skift eller opret en personlig adgangskode. Dine tilknyttede Google- og Facebook-login bevares.
            </p>
          </div>
        </div>
        <ChevronDown className="size-5 text-ink/45 transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="mt-5 grid gap-4">
        {changeState.message ? (
          <p
            className={
              "rounded-md border px-4 py-3 text-sm font-semibold leading-6 outline-none " +
              (changeState.status === "success"
                ? "border-sage-700/20 bg-sage-50 text-sage-700"
                : "border-red-500/25 bg-red-50 text-red-700")
            }
            ref={statusRef}
            tabIndex={-1}
          >
            {changeState.message}
          </p>
        ) : (
          <p className="sr-only" ref={statusRef} tabIndex={-1} />
        )}

        <form action={changeFormAction} className="grid gap-4" ref={changeFormRef}>
          <p className="text-sm leading-6 text-ink/64">
            Hvis du endnu ikke har en personlig adgangskode, kan du oprette den via{" "}
            <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4 hover:text-sage-700" href="/auth/forgot-password">
              glemt adgangskode
            </Link>
            .
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <PasswordField
              autoComplete="current-password"
              error={changeState.fieldErrors?.currentPassword}
              label="Nuværende adgangskode"
              name="current_password"
            />
            <PasswordField
              autoComplete="new-password"
              error={changeState.fieldErrors?.newPassword}
              label="Ny adgangskode"
              name="new_password"
            />
            <PasswordField
              autoComplete="new-password"
              error={changeState.fieldErrors?.confirmPassword}
              label="Gentag ny adgangskode"
              name="confirm_password"
            />
          </div>

          <div className="flex justify-center sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-70"
              disabled={isChangePending}
              type="submit"
            >
              <Save className="size-4" aria-hidden="true" />
              {isChangePending ? "Ændrer adgangskode..." : "Skift adgangskode"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
