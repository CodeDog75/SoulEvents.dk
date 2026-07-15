"use client";

import { useEffect, useState } from "react";
import { signUpFacilitatorAction } from "@/app/auth/actions";
import { LegalConsentLinks } from "@/components/auth/legal-consent-links";

type LegalDocument = {
  body: string;
  slug: string;
  title: string;
};

type SignupFormValues = {
  acceptedTerms: boolean;
  email: string;
  fullName: string;
  password: string;
  phone: string;
};

type SignupFormProps = {
  documents: LegalDocument[];
  initialEmail?: string;
  restoreValues?: boolean;
  returnToEmailFirstLogin?: boolean;
};

const signupDraftKey = "soulevents:signup-form-draft:v1";
const emptyValues: SignupFormValues = {
  acceptedTerms: false,
  email: "",
  fullName: "",
  password: "",
  phone: "",
};

function readStoredValues() {
  try {
    const rawValues = window.sessionStorage.getItem(signupDraftKey);
    return rawValues ? ({ ...emptyValues, ...JSON.parse(rawValues) } as SignupFormValues) : emptyValues;
  } catch {
    return emptyValues;
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function SignupForm({ documents, initialEmail = "", restoreValues = false, returnToEmailFirstLogin = false }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>({ ...emptyValues, email: initialEmail });
  const [successTarget, setSuccessTarget] = useState("login");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (restoreValues) {
        setValues(readStoredValues());
        return;
      }

      setValues({ ...emptyValues, email: initialEmail });
      window.sessionStorage.removeItem(signupDraftKey);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialEmail, restoreValues]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateSuccessTarget = () => setSuccessTarget(mediaQuery.matches ? "signup" : "login");

    updateSuccessTarget();
    mediaQuery.addEventListener("change", updateSuccessTarget);

    return () => mediaQuery.removeEventListener("change", updateSuccessTarget);
  }, []);

  function updateValue<Key extends keyof SignupFormValues>(key: Key, value: SignupFormValues[Key]) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
  }

  function rememberValues() {
    window.sessionStorage.setItem(signupDraftKey, JSON.stringify(values));
    setIsSubmitting(true);
  }

  return (
    <form
      action={signUpFacilitatorAction}
      className="mt-6 grid gap-5 [&_input::placeholder]:text-sm [&_input::placeholder]:font-normal [&_input::placeholder]:text-[#2F2633]/42"
      onSubmit={rememberValues}
    >
      <input name="success_target" type="hidden" value={returnToEmailFirstLogin ? "login" : successTarget} />
      {returnToEmailFirstLogin ? <input name="auth_return_path" type="hidden" value="email-first" /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
          E-mail *
          <input
            autoComplete="email"
            className="h-12 min-w-0 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
            name="email"
            onChange={(event) => updateValue("email", event.currentTarget.value)}
            placeholder="din@mail.dk"
            required
            type="email"
            value={values.email}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
          Adgangskode *
          <input
            autoComplete="new-password"
            className="h-12 min-w-0 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
            minLength={8}
            name="password"
            onChange={(event) => updateValue("password", event.currentTarget.value)}
            placeholder="Mindst 8 tegn"
            required
            type="password"
            value={values.password}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
          Dit rigtige navn *
          <input
            autoComplete="name"
            className="h-12 min-w-0 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
            name="full_name"
            onChange={(event) => updateValue("fullName", event.currentTarget.value)}
            placeholder="Dit fulde navn"
            required
            value={values.fullName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
          <span className="flex items-center gap-2">
            Telefon
            <span className="group relative inline-flex">
              <button
                aria-label="Telefonnummer er valgfrit"
                className="grid size-6 place-items-center rounded-full border border-[#4B5645]/25 bg-[#FAF6EF] text-xs font-semibold text-[#4B5645]"
                type="button"
              >
                i
              </button>
              <span className="pointer-events-none absolute left-1/2 top-8 z-10 hidden w-56 -translate-x-1/2 rounded-2xl border border-[#EDE4F7] bg-white p-3 text-xs font-medium leading-5 text-[#2F2633]/70 shadow-soft group-hover:block group-focus-within:block">
                Valgfrit. Indtast præcis 8 cifre uden landekode.
              </span>
            </span>
          </span>
          <input
            autoComplete="tel"
            className="h-12 min-w-0 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
            inputMode="numeric"
            maxLength={8}
            name="phone"
            onChange={(event) => updateValue("phone", normalizePhone(event.currentTarget.value))}
            pattern="[0-9]{8}"
            placeholder="Kan udfyldes senere"
            title="Telefonnummer skal bestå af præcis 8 tal."
            type="text"
            value={values.phone}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-[1.25rem] bg-[#EDE4F7]/65 p-4 text-sm leading-6 text-[#2F2633]/72">
        <input
          checked={values.acceptedTerms}
          className="mt-1 size-4 accent-[#7A4EAB]"
          name="accepted_terms"
          onChange={(event) => updateValue("acceptedTerms", event.currentTarget.checked)}
          required
          type="checkbox"
        />
        <span>
          <LegalConsentLinks documents={documents} />
        </span>
      </label>

      <button
        aria-disabled={isSubmitting}
        className="mt-1 h-12 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6A4199] hover:shadow-lift disabled:cursor-wait disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:bg-[#7A4EAB] disabled:hover:shadow-soft"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Sender..." : "Opret gratis arrangørprofil"}
      </button>
    </form>
  );
}

export function ClearSignupDraft() {
  useEffect(() => {
    window.sessionStorage.removeItem(signupDraftKey);
  }, []);

  return null;
}
