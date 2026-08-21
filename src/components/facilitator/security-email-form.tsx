"use client";

import { ChevronDown, Mail, Save, XCircle } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import {
  cancelFacilitatorEmailChangeAction,
  requestFacilitatorEmailChangeAction,
  type ChangeEmailFormState,
} from "@/app/facilitator/profile/actions";

type SecurityEmailFormProps = {
  pendingEmail?: string | null;
  pendingExpiresAt?: string | null;
};

const initialState: ChangeEmailFormState = { status: "idle" };

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes("@")) return value ?? "";
  const [localPart, domain] = value.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${localPart.length > 2 ? "***" : "*"}@${domain}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" id={id}>
      {message}
    </span>
  ) : null;
}

export function SecurityEmailForm({
  pendingEmail,
  pendingExpiresAt,
}: SecurityEmailFormProps) {
  const [requestState, requestAction, requestPending] = useActionState(requestFacilitatorEmailChangeAction, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelFacilitatorEmailChangeAction, initialState);
  const requestFormRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const state = cancelState.status !== "idle" ? cancelState : requestState;

  useEffect(() => {
    if (requestState.status === "success") {
      requestFormRef.current?.reset();
    }

    if (state.status !== "idle") {
      statusRef.current?.focus();
    }
  }, [requestState.status, state.status]);

  return (
    <details className="group rounded-md border border-midnight/10 bg-[#FAF8F4] p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage-700">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-[#F4F0F7] text-[#7A5D91]">
            <Mail className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-midnight">Skift loginmail</h3>
            <p className="mt-1 text-sm leading-6 text-ink/64">Sikkert flow med bekræftelse af den nye loginmail.</p>
          </div>
        </div>
        <ChevronDown className="size-5 text-ink/45 transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="mt-5 grid gap-4">
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

        {pendingEmail ? (
          <div className="rounded-md border border-[#D8CBE4] bg-[#F7F2FB] p-4 text-sm leading-6 text-[#4E4058]">
            <p className="font-semibold text-midnight">Afventer bekræftelse af ny mailadresse: {maskEmail(pendingEmail)}</p>
            <p className="mt-1">
              Den gamle mailadresse er stadig aktiv
              {pendingExpiresAt
                ? `, indtil ændringen bekræftes eller udløber ${new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(pendingExpiresAt))}.`
                : "."}
            </p>
            <form action={cancelAction} className="mt-3">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#7A5D91] transition hover:border-[#7A5D91] disabled:cursor-wait disabled:opacity-70"
                disabled={cancelPending}
                type="submit"
              >
                <XCircle className="size-4" aria-hidden="true" />
                {cancelPending ? "Annullerer..." : "Annullér ændring"}
              </button>
            </form>
          </div>
        ) : null}

        <form action={requestAction} className="grid gap-4" ref={requestFormRef}>
          <p className="text-sm leading-6 text-ink/64">
            Loginmailen bruges til login og vigtige beskeder fra SoulEvents. Den gamle adresse forbliver aktiv, indtil den nye er bekræftet.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Ny mailadresse
              <input
                aria-describedby={requestState.fieldErrors?.newEmail ? "new-email-error" : undefined}
                aria-invalid={Boolean(requestState.fieldErrors?.newEmail)}
                autoComplete="email"
                className={"h-11 w-full rounded-md border bg-white px-3 text-base outline-none transition focus:border-sage-700 " + (requestState.fieldErrors?.newEmail ? "border-red-500 bg-red-50" : "border-midnight/15")}
                name="new_email"
                required
                type="email"
              />
              <FieldError id="new-email-error" message={requestState.fieldErrors?.newEmail} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Gentag ny mailadresse
              <input
                aria-describedby={requestState.fieldErrors?.confirmEmail ? "confirm-new-email-error" : undefined}
                aria-invalid={Boolean(requestState.fieldErrors?.confirmEmail)}
                autoComplete="email"
                className={"h-11 w-full rounded-md border bg-white px-3 text-base outline-none transition focus:border-sage-700 " + (requestState.fieldErrors?.confirmEmail ? "border-red-500 bg-red-50" : "border-midnight/15")}
                name="confirm_new_email"
                required
                type="email"
              />
              <FieldError id="confirm-new-email-error" message={requestState.fieldErrors?.confirmEmail} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Nuværende adgangskode
              <input
                aria-describedby={requestState.fieldErrors?.currentPassword ? "email-current-password-error" : undefined}
                aria-invalid={Boolean(requestState.fieldErrors?.currentPassword)}
                autoComplete="current-password"
                className={"h-11 w-full rounded-md border bg-white px-3 text-base outline-none transition focus:border-sage-700 " + (requestState.fieldErrors?.currentPassword ? "border-red-500 bg-red-50" : "border-midnight/15")}
                name="current_password"
                required
                type="password"
              />
              <FieldError id="email-current-password-error" message={requestState.fieldErrors?.currentPassword} />
            </label>
          </div>
          <div className="flex justify-center sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-70"
              disabled={requestPending || Boolean(pendingEmail)}
              type="submit"
            >
              <Save className="size-4" aria-hidden="true" />
              {requestPending ? "Sender bekræftelse..." : "Skift loginmail"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
