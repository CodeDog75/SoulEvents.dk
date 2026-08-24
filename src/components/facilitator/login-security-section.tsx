"use client";

import { ShieldCheck } from "lucide-react";
import { LinkedLoginMethods } from "@/components/facilitator/linked-login-methods";
import { SecurityEmailForm } from "@/components/facilitator/security-email-form";
import { SecurityPasswordForm } from "@/components/facilitator/security-password-form";

type LoginSecuritySectionProps = {
  authProviders: string[];
  currentEmail: string;
  pendingEmailChange?: { expires_at: string; new_email: string; old_email: string } | null;
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
  pendingEmailChange,
}: LoginSecuritySectionProps) {
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
              <span className="font-semibold text-midnight">Loginmail:</span>{" "}
              <span className="font-semibold text-midnight">{currentEmail}</span>
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/64">
              Loginmailen er den e-mailadresse, du bruger til at logge ind på SoulEvents. Din offentlige kontaktmail
              er den e-mailadresse, deltagere kan kontakte dig på, og den behøver ikke være den samme.
            </p>
            {pendingEmailChange ? (
              <div className="mt-3 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] px-3 py-2 text-sm leading-6 text-[#7A5D91]">
                <p className="font-semibold text-midnight">Mailændring afventer begge bekræftelser</p>
                <p>
                  Nuværende loginmail: <span className="font-semibold">{maskEmail(pendingEmailChange.old_email)}</span>
                </p>
                <p>
                  Ny loginmail: <span className="font-semibold">{maskEmail(pendingEmailChange.new_email)}</span>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <SecurityEmailForm
          currentEmail={currentEmail}
          pendingEmail={pendingEmailChange?.new_email ?? null}
          pendingExpiresAt={pendingEmailChange?.expires_at ?? null}
          pendingOldEmail={pendingEmailChange?.old_email ?? null}
        />
        <SecurityPasswordForm />
        <LinkedLoginMethods providers={authProviders} />
      </div>
    </section>
  );
}
