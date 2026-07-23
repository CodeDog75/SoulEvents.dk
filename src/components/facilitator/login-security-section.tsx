"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { LinkedLoginMethods } from "@/components/facilitator/linked-login-methods";
import { SecurityEmailForm } from "@/components/facilitator/security-email-form";
import { SecurityPasswordForm } from "@/components/facilitator/security-password-form";

type LoginSecuritySectionProps = {
  authProviders: string[];
  currentEmail: string;
  oauthProvider?: "facebook" | "google" | string | null;
  passwordLoginAvailable: boolean;
  pendingEmailChange?: { expires_at: string; new_email: string } | null;
};

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes("@")) return value ?? "";
  const [localPart, domain] = value.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${localPart.length > 2 ? "***" : "*"}@${domain}`;
}

export function LoginSecuritySection({
  authProviders,
  currentEmail,
  oauthProvider,
  passwordLoginAvailable,
  pendingEmailChange,
}: LoginSecuritySectionProps) {
  const [hasPasswordLogin, setHasPasswordLogin] = useState(passwordLoginAvailable);
  const visibleProviders = useMemo(() => {
    if (!hasPasswordLogin || authProviders.includes("email")) {
      return authProviders;
    }

    return ["email", ...authProviders];
  }, [authProviders, hasPasswordLogin]);

  return (
    <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sage-50 text-sage-700">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-midnight">Login og sikkerhed</h2>
            <p className="mt-1 break-all text-sm leading-6 text-ink/64">
              Nuværende login- og kontaktmail: <span className="font-semibold text-midnight">{currentEmail}</span>
            </p>
            {pendingEmailChange ? (
              <p className="mt-2 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] px-3 py-2 text-sm font-semibold leading-6 text-[#7A5D91]">
                Afventer bekræftelse af ny mailadresse: {maskEmail(pendingEmailChange.new_email)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <SecurityEmailForm
          oauthProvider={oauthProvider}
          passwordLoginAvailable={hasPasswordLogin}
          pendingEmail={pendingEmailChange?.new_email ?? null}
          pendingExpiresAt={pendingEmailChange?.expires_at ?? null}
        />
        <SecurityPasswordForm
          oauthProvider={oauthProvider}
          onPasswordCreated={() => setHasPasswordLogin(true)}
          passwordLoginAvailable={hasPasswordLogin}
        />
        <LinkedLoginMethods providers={visibleProviders} />
      </div>
    </section>
  );
}
